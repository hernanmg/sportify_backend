import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Team } from 'src/teams/entities/teams.entity';
import { User } from 'src/users/entities/user.entity';
import { LedgerEntryType, LedgerCategory } from '../finance.enums';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({
    type: 'varchar',
    length: 10,
  })
  type: LedgerEntryType;

  @Column({
    type: 'varchar',
    length: 30,
    default: LedgerCategory.OTHER,
  })
  category: LedgerCategory;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'reference_type', type: 'varchar', length: 50, nullable: true })
  referenceType?: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId?: number;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
