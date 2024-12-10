import { Match } from 'src/matches/entities/match-entity';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

@Entity()
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @ManyToOne(() => Match, (match) => match.events, { onDelete: 'CASCADE' })
  match: Match;
}
