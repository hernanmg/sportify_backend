import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Team } from './teams.entity';
import { Category } from '../../categories/entities/category.entity';

/** Un equipo puede tener varias categorías (+35, +40, etc.) */
@Entity('team_categories')
@Unique(['teamId', 'categoryId'])
export class TeamCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, (team) => team.teamCategories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => Category, (category) => category.teamCategories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
