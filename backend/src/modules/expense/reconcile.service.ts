import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdvanceStatus, EXPENSE_CATEGORIES, LedgerItemStatus, ReportStatus } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { AdvanceOrderEntity } from './entities/advance-order.entity';
import { LedgerItemEntity } from './entities/ledger-item.entity';
import { toCents } from './entities/money.transformer';

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(
    @InjectRepository(LedgerItemEntity) private readonly items: Repository<LedgerItemEntity>,
    @InjectRepository(AdvanceOrderEntity) private readonly orders: Repository<AdvanceOrderEntity>
  ) {}

  async reconcileCategory(ledgerId: number, category: string): Promise<LedgerItemEntity> {
    const item = await this.items.findOneBy({ ledgerId, category });
    if (!item) throw new AppException(ERROR_CODES.LEDGER_NOT_FOUND, `行程账缺少分项 ${category}`, 404);
    if (item.status === LedgerItemStatus.Settled) {
      this.logger.log(`分项 ${category} 已结清，对账跳过不回退`);
      return item;
    }
    const orders = await this.orders.find({
      where: {
        ledgerId,
        category,
        reportStatus: ReportStatus.Success,
        status: In([AdvanceStatus.Reported, AdvanceStatus.Matched, AdvanceStatus.Suspended])
      },
      order: { createdAt: 'ASC', id: 'ASC' }
    });
    const target = toCents(item.actual);
    let cumulative = 0;
    for (const order of orders) {
      const amount = toCents(order.amount);
      if (cumulative + amount <= target) {
        order.status = AdvanceStatus.Matched;
        cumulative += amount;
      } else {
        order.status = AdvanceStatus.Suspended;
      }
    }
    await this.orders.save(orders);
    item.matched = cumulative / 100;
    this.logger.log(`分项 ${category} 对账完成：入帐 ${item.matched}，挂起 ${orders.filter(o => o.status === AdvanceStatus.Suspended).length} 笔`);
    return this.items.save(item);
  }

  async reconcileLedger(ledgerId: number): Promise<void> {
    for (const category of EXPENSE_CATEGORIES) {
      await this.reconcileCategory(ledgerId, category);
    }
  }

  async reconcileView(ledgerId: number) {
    const items = await this.items.find({ where: { ledgerId } });
    const orders = await this.orders.find({ where: { ledgerId }, order: { createdAt: 'ASC', id: 'ASC' } });
    return items.map(item => {
      const inCategory = orders.filter(o => o.category === item.category && o.reportStatus === ReportStatus.Success && o.status !== AdvanceStatus.Cancelled);
      const suspended = inCategory.filter(o => o.status === AdvanceStatus.Suspended);
      const advanceTotal = inCategory.reduce((sum, o) => sum + toCents(o.amount), 0) / 100;
      const diff = (toCents(item.actual) - toCents(item.matched)) / 100;
      let state = 'GAP';
      if (item.status === LedgerItemStatus.Settled) state = 'SETTLED';
      else if (suspended.length > 0) state = 'SUSPENDED';
      else if (diff === 0) state = 'BALANCED';
      return {
        category: item.category,
        planned: item.planned,
        actual: item.actual,
        advanceTotal,
        matched: item.matched,
        suspendedTotal: suspended.reduce((sum, o) => sum + toCents(o.amount), 0) / 100,
        diff,
        state,
        suspendedOrders: suspended
      };
    });
  }
}
