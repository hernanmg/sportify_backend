import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { PlayerImpediment } from './entities/player-impediment.entity';
import { PlayerFeeOverride } from './entities/player-fee-override.entity';
import { PlayerStatusAuditLog } from './entities/player-status-audit.entity';
import { UpsertImpedimentDto } from './dtos/upsert-impediment.dto';
import { ImpedimentType } from './eligibility.enums';
import { PlayerEligibilityService } from './player-eligibility.service';
import { TeamsService } from '../teams/teams.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PlayerStatusService {
  constructor(
    @InjectRepository(PlayerImpediment)
    private readonly impedimentRepository: Repository<PlayerImpediment>,
    @InjectRepository(PlayerFeeOverride)
    private readonly feeOverrideRepository: Repository<PlayerFeeOverride>,
    @InjectRepository(PlayerStatusAuditLog)
    private readonly auditRepository: Repository<PlayerStatusAuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    private readonly eligibilityService: PlayerEligibilityService,
    private readonly teamsService: TeamsService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
  ) {}

  async assertCanManageTeam(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const allowedGlobal = ['super_admin', 'manager', 'admin', 'team_captain'];
    if (globalRole && allowedGlobal.includes(globalRole)) {
      if (['super_admin', 'manager'].includes(globalRole)) return;
    }
    const isAdmin = await this.teamsService.isTeamAdmin(userId, teamId);
    if (!isAdmin) {
      throw new ForbiddenException(
        'Solo el admin o DT del equipo pueden gestionar el estado de jugadores',
      );
    }
  }

  /** Cualquier integrante del equipo puede reportar lesión / impedimento. */
  async assertCanReportImpediment(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const elevated = ['super_admin', 'manager', 'admin', 'team_captain'];
    if (globalRole && elevated.includes(globalRole)) return;
    const isMember = await this.teamsService.isTeamMember(userId, teamId);
    if (!isMember) {
      throw new ForbiddenException(
        'Debés ser miembro del equipo para registrar un impedimento',
      );
    }
  }

  private computeEndDate(
    startDate: string,
    durationDays?: number,
  ): string | undefined {
    if (!durationDays) return undefined;
    const d = new Date(startDate);
    d.setDate(d.getDate() + durationDays);
    return d.toISOString().slice(0, 10);
  }

  private formatUserName(user: User | null | undefined): string {
    if (!user) return 'Usuario desconocido';
    const full = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return full || user.username;
  }

  private impedimentTypeLabel(type: ImpedimentType): string {
    switch (type) {
      case ImpedimentType.INJURY:
        return 'Lesión';
      case ImpedimentType.SUSPENSION:
        return 'Suspensión';
      default:
        return 'Otro impedimento';
    }
  }

  private async resolveCategoryForUser(
    teamId: number,
    userId: number,
  ): Promise<string | undefined> {
    const rows = await this.rosterRepository.find({
      where: { teamId },
      relations: ['player', 'categoryRef'],
    });
    const row = rows.find((r) => r.player?.user_id === userId);
    if (!row) return undefined;
    return row.categoryRef?.name ?? row.category ?? undefined;
  }

  async listImpediments(teamId: number, userId?: number) {
    await this.eligibilityService.deactivateExpiredImpediments(teamId);
    return this.impedimentRepository.find({
      where: userId ? { teamId, userId } : { teamId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  async createImpediment(
    teamId: number,
    dto: UpsertImpedimentDto,
    actorId: number,
  ) {
    await this.impedimentRepository.update(
      { teamId, userId: dto.userId, isActive: true },
      { isActive: false, updatedBy: actorId },
    );

    const endDate = this.computeEndDate(dto.startDate, dto.durationDays);
    const saved = await this.impedimentRepository.save(
      this.impedimentRepository.create({
        teamId,
        userId: dto.userId,
        impedimentType: dto.impedimentType,
        description: dto.description,
        startDate: dto.startDate,
        durationDays: dto.durationDays,
        endDate,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
      }),
    );

    await this.eligibilityService.logAudit(
      teamId,
      dto.userId,
      'impediment_created',
      actorId,
      { impedimentId: saved.id, type: dto.impedimentType },
    );

    const [affectedUser, actorUser] = await Promise.all([
      this.userRepository.findOne({ where: { id: dto.userId } }),
      this.userRepository.findOne({ where: { id: actorId } }),
    ]);
    const categoryLabel = await this.resolveCategoryForUser(teamId, dto.userId);
    const staffIds = await this.teamsService.listTeamAdminUserIds(teamId);
    const payload = {
      playerName: this.formatUserName(affectedUser),
      reportedByName: this.formatUserName(actorUser),
      impedimentTypeLabel: this.impedimentTypeLabel(dto.impedimentType),
      categoryLabel,
      clinicalDescription: dto.description,
      startDate: dto.startDate,
      endDate,
    };
    await this.notificationsService.notifyImpedimentCreated(
      teamId,
      dto.userId,
      actorId,
      staffIds,
      payload,
    );

    return saved;
  }

  async clearImpediment(
    teamId: number,
    impedimentId: number,
    actorId: number,
  ) {
    const imp = await this.impedimentRepository.findOne({
      where: { id: impedimentId, teamId },
    });
    if (!imp) throw new NotFoundException('Impedimento no encontrado');
    imp.isActive = false;
    imp.updatedBy = actorId;
    await this.impedimentRepository.save(imp);
    await this.eligibilityService.logAudit(
      teamId,
      imp.userId,
      'impediment_cleared',
      actorId,
      { impedimentId },
    );

    const [affectedUser, actorUser] = await Promise.all([
      this.userRepository.findOne({ where: { id: imp.userId } }),
      this.userRepository.findOne({ where: { id: actorId } }),
    ]);
    const tipo = this.impedimentTypeLabel(imp.impedimentType).toLowerCase();
    await this.notificationsService.sendImpedimentCleared(imp.userId, teamId, {
      playerName: this.formatUserName(affectedUser),
      reason: `Tu ${tipo} fue dado de alta. Ya podés ser convocado.`,
      impedimentTypeLabel: this.impedimentTypeLabel(imp.impedimentType),
      clearedByName:
        actorId === imp.userId
          ? undefined
          : this.formatUserName(actorUser),
    });

    return imp;
  }

  /** Desactiva impedimentos vencidos y notifica (cron). */
  async processExpiredImpediments(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const active = await this.impedimentRepository.find({
      where: { isActive: true },
    });
    let count = 0;
    for (const imp of active) {
      const end =
        imp.endDate ??
        (imp.durationDays && imp.startDate
          ? this.computeEndDate(imp.startDate, imp.durationDays)
          : undefined);
      if (!end || end > today) continue;
      imp.isActive = false;
      await this.impedimentRepository.save(imp);
      const affectedUser = await this.userRepository.findOne({
        where: { id: imp.userId },
      });
      await this.notificationsService.sendImpedimentCleared(imp.userId, imp.teamId, {
        playerName: this.formatUserName(affectedUser),
        reason:
          'Tu impedimento cumplió el plazo. Ya estás habilitado para convocatorias.',
        impedimentTypeLabel: this.impedimentTypeLabel(imp.impedimentType),
      });
      count++;
    }
    return count;
  }

  async setFeeOverride(
    teamId: number,
    targetUserId: number,
    actorId: number,
    reason?: string,
  ) {
    let row = await this.feeOverrideRepository.findOne({
      where: { teamId, userId: targetUserId },
    });
    if (!row) {
      row = this.feeOverrideRepository.create({
        teamId,
        userId: targetUserId,
        overriddenBy: actorId,
        overriddenAt: new Date(),
        reason,
        isActive: true,
      });
    } else {
      row.isActive = true;
      row.overriddenBy = actorId;
      row.overriddenAt = new Date();
      row.reason = reason;
    }
    const saved = await this.feeOverrideRepository.save(row);
    await this.eligibilityService.logAudit(
      teamId,
      targetUserId,
      'fee_override',
      actorId,
      { reason },
    );
    return saved;
  }

  async clearFeeOverride(teamId: number, targetUserId: number, actorId: number) {
    const row = await this.feeOverrideRepository.findOne({
      where: { teamId, userId: targetUserId },
    });
    if (!row) {
      throw new NotFoundException('No hay override de cuota para este jugador');
    }
    row.isActive = false;
    await this.feeOverrideRepository.save(row);
    await this.eligibilityService.logAudit(
      teamId,
      targetUserId,
      'fee_override_cleared',
      actorId,
    );
    return row;
  }

  async getAuditLog(teamId: number, userId?: number, limit = 50) {
    return this.auditRepository.find({
      where: userId ? { teamId, userId } : { teamId },
      relations: ['performer'],
      order: { performedAt: 'DESC' },
      take: limit,
    });
  }
}
