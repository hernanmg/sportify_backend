import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  SportEvent,
  SportEventType,
  SportEventStatus,
} from '../events/entities/sport-event.entity';
import {
  EventParticipant,
  ParticipantStatus,
} from '../events/entities/event-participant.entity';
import { FinanceService } from '../finance/finance.service';
import { RosterService } from '../roster/roster.service';

@Injectable()
export class TeamReportsService {
  constructor(
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    private readonly financeService: FinanceService,
    private readonly rosterService: RosterService,
  ) {}

  async getSummary(teamId: number, season?: string) {
    const roster = await this.rosterService.findByTeam(teamId, season);
    const userIds = [
      ...new Set(
        roster
          .map((r) => r.player?.user_id)
          .filter((id): id is number => !!id),
      ),
    ];

    const attendance = await this.buildAttendanceReport(teamId, userIds, roster);
    const debts = await this.financeService.getTeamPlayerBalances(teamId, season);
    const convocations = await this.buildConvocationReport(teamId);

    return {
      teamId,
      season: season ?? null,
      attendance,
      debts: debts.map((d) => ({
        userId: d.userId,
        userName: d.userName,
        balance: d.balance,
        totalCharged: d.totalCharged,
        totalPaid: d.totalPaid,
      })),
      convocations,
    };
  }

  private async buildAttendanceReport(
    teamId: number,
    userIds: number[],
    roster: Awaited<ReturnType<RosterService['findByTeam']>>,
  ) {
    const events = await this.sportEventRepository.find({
      where: {
        teamId,
        type: In([SportEventType.TRAINING, SportEventType.MATCH]),
        status: In([
          SportEventStatus.COMPLETED,
          SportEventStatus.CONFIRMED,
          SportEventStatus.IN_PROGRESS,
        ]),
      },
      relations: ['participants'],
      order: { eventDate: 'DESC' },
      take: 40,
    });

    const byUser = new Map<
      number,
      { present: number; absent: number; justified: number; total: number }
    >();

    for (const uid of userIds) {
      byUser.set(uid, { present: 0, absent: 0, justified: 0, total: 0 });
    }

    for (const ev of events) {
      for (const p of ev.participants ?? []) {
        if (!byUser.has(p.userId)) continue;
        const row = byUser.get(p.userId)!;
        const st = p.attendanceStatus;
        if (st === 'present') row.present++;
        else if (st === 'absent') row.absent++;
        else if (st === 'justified') row.justified++;
        if (st) row.total++;
      }
    }

    const nameByUser = new Map<number, string>();
    for (const r of roster) {
      const uid = r.player?.user_id;
      if (!uid) continue;
      const name =
        [r.player?.user?.firstName, r.player?.user?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim() ||
        r.player?.user?.email ||
        `Jugador #${uid}`;
      nameByUser.set(uid, name);
    }

    return Array.from(byUser.entries()).map(([userId, stats]) => {
      const pct =
        stats.total > 0
          ? Math.round((stats.present / stats.total) * 100)
          : null;
      return {
        userId,
        userName: nameByUser.get(userId) ?? `Usuario ${userId}`,
        ...stats,
        attendancePct: pct,
      };
    });
  }

  private async buildConvocationReport(teamId: number) {
    const matches = await this.sportEventRepository.find({
      where: {
        teamId,
        type: SportEventType.MATCH,
        status: In([
          SportEventStatus.SCHEDULED,
          SportEventStatus.CONFIRMED,
          SportEventStatus.COMPLETED,
        ]),
      },
      relations: ['participants', 'participants.user'],
      order: { eventDate: 'DESC' },
      take: 15,
    });

    return matches.map((m) => {
      const parts = m.participants ?? [];
      const convoked = parts.filter((p) => p.isConvoked !== false);
      const responded = convoked.filter(
        (p) => p.status !== ParticipantStatus.PENDING,
      );
      const confirmed = convoked.filter(
        (p) => p.status === ParticipantStatus.CONFIRMED,
      );
      return {
        eventId: m.id,
        title: m.title,
        eventDate: m.eventDate.toISOString(),
        convoked: convoked.length,
        responded: responded.length,
        confirmed: confirmed.length,
        responsePct:
          convoked.length > 0
            ? Math.round((responded.length / convoked.length) * 100)
            : 0,
      };
    });
  }
}
