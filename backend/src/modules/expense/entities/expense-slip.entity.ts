import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { SlipStatus } from '../../../constants/expense';
import { decimalTransformer } from './decimal.transformer';

/**
 * 垫付单：成员上报，写清垫付金额、分项和分摊人。
 * source 区分成员上报单与系统生成的调整/覆盖单。
 */
@Entity('expense_slips')
export class ExpenseSlipEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'payer_member_id' }) payerMemberId!: number;
  @Column({ length: 20 }) category!: string;
  /** 垫付金额，单位：分 */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer }) amount!: number;
  /** 分摊人成员 id 列表，JSON 数组 */
  @Column({ name: 'sharer_member_ids', type: 'simple-json' }) sharerMemberIds!: number[];
  @Column({ length: 20, default: SlipStatus.Reported }) status!: SlipStatus;
  /** MEMBER / ADJUST / OVERWRITE */
  @Column({ length: 20, default: 'MEMBER' }) source!: string;
  /** 调整单关联的结算单 id（仅 source != MEMBER 时） */
  @Column({ name: 'settlement_id', type: 'bigint', nullable: true }) settlementId?: number | null;
  /** 覆盖单所替代的旧单 id 列表，JSON 数组（仅 OVERWRITE 时） */
  @Column({ name: 'superseded_slip_ids', type: 'simple-json', nullable: true }) supersededSlipIds?: number[] | null;
  @Column({ length: 200, nullable: true }) note?: string;
  /** 上报幂等键：同一成员同一 key 只认一条，失败重跑不重复 */
  @Index({ unique: true })
  @Column({ name: 'client_key', length: 80 }) clientKey!: string;
  @Column({ name: 'retry_of', type: 'bigint', nullable: true }) retryOf?: number | null;
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }) updatedAt!: Date;
}
