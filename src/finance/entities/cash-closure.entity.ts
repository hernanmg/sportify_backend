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

@Entity('cash_closures')
export class CashClosure {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'varchar', length: 30, nullable: true })
  season?: string;

  @Column({ name: 'closed_at', type: 'timestamptz', default: () => 'NOW()' })
  closedAt: Date;

  @Column({ name: 'closed_by', nullable: true })
  closedBy?: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closer?: User;

  @Column({
    name: 'previous_cash_balance',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  previousCashBalance: number;

  @Column({
    name: 'outstanding_carried',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  outstandingCarried: number;

  @Column({ name: 'carry_pending_quotas', type: 'boolean', default: true })
  carryPendingQuotas: boolean;

  @Column({ name: 'reset_cash_to_zero', type: 'boolean', default: true })
  resetCashToZero: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
