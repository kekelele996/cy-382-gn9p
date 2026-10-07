import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { MemberRole } from '../../../constants/expense';

/** 行程同行成员：既是垫付人来源，也是分摊人候选 */
@Entity('trip_members')
@Index(['tripId', 'userId'], { unique: true })
export class TripMemberEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  /** 可空：上报失败的游客或未注册成员也允许挂名 */
  @Column({ name: 'user_id', type: 'bigint', nullable: true }) userId?: number | null;
  @Column({ length: 80 }) name!: string;
  @Column({ length: 20, default: MemberRole.Member }) role!: MemberRole;
  @Column({ name: 'joined_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) joinedAt!: Date;
}
