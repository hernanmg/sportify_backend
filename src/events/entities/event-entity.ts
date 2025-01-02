import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { TypeEvent } from './typeEvent-entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: false })
  matchId: number;

  @Column({ type: 'int', nullable: true })
  playerId: number;

  @ManyToOne(() => TypeEvent, (typeEvent) => typeEvent.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'type_event_id' })
  typeEvent: TypeEvent;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp', nullable: false })
  eventTime: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
