import { Event } from 'src/events/entities/event-entity';
import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';

@Entity()
export class Match {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column()
  location: string;

  @OneToMany(() => Event, (event) => event.match)
  events: Event[];
}
