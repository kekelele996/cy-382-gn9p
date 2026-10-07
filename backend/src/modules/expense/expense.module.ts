import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdjustmentOrderEntity } from './entities/adjustment-order.entity';
import { AdvanceOrderEntity } from './entities/advance-order.entity';
import { LedgerItemEntity } from './entities/ledger-item.entity';
import { LegacyExpenseEntity } from './entities/legacy-expense.entity';
import { TripLedgerEntity } from './entities/trip-ledger.entity';
import { AdvanceService } from './advance.service';
import { ExpenseController } from './expense.controller';
import { LedgerService } from './ledger.service';
import { MigrationService } from './migration.service';
import { ReconcileService } from './reconcile.service';
import { SettlementService } from './settlement.service';

@Module({
  imports: [TypeOrmModule.forFeature([TripLedgerEntity, LedgerItemEntity, AdvanceOrderEntity, AdjustmentOrderEntity, LegacyExpenseEntity])],
  controllers: [ExpenseController],
  providers: [LedgerService, AdvanceService, ReconcileService, SettlementService, MigrationService]
})
export class ExpenseModule {}
