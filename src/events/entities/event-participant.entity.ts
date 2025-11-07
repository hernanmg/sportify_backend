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

  @Column({ name: 'attendance_notes', type: 'text', nullable: true })
  attendanceNotes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
