import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdvanceStatus, EXPENSE_CATEGORIES, LedgerItemStatus, ReportStatus } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { AdvanceOrderEntity } from './entities/advance-order.entity';
import { LedgerItemEntity } from './entities/ledger-item.entity';
import { TripLedgerEntity } from './entities/trip-ledger.entity';
import { CreateAdvanceInput, UpdateAdvanceInput } from './dto/expense.dto';
import { ReconcileService } from './reconcile.service';
import { SettlementService } from './settlement.service';

@Injectable()
export class AdvanceService {
  private readonly logger = new Logger(AdvanceService.name);

  constructor(
    @InjectRepository(TripLedgerEntity) private readonly ledgers: Repository<TripLedgerEntity>,
    @InjectRepository(LedgerItemEntity) private readonly items: Repository<LedgerItemEntity>,
    @InjectRepository(AdvanceOrderEntity) private readonly orders: Repository<AdvanceOrderEntity>,
    private readonly reconcile: ReconcileService,
    private readonly settlement: SettlementService
  ) {}

  async create(ledgerId: number, input: CreateAdvanceInput) {
    const ledger = await this.ledgers.findOneBy({ id: ledgerId });
    if (!ledger) throw new AppException(ERROR_CODES.LEDGER_NOT_FOUND, '行程账不存在', 404);
    if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '分项必须是交通/住宿/餐饮/门票之一');
    }
    if (!(input.amount > 0)) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '垫付金额必须大于 0');
    if (!input.memberId || !input.memberName) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '垫付成员必填');
    if (!Array.isArray(input.splitMembers) || input.splitMembers.length === 0) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '分摊人不能为空');
    }
    const reportStatus = input.failReport ? ReportStatus.Failed : ReportStatus.Success;
    const order = await this.orders.save(this.orders.create({
      ledgerId,
      memberId: input.memberId,
      memberName: input.memberName,
      category: input.category,
      amount: input.amount,
      splitMembers: input.splitMembers,
      reportStatus
    }));
    if (reportStatus === ReportStatus.Failed) {
      this.logger.warn(`成员 ${input.memberId} 垫付单 ${order.id} 上报失败，等待重跑`);
      return order;
    }
    await this.reconcile.reconcileCategory(ledgerId, input.category);
    return this.orders.findOneBy({ id: order.id });
  }

  list(ledgerId: number) {
    return this.orders.find({ where: { ledgerId }, order: { id: 'ASC' } });
  }

  async update(orderId: number, input: UpdateAdvanceInput) {
    const order = await this.mustGet(orderId);
    if (order.status === AdvanceStatus.Cancelled) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '垫付单已撤销，不能修改');
    }
    if (input.amount !== undefined && !(input.amount > 0)) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '垫付金额必须大于 0');
    }
    if (input.splitMembers !== undefined && (!Array.isArray(input.splitMembers) || input.splitMembers.length === 0)) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '分摊人不能为空');
    }
    const item = await this.items.findOneBy({ ledgerId: order.ledgerId, category: order.category });
    if (item?.status === LedgerItemStatus.Settled) {
      this.logger.log(`垫付单 ${orderId} 所在分项已结清，按结算模式处理不回退`);
      return this.settlement.applyPostSettlementChange(order, input);
    }
    if (input.amount !== undefined) order.amount = input.amount;
    if (input.splitMembers !== undefined) order.splitMembers = input.splitMembers;
    order.version += 1;
    const saved = await this.orders.save(order);
    if (saved.reportStatus === ReportStatus.Success) {
      await this.reconcile.reconcileCategory(saved.ledgerId, saved.category);
    }
    return { order: await this.orders.findOneBy({ id: saved.id }), adjustment: null };
  }

  async cancel(orderId: number) {
    const order = await this.mustGet(orderId);
    if (order.status === AdvanceStatus.Cancelled) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '垫付单已撤销');
    }
    const item = await this.items.findOneBy({ ledgerId: order.ledgerId, category: order.category });
    if (item?.status === LedgerItemStatus.Settled) {
      this.logger.log(`垫付单 ${orderId} 所在分项已结清，撤单按结算模式处理不回退`);
      return this.settlement.applyPostSettlementChange(order, null);
    }
    order.status = AdvanceStatus.Cancelled;
    await this.orders.save(order);
    if (order.reportStatus === ReportStatus.Success) {
      await this.reconcile.reconcileCategory(order.ledgerId, order.category);
    }
    return { order, adjustment: null };
  }

  async retryFailed(ledgerId: number, memberId: number) {
    const failed = await this.orders.findBy({ ledgerId, memberId, reportStatus: ReportStatus.Failed });
    if (failed.length === 0) return { reran: 0, categories: [] };
    const categories = [...new Set(failed.map(o => o.category))];
    for (const order of failed) {
      order.reportStatus = ReportStatus.Success;
    }
    await this.orders.save(failed);
    for (const category of categories) {
      await this.reconcile.reconcileCategory(ledgerId, category);
    }
    this.logger.log(`成员 ${memberId} 重跑 ${failed.length} 条失败上报，行程账其余数据照旧`);
    return { reran: failed.length, categories };
  }

  private async mustGet(orderId: number): Promise<AdvanceOrderEntity> {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new AppException(ERROR_CODES.ADVANCE_NOT_FOUND, '垫付单不存在', 404);
    return order;
  }
}
