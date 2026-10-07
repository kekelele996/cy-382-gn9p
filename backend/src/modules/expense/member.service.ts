import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberRole } from '../../constants/expense';
import { ERROR_CODES } from '../../constants/errors';
import { AppException } from '../../common/errors/app.exception';
import { TripMemberEntity } from './entities/trip-member.entity';

@Injectable()
export class MemberService {
  constructor(@InjectRepository(TripMemberEntity) private readonly members: Repository<TripMemberEntity>) {}

  async add(tripId: number, name: string, userId?: number | null, role: MemberRole = MemberRole.Member) {
    if (!name?.trim()) throw new AppException(ERROR_CODES.VALIDATION_FAILED, '成员名称必填');
    const member = this.members.create({ tripId, name: name.trim(), userId: userId ?? null, role });
    return this.members.save(member);
  }

  list(tripId: number) {
    return this.members.find({ where: { tripId }, order: { id: 'ASC' } });
  }

  async requireByIds(tripId: number, ids: number[]): Promise<TripMemberEntity[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) throw new AppException(ERROR_CODES.SHARER_INVALID, '分摊人不能为空');
    const members = await this.members.findByIds(unique);
    const allInTrip = members.length === unique.length && members.every(m => m.tripId === tripId);
    if (!allInTrip) throw new AppException(ERROR_CODES.SHARER_INVALID, '分摊人必须是该行程的同行成员');
    return members;
  }

  async requireOne(tripId: number, id: number): Promise<TripMemberEntity> {
    const member = await this.members.findOne({ where: { id, tripId } });
    if (!member) throw new AppException(ERROR_CODES.MEMBER_NOT_FOUND, '垫付成员不属于该行程');
    return member;
  }
}
