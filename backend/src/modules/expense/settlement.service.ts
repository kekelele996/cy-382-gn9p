import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvanceStatus, LedgerItemStatus, SettlementMode } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { AdjustmentOrderEntity } from './entities/adjustment-order.entity';
import { AdvanceOrderEntity } from './entities/advance-order.entity';
import { LedgerItemEntity } from './entities/ledger-item.entity';
import { TripLedgerEntity } from './entities/trip-ledger.entity';
import { toCents } from './entities/money.transformer';
import { UpdateAdvanceInput } from './dto/expense.dto';
import { ReconcileService } from './reconcile.service';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    @InjectRepository(TripLedgerEntity) private readonly ledgers: Repository<TripLedgerEntity>,
    @InjectRepository(LedgerItemEntity) private readonly items: Repository<LedgerItemEntity>,
    @InjectRepository(AdvanceOrderEntity) private readonly orders: Repository<AdvanceOrderEntity>,
    @InjectRepository(AdjustmentOrderEntity) private readonly adjustments: Repository<AdjustmentOrderEntity>,
    private readonly reconcile: ReconcileService
  ) {}

  async settleCategory(ledgerId: number, category: string) {
    const item = await this.reconcile.reconcileCategory(ledgerId, category);
    if (item.status === LedgerItemStatus.Settled) {
      throw new AppException(ERROR_CODES.CATEGORY_SETTLED, '分项已结清，请勿重复结算');
    }
    const suspended = await this.orders.countBy({ ledgerId, category, status: AdvanceStatus.Suspended });
    if (suspended > 0 || toCents(item.matched) !== toCents(item.actual)) {
      throw new AppException(ERROR_CODES.RECONCILE_UNBALANCED, '分项未对平：存在挂起垫付单或差额，不能结清');
    }
    item.status = LedgerItemStatus.Settled;
    item.settledAt = new Date();
    await this.items.save(item);
    const matched = await this.orders.findBy({ ledgerId, category, status: AdvanceStatus.Matched });
    for (const order of matched) order.status = AdvanceStatus.Settled;
    await this.orders.save(matched);
    this.logger.log(`行程账 ${ledgerId} 分项 ${category} 结清，入帐 ${item.matched}`);
    return item;
  }

  async applyPostSettlementChange(order: AdvanceOrderEntity, change: UpdateAdvanceInput | null) {
    const ledger = await this.ledgers.findOneBy({ id: order.ledgerId });
    if (!ledger) throw new AppException(ERROR_CODES.LEDGER_NOT_FOUND, '行程账不存在', 404);
    if (ledger.settlementMode === SettlementMode.Overwrite) {
      return this.overwriteOrder(order, change);
    }
    return this.appendAdjustment(order, change);
  }

  private async appendAdjustment(order: AdvanceOrderEntity, change: UpdateAdvanceInput | null) {
    const delta = change?.amount !== undefined ? toCents(change.amount) - toCents(order.amount) : -toCents(order.amount);
    const reason = change === null ? '成员撤单，已结清分项另开调整单' : '成员改金额，已结清分项另开调整单';
    const adjustment = await this.adjustments.save(this.adjustments.create({
      ledgerId: order.ledgerId,
      advanceOrderId: order.id,
      category: order.category,
      deltaAmount: delta / 100,
      reason
    }));
    this.logger.log(`垫付单 ${order.id} 保留原凭证，调整单 ${adjustment.id} 差额 ${adjustment.deltaAmount}`);
    return { order, adjustment };
  }

  private async overwriteOrder(order: AdvanceOrderEntity, change: UpdateAdvanceInput | null) {
    if (change === null) {
      order.status = AdvanceStatus.Cancelled;
    } else {
      if (change.amount !== undefined) order.amount = change.amount;
      if (change.splitMembers !== undefined) order.splitMembers = change.splitMembers;
    }
    order.version += 1;
    order.overwritten = true;
    const saved = await this.orders.save(order);
    this.logger.log(`垫付单 ${order.id} 覆盖旧单，版本 ${saved.version}`);
    return { order: saved, adjustment: null };
  }

  async settlementView(ledgerId: number) {
    const ledger = await this.ledgers.findOneBy({ id: ledgerId });
    if (!ledger) throw new AppException(ERROR_CODES.LEDGER_NOT_FOUND, '行程账不存在', 404);
    const items = await this.items.find({ where: { ledgerId } });
    const orders = await this.orders.find({ where: { ledgerId }, order: { id: 'ASC' } });
    const adjustments = await this.adjustments.find({ where: { ledgerId }, order: { id: 'ASC' } });
    const categories = items.map(item => {
      const inCategory = orders.filter(o => o.category === item.category);
      if (ledger.settlementMode === SettlementMode.Overwrite) {
        return {
          category: item.category,
          status: item.status,
          settledAt: item.settledAt,
          vouchers: inCategory.filter(o => o.status !== AdvanceStatus.Cancelled).map(o => ({
            orderId: o.id,
            memberName: o.memberName,
            amount: o.amount,
            version: o.version,
            overwritten: o.overwritten,
            status: o.status
          })),
          adjustments: []
        };
      }
      return {
        category: item.category,
        status: item.status,
        settledAt: item.settledAt,
        vouchers: inCategory.filter(o => o.status === AdvanceStatus.Settled).map(o => ({
          orderId: o.id,
          memberName: o.memberName,
          amount: o.amount,
          version: o.version,
          overwritten: false,
          status: o.status
        })),
        adjustments: adjustments
          .filter(a => a.category === item.category)
          .map(a => ({ adjustmentId: a.id, advanceOrderId: a.advanceOrderId, deltaAmount: a.deltaAmount, reason: a.reason, createdAt: a.createdAt }))
      };
    });
    return { mode: ledger.settlementMode, categories };
  }
}
