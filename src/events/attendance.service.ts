import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, MoreThan } from 'typeorm';
import {
  SportEvent,
  SportEventType,
  SportEventStatus,
} from './entities/sport-event.entity';
import { EventParticipant } from './entities/event-participant.entity';
import {
  ATTENDANCE_STATUSES,
  AttendanceItemDto,
} from './dtos/update-event-attendance.dto';
import { TeamsService } from '../teams/teams.service';
import { PlayerRoster } from '../roster/entities/player-roster.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    private readonly teamsService: TeamsService,
  ) {}

  private applyStatus(
    participant: EventParticipant,
    status: string,
    notes?: string,
  ): void {
    participant.attendanceStatus = status;
    participant.attendanceNotes = notes?.trim() || participant.attendanceNotes;
    if (status === 'present') {
      participant.attended = true;
    } else {
      participant.attended = false;
    }
  }

  private async assertCanManageEvent(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const elevated = ['super_admin', 'manager', 'admin', 'team_captain', 'dt'];
    if (globalRole && elevated.includes(globalRole)) {
      const isAdmin = await this.teamsService.isTeamAdmin(userId, teamId);
      if (isAdmin || ['super_admin', 'manager'].includes(globalRole)) {
        return;
      }
    }
    throw new ForbiddenException(
      'Solo el cuerpo técnico puede registrar asistencia',
    );
  }

  private async assertTeamMember(
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

  async updateEventAttendance(
    eventId: number,
    userId: number,
    items: AttendanceItemDto[],
    globalRole?: string,
  ): Promise<SportEvent> {
    const event = await this.sportEventRepository.findOne({
      where: { id: eventId },
      relations: ['participants', 'participants.user'],
    });
    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }
    if (
      event.type !== SportEventType.TRAINING &&
      event.type !== SportEventType.MATCH
    ) {
      throw new BadRequestException(
        'La asistencia unificada aplica a entrenamientos y partidos',
      );
    }

    await this.assertCanManageEvent(userId, event.teamId, globalRole);

    const byUser = new Map(
      (event.participants ?? []).map((p) => [p.userId, p]),
    );

    for (const item of items) {
      const p = byUser.get(item.userId);
      if (!p) {
        throw new BadRequestException(
          `El usuario ${item.userId} no participa en este evento`,
        );
      }
      this.applyStatus(p, item.status, item.notes);
      await this.participantRepository.save(p);
    }

    return this.sportEventRepository.findOne({
      where: { id: eventId },
      relations: ['participants', 'participants.user', 'team'],
    }) as Promise<SportEvent>;
  }

  async getEventAttendance(eventId: number, userId: number, globalRole?: string) {
    const event = await this.sportEventRepository.findOne({
      where: { id: eventId },
      relations: ['participants', 'participants.user', 'team'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    await this.assertTeamMember(userId, event.teamId, globalRole);

    const participants = (event.participants ?? []).filter((p) => {
      if (event.type === SportEventType.MATCH) {
        return p.isConvoked !== false;
      }
      return true;
    });

    return {
      eventId: event.id,
      title: event.title,
      type: event.type,
      eventDate: event.eventDate,
      teamId: event.teamId,
      participants: participants.map((p) => ({
        userId: p.userId,
        userName: this.displayName(p),
        status: p.attendanceStatus ?? null,
        attended: p.attended ?? null,
        notes: p.attendanceNotes ?? null,
        confirmationStatus: p.status,
      })),
    };
  }

  async getTeamAttendanceReport(
    teamId: number,
    userId: number,
    globalRole?: string,
    categoryId?: number,
    limit = 30,
  ) {
    await this.assertTeamMember(userId, teamId, globalRole);

    const events = await this.sportEventRepository.find({
      where: {
        teamId,
        type: In([SportEventType.TRAINING, SportEventType.MATCH]),
        status: In([
          SportEventStatus.SCHEDULED,
          SportEventStatus.CONFIRMED,
          SportEventStatus.COMPLETED,
          SportEventStatus.IN_PROGRESS,
        ]),
      },
      relations: ['participants', 'participants.user'],
      order: { eventDate: 'DESC' },
      take: limit,
    });

    let userIds: Set<number> | null = null;
    if (categoryId) {
      const roster = await this.rosterRepository.find({
        where: { teamId, categoryId },
        relations: ['player'],
      });
      userIds = new Set(
        roster.map((r) => r.player?.user_id).filter((id): id is number => !!id),
      );
    }

    const byPlayer = new Map<
      number,
      {
        userId: number;
        userName: string;
        present: number;
        absent: number;
        justified: number;
        unmarked: number;
        sessions: Array<{
          eventId: number;
          title: string;
          type: string;
          eventDate: string;
          status: string | null;
        }>;
      }
    >();

    for (const event of events) {
      for (const p of event.participants ?? []) {
        if (event.type === SportEventType.MATCH && !p.isConvoked) continue;
        if (userIds && !userIds.has(p.userId)) continue;

        let row = byPlayer.get(p.userId);
        if (!row) {
          row = {
            userId: p.userId,
            userName: this.displayName(p),
            present: 0,
            absent: 0,
            justified: 0,
            unmarked: 0,
            sessions: [],
          };
          byPlayer.set(p.userId, row);
        }

        const st = p.attendanceStatus;
        if (st === 'present') row.present++;
        else if (st === 'absent') row.absent++;
        else if (st === 'justified') row.justified++;
        else row.unmarked++;

        row.sessions.push({
          eventId: event.id,
          title: event.title,
          type: event.type,
          eventDate: event.eventDate.toISOString(),
          status: st ?? null,
        });
      }
    }

    return {
      teamId,
      categoryId: categoryId ?? null,
      players: Array.from(byPlayer.values()).sort((a, b) =>
        a.userName.localeCompare(b.userName),
      ),
      recentEvents: events.map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        eventDate: e.eventDate.toISOString(),
        status: e.status,
      })),
    };
  }

  private displayName(p: EventParticipant): string {
    const u = p.user;
    if (!u) return `Usuario ${p.userId}`;
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return full || u.username || `Usuario ${p.userId}`;
  }
}
