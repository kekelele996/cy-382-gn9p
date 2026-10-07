import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { LegacyStatus, SlipStatus } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { AccountCategoryEntity } from './entities/account-category.entity';
import { ExpenseSlipEntity } from './entities/expense-slip.entity';
import { LegacyExpenseEntity } from './entities/legacy-expense.entity';
import { TripAccountEntity } from './entities/trip-account.entity';
import { TripMemberEntity } from './entities/trip-member.entity';
import { backfillLegacy } from './domain/backfill.logic';
import { ReconcileService } from './reconcile.service';

@Injectable()
export class LegacyService {
  constructor(
    @InjectRepository(LegacyExpenseEntity) private readonly legacy: Repository<LegacyExpenseEntity>,
    @InjectRepository(TripAccountEntity) private readonly accounts: Repository<TripAccountEntity>,
    @InjectRepository(AccountCategoryEntity) private readonly categories: Repository<AccountCategoryEntity>,
    @InjectRepository(TripMemberEntity) private readonly members: Repository<TripMemberEntity>,
    @InjectRepository(ExpenseSlipEntity) private readonly slips: Repository<ExpenseSlipEntity>,
    private readonly reconcile: ReconcileService
  ) {}

  /** 登记一条旧数据（没有分摊人和分项） */
  register(tripId: number, amount: number, payerName?: string) {
    if (!(amount > 0)) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '旧数据金额必须大于 0');
    return this.legacy.save(this.legacy.create({ tripId, amount, payerName, status: LegacyStatus.Pending }));
  }

  list(tripId: number) {
    return this.legacy.find({ where: { tripId }, order: { id: 'ASC' } });
  }

  /**
   * 升级一条旧数据：
   * 分摊人按同行人数补齐，分项按四项计划数占总预算的比例拆分；
   * 补不出的标记 UNRESOLVED 并写明原因，在结算页单列。
   */
  async upgrade(tripId: number, id: number, defaultPayerMemberId?: number) {
    const record = await this.legacy.findOne({ where: { id, tripId } });
    if (!record) throw new AppException(ERROR_CODES.LEGACY_NO_SOLUTION, '旧数据不存在');
    if (record.status === LegacyStatus.Filled) return { record, createdSlipIds: record.filledSlipId ? [record.filledSlipId] : [] };

    const [account, categories, members] = await Promise.all([
      this.accounts.findOne({ where: { tripId } }),
      this.categories.find({ where: { tripId } }),
      this.members.find({ where: { tripId }, order: { id: 'ASC' } })
    ]);

    const result = backfillLegacy({
      amount: record.amount,
      totalBudget: account?.totalBudget ?? 0,
      categories,
      memberIds: members.map(m => m.id)
    });

    if (result.status === LegacyStatus.Unresolved) {
      record.status = LegacyStatus.Unresolved;
      record.reason = result.reason;
      await this.legacy.save(record);
      return { record, createdSlipIds: [] };
    }

    // 垫付人：旧数据若留了名字能对上成员则用该成员，否则取默认人/第一个成员
    const payer =
      members.find(m => m.name === record.payerName) ??
      members.find(m => m.id === defaultPayerMemberId) ??
      members[0];

    const createdSlipIds: number[] = [];
    for (const allocation of result.allocations.filter(a => a.amount !== 0)) {
      const slip = this.slips.create({
        tripId,
        payerMemberId: payer.id,
        category: allocation.category,
        amount: allocation.amount,
        sharerMemberIds: result.sharerMemberIds,
        status: SlipStatus.Reported,
        source: 'MEMBER',
        note: `旧数据升级拆分（原垫付人：${record.payerName ?? '未知'}）`,
        clientKey: `legacy-${record.id}-${allocation.category}-${randomUUID()}`
      });
      await this.slips.save(slip);
      createdSlipIds.push(slip.id);
    }

    record.status = LegacyStatus.Filled;
    record.category = result.allocations[0]?.category ?? null;
    record.filledSharerMemberIds = result.sharerMemberIds;
    record.filledSlipId = createdSlipIds[0] ?? null;
    record.filledAt = new Date();
    await this.legacy.save(record);

    await this.reconcile.applyTrip(tripId);
    return { record, createdSlipIds };
  }
}
