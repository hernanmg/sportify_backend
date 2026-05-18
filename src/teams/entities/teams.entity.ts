import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Player } from 'src/players/entities/player.entity';
import { Match } from 'src/matches/entities/match.entity';
import { Sport } from 'src/sports/entities/sport.entity';
import { PlayerTeam } from 'src/player-teams/entities/player-team.entity';
import { Category } from 'src/categories/entities/category.entity';
import { TeamCategory } from './team-category.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column()
  sport_id: number;

  @ManyToOne(() => Sport, (sport) => sport.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sport_id' })
  sport: Sport;

  /** @deprecated Usar teamCategories. Se mantiene por compatibilidad. */
  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId?: number;

  /** @deprecated Usar teamCategories */
  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @OneToMany(() => TeamCategory, (tc) => tc.team)
  teamCategories: TeamCategory[];

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'founded_year', type: 'int', nullable: true })
  foundedYear?: number;

  @Column({ name: 'colors', type: 'varchar', length: 100, nullable: true })
  colors?: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl?: string;

  @OneToMany(() => Player, (player) => player.team)
  players: Player[];

  @OneToMany(() => Match, (match) => match.team)
  matches: Match[];

  @OneToMany(() => PlayerTeam, (playerTeam) => playerTeam.team)
  playerTeams: PlayerTeam[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
