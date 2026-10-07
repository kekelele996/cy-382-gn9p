import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AccountStatus, ACTIVE_SLIP_STATUSES, ExpenseCategory, SettleMode, SlipStatus } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { AccountCategoryEntity } from './entities/account-category.entity';
import { ExpenseSettlementEntity } from './entities/expense-settlement.entity';
import { ExpenseSlipEntity } from './entities/expense-slip.entity';
import { MemberService } from './member.service';
import { ReconcileService } from './reconcile.service';
import { sumSlips } from './domain/reconcile.logic';

export interface SettleInput {
  tripId: number;
  category: ExpenseCategory;
  mode: SettleMode;
  /** 差额补单人（ADJUST）/ 新覆盖单垫付人（OVERWRITE） */
  payerMemberId: number;
  /** 新单分摊人；不传则取旧单分摊人的并集 */
  sharerMemberIds?: number[];
  note?: string;
}

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(AccountCategoryEntity) private readonly categories: Repository<AccountCategoryEntity>,
    @InjectRepository(ExpenseSlipEntity) private readonly slips: Repository<ExpenseSlipEntity>,
    @InjectRepository(ExpenseSettlementEntity) private readonly settlements: Repository<ExpenseSettlementEntity>,
    private readonly members: MemberService,
    private readonly reconcile: ReconcileService,
    private readonly dataSource: DataSource
  ) {}

  /**
   * 结清一个分项。挂起（对不上）的分项必须通过结算处理：
   * - ADJUST：保留原凭证，另开一张差额调整单，结算页能看到原单+调整单；
   * - OVERWRITE：新开一张合计单覆盖旧单，旧单标记 SUPERSEDED，结算页只看到新单。
   */
  async settle(input: SettleInput) {
    if (input.mode !== SettleMode.Adjust && input.mode !== SettleMode.Overwrite) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '结算方式必须是 ADJUST 或 OVERWRITE');
    }
    return this.dataSource.transaction(async manager => {
      const category = await manager.findOne(AccountCategoryEntity, { where: { tripId: input.tripId, category: input.category } });
      if (!category) throw new AppException(ERROR_CODES.ACCOUNT_NOT_FOUND, '请先创建行程账并设定四项计划数');
      if (category.status === AccountStatus.Settled) {
        throw new AppException(ERROR_CODES.CATEGORY_LOCKED, '该分项已结清，不能重复结算');
      }
      if (category.actualAmount <= 0) {
        throw new AppException(ERROR_CODES.SETTLE_NOT_ALLOWED, '行程账还没有该分项的实际花费，不能结算');
      }

      const allSlips = await manager.find(ExpenseSlipEntity, { where: { tripId: input.tripId, category: input.category } });
      const activeSlips = allSlips.filter(s => (ACTIVE_SLIP_STATUSES as readonly SlipStatus[]).includes(s.status));
      const beforeAmount = sumSlips(activeSlips);
      const difference = category.actualAmount - beforeAmount;

      await this.members.requireOne(input.tripId, input.payerMemberId);
      const unionSharers = [...new Set(activeSlips.flatMap(s => s.sharerMemberIds))];
      const sharerMemberIds = input.sharerMemberIds?.length
        ? [...new Set(input.sharerMemberIds)]
        : unionSharers;
      if (!sharerMemberIds.length) {
        throw new AppException(ERROR_CODES.SHARER_INVALID, '结算新单必须指定分摊人');
      }
      await this.members.requireByIds(input.tripId, sharerMemberIds);

      let newSlipId: number;
      let coveredSlipIds: number[] | null = null;

      if (input.mode === SettleMode.Adjust) {
        // 原凭证全部保留；仅在对不上时开一张差额调整单（负数表示原垫付已超出实际花费）
        if (difference !== 0) {
          const adjustment = manager.create(ExpenseSlipEntity, {
            tripId: input.tripId,
            payerMemberId: input.payerMemberId,
            category: input.category,
            amount: difference,
            sharerMemberIds,
            status: SlipStatus.Settled,
            source: 'ADJUST',
            note: input.note ?? '结算差额调整单（原凭证保留）',
            clientKey: `adj-${randomUUID()}`
          });
          await manager.save(adjustment);
          newSlipId = adjustment.id;
        } else {
          // 相符直接结清，没有调整单：用 0 占位会违反金额正数约束，记为 -1 表示无新单
          newSlipId = 0;
        }
        for (const slip of activeSlips) {
          slip.status = SlipStatus.Settled;
          await manager.save(slip);
        }
      } else {
        // 覆盖式：旧单全部置为 SUPERSEDED，新开一张合计单并记录被它替代的旧单
        const newSlip = manager.create(ExpenseSlipEntity, {
          tripId: input.tripId,
          payerMemberId: input.payerMemberId,
          category: input.category,
          amount: category.actualAmount,
          sharerMemberIds,
          status: SlipStatus.Settled,
          source: 'OVERWRITE',
          supersededSlipIds: activeSlips.map(s => s.id),
          note: input.note ?? '结算覆盖单（旧单已作废保留）',
          clientKey: `ovw-${randomUUID()}`
        });
        await manager.save(newSlip);
        newSlipId = newSlip.id;
        coveredSlipIds = activeSlips.map(s => s.id);
        for (const slip of activeSlips) {
          slip.status = SlipStatus.Superseded;
          await manager.save(slip);
        }
      }

      category.status = AccountStatus.Settled;
      await manager.save(category);

      const settlement = manager.create(ExpenseSettlementEntity, {
        tripId: input.tripId,
        category: input.category,
        accountCategoryId: category.id,
        mode: input.mode,
        finalAmount: category.actualAmount,
        beforeAmount,
        difference,
        newSlipId,
        coveredSlipIds,
        note: input.note
      });
      await manager.save(settlement);

      if (newSlipId > 0) {
        const createdSlip = await manager.findOneByOrFail(ExpenseSlipEntity, { id: newSlipId });
        createdSlip.settlementId = settlement.id;
        await manager.save(createdSlip);
      }
      return settlement;
    }).then(async settlement => {
      await this.reconcile.applyTrip(input.tripId);
      return this.detail(settlement.id);
    });
  }

  /** 结算记录明细，结算页按两种模式区分展示 */
  async detail(id: number) {
    const settlement = await this.settlements.findOneByOrFail({ id });
    const slips = await this.slips.find({ where: { tripId: settlement.tripId, category: settlement.category } });
    return {
      ...settlement,
      display: settlement.mode === SettleMode.Adjust
        ? {
            mode: SettleMode.Adjust,
            label: '保留凭证 + 调整单',
            originalSlips: slips.filter(s => s.source === 'MEMBER' && s.status === SlipStatus.Settled),
            adjustmentSlip: settlement.newSlipId ? slips.find(s => s.id === settlement.newSlipId) ?? null : null
          }
        : {
            mode: SettleMode.Overwrite,
            label: '覆盖旧单',
            activeSlip: slips.find(s => s.id === settlement.newSlipId) ?? null,
            supersededSlips: slips.filter(s => (settlement.coveredSlipIds ?? []).includes(s.id))
          }
    };
  }

  list(tripId: number) {
    return this.settlements.find({ where: { tripId }, order: { id: 'ASC' } });
  }
}
