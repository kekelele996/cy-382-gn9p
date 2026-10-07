import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { moneyTransformer } from './money.transformer';

@Entity('adjustment_orders')
export class AdjustmentOrderEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'ledger_id' }) ledgerId!: number;
  @Column({ name: 'advance_order_id' }) advanceOrderId!: number;
  @Column() category!: string;
  @Column({ name: 'delta_amount', type: 'decimal', precision: 12, scale: 2, transformer: moneyTransformer }) deltaAmount!: number;
  @Column() reason!: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
