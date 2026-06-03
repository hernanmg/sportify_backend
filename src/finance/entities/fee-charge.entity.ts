import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Team } from 'src/teams/entities/teams.entity';
import { User } from 'src/users/entities/user.entity';
import { FeeChargeType, FeeChargeStatus } from '../finance.enums';
import { PaymentAllocation } from './payment-allocation.entity';
import { SportEvent } from '../../events/entities/sport-event.entity';

@Entity('fee_charges')
export class FeeCharge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    length: 30,
    default: FeeChargeType.MONTHLY_QUOTA,
  })
  type: FeeChargeType;

  @Column({ type: 'varchar', length: 150 })
  concept: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: FeeChargeStatus.PENDING,
  })
  status: FeeChargeStatus;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate?: Date;

  @Column({ type: 'varchar', length: 20, nullable: true })
  season?: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ name: 'sport_event_id', type: 'int', nullable: true })
  sportEventId?: number;

  @ManyToOne(() => SportEvent, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sport_event_id' })
  sportEvent?: SportEvent;

  @OneToMany(() => PaymentAllocation, (allocation) => allocation.feeCharge)
  allocations: PaymentAllocation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
