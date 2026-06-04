import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { PlayerRoster } from './entities/player-roster.entity';
import { CreateRosterDto } from './dtos/create-roster.dto';
import { UpdateRosterDto } from './dtos/update-roster.dto';
import { Player } from '../players/entities/player.entity';
import { Team } from '../teams/entities/teams.entity';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { TeamCategory } from '../teams/entities/team-category.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { TeamAuditService } from '../teams/team-audit.service';

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
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(TeamCategory)
    private readonly teamCategoryRepository: Repository<TeamCategory>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @Inject(forwardRef(() => TeamAuditService))
    private readonly teamAuditService: TeamAuditService,
  ) {}

  private isElevatedRole(globalRole?: string): boolean {
    return (
      !!globalRole &&
      ['super_admin', 'manager', 'admin', 'team_captain', 'dt'].includes(
        globalRole,
      )
    );
  }

  private async getUserCategoryIdsOnTeam(
    userId: number,
    teamId: number,
  ): Promise<number[]> {
    const rows = await this.rosterRepository
      .createQueryBuilder('pr')
      .innerJoin('pr.player', 'p')
      .where('pr.team_id = :teamId', { teamId })
      .andWhere('p.user_id = :userId', { userId })
      .getMany();
    return [
      ...new Set(
        rows.map((r) => r.categoryId).filter((id): id is number => !!id),
      ),
    ];
  }

  private async countRosterRowsForUser(
    userId: number,
    teamId: number,
  ): Promise<number> {
    return this.rosterRepository
      .createQueryBuilder('pr')
      .innerJoin('pr.player', 'p')
      .where('pr.team_id = :teamId', { teamId })
      .andWhere('p.user_id = :userId', { userId })
      .getCount();
  }

  private async assertCanViewTeamRoster(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    if (this.isElevatedRole(globalRole)) return;
    const member = await this.teamMemberRepository.findOne({
      where: { userId, teamId },
    });
    if (member) return;
    const onRoster = await this.countRosterRowsForUser(userId, teamId);
    if (onRoster > 0) return;
    throw new ForbiddenException('No pertenecés a este equipo');
  }

  private async resolveCategoryForTeam(
    teamId: number,
    categoryLabel: string,
    categoryId?: number,
  ): Promise<{ categoryId: number; categoryName: string }> {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['sport', 'teamCategories', 'teamCategories.category'],
    });
    if (!team) {
      throw new NotFoundException(`Equipo con ID ${teamId} no encontrado`);
    }

    if (categoryId) {
      const cat = await this.categoryRepository.findOne({
        where: { id: categoryId, sportId: team.sport_id },
      });
      if (!cat) {
        throw new BadRequestException(
          'La categoría no pertenece al deporte del equipo',
        );
      }
      const link = await this.teamCategoryRepository.findOne({
        where: { teamId, categoryId: cat.id },
      });
      if (!link) {
        await this.teamCategoryRepository.save(
          this.teamCategoryRepository.create({ teamId, categoryId: cat.id }),
        );
      }
      return { categoryId: cat.id, categoryName: cat.name };
    }

    const normalized = categoryLabel.trim();
    let cat = await this.categoryRepository.findOne({
      where: { sportId: team.sport_id, name: normalized },
    });
    if (!cat) {
      cat = await this.categoryRepository.save(
        this.categoryRepository.create({
          name: normalized,
          sportId: team.sport_id,
          isActive: true,
        }),
      );
    }

    const linkExists = await this.teamCategoryRepository.findOne({
      where: { teamId, categoryId: cat.id },
    });
    if (!linkExists) {
      await this.teamCategoryRepository.save(
        this.teamCategoryRepository.create({ teamId, categoryId: cat.id }),
      );
    }

    return { categoryId: cat.id, categoryName: cat.name };
  }

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

    const playerId = player.id;

    // Dorsal único por equipo/temporada, salvo otra fila del mismo jugador (multi-categoría)
    const existingJersey = await this.rosterRepository.findOne({
      where: {
        teamId: createRosterDto.teamId,
        jerseyNumber: createRosterDto.jerseyNumber,
        season: createRosterDto.season,
      },
    });
    if (existingJersey && existingJersey.playerId !== playerId) {
      throw new ConflictException(
        `El número ${createRosterDto.jerseyNumber} ya está ocupado en la temporada ${createRosterDto.season}`,
      );
    }

    // Verificar que el jugador no esté ya en esa categoría/temporada/equipo
    const { categoryId, categoryName } = await this.resolveCategoryForTeam(
      createRosterDto.teamId,
      createRosterDto.category,
      createRosterDto.categoryId,
    );

    const existingPlayer = await this.rosterRepository.findOne({
      where: {
        playerId,
        teamId: createRosterDto.teamId,
        season: createRosterDto.season,
        categoryId,
      },
    });
    if (existingPlayer) {
      throw new ConflictException(
        `El jugador ya está registrado en ${categoryName} para la temporada ${createRosterDto.season}`,
      );
    }

    const roster = this.rosterRepository.create({
      playerId,
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
      categoryId,
      category: categoryName,
      medicalStatus: createRosterDto.medicalStatus ?? 'pending',
      notes: createRosterDto.notes,
    });

    return await this.rosterRepository.save(roster);
  }

  async findAll(): Promise<PlayerRoster[]> {
    try {
      const rosters = await this.rosterRepository.find({
        relations: ['player', 'player.user', 'team', 'categoryRef'],
        order: { jerseyNumber: 'ASC' }
      });
      console.log('Rosters found:', rosters.length);
      return rosters || [];
    } catch (error) {
      console.error('Error in findAll rosters:', error);
      return []; // Devolver array vacío en caso de error
    }
  }

  async findByTeam(
    teamId: number,
    season?: string,
    categoryIds?: number[],
    userId?: number,
    globalRole?: string,
  ): Promise<PlayerRoster[]> {
    try {
      if (userId != null) {
        await this.assertCanViewTeamRoster(userId, teamId, globalRole);
      }

      let effectiveCategoryIds = categoryIds;
      if (userId != null && !this.isElevatedRole(globalRole)) {
        const onRoster = await this.countRosterRowsForUser(userId, teamId);
        const member = await this.teamMemberRepository.findOne({
          where: { userId, teamId },
        });
        // Jugadores y miembros del plantel ven la lista de buena fe completa del equipo
        if (onRoster > 0 || member) {
          effectiveCategoryIds = categoryIds?.length ? categoryIds : undefined;
        } else {
          const mine = await this.getUserCategoryIdsOnTeam(userId, teamId);
          if (mine.length) {
            effectiveCategoryIds = effectiveCategoryIds?.length
              ? effectiveCategoryIds.filter((id) => mine.includes(id))
              : mine;
          }
        }
      }

      const load = async (seasonFilter?: string) => {
        const whereCondition: Record<string, unknown> = { teamId };
        if (seasonFilter) {
          whereCondition.season = seasonFilter;
        }
        if (effectiveCategoryIds?.length) {
          whereCondition.categoryId = In(effectiveCategoryIds);
        }
        return this.rosterRepository.find({
          where: whereCondition,
          relations: ['player', 'player.user', 'team', 'categoryRef'],
          order: { jerseyNumber: 'ASC' },
        });
      };

      let rosters = await load(season);
      if (season && rosters.length === 0) {
        rosters = await load(undefined);
      }
      return rosters || [];
    } catch (error) {
      console.error('Error in findByTeam rosters:', error);
      throw error;
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

  async update(
    id: number,
    updateRosterDto: UpdateRosterDto,
    actorUserId?: number,
  ): Promise<PlayerRoster> {
    const roster = await this.findOne(id);
    const previousNotes = roster.notes;

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
    if (updateRosterDto.notes !== undefined) {
      roster.notes = updateRosterDto.notes;
    }

    const saved = await this.rosterRepository.save(roster);

    if (
      actorUserId &&
      updateRosterDto.notes !== undefined &&
      updateRosterDto.notes !== previousNotes
    ) {
      const playerName =
        [roster.player?.user?.firstName, roster.player?.user?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        roster.player?.user?.email ||
        `Plantel #${id}`;
      await this.teamAuditService.log({
        teamId: roster.teamId,
        actorUserId,
        action: 'roster_notes_updated',
        entityType: 'player_roster',
        entityId: id,
        summary: `Notas DT actualizadas para ${playerName}`,
        metadata: { rosterId: id, season: roster.season },
      });
    }

    return saved;
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
