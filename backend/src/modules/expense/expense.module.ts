import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountCategoryEntity } from './entities/account-category.entity';
import { ExpenseSettlementEntity } from './entities/expense-settlement.entity';
import { ExpenseSlipEntity } from './entities/expense-slip.entity';
import { LegacyExpenseEntity } from './entities/legacy-expense.entity';
import { TripAccountEntity } from './entities/trip-account.entity';
import { TripMemberEntity } from './entities/trip-member.entity';
import { AccountController } from './account.controller';
import { LegacyController } from './legacy.controller';
import { MemberController } from './member.controller';
import { SettlementController } from './settlement.controller';
import { SlipController } from './slip.controller';
import { AccountService } from './account.service';
import { LegacyService } from './legacy.service';
import { MemberService } from './member.service';
import { ReconcileService } from './reconcile.service';
import { SettlementService } from './settlement.service';
import { SlipService } from './slip.service';

const ENTITIES = [
  TripAccountEntity,
  AccountCategoryEntity,
  TripMemberEntity,
  ExpenseSlipEntity,
  ExpenseSettlementEntity,
  LegacyExpenseEntity
];

@Module({
  imports: [TypeOrmModule.forFeature(ENTITIES)],
  controllers: [AccountController, MemberController, SlipController, SettlementController, LegacyController],
  providers: [AccountService, MemberService, ReconcileService, SlipService, SettlementService, LegacyService],
  exports: [ReconcileService]
})
export class ExpenseModule {}
