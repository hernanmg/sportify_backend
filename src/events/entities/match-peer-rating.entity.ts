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

@Entity('match_peer_ratings')
@Unique(['sportEventId', 'raterUserId', 'ratedUserId'])
export class MatchPeerRating {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sport_event_id' })
  sportEventId: number;

  @ManyToOne(() => SportEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sport_event_id' })
  sportEvent: SportEvent;

  @Column({ name: 'rater_user_id' })
  raterUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rater_user_id' })
  rater: User;

  @Column({ name: 'rated_user_id' })
  ratedUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rated_user_id' })
  rated: User;

  @Column({ type: 'smallint' })
  score: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
