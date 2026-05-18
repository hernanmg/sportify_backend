import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Team } from './teams.entity';
import { User } from '../../users/entities/user.entity';

@Entity('team_invites')
export class TeamInvite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'varchar', length: 12, unique: true })
  code: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  /** IDs de categoría sugeridas al unirse (JSON array). */
  @Column({ name: 'category_ids', type: 'jsonb', nullable: true })
  categoryIds?: number[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
