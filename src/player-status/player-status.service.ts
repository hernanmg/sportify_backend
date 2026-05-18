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

  private computeEndDate(
    startDate: string,
    durationDays?: number,
  ): string | undefined {
    if (!durationDays) return undefined;
    const d = new Date(startDate);
    d.setDate(d.getDate() + durationDays);
    return d.toISOString().slice(0, 10);
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

    const typeLabel =
      imp.impedimentType === ImpedimentType.INJURY
        ? 'lesión'
        : imp.impedimentType === ImpedimentType.SUSPENSION
          ? 'suspensión'
          : 'impedimento';
    await this.notificationsService.sendImpedimentCleared(imp.userId, teamId, {
      reason: `Tu ${typeLabel} fue dado de alta. Ya podés ser convocado.`,
      impedimentType: imp.impedimentType,
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
      await this.notificationsService.sendImpedimentCleared(imp.userId, imp.teamId, {
        reason: 'Tu impedimento cumplió el plazo. Ya estás habilitado para convocatorias.',
        impedimentType: imp.impedimentType,
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
