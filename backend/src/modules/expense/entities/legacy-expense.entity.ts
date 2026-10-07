import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { LegacyStatus } from '../../../constants/expense';
import { decimalTransformer } from './decimal.transformer';

/** 旧版垫付数据：没记分摊人和分项，升级时按人数和总预算补齐，补不出的单列 */
@Entity('legacy_expenses')
export class LegacyExpenseEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Index(['tripId'])
  @Column({ name: 'trip_id' }) tripId!: number;
  /** 旧数据只有一个金额，单位：分 */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer }) amount!: number;
  @Column({ name: 'payer_name', length: 80, nullable: true }) payerName?: string;
  /** 升级后写入的分项；PENDING/UNRESOLVED 时为空 */
  @Column({ type: 'varchar', length: 20, nullable: true }) category?: string | null;
  /** 升级后写入的分摊人成员 id，JSON 数组 */
  @Column({ name: 'filled_sharer_member_ids', type: 'simple-json', nullable: true }) filledSharerMemberIds?: number[] | null;
  /** 升级后生成的垫付单 id */
  @Column({ name: 'filled_slip_id', type: 'bigint', nullable: true }) filledSlipId?: number | null;
  @Column({ length: 20, default: LegacyStatus.Pending }) status!: LegacyStatus;
  /** 补不出的原因，结算页单列展示 */
  @Column({ length: 200, nullable: true }) reason?: string;
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
  @Column({ name: 'filled_at', type: 'datetime', nullable: true }) filledAt?: Date | null;
}
