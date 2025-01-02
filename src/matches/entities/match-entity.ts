import { Team } from 'src/teams/entities/teams-entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  team_id: number;

  @ManyToOne(() => Team, (team) => team.matches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'opponent_name', length: 100 })
  opponentName: string;

  @Column({ name: 'match_date', type: 'timestamp' })
  matchDate: Date;

  @Column({ length: 100, nullable: true })
  location: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
