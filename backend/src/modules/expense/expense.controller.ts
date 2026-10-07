import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AdvanceService } from './advance.service';
import { LedgerService } from './ledger.service';
import { MigrationService } from './migration.service';
import { ReconcileService } from './reconcile.service';
import { SettlementService } from './settlement.service';
import { CreateAdvanceInput, CreateLedgerInput, RecordActualInput, RetryReportInput, SettleCategoryInput, UpdateAdvanceInput, UpdateModeInput } from './dto/expense.dto';

@Controller('api')
export class ExpenseController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly advance: AdvanceService,
    private readonly reconcile: ReconcileService,
    private readonly settlement: SettlementService,
    private readonly migration: MigrationService
  ) {}

  @Post('ledgers') createLedger(@Body() body: CreateLedgerInput) { return this.ledger.create(body); }
  @Get('ledgers/:tripId') overview(@Param('tripId') tripId: string) { return this.ledger.overview(Number(tripId)); }
  @Patch('ledgers/:tripId/actual') recordActual(@Param('tripId') tripId: string, @Body() body: RecordActualInput) { return this.ledger.recordActual(Number(tripId), body); }
  @Patch('ledgers/:tripId/mode') updateMode(@Param('tripId') tripId: string, @Body() body: UpdateModeInput) { return this.ledger.updateMode(Number(tripId), body.mode); }

  @Get('ledgers/:tripId/advances') listAdvances(@Param('tripId') tripId: string) { return this.advance.list(Number(tripId)); }
  @Post('ledgers/:tripId/advances') createAdvance(@Param('tripId') tripId: string, @Body() body: CreateAdvanceInput) { return this.advance.create(Number(tripId), body); }
  @Patch('advances/:id') updateAdvance(@Param('id') id: string, @Body() body: UpdateAdvanceInput) { return this.advance.update(Number(id), body); }
  @Delete('advances/:id') cancelAdvance(@Param('id') id: string) { return this.advance.cancel(Number(id)); }
  @Post('ledgers/:tripId/retry') retryFailed(@Param('tripId') tripId: string, @Body() body: RetryReportInput) { return this.advance.retryFailed(Number(tripId), Number(body.memberId)); }

  @Get('ledgers/:tripId/reconcile') reconcileView(@Param('tripId') tripId: string) { return this.reconcile.reconcileView(Number(tripId)); }
  @Post('ledgers/:tripId/settle') settle(@Param('tripId') tripId: string, @Body() body: SettleCategoryInput) { return this.settlement.settleCategory(Number(tripId), body.category); }
  @Get('ledgers/:tripId/settlement') settlementView(@Param('tripId') tripId: string) { return this.settlement.settlementView(Number(tripId)); }

  @Post('ledgers/:tripId/migrate') migrate(@Param('tripId') tripId: string) { return this.migration.migrate(Number(tripId)); }
  @Get('ledgers/:tripId/migration') migrationView(@Param('tripId') tripId: string) { return this.migration.migrationView(Number(tripId)); }
}
