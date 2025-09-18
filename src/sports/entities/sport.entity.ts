import { Team } from 'src/teams/entities/teams.entity';
import { Category } from 'src/categories/entities/category.entity';
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

  @OneToMany(() => Category, (category) => category.sport)
  categories: Category[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
