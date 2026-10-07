import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { AdvanceStatus, ReportStatus } from '../../../constants/expense';
import { moneyTransformer } from './money.transformer';

@Entity('advance_orders')
export class AdvanceOrderEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'ledger_id' }) ledgerId!: number;
  @Column({ name: 'member_id' }) memberId!: number;
  @Column({ name: 'member_name' }) memberName!: string;
  @Column() category!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: moneyTransformer }) amount!: number;
  @Column({ name: 'split_members', type: 'simple-json' }) splitMembers!: number[];
  @Column({ default: AdvanceStatus.Reported }) status!: string;
  @Column({ name: 'report_status', default: ReportStatus.Success }) reportStatus!: string;
  @Column({ type: 'int', default: 1 }) version!: number;
  @Column({ default: false }) overwritten!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
