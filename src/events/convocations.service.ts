import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  SportEvent,
  SportEventType,
  SportEventStatus,
} from './entities/sport-event.entity';
import {
  EventParticipant,
  ParticipantStatus,
  ParticipantRole,
} from './entities/event-participant.entity';
import { SportEventsService } from './sport-events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlayerEligibilityService } from '../player-status/player-eligibility.service';
import { PlayerStatusService } from '../player-status/player-status.service';
import { TeamsService } from '../teams/teams.service';
import { SetConvocationSquadDto } from './dtos/convocation-squad.dto';
import { EligibilityStatus } from '../player-status/eligibility.enums';

export interface ConvocationDto {
  title: string;
  description?: string;
  eventDate: string;
  location?: string;
  courtNumber?: string;
  teamId: number;
  categoryId?: number;
  opponentName?: string;
  isHomeMatch?: boolean;
  isOfficialMatch?: boolean;
  confirmationDeadline?: string;
  notes?: string;
}

export interface ConvocationStats {
  total: number;
  confirmed: number;
  pending: number;
  declined: number;
  noResponse: number;
  convoked: number;
}

export interface PlayerConvocationHistoryStats {
  userId: number;
  teamId: number;
  totalConvocations: number;
  timesConvoked: number;
  confirmed: number;
  declined: number;
  pending: number;
  noResponse: number;
  confirmationRate: number;
  responseRate: number;
  recent: Array<{
    eventId: number;
    title: string;
    eventDate: string;
    opponentName?: string;
    isConvoked: boolean;
    status: string;
  }>;
}

@Injectable()
export class ConvocationsService {
  constructor(
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    private readonly sportEventsService: SportEventsService,
    private readonly notificationsService: NotificationsService,
    private readonly eligibilityService: PlayerEligibilityService,
    private readonly playerStatusService: PlayerStatusService,
    private readonly teamsService: TeamsService,
  ) {}

  async assertCanManageConvocation(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const allowedGlobal = [
      'super_admin',
      'manager',
      'admin',
      'team_captain',
      'dt',
    ];
    if (globalRole && allowedGlobal.includes(globalRole)) {
      if (['super_admin', 'manager', 'admin'].includes(globalRole)) return;
      if (globalRole === 'dt') {
        const isMember = await this.teamsService.isTeamMember(userId, teamId);
        if (isMember) return;
      }
    }
    await this.playerStatusService.assertCanManageTeam(
      userId,
      teamId,
      globalRole,
    );
  }

  async createConvocation(
    convocationDto: ConvocationDto,
    createdBy: number,
    actorRole?: string,
  ): Promise<SportEvent> {
    const { categoryId, ...rest } = convocationDto;
    const metadata =
      categoryId != null
        ? {
            categoryId,
            categoryIds: [categoryId],
          }
        : undefined;

    const eventData = {
      ...rest,
      metadata,
      type: SportEventType.MATCH,
      status: SportEventStatus.DRAFT,
      createdBy,
      requiresConfirmation: true,
      requiresPaymentUpToDate: convocationDto.isOfficialMatch || false,
      autoInviteParticipants: false,
      sendNotifications: false,
    };

    return await this.sportEventsService.create(
      eventData as any,
      createdBy,
      actorRole,
    );
  }

  async findOne(convocationId: number): Promise<SportEvent> {
    const event = await this.sportEventRepository.findOne({
      where: { id: convocationId, type: SportEventType.MATCH },
      relations: ['team', 'creator', 'participants', 'participants.user'],
    });
    if (!event) {
      throw new NotFoundException(`Convocatoria ${convocationId} no encontrada`);
    }
    return event;
  }

  async getConvocations(
    teamId?: number,
    status?: 'sent' | 'draft',
  ): Promise<SportEvent[]> {
    const whereCondition: Record<string, unknown> = {
      type: SportEventType.MATCH,
    };

    if (teamId) whereCondition.teamId = teamId;
    if (status) {
      whereCondition.status =
        status === 'sent' ? SportEventStatus.SCHEDULED : SportEventStatus.DRAFT;
    }

    return await this.sportEventRepository.find({
      where: whereCondition,
      relations: ['team', 'creator', 'participants', 'participants.user'],
      order: { eventDate: 'ASC' },
    });
  }

  async getEligibleRoster(convocationId: number) {
    const convocation = await this.findOne(convocationId);
    const list = await this.eligibilityService.getTeamEligibility(
      convocation.teamId,
    );
    const meta = convocation.metadata as {
      categoryId?: number;
      categoryIds?: number[];
    } | null;
    const categoryIds = meta?.categoryIds?.length
      ? meta.categoryIds
      : meta?.categoryId != null
        ? [meta.categoryId]
        : [];
    if (!categoryIds.length) {
      return list;
    }
    const allowed = new Set<number>();
    for (const categoryId of categoryIds) {
      const ids = await this.eligibilityService.getRosterUserIdsByCategory(
        convocation.teamId,
        categoryId,
      );
      for (const id of ids) allowed.add(id);
    }
    return list.filter((e) => allowed.has(e.userId));
  }

  async setSquad(
    convocationId: number,
    dto: SetConvocationSquadDto,
    actorId: number,
  ): Promise<SportEvent> {
    const convocation = await this.findOne(convocationId);
    if (convocation.status !== SportEventStatus.DRAFT) {
      throw new BadRequestException(
        'Solo se puede editar el plantel en borrador',
      );
    }

    if (dto.feeOverrides?.length) {
      for (const item of dto.feeOverrides) {
        await this.playerStatusService.setFeeOverride(
          convocation.teamId,
          item.userId,
          actorId,
          item.reason,
        );
      }
    }

    const eligibility = await this.eligibilityService.getTeamEligibility(
      convocation.teamId,
    );
    const byUser = new Map(eligibility.map((e) => [e.userId, e]));

    await this.participantRepository.delete({ eventId: convocationId });

    const rows: Partial<EventParticipant>[] = [];
    for (const userId of dto.convokedUserIds) {
      const entry = byUser.get(userId);
      if (!entry) {
        throw new BadRequestException(
          `El jugador ${userId} no está en el plantel elegible del equipo`,
        );
      }
      rows.push({
        eventId: convocationId,
        userId: entry.userId,
        status: ParticipantStatus.PENDING,
        role: ParticipantRole.PLAYER,
        isConvoked: true,
        eligibilityStatus: entry.status,
        eligibilityDetail: entry.reason,
        feeOverrideBy: entry.feeOverride?.overriddenBy,
        feeOverrideAt: entry.feeOverride
          ? new Date(entry.feeOverride.overriddenAt)
          : undefined,
      });
    }

    if (rows.length) {
      await this.participantRepository.save(
        this.participantRepository.create(rows),
      );
    }

    return this.findOne(convocationId);
  }

  async sendConvocation(convocationId: number): Promise<SportEvent> {
    const convocation = await this.findOne(convocationId);

    if (convocation.status !== SportEventStatus.DRAFT) {
      throw new BadRequestException('La convocatoria ya fue enviada');
    }

    const participants = convocation.participants ?? [];
    if (!participants.length) {
      throw new BadRequestException(
        'Definí el plantel antes de enviar la convocatoria',
      );
    }

    const convokedCount = participants.filter((p) => p.isConvoked).length;
    if (convokedCount === 0) {
      throw new BadRequestException('Debe haber al menos un jugador convocado');
    }

    await this.sportEventsService.update(convocationId, {
      status: SportEventStatus.SCHEDULED,
    });

    const squadSummary = participants.map((p) => ({
      userId: p.userId,
      name: p.user
        ? [p.user.firstName, p.user.lastName].filter(Boolean).join(' ').trim() ||
          p.user.username
        : `Usuario ${p.userId}`,
      isConvoked: p.isConvoked,
      eligibilityStatus: p.eligibilityStatus,
      eligibilityDetail: p.eligibilityDetail,
    }));

    const convokedUserIds = participants
      .filter((p) => p.isConvoked)
      .map((p) => p.userId);

    await this.notificationsService.sendMatchInvitation(
      convocation.id,
      convocation.teamId,
      {
        date: convocation.eventDate.toISOString(),
        opponent: convocation.opponentName || 'Por definir',
        location: [
          convocation.location,
          convocation.courtNumber
            ? `Cancha ${convocation.courtNumber}`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        courtNumber: convocation.courtNumber,
        squadSummary,
        isOfficial: convocation.isOfficialMatch,
      },
      convokedUserIds,
    );

    return this.findOne(convocationId);
  }

  async getConvocationStats(convocationId: number): Promise<ConvocationStats> {
    const participants = await this.participantRepository.find({
      where: { eventId: convocationId },
    });

    const stats: ConvocationStats = {
      total: 0,
      confirmed: 0,
      pending: 0,
      declined: 0,
      noResponse: 0,
      convoked: 0,
    };

    const convoked = participants.filter((p) => p.isConvoked);
    stats.total = convoked.length;
    stats.convoked = convoked.length;

    convoked.forEach((participant) => {
      switch (participant.status) {
        case ParticipantStatus.CONFIRMED:
          stats.confirmed++;
          break;
        case ParticipantStatus.PENDING:
          stats.pending++;
          break;
        case ParticipantStatus.DECLINED:
          stats.declined++;
          break;
        case ParticipantStatus.NO_RESPONSE:
          stats.noResponse++;
          break;
      }
    });

    return stats;
  }

  async getConvocationResponses(
    convocationId: number,
  ): Promise<EventParticipant[]> {
    return await this.participantRepository.find({
      where: { eventId: convocationId, isConvoked: true },
      relations: ['user'],
      order: { status: 'ASC', createdAt: 'ASC' },
    });
  }

  async resendConvocation(convocationId: number): Promise<void> {
    const convocation = await this.findOne(convocationId);
    const participants = convocation.participants ?? [];
    const convokedUserIds = participants
      .filter((p) => p.isConvoked)
      .map((p) => p.userId);

    await this.notificationsService.sendMatchInvitation(
      convocation.id,
      convocation.teamId,
      {
        date: convocation.eventDate.toISOString(),
        opponent: convocation.opponentName || 'Por definir',
        location: convocation.location || 'Por definir',
        courtNumber: convocation.courtNumber,
      },
      convokedUserIds,
    );
  }

  async updateConvocation(
    convocationId: number,
    updateData: Partial<ConvocationDto>,
  ): Promise<SportEvent> {
    const convocation = await this.findOne(convocationId);
    if (convocation.status !== SportEventStatus.DRAFT) {
      throw new BadRequestException(
        'Solo se pueden editar convocatorias en borrador',
      );
    }

    return await this.sportEventsService.update(convocationId, {
      title: updateData.title,
      description: updateData.description,
      eventDate: updateData.eventDate,
      location: updateData.location,
      courtNumber: updateData.courtNumber,
      opponentName: updateData.opponentName,
      isHomeMatch: updateData.isHomeMatch,
      isOfficialMatch: updateData.isOfficialMatch,
      confirmationDeadline: updateData.confirmationDeadline,
      notes: updateData.notes,
      requiresPaymentUpToDate: updateData.isOfficialMatch,
    } as any);
  }

  async deleteConvocation(convocationId: number): Promise<void> {
    await this.findOne(convocationId);
    await this.sportEventsService.remove(convocationId);
  }

  async confirmParticipation(
    convocationId: number,
    userId: number,
    notes?: string,
  ): Promise<EventParticipant> {
    const participant = await this.participantRepository.findOne({
      where: { eventId: convocationId, userId },
    });
    if (!participant?.isConvoked) {
      throw new BadRequestException(
        'No estás convocado para este partido o no podés confirmar',
      );
    }
    return await this.sportEventsService.updateParticipantResponse(
      convocationId,
      userId,
      { status: 'confirmed', notes },
    );
  }

  async declineParticipation(
    convocationId: number,
    userId: number,
    notes?: string,
  ): Promise<EventParticipant> {
    return await this.sportEventsService.updateParticipantResponse(
      convocationId,
      userId,
      { status: 'declined', notes },
    );
  }

  async getUpcomingConvocations(teamId: number): Promise<SportEvent[]> {
    const now = new Date();
    return await this.sportEventRepository.find({
      where: {
        teamId,
        type: SportEventType.MATCH,
        status: SportEventStatus.SCHEDULED,
      },
      relations: ['team', 'participants', 'participants.user'],
      order: { eventDate: 'ASC' },
      take: 10,
    }).then((rows) => rows.filter((r) => r.eventDate > now));
  }

  async getUserConvocations(userId: number): Promise<SportEvent[]> {
    const participants = await this.participantRepository.find({
      where: { userId },
      relations: ['event', 'event.team'],
    });

    return participants
      .filter((p) => p.event.type === SportEventType.MATCH && p.isConvoked)
      .map((p) => p.event)
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
  }

  async getPendingResponses(userId: number): Promise<SportEvent[]> {
    const participants = await this.participantRepository.find({
      where: {
        userId,
        status: ParticipantStatus.PENDING,
        isConvoked: true,
      },
      relations: ['event', 'event.team'],
    });

    return participants
      .filter((p) => p.event.type === SportEventType.MATCH)
      .filter((p) => p.event.eventDate > new Date())
      .map((p) => p.event)
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
  }

  async overrideParticipantFee(
    convocationId: number,
    targetUserId: number,
    actorId: number,
    reason?: string,
  ): Promise<EventParticipant> {
    const convocation = await this.findOne(convocationId);
    await this.playerStatusService.setFeeOverride(
      convocation.teamId,
      targetUserId,
      actorId,
      reason,
    );

    const fresh = await this.eligibilityService.getTeamEligibility(
      convocation.teamId,
    );
    const entry = fresh.find((e) => e.userId === targetUserId);

    await this.participantRepository.update(
      { eventId: convocationId, userId: targetUserId },
      {
        feeOverrideBy: actorId,
        feeOverrideAt: new Date(),
        eligibilityStatus: entry?.status ?? EligibilityStatus.ELIGIBLE,
        eligibilityDetail: entry?.reason,
      },
    );

    const updated = await this.participantRepository.findOne({
      where: { eventId: convocationId, userId: targetUserId },
    });
    if (!updated) {
      throw new NotFoundException('Participante no encontrado en la convocatoria');
    }
    return updated;
  }

  async getPlayerConvocationHistory(
    teamId: number,
    userId: number,
    limit = 20,
  ): Promise<PlayerConvocationHistoryStats> {
    const participants = await this.participantRepository.find({
      where: { userId },
      relations: ['event', 'event.team', 'user'],
      order: { createdAt: 'DESC' },
    });

    const matches = participants.filter(
      (p) =>
        p.event?.teamId === teamId &&
        p.event?.type === SportEventType.MATCH &&
        p.event?.status !== SportEventStatus.DRAFT,
    );

    const stats: PlayerConvocationHistoryStats = {
      userId,
      teamId,
      totalConvocations: matches.length,
      timesConvoked: 0,
      confirmed: 0,
      declined: 0,
      pending: 0,
      noResponse: 0,
      confirmationRate: 0,
      responseRate: 0,
      recent: [],
    };

    for (const p of matches) {
      if (p.isConvoked) stats.timesConvoked++;
      switch (p.status) {
        case ParticipantStatus.CONFIRMED:
          stats.confirmed++;
          break;
        case ParticipantStatus.DECLINED:
          stats.declined++;
          break;
        case ParticipantStatus.PENDING:
          stats.pending++;
          break;
        case ParticipantStatus.NO_RESPONSE:
          stats.noResponse++;
          break;
      }
    }

    const convoked = stats.timesConvoked || 1;
    stats.confirmationRate =
      Math.round((stats.confirmed / convoked) * 1000) / 10;
    stats.responseRate =
      Math.round(((stats.confirmed + stats.declined) / convoked) * 1000) / 10;

    stats.recent = matches.slice(0, limit).map((p) => ({
      eventId: p.eventId,
      title: p.event?.title ?? 'Partido',
      eventDate: p.event?.eventDate?.toISOString?.() ?? '',
      opponentName: p.event?.opponentName,
      isConvoked: p.isConvoked,
      status: p.status,
    }));

    return stats;
  }

  async getConvocationExport(convocationId: number) {
    const convocation = await this.findOne(convocationId);
    const participants = await this.getConvocationResponses(convocationId);
    const stats = await this.getConvocationStats(convocationId);
    const squad = participants.filter((p) => p.isConvoked);

    return {
      generatedAt: new Date().toISOString(),
      convocation: {
        id: convocation.id,
        title: convocation.title,
        teamName: convocation.team?.name,
        eventDate: convocation.eventDate,
        location: convocation.location,
        courtNumber: convocation.courtNumber,
        opponentName: convocation.opponentName,
        isOfficialMatch: convocation.isOfficialMatch,
        isHomeMatch: convocation.isHomeMatch,
        notes: convocation.notes,
      },
      stats,
      squad: squad.map((p) => ({
        userId: p.userId,
        name: p.user
          ? [p.user.firstName, p.user.lastName]
              .filter(Boolean)
              .join(' ')
              .trim() || p.user.username
          : `Usuario ${p.userId}`,
        status: p.status,
        eligibilityStatus: p.eligibilityStatus,
        eligibilityDetail: p.eligibilityDetail,
      })),
      bench: participants
        .filter((p) => !p.isConvoked)
        .map((p) => ({
          userId: p.userId,
          name: p.user
            ? [p.user.firstName, p.user.lastName]
                .filter(Boolean)
                .join(' ')
                .trim() || p.user.username
            : `Usuario ${p.userId}`,
          eligibilityStatus: p.eligibilityStatus,
        })),
    };
  }
}
