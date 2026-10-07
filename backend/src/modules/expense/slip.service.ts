import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AccountStatus, EXPENSE_CATEGORIES, ExpenseCategory, SlipStatus } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { AccountCategoryEntity } from './entities/account-category.entity';
import { ExpenseSlipEntity } from './entities/expense-slip.entity';
import { TripMemberEntity } from './entities/trip-member.entity';
import { MemberService } from './member.service';
import { ReconcileService } from './reconcile.service';

export interface SlipInput {
  tripId: number;
  payerMemberId: number;
  category: ExpenseCategory;
  amount: number; // 分
  sharerMemberIds: number[];
  note?: string;
  /** 幂等键；不传则自动生成 */
  clientKey?: string;
}

@Injectable()
export class SlipService {
  constructor(
    @InjectRepository(ExpenseSlipEntity) private readonly slips: Repository<ExpenseSlipEntity>,
    @InjectRepository(AccountCategoryEntity) private readonly categories: Repository<AccountCategoryEntity>,
    private readonly members: MemberService,
    private readonly reconcile: ReconcileService,
    private readonly dataSource: DataSource
  ) {}

  private validate(input: SlipInput) {
    if (!EXPENSE_CATEGORIES.includes(input.category)) {
      throw new AppException(ERROR_CODES.CATEGORY_INVALID, `未知分项：${input.category}`);
    }
    if (!(input.amount > 0)) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '垫付金额必须大于 0');
  }

  /** 成员上报垫付单；clientKey 保证失败重跑不重复 */
  async report(input: SlipInput, retryOf?: number): Promise<ExpenseSlipEntity> {
    this.validate(input);
    const clientKey = input.clientKey?.trim() || randomUUID();
    return this.dataSource.transaction(async manager => {
      const existing = await manager.findOne(ExpenseSlipEntity, { where: { clientKey } });
      if (existing) {
        // 同一条上报重放：原样返回，不产生第二条
        if (existing.tripId === input.tripId && existing.payerMemberId === input.payerMemberId && existing.amount === input.amount && existing.category === input.category) {
          return existing;
        }
        throw new AppException(ERROR_CODES.DUPLICATE_CLIENT_KEY, '幂等键已被其他垫付单占用', HttpStatus.CONFLICT);
      }
      await this.guardSettled(manager, input.tripId, input.category);
      await this.members.requireOne(input.tripId, input.payerMemberId);
      await this.members.requireByIds(input.tripId, input.sharerMemberIds);

      const slip = manager.create(ExpenseSlipEntity, {
        tripId: input.tripId,
        payerMemberId: input.payerMemberId,
        category: input.category,
        amount: input.amount,
        sharerMemberIds: [...new Set(input.sharerMemberIds)],
        note: input.note,
        clientKey,
        retryOf: retryOf ?? null,
        status: SlipStatus.Reported,
        source: 'MEMBER'
      });
      return manager.save(slip);
    }).then(async slip => {
      await this.reconcile.applyTrip(input.tripId);
      return this.slips.findOneByOrFail({ id: slip.id });
    });
  }

  /**
   * 批量上报：成员上报失败只重跑他那几条，行程账照旧。
   * 每条独立校验、独立事务，单条失败不影响其他条，也不触碰行程账。
   */
  async batchReport(items: SlipInput[], retryOf?: number) {
    const accepted: ExpenseSlipEntity[] = [];
    const failed: Array<{ index: number; clientKey?: string; code: string; message: string }> = [];
    for (let index = 0; index < items.length; index++) {
      try {
        const slip = await this.report(items[index], retryOf);
        accepted.push(slip);
      } catch (e) {
        failed.push({
          index,
          clientKey: items[index].clientKey,
          code: e instanceof AppException ? e.code : ERROR_CODES.INTERNAL_ERROR,
          message: e instanceof Error ? e.message : '上报失败'
        });
      }
    }
    return { accepted, failed, retryScope: retryOf ? `仅重跑成员单 #${retryOf} 相关条目` : undefined };
  }

  private async guardSettled(manager: EntityManager, tripId: number, category: string) {
    const row = await manager.findOne(AccountCategoryEntity, { where: { tripId, category } });
    if (row?.status === AccountStatus.Settled) {
      throw new AppException(ERROR_CODES.CATEGORY_LOCKED, '该分项已结清，不能再上报新的垫付单');
    }
  }

  /** 改金额：已结清分项的单子冻结，不能跟着回退；未结清的按新数重算 */
  async update(id: number, tripId: number, patch: { amount?: number; category?: ExpenseCategory; sharerMemberIds?: number[]; note?: string }) {
    const slip = await this.requireOwned(id, tripId);
    if (slip.status === SlipStatus.Settled) {
      throw new AppException(ERROR_CODES.CATEGORY_LOCKED, '垫付单所在分项已结清，金额不能回退修改');
    }
    if (patch.category !== undefined && !EXPENSE_CATEGORIES.includes(patch.category)) {
      throw new AppException(ERROR_CODES.CATEGORY_INVALID, `未知分项：${patch.category}`);
    }
    const targetCategory = patch.category ?? (slip.category as ExpenseCategory);
    const categoryRow = await this.categories.findOne({ where: { tripId, category: targetCategory } });
    if (categoryRow?.status === AccountStatus.Settled) {
      throw new AppException(ERROR_CODES.CATEGORY_LOCKED, '目标分项已结清，不能把垫付单转入');
    }
    if (patch.amount !== undefined) {
      if (!(patch.amount > 0)) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '垫付金额必须大于 0');
      slip.amount = patch.amount;
    }
    if (patch.category !== undefined) slip.category = patch.category;
    if (patch.sharerMemberIds !== undefined) {
      await this.members.requireByIds(tripId, patch.sharerMemberIds);
      slip.sharerMemberIds = [...new Set(patch.sharerMemberIds)];
    }
    if (patch.note !== undefined) slip.note = patch.note;
    await this.slips.save(slip);
    await this.reconcile.applyTrip(tripId);
    return this.requireOwned(id, tripId);
  }

  /** 撤单：已结清的不能撤；撤掉后该分项按剩余单重算 */
  async withdraw(id: number, tripId: number) {
    const slip = await this.requireOwned(id, tripId);
    if (slip.status === SlipStatus.Settled) {
      throw new AppException(ERROR_CODES.CATEGORY_LOCKED, '垫付单所在分项已结清，不能撤单');
    }
    slip.status = SlipStatus.Withdrawn;
    await this.slips.save(slip);
    await this.reconcile.applyTrip(tripId);
    return this.requireOwned(id, tripId);
  }

  async requireOwned(id: number, tripId: number): Promise<ExpenseSlipEntity> {
    const slip = await this.slips.findOne({ where: { id, tripId } });
    if (!slip) throw new AppException(ERROR_CODES.SLIP_NOT_FOUND, '垫付单不存在或不属于该行程');
    return slip;
  }

  /** 列表带上垫付人姓名，结算页展示用 */
  async listWithPayer(tripId: number) {
    const slips = await this.slips.find({ where: { tripId }, order: { id: 'ASC' } });
    const members = await this.dataSource.getRepository(TripMemberEntity).find({ where: { tripId } });
    const nameById = new Map(members.map(m => [m.id, m.name]));
    return slips.map(s => ({ ...s, payerName: nameById.get(s.payerMemberId) ?? `成员#${s.payerMemberId}` }));
  }
}
