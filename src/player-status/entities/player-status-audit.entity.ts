import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Team } from '../../teams/entities/teams.entity';
import { User } from '../../users/entities/user.entity';

@Entity('player_status_audit_log')
export class PlayerStatusAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown>;

  @Column({ name: 'performed_by' })
  performedBy: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'performed_by' })
  performer: User;

  @CreateDateColumn({ name: 'performed_at' })
  performedAt: Date;
}
