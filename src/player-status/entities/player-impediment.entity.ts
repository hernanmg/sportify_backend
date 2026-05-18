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
import { ImpedimentType } from '../eligibility.enums';

@Entity('player_impediments')
export class PlayerImpediment {
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

  @Column({ name: 'impediment_type', type: 'varchar', length: 20 })
  impedimentType: ImpedimentType;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'duration_days', type: 'int', nullable: true })
  durationDays?: number;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
