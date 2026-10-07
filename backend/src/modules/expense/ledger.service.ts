import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EXPENSE_CATEGORIES, LedgerItemStatus, SettlementMode } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { LedgerItemEntity } from './entities/ledger-item.entity';
import { TripLedgerEntity } from './entities/trip-ledger.entity';
import { toCents } from './entities/money.transformer';
import { CreateLedgerInput, RecordActualInput } from './dto/expense.dto';
import { ReconcileService } from './reconcile.service';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectRepository(TripLedgerEntity) private readonly ledgers: Repository<TripLedgerEntity>,
    @InjectRepository(LedgerItemEntity) private readonly items: Repository<LedgerItemEntity>,
    private readonly reconcile: ReconcileService
  ) {}

  async create(input: CreateLedgerInput) {
    if (!input.tripId || !input.memberCount || input.memberCount < 1) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '行程与人数必填');
    }
    if (!input.totalBudget || input.totalBudget <= 0) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '总预算必须大于 0');
    }
    const mode = input.settlementMode ?? SettlementMode.Adjustment;
    if (!Object.values(SettlementMode).includes(mode as SettlementMode)) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '结算模式只支持 ADJUSTMENT 或 OVERWRITE');
    }
    const plans = input.plans ?? [];
    const categories = plans.map(p => p.category).sort();
    if (plans.length !== EXPENSE_CATEGORIES.length || categories.join(',') !== [...EXPENSE_CATEGORIES].sort().join(',')) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '必须包含交通/住宿/餐饮/门票四项计划数');
    }
    if (plans.some(p => !(p.planned >= 0))) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '计划数不能为负');
    }
    const plannedTotal = plans.reduce((sum, p) => sum + toCents(p.planned), 0);
    if (plannedTotal > toCents(input.totalBudget)) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '四项计划数合计不能超过总预算');
    }
    const exists = await this.ledgers.findOneBy({ tripId: input.tripId });
    if (exists) throw new AppException(ERROR_CODES.LEDGER_EXISTS, '该行程已存在行程账');
    const ledger = await this.ledgers.save(this.ledgers.create({
      tripId: input.tripId,
      totalBudget: input.totalBudget,
      memberCount: input.memberCount,
      settlementMode: mode
    }));
    await this.items.save(plans.map(p => this.items.create({ ledgerId: ledger.id, category: p.category, planned: p.planned })));
    this.logger.log(`行程 ${input.tripId} 创建行程账 ${ledger.id}，总预算 ${input.totalBudget}`);
    return this.overview(input.tripId);
  }

  async getByTrip(tripId: number): Promise<TripLedgerEntity> {
    const ledger = await this.ledgers.findOneBy({ tripId });
    if (!ledger) throw new AppException(ERROR_CODES.LEDGER_NOT_FOUND, '行程账不存在，请先创建', 404);
    return ledger;
  }

  async overview(tripId: number) {
    const ledger = await this.getByTrip(tripId);
    const items = await this.items.find({ where: { ledgerId: ledger.id } });
    return {
      ...ledger,
      items: items.map(item => ({
        ...item,
        remaining: (toCents(item.planned) - toCents(item.matched)) / 100
      }))
    };
  }

  async recordActual(tripId: number, input: RecordActualInput) {
    const ledger = await this.getByTrip(tripId);
    const item = await this.items.findOneBy({ ledgerId: ledger.id, category: input.category });
    if (!item) throw new AppException(ERROR_CODES.VALIDATION_FAILED, `分项 ${input.category} 不存在`);
    if (item.status === LedgerItemStatus.Settled) {
      throw new AppException(ERROR_CODES.CATEGORY_SETTLED, '分项已结清，实际花费不能回退');
    }
    if (!(input.actual >= 0)) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '实际花费不能为负');
    item.actual = input.actual;
    await this.items.save(item);
    await this.reconcile.reconcileCategory(ledger.id, input.category);
    return this.overview(tripId);
  }

  async updateMode(tripId: number, mode: string) {
    if (!Object.values(SettlementMode).includes(mode as SettlementMode)) {
      throw new AppException(ERROR_CODES.VALIDATION_FAILED, '结算模式只支持 ADJUSTMENT 或 OVERWRITE');
    }
    const ledger = await this.getByTrip(tripId);
    ledger.settlementMode = mode;
    await this.ledgers.save(ledger);
    this.logger.log(`行程账 ${ledger.id} 结算模式切换为 ${mode}`);
    return this.overview(tripId);
  }
}
