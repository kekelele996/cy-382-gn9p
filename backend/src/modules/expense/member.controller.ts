import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MemberRole } from '../../constants/expense';
import { MemberService } from './member.service';

/** 同行成员：垫付人 / 分摊人来源 */
@Controller('api/trips/:tripId/expense/members')
export class MemberController {
  constructor(private readonly members: MemberService) {}

  @Get()
  list(@Param('tripId') tripId: string) {
    return this.members.list(Number(tripId));
  }

  @Post()
  add(
    @Param('tripId') tripId: string,
    @Body() body: { name: string; userId?: number | null; role?: MemberRole }
  ) {
    return this.members.add(Number(tripId), body.name, body.userId ?? null, body.role);
  }
}
