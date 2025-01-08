import { Team } from 'src/teams/entities/teams-entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';

@Entity('sports')
export class Sport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'text', nullable: false })
  name: string;

  @OneToMany(() => Team, (team) => team.sport)
  teams: Team[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
