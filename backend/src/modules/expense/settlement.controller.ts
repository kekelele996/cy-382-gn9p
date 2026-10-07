import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ExpenseCategory, SettleMode } from '../../constants/expense';
import { SettleInput, SettlementService } from './settlement.service';

/** 结算：保留凭证开调整单（ADJUST）或覆盖旧单（OVERWRITE），结算页按模式区分展示 */
@Controller('api/trips/:tripId/expense/settlements')
export class SettlementController {
  constructor(private readonly settlements: SettlementService) {}

  @Get()
  list(@Param('tripId') tripId: string) {
    return this.settlements.list(Number(tripId));
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.settlements.detail(Number(id));
  }

  @Post()
  settle(@Param('tripId') tripId: string, @Body() body: Omit<SettleInput, 'tripId'>) {
    return this.settlements.settle({
      tripId: Number(tripId),
      category: body.category as ExpenseCategory,
      mode: body.mode as SettleMode,
      payerMemberId: Number(body.payerMemberId),
      sharerMemberIds: body.sharerMemberIds?.map(Number),
      note: body.note
    });
  }
}
