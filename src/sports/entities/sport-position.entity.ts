import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Sport } from './sport.entity';

@Entity('sport_positions')
@Unique(['sportId', 'code'])
export class SportPosition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sport_id' })
  sportId: number;

  @ManyToOne(() => Sport, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sport_id' })
  sport: Sport;

  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 80 })
  label: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
