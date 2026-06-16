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
import { Repository, Not, In, IsNull } from 'typeorm';
import { PlayerRoster } from './entities/player-roster.entity';
import { CreateRosterDto } from './dtos/create-roster.dto';
import { UpdateRosterDto } from './dtos/update-roster.dto';
import { Player } from '../players/entities/player.entity';
import { Team } from '../teams/entities/teams.entity';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { TeamCategory } from '../teams/entities/team-category.entity';
import { TeamMember, TeamMemberRole } from '../teams/entities/team-member.entity';
import { TeamAuditService } from '../teams/team-audit.service';
import { TeamsService } from '../teams/teams.service';
import { shortCategoryLabel } from '../common/category-label';

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
    @Inject(forwardRef(() => TeamsService))
    private readonly teamsService: TeamsService,
  ) {}

  private mapRosterCategory(row: PlayerRoster): PlayerRoster {
    const raw =
      row.categoryRef?.name?.trim() ||
      row.category?.trim() ||
      '';
    const label = shortCategoryLabel(raw);
    if (label) {
      row.category = label;
    } else if (raw && raw !== 'Masculino' && raw !== 'Femenino') {
      row.category = raw;
    }
    return row;
  }

  /** Incluye temporadas legado (2025-2026) al filtrar Apertura/Clausura. */
  private seasonFilterVariants(season: string): string[] {
    const variants = new Set<string>([season.trim()]);
    const apertura = /^(\d{4})-Apertura$/i.exec(season);
    if (apertura) {
      const y = parseInt(apertura[1], 10);
      variants.add(`${y - 1}-${y}`);
    }
    const clausura = /^(\d{4})-Clausura$/i.exec(season);
    if (clausura) {
      const y = parseInt(clausura[1], 10);
      variants.add(`${y}-${y + 1}`);
    }
    const legacy = /^(\d{4})-(\d{4})$/.exec(season);
    if (legacy) {
      const start = parseInt(legacy[1], 10);
      const end = parseInt(legacy[2], 10);
      variants.add(`${end}-Apertura`);
      variants.add(`${start}-Clausura`);
    }
    return [...variants];
  }

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

  private filterUpdateDtoForPlayerSelfEdit(
    dto: UpdateRosterDto,
  ): UpdateRosterDto {
    const allowed: UpdateRosterDto = {};
    if (dto.jerseyNumber !== undefined) {
      allowed.jerseyNumber = dto.jerseyNumber;
    }
    if (dto.documentNumber !== undefined) {
      allowed.documentNumber = dto.documentNumber;
    }
    if (dto.emergencyContact !== undefined) {
      allowed.emergencyContact = dto.emergencyContact;
    }
    if (dto.medicalCertificateDate !== undefined) {
      allowed.medicalCertificateDate = dto.medicalCertificateDate;
    }
    if (dto.medicalCertificateExpires !== undefined) {
      allowed.medicalCertificateExpires = dto.medicalCertificateExpires;
    }
    if (dto.position !== undefined) {
      allowed.position = dto.position;
    }
    if (dto.medicalStatus !== undefined) {
      allowed.medicalStatus = dto.medicalStatus;
    }
    if (dto.isEnabled !== undefined) {
      allowed.isEnabled = dto.isEnabled;
    }
    return allowed;
  }

  private assertCanUpdateRoster(
    roster: PlayerRoster,
    dto: UpdateRosterDto,
    actorUserId: number,
    actorRole?: string,
  ): UpdateRosterDto {
    if (this.isElevatedRole(actorRole)) {
      return dto;
    }

    const ownerUserId = roster.player?.user_id;
    if (ownerUserId !== actorUserId) {
      throw new ForbiddenException(
        'No tenés permiso para modificar esta ficha',
      );
    }

    return this.filterUpdateDtoForPlayerSelfEdit(dto);
  }

  /** Crea fichas faltantes para integrantes del equipo (p. ej. jugador que se unió sin plantel). */
  async ensureTeamMembersOnRoster(teamId: number): Promise<void> {
    await this.consolidateDuplicatePlayers(teamId);
    await this.syncMissingMemberRosters(teamId);
    await this.backfillRosterCategoryIds(teamId);
    await this.propagateIdentityAcrossCategories(teamId);
  }

  private async backfillRosterCategoryIds(teamId: number): Promise<void> {
    const rows = await this.rosterRepository.find({ where: { teamId } });
    for (const row of rows) {
      if (row.categoryId || !row.category?.trim()) continue;
      try {
        const resolved = await this.resolveCategoryForTeam(
          teamId,
          row.category,
        );
        row.categoryId = resolved.categoryId;
        const label = shortCategoryLabel(resolved.categoryName);
        if (label) row.category = label;
        await this.rosterRepository.save(row);
      } catch {
        // omitir filas con categoría inválida
      }
    }
  }

  private isPlaceholderDocument(documentNumber?: string | null): boolean {
    return !!documentNumber?.trim().startsWith('USR-');
  }

  /** Unifica jugadores duplicados (mismo user en el mismo equipo). */
  private async consolidateDuplicatePlayers(teamId: number): Promise<void> {
    const players = await this.playerRepository.find({
      where: { team_id: teamId },
    });
    const byUserId = new Map<number, Player[]>();
    for (const p of players) {
      if (!p.user_id) continue;
      const list = byUserId.get(p.user_id) ?? [];
      list.push(p);
      byUserId.set(p.user_id, list);
    }

    for (const list of byUserId.values()) {
      if (list.length <= 1) continue;
      const primary =
        list.find((p) => p.user_id) ?? list.sort((a, b) => a.id - b.id)[0];
      for (const dup of list) {
        if (dup.id === primary.id) continue;
        await this.rosterRepository.update(
          { playerId: dup.id, teamId },
          { playerId: primary.id },
        );
        await this.playerRepository.remove(dup);
      }
    }
  }

  /** Copia DNI, apto y dorsal entre fichas del mismo jugador (multi-categoría). */
  private async propagateIdentityAcrossCategories(
    teamId: number,
    season?: string,
  ): Promise<void> {
    const where: Record<string, unknown> = { teamId };
    if (season?.trim()) {
      const variants = this.seasonFilterVariants(season);
      where.season = variants.length === 1 ? variants[0] : In(variants);
    }

    const rows = await this.rosterRepository.find({
      where,
      relations: ['player', 'player.user'],
      order: { updatedAt: 'DESC' },
    });

    const byPlayer = new Map<number, PlayerRoster[]>();
    for (const row of rows) {
      const list = byPlayer.get(row.playerId) ?? [];
      list.push(row);
      byPlayer.set(row.playerId, list);
    }

    for (const group of byPlayer.values()) {
      if (group.length <= 1) continue;

      const canonical =
        group.find(
          (r) =>
            r.documentNumber &&
            !this.isPlaceholderDocument(r.documentNumber),
        ) ?? group[0];

      for (const row of group) {
        if (row.id === canonical.id) continue;

        let changed = false;
        if (
          this.isPlaceholderDocument(row.documentNumber) &&
          canonical.documentNumber &&
          !this.isPlaceholderDocument(canonical.documentNumber)
        ) {
          row.documentNumber = canonical.documentNumber;
          changed = true;
        }
        if (!row.emergencyContact && canonical.emergencyContact) {
          row.emergencyContact = canonical.emergencyContact;
          changed = true;
        }
        if (!row.medicalCertificateDate && canonical.medicalCertificateDate) {
          row.medicalCertificateDate = canonical.medicalCertificateDate;
          changed = true;
        }
        if (
          !row.medicalCertificateExpires &&
          canonical.medicalCertificateExpires
        ) {
          row.medicalCertificateExpires = canonical.medicalCertificateExpires;
          changed = true;
        }
        if (
          (row.medicalStatus === 'pending' ||
            row.medicalStatus === 'expired') &&
          canonical.medicalStatus === 'approved' &&
          canonical.medicalCertificateExpires &&
          new Date(canonical.medicalCertificateExpires) > new Date()
        ) {
          row.medicalStatus = 'approved';
          changed = true;
        }
        if (row.jerseyNumber !== canonical.jerseyNumber) {
          row.jerseyNumber = canonical.jerseyNumber;
          changed = true;
        }
        if (row.position !== canonical.position) {
          row.position = canonical.position;
          changed = true;
        }
        if (changed) {
          await this.rosterRepository.save(row);
        }
      }
    }
  }

  private async propagateIdentityFromRow(
    source: PlayerRoster,
    fields: UpdateRosterDto,
  ): Promise<void> {
    const siblings = await this.rosterRepository.find({
      where: {
        playerId: source.playerId,
        teamId: source.teamId,
        season: source.season,
        id: Not(source.id),
      },
    });
    if (!siblings.length) return;

    for (const row of siblings) {
      let dirty = false;
      if (fields.documentNumber && row.documentNumber !== fields.documentNumber) {
        row.documentNumber = fields.documentNumber;
        dirty = true;
      }
      if (
        fields.emergencyContact !== undefined &&
        row.emergencyContact !== fields.emergencyContact
      ) {
        row.emergencyContact = fields.emergencyContact;
        dirty = true;
      }
      if (fields.medicalCertificateDate) {
        row.medicalCertificateDate = new Date(fields.medicalCertificateDate);
        dirty = true;
      }
      if (fields.medicalCertificateExpires) {
        row.medicalCertificateExpires = new Date(
          fields.medicalCertificateExpires,
        );
        dirty = true;
      }
      if (fields.medicalStatus && row.medicalStatus !== fields.medicalStatus) {
        row.medicalStatus = fields.medicalStatus;
        dirty = true;
      }
      if (fields.jerseyNumber && row.jerseyNumber !== fields.jerseyNumber) {
        row.jerseyNumber = fields.jerseyNumber;
        dirty = true;
      }
      if (fields.position && row.position !== fields.position) {
        row.position = fields.position;
        dirty = true;
      }
      if (fields.isEnabled !== undefined && row.isEnabled !== fields.isEnabled) {
        row.isEnabled = fields.isEnabled;
        dirty = true;
      }
      if (dirty) await this.rosterRepository.save(row);
    }
  }

  private rosterRowKey(row: PlayerRoster): string {
    return `${row.playerId}:${row.categoryId ?? row.category}`;
  }

  /** DT/staff: temporada activa + fichas de otras temporadas que no tienen fila en la actual. */
  private mergeRosterRowsForStaff(
    seasonRows: PlayerRoster[],
    allRows: PlayerRoster[],
    season?: string,
  ): PlayerRoster[] {
    if (!season?.trim()) {
      return allRows;
    }
    const keysInSeason = new Set(seasonRows.map((r) => this.rosterRowKey(r)));
    const merged = [...seasonRows];
    for (const row of allRows) {
      const key = this.rosterRowKey(row);
      if (!keysInSeason.has(key)) {
        merged.push(row);
        keysInSeason.add(key);
      }
    }
    merged.sort((a, b) => a.jerseyNumber - b.jerseyNumber);
    return merged;
  }

  private async syncMissingMemberRosters(teamId: number): Promise<void> {
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
      relations: ['teamCategories'],
    });
    if (!team) return;

    const categoryIds =
      team.teamCategories
        ?.map((tc) => tc.categoryId)
        .filter((id): id is number => !!id) ?? [];
    if (!categoryIds.length) return;

    const userIds = new Set<number>();

    const members = await this.teamMemberRepository.find({ where: { teamId } });
    for (const member of members) {
      if (member.role === TeamMemberRole.ADMIN) {
        const linkedPlayer = await this.playerRepository.findOne({
          where: { user_id: member.userId, team_id: teamId },
        });
        if (!linkedPlayer) continue;
      }
      userIds.add(member.userId);
    }

    const playersOnTeam = await this.playerRepository.find({
      where: { team_id: teamId },
    });
    for (const player of playersOnTeam) {
      if (player.user_id) userIds.add(player.user_id);
    }

    for (const userId of userIds) {
      const onRoster = await this.countRosterRowsForUser(userId, teamId);
      if (onRoster === 0) {
        await this.teamsService.ensureRosterEntries(
          userId,
          teamId,
          categoryIds,
        );
      }
    }
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
    const team = await this.teamRepository.findOne({
      where: { id: createRosterDto.teamId },
    });
    if (!team) {
      throw new NotFoundException(
        `Equipo con ID ${createRosterDto.teamId} no encontrado`,
      );
    }

    const player = await this.resolveOrCreatePlayer(createRosterDto);
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

  private async resolveOrCreatePlayer(
    dto: CreateRosterDto,
  ): Promise<Player> {
    const isGuest =
      !dto.playerId &&
      dto.guestFirstName?.trim() &&
      dto.guestLastName?.trim();

    if (isGuest) {
      const first = dto.guestFirstName!.trim();
      const last = dto.guestLastName!.trim();
      const existingGuest = await this.playerRepository.findOne({
        where: {
          team_id: dto.teamId,
          user_id: IsNull(),
          guestFirstName: first,
          guestLastName: last,
        },
      });
      if (existingGuest) {
        return existingGuest;
      }

      return this.playerRepository.save(
        this.playerRepository.create({
          user_id: null,
          guestFirstName: first,
          guestLastName: last,
          team_id: dto.teamId,
          isActive: true,
          joinedTeamDate: new Date(),
        }),
      );
    }

    if (!dto.playerId) {
      throw new BadRequestException(
        'Indicá un usuario registrado o nombre y apellido para jugador sin app',
      );
    }

    let player = await this.playerRepository.findOne({
      where: { id: dto.playerId },
    });

    if (!player) {
      const user = await this.userRepository.findOne({
        where: { id: dto.playerId },
      });
      if (!user) {
        throw new NotFoundException(
          `Usuario con ID ${dto.playerId} no encontrado`,
        );
      }

      const existingForUser = await this.playerRepository.findOne({
        where: { user_id: dto.playerId, team_id: dto.teamId },
      });
      if (existingForUser) {
        return existingForUser;
      }

      player = this.playerRepository.create({
        user_id: dto.playerId,
        team_id: dto.teamId,
        isActive: true,
        joinedTeamDate: new Date(),
      });
      player = await this.playerRepository.save(player);
    }

    return player;
  }

  async linkPlayerToUser(
    rosterId: number,
    userId: number,
    actorUserId?: number,
  ): Promise<PlayerRoster> {
    const roster = await this.rosterRepository.findOne({
      where: { id: rosterId },
      relations: ['player', 'player.user', 'team'],
    });
    if (!roster) {
      throw new NotFoundException(
        `Registro de lista de buena fe con ID ${rosterId} no encontrado`,
      );
    }

    const player = roster.player;
    if (!player) {
      throw new NotFoundException('Jugador no encontrado');
    }
    if (player.user_id) {
      throw new BadRequestException(
        'Este jugador ya tiene una cuenta vinculada en la app',
      );
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }

    const existingLinked = await this.playerRepository.findOne({
      where: { user_id: userId, team_id: roster.teamId },
    });
    if (existingLinked && existingLinked.id !== player.id) {
      throw new ConflictException(
        'Ese usuario ya tiene ficha en este equipo. Unificá o eliminá el registro duplicado.',
      );
    }

    const guestName = [player.guestFirstName, player.guestLastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    player.user_id = userId;
    player.guestFirstName = null;
    player.guestLastName = null;
    await this.playerRepository.save(player);

    if (actorUserId) {
      const userName =
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.email;
      await this.teamAuditService.log({
        teamId: roster.teamId,
        actorUserId,
        action: 'roster_player_linked',
        entityType: 'player_roster',
        entityId: rosterId,
        summary: `Jugador sin app vinculado a ${userName}${guestName ? ` (antes: ${guestName})` : ''}`,
        metadata: { rosterId, userId, playerId: player.id },
      });
    }

    return this.findOne(rosterId);
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

      if (userId != null && this.isElevatedRole(globalRole)) {
        await this.syncMissingMemberRosters(teamId);
        await this.propagateIdentityAcrossCategories(teamId, season);
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
          const variants = this.seasonFilterVariants(seasonFilter);
          whereCondition.season =
            variants.length === 1 ? variants[0] : In(variants);
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
      const allRosters = await load(undefined);

      if (userId != null && this.isElevatedRole(globalRole)) {
        rosters = this.mergeRosterRowsForStaff(
          rosters ?? [],
          allRosters ?? [],
          season,
        );
      } else if ((!rosters || rosters.length === 0) && season) {
        rosters = allRosters;
      }

      return (rosters || []).map((r) => this.mapRosterCategory(r));
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
    actorRole?: string,
  ): Promise<PlayerRoster> {
    const roster = await this.findOne(id);
    const previousNotes = roster.notes;

    const dto =
      actorUserId != null
        ? this.assertCanUpdateRoster(
            roster,
            updateRosterDto,
            actorUserId,
            actorRole,
          )
        : updateRosterDto;

    // Si se está cambiando el número de camiseta, verificar que no esté ocupado
    if (dto.jerseyNumber && dto.jerseyNumber !== roster.jerseyNumber) {
      const existingJersey = await this.rosterRepository.findOne({
        where: {
          teamId: roster.teamId,
          jerseyNumber: dto.jerseyNumber,
          season: roster.season,
          playerId: Not(roster.playerId),
        },
      });
      if (existingJersey) {
        throw new ConflictException(`El número ${dto.jerseyNumber} ya está ocupado en la temporada ${roster.season}`);
      }
    }

    // Actualizar campos
    if (dto.jerseyNumber) roster.jerseyNumber = dto.jerseyNumber;
    if (dto.medicalCertificateDate) roster.medicalCertificateDate = new Date(dto.medicalCertificateDate);
    if (dto.medicalCertificateExpires) roster.medicalCertificateExpires = new Date(dto.medicalCertificateExpires);
    if (dto.isEnabled !== undefined) roster.isEnabled = dto.isEnabled;
    if (dto.position) roster.position = dto.position;
    if (dto.documentNumber) roster.documentNumber = dto.documentNumber;
    if (dto.emergencyContact !== undefined) roster.emergencyContact = dto.emergencyContact;
    if (dto.medicalStatus) roster.medicalStatus = dto.medicalStatus;
    if (dto.notes !== undefined) {
      roster.notes = dto.notes;
    }

    const saved = await this.rosterRepository.save(roster);

    await this.propagateIdentityFromRow(saved, dto);

    if (
      actorUserId &&
      dto.notes !== undefined &&
      dto.notes !== previousNotes
    ) {
      const playerName =
        [roster.player?.user?.firstName, roster.player?.user?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        [roster.player?.guestFirstName, roster.player?.guestLastName]
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
