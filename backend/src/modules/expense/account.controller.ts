import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ExpenseCategory } from '../../constants/expense';
import { AccountService } from './account.service';
import { ReconcileService } from './reconcile.service';

/**
 * 行程账：总预算、四项计划数、分项实际花费、对账概览。
 * 金额一律为「分」整数（元请在前端 ×100 后传入）。
 */
@Controller('api/trips/:tripId/expense')
export class AccountController {
  constructor(private readonly accounts: AccountService, private readonly reconcile: ReconcileService) {}

  @Get('overview')
  overview(@Param('tripId') tripId: string) {
    return this.reconcile.getOverview(Number(tripId));
  }

  /** 发起人定总预算和四项计划数 */
  @Post('account')
  setup(
    @Param('tripId') tripId: string,
    @Body() body: { ownerId?: number; totalBudget: number; planned: Record<string, number> }
  ) {
    const planned: Record<string, number> = {};
    for (const [cat, cents] of Object.entries(body.planned ?? {})) planned[cat] = Math.round(Number(cents));
    return this.accounts.setup({
      tripId: Number(tripId),
      ownerId: body.ownerId ? Number(body.ownerId) : 0,
      totalBudget: Math.round(Number(body.totalBudget)),
      planned
    });
  }

  /** 登记某分项在行程账上的实际花费 */
  @Put('categories/:category/actual')
  setActual(
    @Param('tripId') tripId: string,
    @Param('category') category: ExpenseCategory,
    @Body() body: { actualAmount: number }
  ) {
    return this.accounts.setActual(Number(tripId), category, Math.round(Number(body.actualAmount)));
  }
}
