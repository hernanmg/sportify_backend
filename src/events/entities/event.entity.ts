import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { TypeEvent } from './typeEvent.entity';
import { Match } from 'src/matches/entities/match.entity';
import { Player } from 'src/players/entities/player.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Match, (match) => match.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' }) // Asegúrate de que el nombre coincida con el esquema de la base de datos
  match: Match;

  @ManyToOne(() => Player, (player) => player.events, { nullable: true })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @ManyToOne(() => TypeEvent, (typeEvent) => typeEvent.events)
  @JoinColumn({ name: 'type_event_id' })
  typeEvent: TypeEvent;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'event_time', type: 'timestamp', nullable: false })
  eventTime: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
