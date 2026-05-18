import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Team } from '../../teams/entities/teams.entity';
import { User } from '../../users/entities/user.entity';

@Entity('convocation_templates')
export class ConvocationTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'default_participant_user_ids', type: 'jsonb', nullable: true })
  defaultParticipantUserIds?: number[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
