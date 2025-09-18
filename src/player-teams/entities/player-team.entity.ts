import { Player } from 'src/players/entities/player.entity';
import { Team } from 'src/teams/entities/teams.entity';
import { Category } from 'src/categories/entities/category.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('player_teams')
export class PlayerTeam {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'player_id', type: 'int' })
  playerId: number;

  @ManyToOne(() => Player, (player) => player.playerTeams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'team_id', type: 'int' })
  teamId: number;

  @ManyToOne(() => Team, (team) => team.playerTeams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId?: number;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  // Información específica del jugador en este equipo
  @Column({ name: 'jersey_number', type: 'int', nullable: true })
  jerseyNumber?: number;

  @Column({ name: 'position', type: 'varchar', length: 30, nullable: true })
  position?: string;

  @Column({ name: 'is_captain', type: 'boolean', default: false })
  isCaptain: boolean;

  @Column({ name: 'is_starter', type: 'boolean', default: false })
  isStarter: boolean;

  // Fechas del jugador en este equipo
  @Column({ name: 'joined_date', type: 'date', default: () => 'CURRENT_DATE' })
  joinedDate: Date;

  @Column({ name: 'left_date', type: 'date', nullable: true })
  leftDate?: Date;

  // Estado en este equipo específico
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'active' })
  status: string; // 'active', 'inactive', 'suspended', 'transferred'

  @Column({ name: 'is_current', type: 'boolean', default: true })
  isCurrent: boolean; // Si es el equipo actualmente seleccionado

  // Notas del entrenador sobre este jugador
  @Column({ name: 'coach_notes', type: 'text', nullable: true })
  coachNotes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
