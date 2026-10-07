import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AccountStatus, SlipStatus } from '../../constants/expense';
import { AccountCategoryEntity } from './entities/account-category.entity';
import { ExpenseSlipEntity } from './entities/expense-slip.entity';
import { TripAccountEntity } from './entities/trip-account.entity';
import { calcSpent, reconcile, CategorySummary } from './domain/reconcile.logic';

/**
 * 对账编排：成员每次上报/改单/撤单后重算整个行程。
 * 已结清（SETTLED）分项在纯逻辑里直接冻结，不会被这里回退。
 */
@Injectable()
export class ReconcileService {
  constructor(
    @InjectRepository(TripAccountEntity) private readonly accounts: Repository<TripAccountEntity>,
    @InjectRepository(AccountCategoryEntity) private readonly categories: Repository<AccountCategoryEntity>,
    @InjectRepository(ExpenseSlipEntity) private readonly slips: Repository<ExpenseSlipEntity>,
    private readonly dataSource: DataSource
  ) {}

  /** 重算并持久化一个行程的所有分项状态及单子挂起标记，返回新的分项汇总 */
  async applyTrip(tripId: number): Promise<CategorySummary[]> {
    return this.dataSource.transaction(async manager => {
      const categoryEntities = await manager.find(AccountCategoryEntity, { where: { tripId } });
      const slipEntities = await manager.find(ExpenseSlipEntity, { where: { tripId } });
      const summaries = reconcile(categoryEntities, slipEntities);
      const summaryByCategory = new Map(summaries.map(s => [s.category, s]));

      // 未结清分项的状态与每张未冻结单的挂起标记，全部按新数重算
      for (const category of categoryEntities) {
        if (category.status === AccountStatus.Settled) continue;
        const summary = summaryByCategory.get(category.category);
        if (!summary) continue;
        if (category.status !== summary.status) category.status = summary.status;
      }
      await manager.save(categoryEntities);

      for (const slip of slipEntities) {
        if (slip.status === SlipStatus.Settled || slip.status === SlipStatus.Superseded || slip.status === SlipStatus.Withdrawn) continue;
        const summary = summaryByCategory.get(slip.category);
        const target = summary?.status === AccountStatus.Suspended ? SlipStatus.Suspended : SlipStatus.Reported;
        if (slip.status !== target) {
          slip.status = target;
          await manager.save(slip);
        }
      }
      return summaries;
    });
  }

  /** 行程账概览：计划数、实际花费、垫付合计、对账状态、已花与剩余预算 */
  async getOverview(tripId: number) {
    const account = await this.accounts.findOne({ where: { tripId } });
    const categoryEntities = await this.categories.find({ where: { tripId } });
    const slipEntities = await this.slips.find({ where: { tripId } });
    const summaries = reconcile(categoryEntities, slipEntities);
    const spent = calcSpent(summaries);
    const suspended = summaries.filter(s => s.status === AccountStatus.Suspended);
    return {
      tripId,
      totalBudget: account?.totalBudget ?? 0,
      spent,
      remaining: (account?.totalBudget ?? 0) - spent,
      categories: summaries,
      suspendedCategories: suspended.map(s => s.category),
      accountInitialized: Boolean(account)
    };
  }
}
