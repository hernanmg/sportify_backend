import { Sport } from 'src/sports/entities/sport.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 50 })
  name: string; // "Libre", "+35", "+40", "+45", "Femenino", "Masculino", etc.

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'sport_id', type: 'int' })
  sportId: number;

  @ManyToOne(() => Sport, (sport) => sport.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sport_id' })
  sport: Sport;

  // Rangos de edad para la categoría
  @Column({ name: 'age_min', type: 'int', nullable: true })
  ageMin?: number;

  @Column({ name: 'age_max', type: 'int', nullable: true })
  ageMax?: number;

  // Género específico (opcional)
  @Column({ 
    name: 'gender', 
    type: 'varchar', 
    length: 20, 
    nullable: true 
  })
  gender?: string; // 'masculino', 'femenino', 'mixto'

  // Estado y orden
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relaciones futuras con equipos/jugadores
  // @OneToMany(() => Team, (team) => team.category)
  // teams: Team[];
}
