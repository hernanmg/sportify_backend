import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Player } from 'src/players/entities/player-entity';
import { Match } from 'src/matches/entities/match-entity';
import { Sport } from 'src/sports/entities/sport-entity';

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

  @OneToMany(() => Player, (player) => player.team)
  players: Player[];

  @OneToMany(() => Match, (match) => match.team)
  matches: Match[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @CreateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}
