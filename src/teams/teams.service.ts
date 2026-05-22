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
    const y = new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }

  private generateCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  async isTeamAdmin(userId: number, teamId: number): Promise<boolean> {
    const member = await this.teamMemberRepository.findOne({
      where: { userId, teamId, role: TeamMemberRole.ADMIN },
    });
    return !!member;
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
      team_captain: 60,
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

  async joinWithCode(userId: number, dto: JoinTeamDto) {
    const invite = await this.teamInviteRepository.findOne({
      where: { code: dto.inviteCode.trim().toUpperCase(), isActive: true },
      relations: ['team'],
    });
    if (!invite?.team) {
      throw new NotFoundException('Código de invitación inválido o expirado');
    }

    await this.addTeamMember(userId, invite.teamId, TeamMemberRole.PLAYER);
    await this.setPrimaryRole(userId, 'player');

    const categoryIds =
      dto.categoryIds?.length
        ? dto.categoryIds
        : (invite.categoryIds as number[] | undefined) ?? [];

    if (categoryIds.length) {
      await this.ensureRosterEntries(userId, invite.teamId, categoryIds);
    }

    const role = await this.primaryRoleForUser(userId);
    return {
      team: await this.findOne(invite.teamId),
      teamId: invite.teamId,
      role,
      message: `Te uniste a ${invite.team.name}`,
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

      const existing = await this.teamRepository.findOne({
        where: { name: dto.name.trim(), sport_id: dto.sportId },
      });
      if (existing) {
        const member = await this.teamMemberRepository.findOne({
          where: { userId, teamId: existing.id },
        });
        if (member) {
          throw new ConflictException('Ya sos miembro de este equipo');
        }
      }

      const team = await this.create({
        name: dto.name.trim(),
        sport_id: dto.sportId,
        description: dto.description ?? 'Equipo creado desde la app',
        categoryIds,
      });

      await this.addTeamMember(userId, team.id, TeamMemberRole.ADMIN);
      // Encargado del club: manager (gestión deportiva, eventos, finanzas de equipo)
      await this.setPrimaryRole(userId, 'manager');
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

  async create(createTeamData: Partial<Team> & { categoryIds?: number[] }): Promise<Team> {
    const { categoryIds, ...teamData } = createTeamData;
    const team = await this.teamRepository.save(
      this.teamRepository.create(teamData),
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
    return teams.map(mapTeamWithCategories);
  }

  async update(
    id: number,
    updateData: Partial<Team> & { categoryIds?: number[] },
  ) {
    const { categoryIds, ...teamFields } = updateData;
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
        await this.setPrimaryRole(userId, 'manager');
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
