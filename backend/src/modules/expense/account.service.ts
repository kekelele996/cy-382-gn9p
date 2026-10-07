import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AccountStatus, EXPENSE_CATEGORIES, ExpenseCategory } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { AccountCategoryEntity } from './entities/account-category.entity';
import { TripAccountEntity } from './entities/trip-account.entity';
import { ReconcileService } from './reconcile.service';

export interface AccountSetupInput {
  tripId: number;
  ownerId: number;
  totalBudget: number; // 分
  planned: Record<string, number>; // 分项 -> 分
}

@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(TripAccountEntity) private readonly accounts: Repository<TripAccountEntity>,
    @InjectRepository(AccountCategoryEntity) private readonly categories: Repository<AccountCategoryEntity>,
    private readonly reconcile: ReconcileService,
    private readonly dataSource: DataSource
  ) {}

  /** 发起人定总预算和四项计划数；四项计划数之和应当等于总预算 */
  async setup(input: AccountSetupInput) {
    const plannedSum = EXPENSE_CATEGORIES.reduce((sum, cat) => sum + (input.planned[cat] ?? 0), 0);
    if (input.totalBudget < 0 || plannedSum !== input.totalBudget) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '四项计划数之和必须等于总预算');
    }
    await this.dataSource.transaction(async manager => {
      const existing = await manager.findOne(TripAccountEntity, { where: { tripId: input.tripId } });
      const account = existing ?? manager.create(TripAccountEntity, { tripId: input.tripId, ownerId: input.ownerId });
      account.totalBudget = input.totalBudget;
      await manager.save(account);

      const existingCategories = await manager.find(AccountCategoryEntity, { where: { tripId: input.tripId } });
      for (const cat of EXPENSE_CATEGORIES) {
        const row = existingCategories.find(c => c.category === cat) ??
          manager.create(AccountCategoryEntity, { tripId: input.tripId, category: cat, actualAmount: 0, status: AccountStatus.Pending });
        // 已结清分项的计划数冻结
        if (row.status === AccountStatus.Settled) continue;
        row.planned = input.planned[cat] ?? 0;
        await manager.save(row);
      }
    });
    await this.reconcile.applyTrip(input.tripId);
    return this.reconcile.getOverview(input.tripId);
  }

  /**
   * 登记某分项的实际花费（行程账口径）。
   * 已结清分项冻结，拒绝改动。
   */
  async setActual(tripId: number, category: ExpenseCategory, actualAmount: number) {
    if (!EXPENSE_CATEGORIES.includes(category)) {
      throw new AppException(ERROR_CODES.CATEGORY_INVALID, `未知分项：${category}`);
    }
    if (actualAmount < 0) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '实际花费不能为负');
    const row = await this.categories.findOne({ where: { tripId, category } });
    if (!row) throw new AppException(ERROR_CODES.ACCOUNT_NOT_FOUND, '请先创建行程账并设定四项计划数');
    if (row.status === AccountStatus.Settled) {
      throw new AppException(ERROR_CODES.CATEGORY_LOCKED, '该分项已结清，实际花费不能回退修改');
    }
    row.actualAmount = actualAmount;
    await this.categories.save(row);
    await this.reconcile.applyTrip(tripId);
    return this.reconcile.getOverview(tripId);
  }
}
