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

@Entity('match_player_stats')
@Unique(['sportEventId', 'userId'])
export class MatchPlayerStats {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sport_event_id' })
  sportEventId: number;

  @ManyToOne(() => SportEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sport_event_id' })
  sportEvent: SportEvent;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', default: 0 })
  goals: number;

  @Column({ type: 'int', default: 0 })
  assists: number;

  @Column({ name: 'yellow_cards', type: 'int', default: 0 })
  yellowCards: number;

  @Column({ name: 'red_cards', type: 'int', default: 0 })
  redCards: number;

  @Column({ name: 'minutes_played', type: 'int', nullable: true })
  minutesPlayed?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
