import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { SportEvent } from './sport-event.entity';
import { User } from '../../users/entities/user.entity';

export enum ParticipantStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined',
  NO_RESPONSE = 'no_response',
}

export enum ParticipantRole {
  PLAYER = 'player',
  SUBSTITUTE = 'substitute',
  COACH = 'coach',
  STAFF = 'staff',
}

@Entity('event_participants')
@Unique(['eventId', 'userId']) // Un usuario solo puede participar una vez por evento
export class EventParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'event_id' })
  eventId: number;

  @ManyToOne(() => SportEvent, event => event.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: SportEvent;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: ParticipantStatus,
    default: ParticipantStatus.PENDING,
  })
  status: ParticipantStatus;

  @Column({
    type: 'enum',
    enum: ParticipantRole,
    default: ParticipantRole.PLAYER,
  })
  role: ParticipantRole;

  @Column({ name: 'response_date', type: 'timestamp', nullable: true })
  responseDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  // Para eventos con gastos
  @Column({ name: 'expense_share', type: 'decimal', precision: 10, scale: 2, nullable: true })
  expenseShare?: number;

  @Column({ name: 'has_paid_expenses', type: 'boolean', default: false })
  hasPaidExpenses: boolean;

  // Para partidos - posición en la que jugará
  @Column({ name: 'playing_position', type: 'varchar', length: 50, nullable: true })
  playingPosition?: string;

  // Para control de asistencia
  @Column({ name: 'attended', type: 'boolean', nullable: true })
  attended?: boolean;

  /** present | absent | justified */
  @Column({ name: 'attendance_status', type: 'varchar', length: 20, nullable: true })
  attendanceStatus?: string;

  /** Si false, no entra en el reparto de gastos del evento social */
  @Column({ name: 'included_in_expense_split', type: 'boolean', default: true })
  includedInExpenseSplit: boolean;

  @Column({ name: 'attendance_notes', type: 'text', nullable: true })
  attendanceNotes?: string;

  @Column({ name: 'is_convoked', type: 'boolean', default: true })
  isConvoked: boolean;

  @Column({ name: 'is_starter', type: 'boolean', default: false })
  isStarter: boolean;

  @Column({ name: 'eligibility_status', type: 'varchar', length: 30, nullable: true })
  eligibilityStatus?: string;

  @Column({ name: 'eligibility_detail', type: 'text', nullable: true })
  eligibilityDetail?: string;

  @Column({ name: 'fee_override_by', type: 'int', nullable: true })
  feeOverrideBy?: number;

  @Column({ name: 'fee_override_at', type: 'timestamp', nullable: true })
  feeOverrideAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
