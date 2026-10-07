import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LegacyService } from './legacy.service';

/** 旧数据升级：没记分摊人和分项的旧垫付（金额单位：分），按人数和总预算补齐，补不出的单列 */
@Controller('api/trips/:tripId/expense/legacy')
export class LegacyController {
  constructor(private readonly legacy: LegacyService) {}

  @Get()
  list(@Param('tripId') tripId: string) {
    return this.legacy.list(Number(tripId));
  }

  /** 登记一条旧数据 */
  @Post()
  register(
    @Param('tripId') tripId: string,
    @Body() body: { amount: number; payerName?: string }
  ) {
    return this.legacy.register(Number(tripId), Math.round(Number(body.amount)), body.payerName);
  }

  /** 执行升级补齐，可指定补出单子的默认垫付人 */
  @Post(':id/upgrade')
  upgrade(
    @Param('tripId') tripId: string,
    @Param('id') id: string,
    @Body() body: { defaultPayerMemberId?: number }
  ) {
    return this.legacy.upgrade(
      Number(tripId),
      Number(id),
      body.defaultPayerMemberId ? Number(body.defaultPayerMemberId) : undefined
    );
  }
}
