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
import { PaymentMethod, PaymentStatus } from '../finance.enums';
import { PaymentAllocation } from './payment-allocation.entity';

@Entity('player_payments')
export class PlayerPayment {
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

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: PaymentMethod.TRANSFER,
  })
  method: PaymentMethod;

  @Column({
    type: 'varchar',
    length: 30,
    default: PaymentStatus.CONFIRMED,
  })
  status: PaymentStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'recorded_by', nullable: true })
  recordedBy?: number;

  @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
  confirmedAt?: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ name: 'pending_fee_charge_ids', type: 'simple-json', nullable: true })
  pendingFeeChargeIds?: number[];

  @OneToMany(() => PaymentAllocation, (allocation) => allocation.payment)
  allocations: PaymentAllocation[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
