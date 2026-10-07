import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AccountStatus } from '../../../constants/expense';
import { decimalTransformer } from './decimal.transformer';

/** 行程账分项：四项计划数、实际花费、对账状态 */
@Entity('account_categories')
@Index(['tripId', 'category'], { unique: true })
export class AccountCategoryEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ length: 20 }) category!: string;
  /** 计划数，单位：分 */
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer }) planned!: number;
  /** 行程账上该分项的实际花费（发起人登记），单位：分 */
  @Column({ name: 'actual_amount', type: 'decimal', precision: 12, scale: 2, default: 0, transformer: decimalTransformer })
  actualAmount!: number;
  @Column({ length: 20, default: AccountStatus.Pending }) status!: AccountStatus;
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }) updatedAt!: Date;
}
