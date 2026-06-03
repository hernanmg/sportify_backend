import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan, LessThan } from 'typeorm';
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
import { LedgerEntry } from '../finance/entities/ledger-entry.entity';
import { LedgerEntryType } from '../finance/finance.enums';
import { TeamsService } from './teams.service';

@Injectable()
export class TeamDashboardService {
  constructor(
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly financeService: FinanceService,
    private readonly teamsService: TeamsService,
  ) {}

  private async assertCanViewDashboard(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const elevated = ['super_admin', 'manager', 'admin', 'team_captain', 'dt'];
    if (globalRole && elevated.includes(globalRole)) {
      if (['super_admin', 'manager'].includes(globalRole)) return;
      const isAdmin = await this.teamsService.isTeamAdmin(userId, teamId);
      if (isAdmin) return;
    }
    throw new ForbiddenException(
      'Solo el cuerpo técnico puede ver el panel del equipo',
    );
  }

  async getDashboard(teamId: number, userId: number, globalRole?: string) {
    await this.assertCanViewDashboard(userId, teamId, globalRole);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const balances = await this.financeService.getTeamPlayerBalances(teamId);
    const debtors = balances
      .filter((b) => b.balance > 0.01)
      .map((b) => ({
        userId: b.userId,
        userName: b.userName,
        balance: b.balance,
        jerseyNumber: b.jerseyNumber,
      }));

    const upcoming = await this.sportEventRepository.find({
      where: {
        teamId,
        type: In([SportEventType.TRAINING, SportEventType.MATCH]),
        status: In([
          SportEventStatus.SCHEDULED,
          SportEventStatus.CONFIRMED,
          SportEventStatus.DRAFT,
        ]),
        eventDate: MoreThan(now),
      },
      relations: ['participants', 'participants.user'],
      order: { eventDate: 'ASC' },
      take: 5,
    });

    const pendingConfirmations = upcoming.map((event) => {
      const pending = (event.participants ?? []).filter(
        (p) =>
          p.status === ParticipantStatus.PENDING &&
          (event.type !== SportEventType.MATCH || p.isConvoked),
      );
      return {
        eventId: event.id,
        title: event.title,
        type: event.type,
        eventDate: event.eventDate.toISOString(),
        pendingCount: pending.length,
        pending: pending.slice(0, 8).map((p) => ({
          userId: p.userId,
          userName: this.userName(p),
        })),
      };
    }).filter((e) => e.pendingCount > 0);

    const lastSession = await this.sportEventRepository.findOne({
      where: {
        teamId,
        type: In([SportEventType.TRAINING, SportEventType.MATCH]),
        eventDate: LessThan(now),
        status: In([
          SportEventStatus.SCHEDULED,
          SportEventStatus.CONFIRMED,
          SportEventStatus.COMPLETED,
          SportEventStatus.IN_PROGRESS,
        ]),
      },
      relations: ['participants', 'participants.user'],
      order: { eventDate: 'DESC' },
    });

    let lastSessionAttendance: {
      eventId: number;
      title: string;
      type: string;
      eventDate: string;
      present: number;
      absent: number;
      justified: number;
      unmarked: number;
    } | null = null;

    if (lastSession) {
      const parts = (lastSession.participants ?? []).filter((p) =>
        lastSession.type === SportEventType.MATCH ? p.isConvoked : true,
      );
      let present = 0;
      let absent = 0;
      let justified = 0;
      let unmarked = 0;
      for (const p of parts) {
        if (p.attendanceStatus === 'present') present++;
        else if (p.attendanceStatus === 'absent') absent++;
        else if (p.attendanceStatus === 'justified') justified++;
        else unmarked++;
      }
      lastSessionAttendance = {
        eventId: lastSession.id,
        title: lastSession.title,
        type: lastSession.type,
        eventDate: lastSession.eventDate.toISOString(),
        present,
        absent,
        justified,
        unmarked,
      };
    }

    const ledgerMonth = await this.ledgerRepository.find({
      where: { teamId },
    });

    const monthIncome = ledgerMonth
      .filter(
        (e) =>
          e.type === LedgerEntryType.INCOME &&
          e.createdAt >= monthStart &&
          e.createdAt <= monthEnd,
      )
      .reduce((s, e) => s + Number(e.amount), 0);

    const monthExpenses = ledgerMonth
      .filter(
        (e) =>
          e.type === LedgerEntryType.EXPENSE &&
          e.createdAt >= monthStart &&
          e.createdAt <= monthEnd,
      )
      .reduce((s, e) => s + Number(e.amount), 0);

    const summary = await this.financeService.getTeamSummary(teamId);

    return {
      teamId,
      generatedAt: now.toISOString(),
      debtors,
      debtorsCount: debtors.length,
      pendingConfirmations,
      lastSessionAttendance,
      monthFinance: {
        income: monthIncome,
        expenses: monthExpenses,
        net: monthIncome - monthExpenses,
        cashBalance: summary.cashBalance,
      },
      upcomingEvents: upcoming.slice(0, 3).map((e) => ({
        id: e.id,
        title: e.title,
        type: e.type,
        eventDate: e.eventDate.toISOString(),
      })),
    };
  }

  private userName(p: EventParticipant): string {
    const u = p.user;
    if (!u) return `Usuario ${p.userId}`;
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return full || u.username || `Usuario ${p.userId}`;
  }
}
