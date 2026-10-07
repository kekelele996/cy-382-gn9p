import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SettleMode } from '../../../constants/expense';
import { decimalTransformer } from './decimal.transformer';

/** 结算记录：记录每次结清用的方式（保留凭证开调整单 / 覆盖旧单） */
@Entity('expense_settlements')
export class ExpenseSettlementEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ length: 20 }) category!: string;
  @Column({ name: 'account_category_id' }) accountCategoryId!: number;
  @Column({ length: 20 }) mode!: SettleMode;
  /** 结清金额（= 该分项实际花费），单位：分 */
  @Column({ name: 'final_amount', type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  finalAmount!: number;
  /** 结算前垫付合计，单位：分 */
  @Column({ name: 'before_amount', type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  beforeAmount!: number;
  /** 差额 finalAmount - beforeAmount，单位：分 */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  difference!: number;
  /** ADJUST 时的调整单 id；OVERWRITE 时的新覆盖单 id */
  @Column({ name: 'new_slip_id' }) newSlipId!: number;
  /** OVERWRITE 时被替代的旧单 id，JSON 数组 */
  @Column({ name: 'covered_slip_ids', type: 'simple-json', nullable: true }) coveredSlipIds?: number[] | null;
  @Column({ length: 200, nullable: true }) note?: string;
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
}
