import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ExpenseCategory } from '../../constants/expense';
import { SlipInput, SlipService } from './slip.service';

/** 垫付单：成员各自上报，写清金额（分）、分项、分摊人 */
@Controller('api/trips/:tripId/expense/slips')
export class SlipController {
  constructor(private readonly slips: SlipService) {}

  @Get()
  list(@Param('tripId') tripId: string) {
    return this.slips.listWithPayer(Number(tripId));
  }

  private parse(tripId: string, body: any): SlipInput {
    return {
      tripId: Number(tripId),
      payerMemberId: Number(body.payerMemberId),
      category: body.category as ExpenseCategory,
      amount: Math.round(Number(body.amount)),
      sharerMemberIds: (body.sharerMemberIds ?? []).map(Number),
      note: body.note,
      clientKey: body.clientKey
    };
  }

  @Post()
  report(@Param('tripId') tripId: string, @Body() body: any) {
    return this.slips.report(this.parse(tripId, body));
  }

  /**
   * 批量上报：body.items 为某成员那几条；
   * 上报失败只重跑他那几条（带 retryOf 标明重跑来源），行程账不回滚。
   */
  @Post('batch')
  batch(
    @Param('tripId') tripId: string,
    @Body() body: { items: any[]; retryOf?: number }
  ) {
    return this.slips.batchReport(
      (body.items ?? []).map(item => this.parse(tripId, item)),
      body.retryOf ? Number(body.retryOf) : undefined
    );
  }

  @Put(':id')
  update(
    @Param('tripId') tripId: string,
    @Param('id') id: string,
    @Body() body: { amount?: number; category?: ExpenseCategory; sharerMemberIds?: number[]; note?: string }
  ) {
    return this.slips.update(Number(id), Number(tripId), {
      ...body,
      amount: body.amount === undefined ? undefined : Math.round(Number(body.amount)),
      sharerMemberIds: body.sharerMemberIds?.map(Number)
    });
  }

  /** 撤单 */
  @Post(':id/withdraw')
  withdraw(@Param('tripId') tripId: string, @Param('id') id: string) {
    return this.slips.withdraw(Number(id), Number(tripId));
  }
}
