import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SettlementMode } from '../../../constants/expense';
import { moneyTransformer } from './money.transformer';

@Entity('trip_ledgers')
export class TripLedgerEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id', unique: true }) tripId!: number;
  @Column({ name: 'total_budget', type: 'decimal', precision: 12, scale: 2, transformer: moneyTransformer }) totalBudget!: number;
  @Column({ name: 'member_count', type: 'int' }) memberCount!: number;
  @Column({ name: 'settlement_mode', default: SettlementMode.Adjustment }) settlementMode!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
