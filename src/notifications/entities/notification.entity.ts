import { User } from 'src/users/entities/user.entity';
import { Team } from 'src/teams/entities/teams.entity';
import { Event } from 'src/events/entities/event.entity';
import { SportEvent } from 'src/events/entities/sport-event.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum NotificationType {
  MATCH_INVITATION = 'match_invitation',
  TRAINING_REMINDER = 'training_reminder',
  PAYMENT_REMINDER = 'payment_reminder',
  SOCIAL_EVENT = 'social_event',
  MEDICAL_EXPIRY = 'medical_expiry',
  GENERAL = 'general',
  ROSTER_UPDATE = 'roster_update',
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => Team, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'team_id' })
  team?: Team;

  @Column({ name: 'team_id', nullable: true })
  teamId?: number;

  @ManyToOne(() => Event, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'event_id' })
  event?: Event;

  @Column({ name: 'event_id', nullable: true })
  eventId?: number;

  @ManyToOne(() => SportEvent, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sport_event_id' })
  sportEvent?: SportEvent;

  @Column({ name: 'sport_event_id', nullable: true })
  sportEventId?: number;

  @Column({ 
    type: 'enum', 
    enum: NotificationType, 
    default: NotificationType.GENERAL 
  })
  type: NotificationType;

  @Column({ 
    type: 'enum', 
    enum: NotificationPriority, 
    default: NotificationPriority.MEDIUM 
  })
  priority: NotificationPriority;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'json', nullable: true })
  data?: any; // Datos adicionales específicos del tipo de notificación

  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  scheduledFor?: Date; // Para notificaciones programadas

  @Column({ type: 'boolean', default: false })
  sent: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
