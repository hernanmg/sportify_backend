import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Team } from '../../teams/entities/teams.entity';
import { User } from '../../users/entities/user.entity';

@Entity('training_schedules')
export class TrainingSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ type: 'varchar', length: 200, default: 'Entrenamiento' })
  title: string;

  /** 0 = domingo … 6 = sábado (Date.getDay()) */
  @Column({ type: 'smallint' })
  weekday: number;

  @Column({ type: 'smallint' })
  hour: number;

  @Column({ type: 'smallint', default: 0 })
  minute: number;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes?: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location?: string;

  @Column({ name: 'category_ids', type: 'int', array: true, nullable: true })
  categoryIds?: number[];

  @Column({ name: 'weeks_ahead', type: 'int', default: 8 })
  weeksAhead: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
