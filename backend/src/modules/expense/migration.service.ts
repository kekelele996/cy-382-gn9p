import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EXPENSE_CATEGORIES, MIGRATION_MEMBER_NAME, MigrationStatus } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { AdvanceOrderEntity } from './entities/advance-order.entity';
import { LedgerItemEntity } from './entities/ledger-item.entity';
import { LegacyExpenseEntity } from './entities/legacy-expense.entity';
import { TripLedgerEntity } from './entities/trip-ledger.entity';
import { toCents } from './entities/money.transformer';
import { ReconcileService } from './reconcile.service';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectRepository(TripLedgerEntity) private readonly ledgers: Repository<TripLedgerEntity>,
    @InjectRepository(LedgerItemEntity) private readonly items: Repository<LedgerItemEntity>,
    @InjectRepository(AdvanceOrderEntity) private readonly orders: Repository<AdvanceOrderEntity>,
    @InjectRepository(LegacyExpenseEntity) private readonly legacy: Repository<LegacyExpenseEntity>,
    private readonly reconcile: ReconcileService
  ) {}

  async migrate(tripId: number) {
    const ledger = await this.ledgers.findOneBy({ tripId });
    if (!ledger) throw new AppException(ERROR_CODES.LEDGER_NOT_FOUND, '请先创建行程账再升级旧数据', 404);
    const items = await this.items.find({ where: { ledgerId: ledger.id } });
    const remaining = new Map<string, number>();
    for (const category of EXPENSE_CATEGORIES) {
      const item = items.find(i => i.category === category);
      remaining.set(category, toCents(item?.planned ?? 0) - toCents(item?.matched ?? 0));
    }
    const pending = await this.legacy.find({ where: { tripId, migrationStatus: MigrationStatus.Pending }, order: { id: 'ASC' } });
    const splitMembers = Array.from({ length: ledger.memberCount }, (_, i) => i + 1);
    const touched = new Set<string>();
    let migrated = 0;
    let unfillable = 0;
    for (const expense of pending) {
      const amount = toCents(expense.amount);
      const category = EXPENSE_CATEGORIES
        .filter(c => (remaining.get(c) ?? 0) >= amount)
        .sort((a, b) => (remaining.get(b) ?? 0) - (remaining.get(a) ?? 0))[0];
      if (!category) {
        expense.migrationStatus = MigrationStatus.Unfillable;
        expense.failReason = '按人数和总预算补不出分摊人与分项，单列待人工处理';
        unfillable += 1;
      } else {
        await this.orders.save(this.orders.create({
          ledgerId: ledger.id,
          memberId: 0,
          memberName: MIGRATION_MEMBER_NAME,
          category,
          amount: expense.amount,
          splitMembers
        }));
        remaining.set(category, (remaining.get(category) ?? 0) - amount);
        expense.migrationStatus = MigrationStatus.Migrated;
        expense.migratedCategory = category;
        touched.add(category);
        migrated += 1;
      }
      await this.legacy.save(expense);
    }
    for (const category of touched) {
      await this.reconcile.reconcileCategory(ledger.id, category);
    }
    this.logger.log(`行程 ${tripId} 旧数据升级：补齐 ${migrated} 条，单列 ${unfillable} 条`);
    return { migrated, unfillable, pending: pending.length };
  }

  async migrationView(tripId: number) {
    const all = await this.legacy.find({ where: { tripId }, order: { id: 'ASC' } });
    return {
      pending: all.filter(e => e.migrationStatus === MigrationStatus.Pending),
      migrated: all.filter(e => e.migrationStatus === MigrationStatus.Migrated),
      unfillable: all.filter(e => e.migrationStatus === MigrationStatus.Unfillable)
    };
  }
}
