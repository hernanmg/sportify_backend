import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Team } from './teams.entity';

export enum TeamMemberRole {
  ADMIN = 'admin',
  PLAYER = 'player',
}

@Entity('team_members')
@Unique(['userId', 'teamId'])
export class TeamMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'varchar', length: 20, default: TeamMemberRole.PLAYER })
  role: TeamMemberRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
