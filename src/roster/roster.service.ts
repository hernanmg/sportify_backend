import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { PlayerRoster } from './entities/player-roster.entity';
import { CreateRosterDto } from './dtos/create-roster.dto';
import { UpdateRosterDto } from './dtos/update-roster.dto';
import { Player } from '../players/entities/player.entity';
import { Team } from '../teams/entities/teams.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class RosterService {
  constructor(
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createRosterDto: CreateRosterDto): Promise<PlayerRoster> {
    // Verificar que el jugador existe, si no existe, crearlo
    let player = await this.playerRepository.findOne({
      where: { id: createRosterDto.playerId }
    });
    
    if (!player) {
      // Verificar que el usuario existe
      const user = await this.userRepository.findOne({
        where: { id: createRosterDto.playerId }
      });
      if (!user) {
        throw new NotFoundException(`Usuario con ID ${createRosterDto.playerId} no encontrado`);
      }
      
      // Crear el registro de Player automáticamente
      player = this.playerRepository.create({
        user_id: createRosterDto.playerId,
        team_id: createRosterDto.teamId,
        isActive: true,
        joinedTeamDate: new Date(),
      });
      player = await this.playerRepository.save(player);
    }

    // Verificar que el equipo existe
    const team = await this.teamRepository.findOne({
      where: { id: createRosterDto.teamId }
    });
    if (!team) {
      throw new NotFoundException(`Equipo con ID ${createRosterDto.teamId} no encontrado`);
    }

    // Verificar que el número de camiseta no esté ocupado en esa temporada
    const existingJersey = await this.rosterRepository.findOne({
      where: {
        teamId: createRosterDto.teamId,
        jerseyNumber: createRosterDto.jerseyNumber,
        season: createRosterDto.season
      }
    });
    if (existingJersey) {
      throw new ConflictException(`El número ${createRosterDto.jerseyNumber} ya está ocupado en la temporada ${createRosterDto.season}`);
    }

    // Verificar que el jugador no esté ya registrado en esa temporada para ese equipo
    const existingPlayer = await this.rosterRepository.findOne({
      where: {
        playerId: createRosterDto.playerId,
        teamId: createRosterDto.teamId,
        season: createRosterDto.season
      }
    });
    if (existingPlayer) {
      throw new ConflictException(`El jugador ya está registrado en la temporada ${createRosterDto.season}`);
    }

    const roster = this.rosterRepository.create({
      playerId: createRosterDto.playerId,
      player,
      teamId: createRosterDto.teamId,
      team,
      jerseyNumber: createRosterDto.jerseyNumber,
      medicalCertificateDate: createRosterDto.medicalCertificateDate ? new Date(createRosterDto.medicalCertificateDate) : null,
      medicalCertificateExpires: createRosterDto.medicalCertificateExpires ? new Date(createRosterDto.medicalCertificateExpires) : null,
      isEnabled: createRosterDto.isEnabled ?? true,
      position: createRosterDto.position,
      documentNumber: createRosterDto.documentNumber,
      emergencyContact: createRosterDto.emergencyContact,
      season: createRosterDto.season,
      category: createRosterDto.category,
      medicalStatus: createRosterDto.medicalStatus ?? 'pending',
      notes: createRosterDto.notes,
    });

    return await this.rosterRepository.save(roster);
  }

  async findAll(): Promise<PlayerRoster[]> {
    try {
      const rosters = await this.rosterRepository.find({
        relations: ['player', 'player.user', 'team'],
        order: { jerseyNumber: 'ASC' }
      });
      console.log('Rosters found:', rosters.length);
      return rosters || [];
    } catch (error) {
      console.error('Error in findAll rosters:', error);
      return []; // Devolver array vacío en caso de error
    }
  }

  async findByTeam(teamId: number, season?: string): Promise<PlayerRoster[]> {
    try {
      const whereCondition: any = { teamId };
      if (season) {
        whereCondition.season = season;
      }

      const rosters = await this.rosterRepository.find({
        where: whereCondition,
        relations: ['player', 'player.user', 'team'],
        order: { jerseyNumber: 'ASC' }
      });
      return rosters || [];
    } catch (error) {
      console.error('Error in findByTeam rosters:', error);
      return [];
    }
  }

  async findBySeason(season: string): Promise<PlayerRoster[]> {
    try {
      const rosters = await this.rosterRepository.find({
        where: { season },
        relations: ['player', 'player.user', 'team'],
        order: { team: { name: 'ASC' }, jerseyNumber: 'ASC' }
      });
      return rosters || [];
    } catch (error) {
      console.error('Error in findBySeason rosters:', error);
      return [];
    }
  }

  async findOne(id: number): Promise<PlayerRoster> {
    const roster = await this.rosterRepository.findOne({
      where: { id },
      relations: ['player', 'player.user', 'team']
    });
    
    if (!roster) {
      throw new NotFoundException(`Registro de lista de buena fe con ID ${id} no encontrado`);
    }
    
    return roster;
  }

  async update(id: number, updateRosterDto: UpdateRosterDto): Promise<PlayerRoster> {
    const roster = await this.findOne(id);

    // Si se está cambiando el número de camiseta, verificar que no esté ocupado
    if (updateRosterDto.jerseyNumber && updateRosterDto.jerseyNumber !== roster.jerseyNumber) {
      const existingJersey = await this.rosterRepository.findOne({
        where: {
          teamId: roster.teamId,
          jerseyNumber: updateRosterDto.jerseyNumber,
          season: roster.season,
          id: Not(id) // Excluir el registro actual
        }
      });
      if (existingJersey) {
        throw new ConflictException(`El número ${updateRosterDto.jerseyNumber} ya está ocupado en la temporada ${roster.season}`);
      }
    }

    // Actualizar campos
    if (updateRosterDto.jerseyNumber) roster.jerseyNumber = updateRosterDto.jerseyNumber;
    if (updateRosterDto.medicalCertificateDate) roster.medicalCertificateDate = new Date(updateRosterDto.medicalCertificateDate);
    if (updateRosterDto.medicalCertificateExpires) roster.medicalCertificateExpires = new Date(updateRosterDto.medicalCertificateExpires);
    if (updateRosterDto.isEnabled !== undefined) roster.isEnabled = updateRosterDto.isEnabled;
    if (updateRosterDto.position) roster.position = updateRosterDto.position;
    if (updateRosterDto.documentNumber) roster.documentNumber = updateRosterDto.documentNumber;
    if (updateRosterDto.emergencyContact) roster.emergencyContact = updateRosterDto.emergencyContact;
    if (updateRosterDto.medicalStatus) roster.medicalStatus = updateRosterDto.medicalStatus;
    if (updateRosterDto.notes) roster.notes = updateRosterDto.notes;

    return await this.rosterRepository.save(roster);
  }

  async remove(id: number): Promise<void> {
    const roster = await this.findOne(id);
    await this.rosterRepository.remove(roster);
  }

  // Métodos específicos para la gestión deportiva
  async getEnabledPlayersByTeam(teamId: number, season: string): Promise<PlayerRoster[]> {
    return await this.rosterRepository.find({
      where: {
        teamId,
        season,
        isEnabled: true,
        medicalStatus: 'approved'
      },
      relations: ['player', 'player.user'],
      order: { jerseyNumber: 'ASC' }
    });
  }

  async getAvailableJerseyNumbers(teamId: number, season: string): Promise<number[]> {
    const usedNumbers = await this.rosterRepository.find({
      where: { teamId, season },
      select: ['jerseyNumber']
    });

    const used = usedNumbers.map(r => r.jerseyNumber);
    const available = [];
    
    for (let i = 1; i <= 99; i++) {
      if (!used.includes(i)) {
        available.push(i);
      }
    }
    
    return available;
  }

  async updateMedicalStatus(id: number, status: 'pending' | 'approved' | 'expired' | 'rejected'): Promise<PlayerRoster> {
    const roster = await this.findOne(id);
    roster.medicalStatus = status;
    
    // Si se aprueba, habilitar al jugador automáticamente
    if (status === 'approved') {
      roster.isEnabled = true;
    }
    // Si se rechaza o expira, deshabilitar al jugador
    else if (status === 'rejected' || status === 'expired') {
      roster.isEnabled = false;
    }
    
    return await this.rosterRepository.save(roster);
  }
}
