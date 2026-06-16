import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, Like } from 'typeorm';
import { randomBytes } from 'crypto';
import { Team } from './entities/teams.entity';
import { TeamCategory } from './entities/team-category.entity';
import { TeamMember, TeamMemberRole } from './entities/team-member.entity';
import { TeamInvite } from './entities/team-invite.entity';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { Player } from '../players/entities/player.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../users-roles/entities/userRole.entity';
import { Category } from '../categories/entities/category.entity';
import { mapTeamWithCategories } from './teams.mapper';
import {
  TeamOnboardingDto,
  TeamOnboardingMode,
  JoinTeamDto,
} from './dtos/team-onboarding.dto';

export interface MyTeamOption {
  teamId: number;
  name: string;
  categories: string[];
  categoryIds: number[];
  sportName?: string;
  isTeamAdmin?: boolean;
  teamMemberRole?: TeamMemberRole;
  canManageFinance?: boolean;
  team: ReturnType<typeof mapTeamWithCategories>;
}

const TEAM_RELATIONS = [
  'sport',
  'category',
  'teamCategories',
  'teamCategories.category',
] as const;

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamCategory)
    private readonly teamCategoryRepository: Repository<TeamCategory>,
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(TeamInvite)
    private readonly teamInviteRepository: Repository<TeamInvite>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  private currentSeason(): string {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const half = month <= 6 ? 'Apertura' : 'Clausura';
    return `${year}-${half}`;
  }

  private generateCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  /** Acepta snake_case del cliente Flutter y valida escudo (data-URI o URL cloud). */
  private normalizeTeamPayload(
    data: Partial<Team> & {
      categoryIds?: number[];
      sport_id?: number;
      founded_year?: number;
      logo_url?: string;
      category_id?: number;
    },
  ): Partial<Team> & { categoryIds?: number[] } {
    const { categoryIds, ...rest } = data;
    const normalized: Partial<Team> = { ...rest };

    if (rest.sport_id != null && normalized.sport_id == null) {
      normalized.sport_id = rest.sport_id;
    }
    if (rest.founded_year != null && normalized.foundedYear == null) {
      normalized.foundedYear = rest.founded_year;
    }
    if (rest.logo_url != null && normalized.logoUrl == null) {
      normalized.logoUrl = rest.logo_url;
    }
    if (rest.category_id != null && normalized.categoryId == null) {
      normalized.categoryId = rest.category_id;
    }
    if (
      (rest as { birthday_notification_hour?: number }).birthday_notification_hour !=
        null &&
      normalized.birthdayNotificationHour == null
    ) {
      normalized.birthdayNotificationHour = (
        rest as { birthday_notification_hour?: number }
      ).birthday_notification_hour;
    }

    if (normalized.birthdayNotificationHour != null) {
      this.validateBirthdayNotificationHour(normalized.birthdayNotificationHour);
    }

    if (normalized.logoUrl !== undefined) {
      this.validateLogoUrl(normalized.logoUrl);
    }

    return { ...normalized, categoryIds };
  }

  private validateLogoUrl(logoUrl?: string | null): void {
    if (!logoUrl || logoUrl.trim() === '') return;
    const value = logoUrl.trim();
    if (value.startsWith('https://') || value.startsWith('http://')) {
      return;
    }
    if (value.startsWith('data:image/')) {
      if (value.length > 700_000) {
        throw new BadRequestException(
          'El escudo es demasiado grande. Usá una imagen más chica.',
        );
      }
      return;
    }
    throw new BadRequestException(
      'Formato de escudo inválido. Usá una imagen o una URL.',
    );
  }

  private validateBirthdayNotificationHour(hour: number): void {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new BadRequestException(
        'La hora de notificación de cumpleaños debe estar entre 0 y 23',
      );
    }
  }

  async updateBirthdayNotificationHour(
    teamId: number,
    userId: number,
    role: string | undefined,
    hour: number,
  ) {
    this.validateBirthdayNotificationHour(hour);
    const elevated = role === 'super_admin' || role === 'manager';
    const isAdmin = await this.isTeamAdmin(userId, teamId);
    const isDt =
      role === 'dt' && (await this.isTeamMember(userId, teamId));
    if (!elevated && !isAdmin && !isDt) {
      throw new ForbiddenException(
        'Solo el DT o admin del equipo puede configurar los cumpleaños',
      );
    }
    return this.update(teamId, { birthdayNotificationHour: hour });
  }

  async isTeamAdmin(userId: number, teamId: number): Promise<boolean> {
    const member = await this.teamMemberRepository.findOne({
      where: { userId, teamId, role: TeamMemberRole.ADMIN },
    });
    return !!member;
  }

  /** Cuotas, pagos, gastos y caja del equipo. */
  async canManageTeamFinance(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<boolean> {
    const platform = ['super_admin', 'manager', 'admin'];
    if (globalRole && platform.includes(globalRole)) return true;

    const member = await this.teamMemberRepository.findOne({
      where: { userId, teamId },
    });
    const financeTeamRoles = [
      TeamMemberRole.ADMIN,
      TeamMemberRole.TREASURER,
      TeamMemberRole.DELEGATE,
    ];
    if (member && financeTeamRoles.includes(member.role)) {
      return true;
    }

    const staffGlobal = ['dt', 'tesorero', 'delegado'];
    if (globalRole && staffGlobal.includes(globalRole)) {
      return this.isTeamMember(userId, teamId);
    }

    return false;
  }

  async assertCanManageTeamFinance(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const ok = await this.canManageTeamFinance(userId, teamId, globalRole);
    if (!ok) {
      throw new ForbiddenException(
        'No tenés permisos de finanzas en este equipo',
      );
    }
  }

  /** DT / admins del equipo (tabla team_members, rol admin). */
  async listTeamAdminUserIds(teamId: number): Promise<number[]> {
    const members = await this.teamMemberRepository.find({
      where: { teamId, role: TeamMemberRole.ADMIN },
    });
    return members.map((m) => m.userId);
  }

  /** Miembro del equipo (admin, jugador fichado o invitado). */
  async isTeamMember(userId: number, teamId: number): Promise<boolean> {
    const member = await this.teamMemberRepository.findOne({
      where: { userId, teamId },
    });
    if (member) return true;

    const onRoster = await this.rosterRepository
      .createQueryBuilder('pr')
      .innerJoin('pr.player', 'p')
      .where('pr.team_id = :teamId', { teamId })
      .andWhere('p.user_id = :userId', { userId })
      .getCount();
    return onRoster > 0;
  }

  async setPrimaryRole(userId: number, roleName: string): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { name: roleName } });
    if (!role) return;
    await this.userRoleRepository.delete({ userId });
    await this.userRoleRepository.save(
      this.userRoleRepository.create({ userId, roleId: role.id }),
    );
  }

  /** No degradar dt / admin de plataforma al crear o unirse a un equipo. */
  private async ensureClubManagerRole(userId: number): Promise<void> {
    const primary = await this.primaryRoleForUser(userId);
    if (
      ['super_admin', 'manager', 'admin', 'dt', 'team_captain'].includes(
        primary,
      )
    ) {
      return;
    }
    await this.setPrimaryRole(userId, 'manager');
  }

  private async primaryRoleForUser(userId: number): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { userRoles: { role: true } },
    });
    if (!user?.userRoles?.length) return 'guest';
    const hierarchy: Record<string, number> = {
      super_admin: 100,
      manager: 80,
      admin: 75,
      dt: 65,
      team_captain: 60,
      tesorero: 55,
      delegado: 50,
      player: 40,
      guest: 10,
    };
    let best = 'guest';
    let bestScore = 0;
    for (const ur of user.userRoles) {
      const name = ur.role?.name;
      if (!name) continue;
      const score = hierarchy[name] ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best = name;
      }
    }
    return best;
  }

  async addTeamMember(
    userId: number,
    teamId: number,
    role: TeamMemberRole,
  ): Promise<TeamMember> {
    const existing = await this.teamMemberRepository.findOne({
      where: { userId, teamId },
    });
    if (existing) {
      if (role === TeamMemberRole.ADMIN && existing.role !== TeamMemberRole.ADMIN) {
        existing.role = TeamMemberRole.ADMIN;
        return this.teamMemberRepository.save(existing);
      }
      return existing;
    }
    return this.teamMemberRepository.save(
      this.teamMemberRepository.create({ userId, teamId, role }),
    );
  }

  async ensureRosterEntries(
    userId: number,
    teamId: number,
    categoryIds: number[],
  ): Promise<void> {
    if (!categoryIds.length) return;

    const season = this.currentSeason();
    let player = await this.playerRepository.findOne({
      where: { user_id: userId, team_id: teamId },
    });
    if (!player) {
      player = await this.playerRepository.save(
        this.playerRepository.create({
          user_id: userId,
          team_id: teamId,
          isActive: true,
          joinedTeamDate: new Date(),
        }),
      );
    }

    const usedJerseys = await this.rosterRepository.find({
      where: { teamId, season },
      select: ['jerseyNumber', 'playerId'],
    });
    let nextJersey = 1;
    const taken = new Set(usedJerseys.map((r) => r.jerseyNumber));
    while (taken.has(nextJersey)) nextJersey++;

    for (const categoryId of categoryIds) {
      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });
      if (!category) continue;

      const exists = await this.rosterRepository.findOne({
        where: { playerId: player.id, teamId, season, categoryId },
      });
      if (exists) continue;

      const jerseyConflict = usedJerseys.find(
        (r) => r.jerseyNumber === nextJersey && r.playerId !== player!.id,
      );
      const jersey = jerseyConflict ? nextJersey + 100 : nextJersey;

      await this.rosterRepository.save(
        this.rosterRepository.create({
          playerId: player.id,
          teamId,
          jerseyNumber: jersey,
          season,
          categoryId,
          category: category.name,
          isEnabled: true,
          position: 'player',
          documentNumber: `USR-${userId}`,
          medicalStatus: 'pending',
        }),
      );
    }
  }

  async createInvite(
    teamId: number,
    createdBy: number,
    categoryIds?: number[],
  ): Promise<{ code: string; teamId: number }> {
    const isAdmin = await this.isTeamAdmin(createdBy, teamId);
    if (!isAdmin) {
      throw new ForbiddenException('Solo el admin del equipo puede generar invitaciones');
    }

    let code = this.generateCode();
    while (await this.teamInviteRepository.findOne({ where: { code } })) {
      code = this.generateCode();
    }

    await this.teamInviteRepository.save(
      this.teamInviteRepository.create({
        teamId,
        code,
        createdBy,
        categoryIds: categoryIds?.length ? categoryIds : null,
        isActive: true,
      }),
    );

    return { code, teamId };
  }

  async previewInvite(code: string) {
    const invite = await this.teamInviteRepository.findOne({
      where: { code: code.trim().toUpperCase(), isActive: true },
      relations: ['team', 'team.sport', 'team.teamCategories', 'team.teamCategories.category'],
    });
    if (!invite?.team) {
      throw new NotFoundException('Código de invitación inválido o expirado');
    }
    const mapped = mapTeamWithCategories(invite.team);
    return {
      code: invite.code,
      teamId: invite.teamId,
      teamName: invite.team.name,
      sportName: invite.team.sport?.name,
      categoryIds: invite.categoryIds ?? mapped.categoryIds ?? [],
      categoryNames: mapped.categoryNames ?? [],
    };
  }

  private async isStaffUser(userId: number): Promise<boolean> {
    const role = await this.primaryRoleForUser(userId);
    return ['super_admin', 'manager', 'admin', 'dt', 'team_captain'].includes(
      role,
    );
  }

  async joinWithCode(userId: number, dto: JoinTeamDto) {
    const invite = await this.teamInviteRepository.findOne({
      where: { code: dto.inviteCode.trim().toUpperCase(), isActive: true },
      relations: ['team'],
    });
    if (!invite?.team) {
      throw new NotFoundException('Código de invitación inválido o expirado');
    }

    const isStaff = await this.isStaffUser(userId);
    const memberRole = isStaff ? TeamMemberRole.ADMIN : TeamMemberRole.PLAYER;
    await this.addTeamMember(userId, invite.teamId, memberRole);

    if (!isStaff) {
      await this.setPrimaryRole(userId, 'player');
    }

    // Jugadores: categorías del invite o las elegidas. Staff: plantel solo si elige categorías.
    let categoryIds: number[] = [];
    if (isStaff) {
      categoryIds = dto.categoryIds?.length ? dto.categoryIds : [];
    } else {
      categoryIds = dto.categoryIds?.length
        ? dto.categoryIds
        : ((invite.categoryIds as number[] | undefined) ?? []);
      if (!categoryIds.length) {
        const mapped = mapTeamWithCategories(invite.team);
        categoryIds = mapped.categoryIds ?? [];
      }
    }

    if (categoryIds.length) {
      await this.ensureRosterEntries(userId, invite.teamId, categoryIds);
    }

    const role = await this.primaryRoleForUser(userId);
    const teamName = invite.team.name;
    let message = `Te uniste a ${teamName}`;
    if (isStaff) {
      message = categoryIds.length
        ? `Te uniste a ${teamName} como cuerpo técnico y jugador`
        : `Te uniste a ${teamName} como cuerpo técnico`;
    }

    return {
      team: await this.findOne(invite.teamId),
      teamId: invite.teamId,
      role,
      joinedAsStaff: isStaff,
      onRoster: categoryIds.length > 0,
      message,
    };
  }

  async completeOnboarding(userId: number, dto: TeamOnboardingDto) {
    if (dto.mode === TeamOnboardingMode.SKIP) {
      return { mode: 'skip', message: 'Onboarding de equipo omitido' };
    }

    if (dto.mode === TeamOnboardingMode.JOIN) {
      if (!dto.inviteCode?.trim()) {
        throw new BadRequestException('Ingresá el código de invitación');
      }
      return this.joinWithCode(userId, {
        inviteCode: dto.inviteCode,
        categoryIds: dto.categoryIds,
      });
    }

    if (dto.mode === TeamOnboardingMode.CREATE) {
      if (!dto.name?.trim() || !dto.sportId) {
        throw new BadRequestException('Nombre y deporte son obligatorios para crear un equipo');
      }
      const categoryIds = dto.categoryIds ?? [];
      if (!categoryIds.length) {
        throw new BadRequestException('Seleccioná al menos una categoría');
      }

      const trimmedName = dto.name.trim();
      const existingTeams = await this.teamRepository.find({
        where: { name: trimmedName, sport_id: dto.sportId },
        relations: ['teamCategories'],
      });

      const ownTeam = existingTeams.find((t) => t.createdByUserId === userId);
      if (ownTeam) {
        const member = await this.teamMemberRepository.findOne({
          where: { userId, teamId: ownTeam.id },
        });
        if (member) {
          throw new ConflictException('Ya sos miembro de este equipo');
        }

        await this.addTeamMember(userId, ownTeam.id, TeamMemberRole.ADMIN);
        const mergedCategoryIds = [
          ...new Set([
            ...(ownTeam.teamCategories?.map((tc) => tc.categoryId) ?? []),
            ...categoryIds,
          ]),
        ];
        if (mergedCategoryIds.length) {
          await this.setTeamCategories(ownTeam.id, mergedCategoryIds);
        }
        await this.ensureRosterEntries(userId, ownTeam.id, categoryIds);
        await this.ensureClubManagerRole(userId);

        const role = await this.primaryRoleForUser(userId);
        return {
          mode: 'join_existing',
          team: await this.findOne(ownTeam.id),
          role,
          message: `Ya tenías el equipo "${ownTeam.name}" cargado. Te vinculamos como encargado.`,
        };
      }

      const foreignTeams = existingTeams.filter(
        (t) => t.createdByUserId !== userId,
      );
      if (foreignTeams.length > 0 && !dto.acknowledgeDuplicateName) {
        const adminEmails = await this.getAdminEmailsForTeams(
          foreignTeams.map((t) => t.id),
        );
        throw new ConflictException({
          message:
            'Ya existe otro equipo con este nombre en el mismo deporte. ' +
            'Si es un club distinto, confirmá la creación. ' +
            'Si es el tuyo, unite con el código de invitación del administrador.',
          code: 'DUPLICATE_TEAM_NAME',
          teams: foreignTeams.map((t) => ({
            id: t.id,
            name: t.name,
            adminEmails: adminEmails.get(t.id) ?? [],
          })),
        });
      }

      const team = await this.create({
        name: trimmedName,
        sport_id: dto.sportId,
        description: dto.description ?? 'Equipo creado desde la app',
        categoryIds,
        createdByUserId: userId,
      });

      await this.addTeamMember(userId, team.id, TeamMemberRole.ADMIN);
      await this.ensureClubManagerRole(userId);
      await this.ensureRosterEntries(userId, team.id, categoryIds);

      const { code } = await this.createInvite(team.id, userId, categoryIds);
      const role = await this.primaryRoleForUser(userId);

      return {
        mode: 'create',
        team,
        inviteCode: code,
        role,
        message: `Equipo "${team.name}" creado. Compartí el código ${code} con tu plantel.`,
      };
    }

    throw new BadRequestException('Modo de onboarding inválido');
  }

  private isPlatformAdminRole(globalRole?: string): boolean {
    return ['super_admin', 'manager', 'admin'].includes(globalRole ?? '');
  }

  /** Al crear desde la app, el usuario queda como encargado del equipo (team_members + roster). */
  async createWithCreator(
    userId: number,
    createTeamData: Partial<Team> & { categoryIds?: number[] },
    globalRole?: string,
  ) {
    const categoryIds =
      createTeamData.categoryIds?.length
        ? createTeamData.categoryIds
        : createTeamData.categoryId
          ? [createTeamData.categoryId]
          : [];

    const team = await this.create({
      ...createTeamData,
      createdByUserId: userId,
    });

    await this.addTeamMember(userId, team.id, TeamMemberRole.ADMIN);
    if (categoryIds.length) {
      await this.ensureRosterEntries(userId, team.id, categoryIds);
    }
    if (!this.isPlatformAdminRole(globalRole)) {
      await this.ensureClubManagerRole(userId);
    }
    await this.createInvite(team.id, userId, categoryIds);

    return this.findOne(team.id);
  }

  /** Super admin / manager sin membresía previa: asignarse a un equipo ya creado. */
  async claimTeamAsAdmin(
    userId: number,
    teamId: number,
    globalRole?: string,
  ) {
    if (!this.isPlatformAdminRole(globalRole)) {
      throw new ForbiddenException(
        'Solo administradores de la plataforma pueden asignarse como encargado',
      );
    }

    const mapped = await this.findOne(teamId);
    const categoryIds =
      (mapped as { categoryIds?: number[] }).categoryIds ?? [];

    await this.addTeamMember(userId, teamId, TeamMemberRole.ADMIN);
    if (categoryIds.length) {
      await this.ensureRosterEntries(userId, teamId, categoryIds);
    }

    return {
      teamId,
      teamName: mapped.name,
      message: `Te asignaste como encargado de ${mapped.name}`,
    };
  }

  async create(
    createTeamData: Partial<Team> & {
      categoryIds?: number[];
      createdByUserId?: number;
      sport_id?: number;
      founded_year?: number;
      logo_url?: string;
      category_id?: number;
    },
  ): Promise<Team> {
    const normalized = this.normalizeTeamPayload(createTeamData);
    const { categoryIds, createdByUserId, ...teamData } = {
      ...normalized,
      createdByUserId: createTeamData.createdByUserId,
    };
    const team = await this.teamRepository.save(
      this.teamRepository.create({
        ...teamData,
        ...(createdByUserId != null ? { createdByUserId } : {}),
      }),
    );
    if (categoryIds?.length) {
      await this.setTeamCategories(team.id, categoryIds);
    } else if (teamData.categoryId) {
      await this.setTeamCategories(team.id, [teamData.categoryId]);
    }
    return this.findOne(team.id);
  }

  async findAll() {
    const teams = await this.teamRepository.find({
      relations: [...TEAM_RELATIONS],
      order: { name: 'ASC' },
    });
    return teams.map(mapTeamWithCategories);
  }

  async findOne(id: number) {
    const team = await this.teamRepository.findOne({
      where: { id },
      relations: [...TEAM_RELATIONS, 'playerTeams'],
    });
    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }
    return mapTeamWithCategories(team);
  }

  async findBySport(sportId: number) {
    const teams = await this.teamRepository.find({
      where: { sport_id: sportId },
      relations: [...TEAM_RELATIONS],
      order: { name: 'ASC' },
    });
    return teams.map(mapTeamWithCategories);
  }

  async getAdminEmailsForTeams(
    teamIds: number[],
  ): Promise<Map<number, string[]>> {
    const result = new Map<number, string[]>();
    if (!teamIds.length) return result;

    const members = await this.teamMemberRepository.find({
      where: { teamId: In(teamIds), role: TeamMemberRole.ADMIN },
      relations: ['user'],
    });

    for (const m of members) {
      const email = m.user?.email;
      if (!email) continue;
      const list = result.get(m.teamId) ?? [];
      if (!list.includes(email)) list.push(email);
      result.set(m.teamId, list);
    }

    return result;
  }

  async searchTeams(query: string) {
    const teams = await this.teamRepository.find({
      where: [
        { name: Like(`%${query}%`) },
        { description: Like(`%${query}%`) },
      ],
      relations: [...TEAM_RELATIONS],
      order: { name: 'ASC' },
      take: 20,
    });
    const mapped = teams.map(mapTeamWithCategories);
    const adminEmails = await this.getAdminEmailsForTeams(
      teams.map((t) => t.id),
    );
    return mapped.map((team) => ({
      ...team,
      adminEmails: adminEmails.get(team.id) ?? [],
    }));
  }

  async update(
    id: number,
    updateData: Partial<Team> & {
      categoryIds?: number[];
      sport_id?: number;
      founded_year?: number;
      logo_url?: string;
      category_id?: number;
    },
  ) {
    const normalized = this.normalizeTeamPayload(updateData);
    const { categoryIds, ...teamFields } = normalized;
    const team = await this.teamRepository.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }
    Object.assign(team, teamFields);
    await this.teamRepository.save(team);
    if (categoryIds !== undefined) {
      await this.setTeamCategories(id, categoryIds);
    }
    return this.findOne(id);
  }

  async setTeamCategories(teamId: number, categoryIds: number[]): Promise<void> {
    await this.teamCategoryRepository.delete({ teamId });
    const uniqueIds = [...new Set(categoryIds.filter((id) => id > 0))];
    if (uniqueIds.length === 0) return;

    await this.teamCategoryRepository.save(
      uniqueIds.map((categoryId) =>
        this.teamCategoryRepository.create({ teamId, categoryId }),
      ),
    );

    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (team) {
      team.categoryId = uniqueIds[0];
      await this.teamRepository.save(team);
    }
  }

  async remove(id: number): Promise<void> {
    const team = await this.teamRepository.findOne({ where: { id } });
    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }
    await this.teamRepository.remove(team);
  }

  async findOrCreateByName(
    name: string,
    sportId: number,
    categoryId?: number,
    userId?: number,
  ) {
    let team = await this.teamRepository.findOne({
      where: { name, sport_id: sportId },
      relations: [...TEAM_RELATIONS],
    });

    if (!team) {
      const created = await this.create({
        name,
        sport_id: sportId,
        categoryId,
        description: 'Equipo creado durante onboarding',
        categoryIds: categoryId ? [categoryId] : [],
      });
      if (userId) {
        await this.addTeamMember(userId, created.id, TeamMemberRole.ADMIN);
        await this.ensureClubManagerRole(userId);
        if (categoryId) {
          await this.ensureRosterEntries(userId, created.id, [categoryId]);
        }
        await this.createInvite(created.id, userId, categoryId ? [categoryId] : []);
      }
      return created;
    }

    if (categoryId) {
      const exists = team.teamCategories?.some(
        (tc) => tc.categoryId === categoryId,
      );
      if (!exists) {
        await this.teamCategoryRepository.save(
          this.teamCategoryRepository.create({ teamId: team.id, categoryId }),
        );
      }
    }

    return this.findOne(team.id);
  }

  async getFootballTeams() {
    const teams = await this.teamRepository.find({
      where: { sport: { name: 'Fútbol' } },
      relations: [...TEAM_RELATIONS],
      order: { name: 'ASC' },
    });
    return teams.map(mapTeamWithCategories);
  }

  async findMyTeams(userId: number): Promise<MyTeamOption[]> {
    const adminMemberships = await this.teamMemberRepository.find({
      where: { userId },
      relations: ['team', 'team.sport', 'team.teamCategories', 'team.teamCategories.category'],
    });

    const entries = await this.rosterRepository
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.team', 'team')
      .leftJoinAndSelect('team.sport', 'sport')
      .leftJoinAndSelect('team.teamCategories', 'tc')
      .leftJoinAndSelect('tc.category', 'tcat')
      .leftJoinAndSelect('r.categoryRef', 'rcat')
      .innerJoin('r.player', 'player')
      .where('player.user_id = :userId', { userId })
      .orderBy('team.name', 'ASC')
      .addOrderBy('r.category', 'ASC')
      .getMany();

    const byTeam = new Map<number, MyTeamOption>();

    for (const membership of adminMemberships) {
      const team = membership.team;
      if (!team) continue;
      const mapped = mapTeamWithCategories(team);
      byTeam.set(team.id, {
        teamId: team.id,
        name: team.name,
        categories: mapped.categoryNames ?? [],
        categoryIds: mapped.categoryIds ?? [],
        sportName: team.sport?.name,
        isTeamAdmin: membership.role === TeamMemberRole.ADMIN,
        teamMemberRole: membership.role,
        canManageFinance: [
          TeamMemberRole.ADMIN,
          TeamMemberRole.TREASURER,
          TeamMemberRole.DELEGATE,
        ].includes(membership.role),
        team: mapped,
      });
    }

    for (const entry of entries) {
      const team = entry.team;
      if (!team) continue;

      if (!byTeam.has(team.id)) {
        const mapped = mapTeamWithCategories(team);
        byTeam.set(team.id, {
          teamId: team.id,
          name: team.name,
          categories: mapped.categoryNames ?? [],
          categoryIds: mapped.categoryIds ?? [],
          sportName: team.sport?.name,
          isTeamAdmin: false,
          team: mapped,
        });
      }

      const opt = byTeam.get(team.id)!;
      const mapped = mapTeamWithCategories(team);
      if ((mapped.categoryNames?.length ?? 0) > opt.categories.length) {
        opt.categories = mapped.categoryNames ?? opt.categories;
        opt.categoryIds = mapped.categoryIds ?? opt.categoryIds;
      }
      const label = entry.categoryRef?.name ?? entry.category;
      if (label && !opt.categories.includes(label)) {
        opt.categories.push(label);
      }
      if (entry.categoryId && !opt.categoryIds.includes(entry.categoryId)) {
        opt.categoryIds.push(entry.categoryId);
      }
    }

    return Array.from(byTeam.values());
  }

  async listInvitesForTeam(teamId: number, userId: number) {
    const isAdmin = await this.isTeamAdmin(userId, teamId);
    if (!isAdmin) {
      throw new ForbiddenException('Solo el admin del equipo puede ver invitaciones');
    }
    const invites = await this.teamInviteRepository.find({
      where: { teamId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    return invites.map((i) => ({
      id: i.id,
      code: i.code,
      categoryIds: i.categoryIds,
      createdAt: i.createdAt,
    }));
  }
}
