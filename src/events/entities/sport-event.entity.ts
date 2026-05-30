import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Team } from '../../teams/entities/teams.entity';
import { User } from '../../users/entities/user.entity';
import { EventParticipant } from './event-participant.entity';

export enum SportEventType {
  TRAINING = 'training',
  MATCH = 'match',
  SOCIAL = 'social',
  MEETING = 'meeting',
}

export enum SportEventStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed',
}

@Entity('sport_events')
export class SportEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: SportEventType,
    default: SportEventType.TRAINING,
  })
  type: SportEventType;

  @Column({
    type: 'enum',
    enum: SportEventStatus,
    default: SportEventStatus.SCHEDULED,
  })
  status: SportEventStatus;

  @Column({ name: 'event_date', type: 'timestamp' })
  eventDate: Date;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes?: number;

  @Column({ type: 'varchar', length: 300, nullable: true })
  location?: string;

  @Column({ name: 'court_number', type: 'varchar', length: 20, nullable: true })
  courtNumber?: string;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'created_by' })
  createdBy: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  // Para partidos
  @Column({ name: 'opponent_name', type: 'varchar', length: 100, nullable: true })
  opponentName?: string;

  @Column({ name: 'is_home_match', type: 'boolean', default: true })
  isHomeMatch: boolean;

  @Column({ name: 'is_official_match', type: 'boolean', default: false })
  isOfficialMatch: boolean;

  // Para eventos sociales
  @Column({ name: 'has_expenses', type: 'boolean', default: false })
  hasExpenses: boolean;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedCost?: number;

  // Configuración de participación
  @Column({ name: 'max_participants', type: 'int', nullable: true })
  maxParticipants?: number;

  @Column({ name: 'requires_confirmation', type: 'boolean', default: true })
  requiresConfirmation: boolean;

  @Column({ name: 'confirmation_deadline', type: 'timestamp', nullable: true })
  confirmationDeadline?: Date;

  // Para partidos oficiales - solo jugadores con cuotas al día
  @Column({ name: 'requires_payment_up_to_date', type: 'boolean', default: false })
  requiresPaymentUpToDate: boolean;

  // Notas adicionales
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: any; // Para datos específicos del tipo de evento

  // Control de recordatorios automáticos
  @Column({ name: 'reminder_sent', type: 'boolean', default: false })
  reminderSent: boolean;

  @Column({ name: 'post_match_voting_closed', type: 'boolean', default: false })
  postMatchVotingClosed: boolean;

  @Column({ name: 'player_of_match_user_id', type: 'int', nullable: true })
  playerOfMatchUserId?: number;

  @Column({ name: 'team_score', type: 'int', nullable: true })
  teamScore?: number;

  @Column({ name: 'opponent_score', type: 'int', nullable: true })
  opponentScore?: number;

  @Column({ name: 'post_match_report', type: 'text', nullable: true })
  postMatchReport?: string;

  @Column({
    name: 'post_match_report_updated_by',
    type: 'int',
    nullable: true,
  })
  postMatchReportUpdatedBy?: number;

  @Column({
    name: 'post_match_report_updated_at',
    type: 'timestamp',
    nullable: true,
  })
  postMatchReportUpdatedAt?: Date;

  @OneToMany(() => EventParticipant, participant => participant.event)
  participants: EventParticipant[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Getters computados
  get participantCount(): number {
    return this.participants?.length || 0;
  }

  get confirmedCount(): number {
    return this.participants?.filter(p => p.status === 'confirmed').length || 0;
  }

  get pendingCount(): number {
    return this.participants?.filter(p => p.status === 'pending').length || 0;
  }
}
