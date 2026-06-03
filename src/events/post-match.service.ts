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
} from './entities/event-participant.entity';
import { MatchPeerRating } from './entities/match-peer-rating.entity';
import { MatchOfficialRating } from './entities/match-official-rating.entity';
import { MatchPlayerStats } from './entities/match-player-stats.entity';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { TeamsService } from '../teams/teams.service';
import { ConvocationsService } from './convocations.service';
import { EventStateService } from './event-state.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationPriority,
  NotificationType,
} from '../notifications/entities/notification.entity';
import {
  SubmitMatchVotesDto,
  SetOfficialMatchRatingsDto,
} from './dtos/submit-match-votes.dto';
import {
  UpdateMatchAttendanceDto,
  UpdateMatchLineupDto,
  UpdateMatchStatsDto,
  CompleteMatchDto,
} from './dtos/post-match-update.dto';
import { UpdatePostMatchReportDto } from './dtos/post-match-report.dto';

export interface PostMatchPlayerRow {
  userId: number;
  userName: string;
  avatarUrl: string | null;
  jerseyNumber: number | null;
  isConvoked: boolean;
  attended: boolean | null;
  teamAvgScore: number | null;
  teamVoteCount: number;
  officialScore: number | null;
  myVote: number | null;
}

export interface PostMatchLineupRow {
  userId: number;
  userName: string;
  avatarUrl: string | null;
  jerseyNumber: number | null;
  playingPosition: string | null;
  role: string;
  isStarter: boolean;
  attended: boolean | null;
  confirmed: boolean;
}

export interface PostMatchStatsRow {
  userId: number;
  userName: string;
  jerseyNumber: number | null;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number | null;
}

export interface PostMatchResult {
  teamScore: number | null;
  opponentScore: number | null;
  isHomeMatch: boolean;
}

export interface PostMatchResponse {
  eventId: number;
  title: string;
  teamId: number;
  eventDate: string;
  status: SportEventStatus;
  opponentName: string | null;
  canAccess: boolean;
  postMatchOpen: boolean;
  votingClosed: boolean;
  canVote: boolean;
  canManage: boolean;
  playerOfMatch: {
    userId: number;
    userName: string;
    avatarUrl: string | null;
    jerseyNumber: number | null;
    officialScore: number | null;
    teamAvgScore: number | null;
    combinedScore: number | null;
  } | null;
  /** Empate en el puntaje máximo (sin definición manual del DT). */
  playerOfMatchTied: Array<{
    userId: number;
    userName: string;
    avatarUrl: string | null;
    jerseyNumber: number | null;
    officialScore: number | null;
    teamAvgScore: number | null;
    combinedScore: number | null;
  }>;
  formation: string | null;
  lineupSlots: Record<string, { x: number; y: number }>;
  boardStrokes: Array<{
    points: { x: number; y: number }[];
    color?: string;
    width?: number;
  }>;
  report: {
    text: string | null;
    updatedAt: string | null;
    updatedByUserId: number | null;
  };
  targets: PostMatchPlayerRow[];
  myVotesCount: number;
  votesExpected: number;
  currentUserId: number;
  isCompleted: boolean;
  matchResult: PostMatchResult;
  lineup: PostMatchLineupRow[];
  stats: PostMatchStatsRow[];
}

@Injectable()
export class PostMatchService {
  constructor(
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    @InjectRepository(MatchPeerRating)
    private readonly peerRatingRepository: Repository<MatchPeerRating>,
    @InjectRepository(MatchOfficialRating)
    private readonly officialRatingRepository: Repository<MatchOfficialRating>,
    @InjectRepository(MatchPlayerStats)
    private readonly playerStatsRepository: Repository<MatchPlayerStats>,
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    private readonly teamsService: TeamsService,
    private readonly convocationsService: ConvocationsService,
    private readonly eventStateService: EventStateService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async assertCanManage(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    await this.convocationsService.assertCanManageConvocation(
      userId,
      teamId,
      globalRole,
    );
  }

  private convokedParticipants(
    participants: EventParticipant[],
  ): EventParticipant[] {
    return participants.filter((p) => p.isConvoked);
  }

  private avatarUrl(user: { avatarUrl?: string } | undefined): string | null {
    const u = user?.avatarUrl?.trim();
    return u || null;
  }

  private displayName(user: {
    firstName?: string;
    lastName?: string;
    username?: string;
  }): string {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return user.username ?? 'Jugador';
  }

  /** Pantalla post-partido (gestión DT) — convocatoria enviada o posterior. */
  private canAccessPostMatch(event: SportEvent): boolean {
    if (event.type !== SportEventType.MATCH) return false;
    if (event.status === SportEventStatus.CANCELLED) return false;
    if (event.status === SportEventStatus.DRAFT) return false;
    return true;
  }

  /** Votación entre jugadores — partido jugado o marcado completado. */
  private isVotingOpen(event: SportEvent): boolean {
    if (!this.canAccessPostMatch(event)) return false;
    if (event.status === SportEventStatus.COMPLETED) return true;
    return event.eventDate.getTime() < Date.now();
  }

  private async loadMatchEvent(eventId: number): Promise<SportEvent> {
    const event = await this.sportEventRepository.findOne({
      where: { id: eventId, type: SportEventType.MATCH },
      relations: ['participants', 'participants.user'],
    });
    if (!event) {
      throw new NotFoundException('Partido no encontrado');
    }
    return event;
  }

  private async assertTeamAccess(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const elevated = ['super_admin', 'manager'];
    if (globalRole && elevated.includes(globalRole)) return;
    const member = await this.teamsService.isTeamMember(userId, teamId);
    if (!member) {
      throw new ForbiddenException('No pertenecés a este equipo');
    }
  }

  private getRateableUserIds(participants: EventParticipant[]): number[] {
    return participants
      .filter((p) => p.isConvoked || p.attended === true)
      .map((p) => p.userId);
  }

  private async jerseyMap(
    teamId: number,
    userIds: number[],
  ): Promise<Map<number, number | null>> {
    if (!userIds.length) return new Map();
    const rows = await this.rosterRepository
      .createQueryBuilder('pr')
      .innerJoin('pr.player', 'pl')
      .where('pr.team_id = :teamId', { teamId })
      .andWhere('pl.user_id IN (:...userIds)', { userIds })
      .select(['pl.user_id AS userId', 'pr.jersey_number AS jersey'])
      .getRawMany<{ userId: number; jersey: number | null }>();
    const map = new Map<number, number | null>();
    for (const r of rows) {
      map.set(Number(r.userId), r.jersey != null ? Number(r.jersey) : null);
    }
    return map;
  }

  async getPostMatch(
    eventId: number,
    userId: number,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.assertTeamAccess(userId, event.teamId, globalRole);

    if (!this.canAccessPostMatch(event)) {
      throw new BadRequestException(
        'Enviá la convocatoria antes de abrir post-partido',
      );
    }

    const canAccess = true;
    const postMatchOpen = this.isVotingOpen(event);
    let canManage = false;
    try {
      await this.convocationsService.assertCanManageConvocation(
        userId,
        event.teamId,
        globalRole,
      );
      canManage = true;
    } catch {
      canManage = false;
    }

    const participants = event.participants ?? [];
    const convoked = this.convokedParticipants(participants);
    const allUserIds = [
      ...new Set(participants.map((p) => p.userId)),
    ];
    const rateableIds = this.getRateableUserIds(participants);
    const jerseys = await this.jerseyMap(event.teamId, allUserIds);

    const peerRatings = await this.peerRatingRepository.find({
      where: { sportEventId: eventId },
    });
    const officialRatings = await this.officialRatingRepository.find({
      where: { sportEventId: eventId },
    });

    const myPeerVotes = peerRatings.filter((r) => r.raterUserId === userId);

    const targets: PostMatchPlayerRow[] = rateableIds.map((uid) => {
      const p = participants.find((x) => x.userId === uid)!;
      const user = p.user!;
      const votesFor = peerRatings.filter((r) => r.ratedUserId === uid);
      const avg =
        votesFor.length > 0
          ? Math.round(
              (votesFor.reduce((s, r) => s + r.score, 0) / votesFor.length) *
                10,
            ) / 10
          : null;
      const official = officialRatings.find((r) => r.ratedUserId === uid);
      const mine = myPeerVotes.find((r) => r.ratedUserId === uid);
      return {
        userId: uid,
        userName: this.displayName(user),
        avatarUrl: this.avatarUrl(user),
        jerseyNumber: jerseys.get(uid) ?? null,
        isConvoked: p.isConvoked,
        attended: p.attended ?? null,
        teamAvgScore: avg,
        teamVoteCount: votesFor.length,
        officialScore: official?.score ?? null,
        myVote: mine?.score ?? null,
      };
    });

    targets.sort((a, b) => {
      const sa = this.combinedScore(a) ?? 0;
      const sb = this.combinedScore(b) ?? 0;
      return sb - sa;
    });

    const { selected: playerOfMatch, tied: playerOfMatchTied } =
      await this.resolvePlayerOfMatch(event, targets, officialRatings);

    const votingClosed = event.postMatchVotingClosed;
    const isConvokedVoter = participants.some(
      (p) => p.userId === userId && p.isConvoked,
    );
    const othersToRate = rateableIds.filter((id) => id !== userId);
    const votesGiven = myPeerVotes.filter((v) =>
      othersToRate.includes(v.ratedUserId),
    ).length;
    const canVote =
      postMatchOpen &&
      !votingClosed &&
      othersToRate.length > 0 &&
      isConvokedVoter &&
      votesGiven < othersToRate.length;

    const playerStatsRows = await this.playerStatsRepository.find({
      where: { sportEventId: eventId },
    });
    const statsByUser = new Map(
      playerStatsRows.map((s) => [s.userId, s]),
    );

    const lineup: PostMatchLineupRow[] = convoked
      .map((p) => {
        const user = p.user!;
        return {
          userId: p.userId,
          userName: this.displayName(user),
          avatarUrl: this.avatarUrl(user),
          jerseyNumber: jerseys.get(p.userId) ?? null,
          playingPosition: p.playingPosition ?? null,
          role: p.role,
          isStarter: p.isStarter ?? false,
          attended: p.attended ?? null,
          confirmed: p.status === ParticipantStatus.CONFIRMED,
        };
      })
      .sort(
        (a, b) =>
          (b.isStarter ? 1 : 0) - (a.isStarter ? 1 : 0) ||
          a.userName.localeCompare(b.userName),
      );

    const stats: PostMatchStatsRow[] = convoked.map((p) => {
      const user = p.user!;
      const s = statsByUser.get(p.userId);
      return {
        userId: p.userId,
        userName: this.displayName(user),
        jerseyNumber: jerseys.get(p.userId) ?? null,
        goals: s?.goals ?? 0,
        assists: s?.assists ?? 0,
        yellowCards: s?.yellowCards ?? 0,
        redCards: s?.redCards ?? 0,
        minutesPlayed: s?.minutesPlayed ?? null,
      };
    });

    return {
      eventId: event.id,
      title: event.title,
      teamId: event.teamId,
      eventDate: event.eventDate.toISOString(),
      status: event.status,
      opponentName: event.opponentName ?? null,
      canAccess,
      postMatchOpen,
      votingClosed,
      canVote,
      canManage,
      playerOfMatch,
      playerOfMatchTied,
      targets,
      myVotesCount: votesGiven,
      votesExpected: othersToRate.length,
      currentUserId: userId,
      isCompleted: event.status === SportEventStatus.COMPLETED,
      matchResult: {
        teamScore: event.teamScore ?? null,
        opponentScore: event.opponentScore ?? null,
        isHomeMatch: event.isHomeMatch,
      },
      lineup,
      stats,
      formation: this.getFormation(event),
      lineupSlots: this.getLineupSlots(event),
      boardStrokes: this.getBoardStrokes(event),
      report: {
        text: event.postMatchReport ?? null,
        updatedAt: event.postMatchReportUpdatedAt
          ? event.postMatchReportUpdatedAt.toISOString()
          : null,
        updatedByUserId: event.postMatchReportUpdatedBy ?? null,
      },
    };
  }

  private getFormation(event: SportEvent): string | null {
    const m = event.metadata as { formation?: string } | null;
    return m?.formation?.trim() || null;
  }

  private getLineupSlots(
    event: SportEvent,
  ): Record<string, { x: number; y: number }> {
    const m = event.metadata as {
      lineupSlots?: Record<string, { x: number; y: number }>;
    } | null;
    return m?.lineupSlots ?? {};
  }

  private getBoardStrokes(event: SportEvent): PostMatchResponse['boardStrokes'] {
    const m = event.metadata as {
      boardStrokes?: PostMatchResponse['boardStrokes'];
    } | null;
    return m?.boardStrokes ?? [];
  }

  private combinedScore(row: PostMatchPlayerRow): number | null {
    const parts: number[] = [];
    if (row.teamAvgScore != null && row.teamAvgScore > 0) {
      parts.push(row.teamAvgScore);
    }
    if (row.officialScore != null && row.officialScore > 0) {
      parts.push(row.officialScore);
    }
    if (!parts.length) return null;
    return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
  }

  private toPlayerOfMatchDto(
    row: PostMatchPlayerRow,
  ): NonNullable<PostMatchResponse['playerOfMatch']> {
    return {
      userId: row.userId,
      userName: row.userName,
      avatarUrl: row.avatarUrl,
      jerseyNumber: row.jerseyNumber,
      officialScore: row.officialScore,
      teamAvgScore: row.teamAvgScore,
      combinedScore: this.combinedScore(row),
    };
  }

  private async resolvePlayerOfMatch(
    event: SportEvent,
    targets: PostMatchPlayerRow[],
    officialRatings: MatchOfficialRating[],
  ): Promise<{
    selected: PostMatchResponse['playerOfMatch'];
    tied: PostMatchResponse['playerOfMatchTied'];
  }> {
    const empty = {
      selected: null as PostMatchResponse['playerOfMatch'],
      tied: [] as PostMatchResponse['playerOfMatchTied'],
    };
    if (event.status !== SportEventStatus.COMPLETED) {
      return empty;
    }

    if (event.playerOfMatchUserId) {
      const row = targets.find((t) => t.userId === event.playerOfMatchUserId);
      if (!row) return empty;
      return { selected: this.toPlayerOfMatchDto(row), tied: [] };
    }

    const scores = new Map<number, number>();
    for (const t of targets) {
      const combined = this.combinedScore(t);
      if (combined != null && combined > 0) {
        scores.set(t.userId, combined);
      }
    }

    if (!scores.size) return empty;

    const maxScore = Math.max(...scores.values());
    const topUserIds = [...scores.entries()]
      .filter(([, s]) => s === maxScore)
      .map(([id]) => id);
    const tiedRows = targets
      .filter((t) => topUserIds.includes(t.userId))
      .map((t) => this.toPlayerOfMatchDto(t));

    if (tiedRows.length === 1) {
      return { selected: tiedRows[0], tied: [] };
    }
    return { selected: null, tied: tiedRows };
  }

  async submitVotes(
    eventId: number,
    userId: number,
    dto: SubmitMatchVotesDto,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.assertTeamAccess(userId, event.teamId, globalRole);

    if (!this.canAccessPostMatch(event)) {
      throw new BadRequestException(
        'Post-partido no disponible para este evento',
      );
    }
    if (!this.isVotingOpen(event)) {
      throw new BadRequestException(
        'La votación abre cuando el partido se juegue o se marque como finalizado',
      );
    }
    if (event.postMatchVotingClosed) {
      throw new BadRequestException('La votación está cerrada');
    }

    const participants = event.participants ?? [];
    const isConvokedVoter = participants.some(
      (p) => p.userId === userId && p.isConvoked,
    );
    if (!isConvokedVoter) {
      throw new ForbiddenException(
        'Solo los jugadores convocados pueden votar',
      );
    }

    const rateableIds = new Set(this.getRateableUserIds(participants));
    if (!rateableIds.size) {
      throw new BadRequestException('No hay jugadores para puntuar');
    }

    const toSave = (dto.ratings ?? []).filter((item) => {
      if (!item?.ratedUserId || !item?.score) return false;
      if (!rateableIds.has(item.ratedUserId)) {
        throw new BadRequestException(
          `El jugador ${item.ratedUserId} no está en la lista del partido`,
        );
      }
      return item.ratedUserId !== userId;
    });

    if (!toSave.length) {
      throw new BadRequestException(
        'Indicá al menos una puntuación para otro jugador del partido',
      );
    }

    for (const item of toSave) {
      await this.peerRatingRepository.upsert(
        {
          sportEventId: eventId,
          raterUserId: userId,
          ratedUserId: item.ratedUserId,
          score: item.score,
        },
        ['sportEventId', 'raterUserId', 'ratedUserId'],
      );
    }

    return this.getPostMatch(eventId, userId, globalRole);
  }

  async setOfficialRatings(
    eventId: number,
    userId: number,
    dto: SetOfficialMatchRatingsDto,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.convocationsService.assertCanManageConvocation(
      userId,
      event.teamId,
      globalRole,
    );

    if (!this.canAccessPostMatch(event)) {
      throw new BadRequestException(
        'Post-partido no disponible para este evento',
      );
    }

    const rateableIds = new Set(
      this.getRateableUserIds(event.participants ?? []),
    );

    for (const item of dto.ratings ?? []) {
      if (!rateableIds.has(item.ratedUserId)) {
        throw new BadRequestException(
          `El jugador ${item.ratedUserId} no está en la lista del partido`,
        );
      }
      await this.officialRatingRepository.upsert(
        {
          sportEventId: eventId,
          ratedUserId: item.ratedUserId,
          score: item.score,
          setByUserId: userId,
        },
        ['sportEventId', 'ratedUserId'],
      );
    }

    let pomId = dto.playerOfMatchUserId;
    if (pomId != null && !rateableIds.has(pomId)) {
      throw new BadRequestException(
        'El jugador del partido debe estar en la lista del partido',
      );
    }
    if (pomId == null && dto.ratings.length > 0) {
      const max = Math.max(...dto.ratings.map((r) => r.score));
      const top = dto.ratings.filter((r) => r.score === max);
      if (top.length === 1) {
        pomId = top[0].ratedUserId;
      }
    }
    if (pomId != null) {
      await this.sportEventRepository.update(eventId, {
        playerOfMatchUserId: pomId,
      });
    }

    return this.getPostMatch(eventId, userId, globalRole);
  }

  async closeVoting(
    eventId: number,
    userId: number,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.convocationsService.assertCanManageConvocation(
      userId,
      event.teamId,
      globalRole,
    );
    await this.sportEventRepository.update(eventId, {
      postMatchVotingClosed: true,
    });
    return this.getPostMatch(eventId, userId, globalRole);
  }

  async updateAttendance(
    eventId: number,
    userId: number,
    dto: UpdateMatchAttendanceDto,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.assertCanManage(userId, event.teamId, globalRole);
    this.assertPostMatchEditable(event);

    const convokedIds = new Set(
      this.convokedParticipants(event.participants ?? []).map((p) => p.userId),
    );

    for (const item of dto.items ?? []) {
      if (!convokedIds.has(item.userId)) {
        throw new BadRequestException(
          `El jugador ${item.userId} no está convocado`,
        );
      }
      await this.participantRepository.update(
        { eventId, userId: item.userId },
        { attended: item.attended },
      );
    }

    return this.getPostMatch(eventId, userId, globalRole);
  }

  async updateLineup(
    eventId: number,
    userId: number,
    dto: UpdateMatchLineupDto,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.assertCanManage(userId, event.teamId, globalRole);
    this.assertPostMatchEditable(event);

    const convokedIds = new Set(
      this.convokedParticipants(event.participants ?? []).map((p) => p.userId),
    );

    for (const item of dto.items ?? []) {
      if (!convokedIds.has(item.userId)) {
        throw new BadRequestException(
          `El jugador ${item.userId} no está convocado`,
        );
      }
      const patch: Partial<EventParticipant> = {};
      if (item.playingPosition !== undefined) {
        patch.playingPosition = item.playingPosition || null;
      }
      if (item.role !== undefined) {
        patch.role = item.role;
      }
      if (item.isStarter !== undefined) {
        patch.isStarter = item.isStarter;
      }
      if (Object.keys(patch).length) {
        await this.participantRepository.update(
          { eventId, userId: item.userId },
          patch,
        );
      }
    }

    if (
      dto.formation !== undefined ||
      dto.lineupSlots !== undefined ||
      dto.boardStrokes !== undefined
    ) {
      const meta = { ...(event.metadata ?? {}) } as Record<string, unknown>;
      if (dto.formation !== undefined) {
        meta.formation = dto.formation || null;
      }
      if (dto.lineupSlots !== undefined) {
        meta.lineupSlots = dto.lineupSlots;
      }
      if (dto.boardStrokes !== undefined) {
        meta.boardStrokes = dto.boardStrokes;
      }
      await this.sportEventRepository.update(eventId, {
        metadata: meta as SportEvent['metadata'],
      });
    }

    return this.getPostMatch(eventId, userId, globalRole);
  }

  async updateStats(
    eventId: number,
    userId: number,
    dto: UpdateMatchStatsDto,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.assertCanManage(userId, event.teamId, globalRole);
    this.assertPostMatchEditable(event);

    const convokedIds = new Set(
      this.convokedParticipants(event.participants ?? []).map((p) => p.userId),
    );

    if (dto.teamScore !== undefined || dto.opponentScore !== undefined) {
      await this.sportEventRepository.update(eventId, {
        teamScore: dto.teamScore,
        opponentScore: dto.opponentScore,
      });
    }

    for (const item of dto.players ?? []) {
      if (!convokedIds.has(item.userId)) {
        throw new BadRequestException(
          `El jugador ${item.userId} no está convocado`,
        );
      }
      await this.playerStatsRepository.upsert(
        {
          sportEventId: eventId,
          userId: item.userId,
          goals: item.goals ?? 0,
          assists: item.assists ?? 0,
          yellowCards: item.yellowCards ?? 0,
          redCards: item.redCards ?? 0,
          minutesPlayed: item.minutesPlayed ?? null,
        },
        ['sportEventId', 'userId'],
      );
    }

    return this.getPostMatch(eventId, userId, globalRole);
  }

  async updateReport(
    eventId: number,
    userId: number,
    dto: UpdatePostMatchReportDto,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.assertCanManage(userId, event.teamId, globalRole);
    this.assertPostMatchEditable(event);

    await this.sportEventRepository.update(eventId, {
      postMatchReport: dto.text?.trim() || null,
      postMatchReportUpdatedBy: userId,
      postMatchReportUpdatedAt: new Date(),
    });
    return this.getPostMatch(eventId, userId, globalRole);
  }

  async completeMatch(
    eventId: number,
    userId: number,
    dto: CompleteMatchDto,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.assertCanManage(userId, event.teamId, globalRole);

    if (!this.canAccessPostMatch(event)) {
      throw new BadRequestException('No se puede finalizar este partido');
    }

    const oldStatus = event.status;
    const patch: Partial<SportEvent> = {
      status: SportEventStatus.COMPLETED,
      postMatchVotingClosed: false,
    };
    if (dto.teamScore !== undefined) patch.teamScore = dto.teamScore;
    if (dto.opponentScore !== undefined) patch.opponentScore = dto.opponentScore;

    await this.sportEventRepository.update(eventId, patch);

    if (oldStatus !== SportEventStatus.COMPLETED) {
      const participants = await this.participantRepository.find({
        where: { eventId },
        relations: ['user'],
      });
      await this.eventStateService.handleEventStateChange({
        eventId,
        eventTitle: event.title,
        eventType: event.type,
        oldStatus,
        newStatus: SportEventStatus.COMPLETED,
        changedBy: userId,
        teamId: event.teamId,
        participants,
      });
    }

    // Notificación "Cerrá tu voto" a quienes aún no completaron la votación.
    try {
      const rateableIds = this.getRateableUserIds(event.participants ?? []);
      if (rateableIds.length > 0) {
        const roster = await this.rosterRepository.find({
          where: { teamId: event.teamId },
          relations: ['player', 'player.user'],
        });
        const teamUserIds = roster
          .map((r) => r.player?.user?.id)
          .filter((id): id is number => typeof id === 'number');

        if (teamUserIds.length > 0) {
          const rows = await this.peerRatingRepository
            .createQueryBuilder('r')
            .select('r.raterUserId', 'raterUserId')
            .addSelect('COUNT(DISTINCT r.ratedUserId)', 'cnt')
            .where('r.eventId = :eventId', { eventId })
            .andWhere('r.raterUserId IN (:...ids)', { ids: teamUserIds })
            .groupBy('r.raterUserId')
            .getRawMany<{ raterUserId: string; cnt: string }>();

          const counts = new Map<number, number>();
          for (const row of rows) {
            const id = parseInt(row.raterUserId, 10);
            const c = parseInt(row.cnt, 10);
            if (!Number.isNaN(id) && !Number.isNaN(c)) counts.set(id, c);
          }

          const expected = rateableIds.length;
          const incomplete = teamUserIds.filter(
            (id) => (counts.get(id) ?? 0) < expected,
          );

          if (incomplete.length > 0) {
            await this.notificationsService.createBulkNotifications({
              userIds: incomplete,
              teamId: event.teamId,
              sportEventId: event.id,
              type: NotificationType.GENERAL,
              priority: NotificationPriority.HIGH,
              title: 'Votá el partido',
              message: `El partido finalizó. Completá tu votación (${expected} jugadores).`,
              data: {
                action: 'open_post_match',
                sportEventId: event.id,
                teamId: event.teamId,
              },
            });
          }
        }
      }
    } catch {
      // No bloquear el cierre del partido por notificaciones.
    }

    return this.getPostMatch(eventId, userId, globalRole);
  }

  private assertPostMatchEditable(event: SportEvent): void {
    if (!this.canAccessPostMatch(event)) {
      throw new BadRequestException(
        'Post-partido no disponible para este evento',
      );
    }
  }
}
