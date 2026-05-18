import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Player } from '../../players/entities/player.entity';
import { Team } from '../../teams/entities/teams.entity';
import { Category } from '../../categories/entities/category.entity';

@Entity('player_roster')
/** Dorsal: validado en servicio (único por equipo/temporada entre jugadores distintos; mismo jugador en varias categorías puede repetir dorsal). */
@Unique(['playerId', 'teamId', 'season', 'categoryId'])
export class PlayerRoster {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'player_id' })
  playerId: number;

  @ManyToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'player_id' })
  player: Player;

  @Column({ name: 'team_id' })
  teamId: number;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  // Información de buena fe
  @Column({ name: 'jersey_number', type: 'int' })
  jerseyNumber: number;

  @Column({ name: 'medical_certificate_date', type: 'date', nullable: true })
  medicalCertificateDate: Date;

  @Column({ name: 'medical_certificate_expires', type: 'date', nullable: true })
  medicalCertificateExpires: Date;

  @Column({ name: 'is_enabled', type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ 
    name: 'position', 
    type: 'varchar', 
    length: 20,
    default: 'player'
  })
  position: 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'player';

  @Column({ name: 'document_number', type: 'varchar', length: 20 })
  documentNumber: string;

  @Column({ name: 'emergency_contact', type: 'varchar', length: 100, nullable: true })
  emergencyContact: string;

  @Column({ name: 'season', type: 'varchar', length: 20 })
  season: string; // "2024-Apertura", "2024-Clausura"

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId?: number;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  categoryRef?: Category;

  /** Etiqueta legible; se sincroniza desde categoryRef.name */
  @Column({ name: 'category', type: 'varchar', length: 50 })
  category: string;

  // Estado médico
  @Column({ name: 'medical_status', type: 'varchar', length: 20, default: 'pending' })
  medicalStatus: 'pending' | 'approved' | 'expired' | 'rejected';

  // Observaciones
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
