import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { LedgerItemStatus } from '../../../constants/expense';
import { moneyTransformer } from './money.transformer';

@Entity('ledger_items')
export class LedgerItemEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'ledger_id' }) ledgerId!: number;
  @Column() category!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: moneyTransformer }) planned!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: moneyTransformer }) actual!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, transformer: moneyTransformer }) matched!: number;
  @Column({ default: LedgerItemStatus.Open }) status!: string;
  @Column({ name: 'settled_at', type: 'timestamp', nullable: true }) settledAt?: Date | null;
}
