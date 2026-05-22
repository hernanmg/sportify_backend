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

@Entity('match_official_ratings')
@Unique(['sportEventId', 'ratedUserId'])
export class MatchOfficialRating {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sport_event_id' })
  sportEventId: number;

  @ManyToOne(() => SportEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sport_event_id' })
  sportEvent: SportEvent;

  @Column({ name: 'rated_user_id' })
  ratedUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rated_user_id' })
  rated: User;

  @Column({ type: 'smallint' })
  score: number;

  @Column({ name: 'set_by_user_id' })
  setByUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'set_by_user_id' })
  setBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
