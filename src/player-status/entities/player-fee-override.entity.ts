import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Team } from '../../teams/entities/teams.entity';
import { User } from '../../users/entities/user.entity';

@Entity('player_fee_overrides')
export class PlayerFeeOverride {
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

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'overridden_by' })
  overriddenBy: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'overridden_by' })
  overrider: User;

  @Column({ name: 'overridden_at', type: 'timestamp' })
  overriddenAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
