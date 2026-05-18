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

/** Persona sin app, reutilizable en eventos sociales del equipo */
@Entity('team_social_guests')
export class TeamSocialGuest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email?: string;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
