import { Team } from 'src/teams/entities/teams.entity';
import { User } from 'src/users/entities/user.entity';
import { Event } from 'src/events/entities/event.entity';
import { PlayerTeam } from 'src/player-teams/entities/player-team.entity';
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

@Entity('players')
export class Player {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: true })
  user_id?: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'guest_first_name', type: 'varchar', length: 80, nullable: true })
  guestFirstName?: string;

  @Column({ name: 'guest_last_name', type: 'varchar', length: 80, nullable: true })
  guestLastName?: string;

  @Column()
  team_id: number;

  @ManyToOne(() => Team, (team) => team.players, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  // Información deportiva
  @Column({ name: 'posicion', type: 'varchar', length: 30, nullable: true })
  posicion?: string;

  @Column({ name: 'jersey_number', type: 'int', nullable: true })
  jerseyNumber?: number;

  @Column({ name: 'height', type: 'numeric', precision: 5, scale: 2, nullable: true })
  height?: number;

  @Column({ name: 'weight', type: 'numeric', precision: 5, scale: 2, nullable: true })
  weight?: number;

  @Column({ name: 'dominant_foot', type: 'varchar', length: 10, nullable: true })
  dominantFoot?: string;

  // Fechas importantes
  @Column({ name: 'joined_team_date', type: 'date', default: () => 'CURRENT_DATE' })
  joinedTeamDate: Date;

  @Column({ name: 'contract_end_date', type: 'date', nullable: true })
  contractEndDate?: Date;

  // Estado del jugador
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_captain', type: 'boolean', default: false })
  isCaptain: boolean;

  @Column({ 
    name: 'injury_status', 
    type: 'varchar', 
    length: 20, 
    default: 'healthy' 
  })
  injuryStatus: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Event, (event) => event.player)
  events: Event[];

  @OneToMany(() => PlayerTeam, (playerTeam) => playerTeam.player)
  playerTeams: PlayerTeam[];
}
