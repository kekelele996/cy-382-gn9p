import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { MigrationStatus } from '../../../constants/expense';
import { moneyTransformer } from './money.transformer';

@Entity('legacy_expenses')
export class LegacyExpenseEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ name: 'trip_id' }) tripId!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, transformer: moneyTransformer }) amount!: number;
  @Column({ nullable: true }) note?: string;
  @Column({ name: 'migration_status', default: MigrationStatus.Pending }) migrationStatus!: string;
  @Column({ name: 'migrated_category', nullable: true }) migratedCategory?: string | null;
  @Column({ name: 'fail_reason', nullable: true }) failReason?: string | null;
}
