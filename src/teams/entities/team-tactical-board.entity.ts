import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Team } from './teams.entity';
import { User } from '../../users/entities/user.entity';

export interface BoardStrokePoint {
  x: number;
  y: number;
}

export interface BoardStroke {
  points: BoardStrokePoint[];
  color?: string;
  width?: number;
}

@Entity('team_tactical_boards')
export class TeamTacticalBoard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  formation: string | null;

  @Column({ name: 'lineup_slots', type: 'jsonb', default: {} })
  lineupSlots: Record<string, { x: number; y: number }>;

  @Column({ name: 'board_strokes', type: 'jsonb', default: [] })
  boardStrokes: BoardStroke[];

  @Column({ name: 'created_by_user_id' })
  createdByUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @Column({ name: 'share_token', type: 'uuid', nullable: true, unique: true })
  shareToken: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
