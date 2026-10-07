import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from './decimal.transformer';

/** 行程账：行程发起人定的总预算（四项计划数落在 account_categories） */
@Entity('trip_accounts')
export class TripAccountEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Index({ unique: true })
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ name: 'owner_id' }) ownerId!: number;
  /** 总预算，单位：分 */
  @Column({ name: 'total_budget', type: 'decimal', precision: 12, scale: 2, transformer: decimalTransformer })
  totalBudget!: number;
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' }) createdAt!: Date;
  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }) updatedAt!: Date;
}
