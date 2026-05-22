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
import { EventParticipant } from './entities/event-participant.entity';
import { MatchPeerRating } from './entities/match-peer-rating.entity';
import { MatchOfficialRating } from './entities/match-official-rating.entity';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { TeamsService } from '../teams/teams.service';
import { ConvocationsService } from './convocations.service';
import {
  SubmitMatchVotesDto,
  SetOfficialMatchRatingsDto,
} from './dtos/submit-match-votes.dto';

export interface PostMatchPlayerRow {
  userId: number;
  userName: string;
  jerseyNumber: number | null;
  isConvoked: boolean;
  attended: boolean | null;
  teamAvgScore: number | null;
  teamVoteCount: number;
  officialScore: number | null;
  myVote: number | null;
}

export interface PostMatchResponse {
  eventId: number;
  title: string;
  teamId: number;
  eventDate: string;
  status: SportEventStatus;
  opponentName: string | null;
  postMatchOpen: boolean;
  votingClosed: boolean;
  canVote: boolean;
  canManage: boolean;
  playerOfMatch: {
    userId: number;
    userName: string;
    jerseyNumber: number | null;
    officialScore: number | null;
    teamAvgScore: number | null;
  } | null;
  targets: PostMatchPlayerRow[];
  myVotesCount: number;
  votesExpected: number;
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
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    private readonly teamsService: TeamsService,
    private readonly convocationsService: ConvocationsService,
  ) {}

  private displayName(user: {
    firstName?: string;
    lastName?: string;
    username?: string;
  }): string {
    const parts = [user.firstName, user.lastName].filter(Boolean);
    if (parts.length) return parts.join(' ');
    return user.username ?? 'Jugador';
  }

  private isPostMatchEligible(event: SportEvent): boolean {
    if (event.type !== SportEventType.MATCH) return false;
    if (event.status === SportEventStatus.CANCELLED) return false;
    if (event.status === SportEventStatus.DRAFT) return false;
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

    const postMatchOpen = this.isPostMatchEligible(event);
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
    const rateableIds = this.getRateableUserIds(participants);
    const jerseys = await this.jerseyMap(event.teamId, rateableIds);

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
      const sa = a.officialScore ?? a.teamAvgScore ?? 0;
      const sb = b.officialScore ?? b.teamAvgScore ?? 0;
      return sb - sa;
    });

    const playerOfMatch = await this.resolvePlayerOfMatch(
      event,
      targets,
      officialRatings,
    );

    const votingClosed = event.postMatchVotingClosed;
    const canVote =
      postMatchOpen &&
      !votingClosed &&
      rateableIds.length > 0;

    return {
      eventId: event.id,
      title: event.title,
      teamId: event.teamId,
      eventDate: event.eventDate.toISOString(),
      status: event.status,
      opponentName: event.opponentName ?? null,
      postMatchOpen,
      votingClosed,
      canVote,
      canManage,
      playerOfMatch,
      targets,
      myVotesCount: myPeerVotes.length,
      votesExpected: rateableIds.length,
    };
  }

  private async resolvePlayerOfMatch(
    event: SportEvent,
    targets: PostMatchPlayerRow[],
    officialRatings: MatchOfficialRating[],
  ): Promise<PostMatchResponse['playerOfMatch']> {
    let userId = event.playerOfMatchUserId;
    if (!userId && officialRatings.length > 0) {
      const best = [...officialRatings].sort((a, b) => b.score - a.score)[0];
      userId = best.ratedUserId;
    }
    if (!userId && targets.length > 0) {
      const best = [...targets].sort(
        (a, b) =>
          (b.officialScore ?? b.teamAvgScore ?? 0) -
          (a.officialScore ?? a.teamAvgScore ?? 0),
      )[0];
      userId = best.userId;
    }
    if (!userId) return null;
    const row = targets.find((t) => t.userId === userId);
    if (!row) return null;
    return {
      userId: row.userId,
      userName: row.userName,
      jerseyNumber: row.jerseyNumber,
      officialScore: row.officialScore,
      teamAvgScore: row.teamAvgScore,
    };
  }

  async submitVotes(
    eventId: number,
    userId: number,
    dto: SubmitMatchVotesDto,
    globalRole?: string,
  ): Promise<PostMatchResponse> {
    const event = await this.loadMatchEvent(eventId);
    await this.assertTeamAccess(userId, event.teamId, globalRole);

    if (!this.isPostMatchEligible(event)) {
      throw new BadRequestException(
        'Post-partido no disponible para este evento',
      );
    }
    if (event.postMatchVotingClosed) {
      throw new BadRequestException('La votación está cerrada');
    }

    const rateableIds = new Set(
      this.getRateableUserIds(event.participants ?? []),
    );
    if (!rateableIds.size) {
      throw new BadRequestException('No hay jugadores para puntuar');
    }

    for (const item of dto.ratings) {
      if (!rateableIds.has(item.ratedUserId)) {
        throw new BadRequestException(
          `El jugador ${item.ratedUserId} no está en la lista del partido`,
        );
      }
      if (item.ratedUserId === userId) {
        throw new BadRequestException('No podés puntuarte a vos mismo');
      }
    }

    for (const item of dto.ratings) {
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

    if (!this.isPostMatchEligible(event)) {
      throw new BadRequestException(
        'Post-partido no disponible para este evento',
      );
    }

    const rateableIds = new Set(
      this.getRateableUserIds(event.participants ?? []),
    );

    for (const item of dto.ratings) {
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
      const best = [...dto.ratings].sort((a, b) => b.score - a.score)[0];
      pomId = best.ratedUserId;
    }
    if (pomId != null) {
      await this.sportEventRepository.update(eventId, {
        playerOfMatchUserId: pomId,
      });
    }

    if (event.status !== SportEventStatus.COMPLETED) {
      await this.sportEventRepository.update(eventId, {
        status: SportEventStatus.COMPLETED,
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
      status: SportEventStatus.COMPLETED,
    });
    return this.getPostMatch(eventId, userId, globalRole);
  }
}
