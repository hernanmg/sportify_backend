import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { SportEvent } from '../events/entities/sport-event.entity';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { TeamMember } from './entities/team-member.entity';
import { Team } from './entities/teams.entity';
import { TeamsService } from './teams.service';
import { User } from '../users/entities/user.entity';

export type CalendarItemKind = 'event' | 'birthday';

export interface TeamCalendarItem {
  kind: CalendarItemKind;
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  dayMonthLabel?: string;
  sportEventId?: number;
  eventType?: string;
  location?: string;
  userId?: number;
  userName?: string;
}

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

@Injectable()
export class TeamCalendarService {
  constructor(
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    @InjectRepository(TeamMember)
    private readonly teamMemberRepository: Repository<TeamMember>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    private readonly teamsService: TeamsService,
  ) {}

  async getTeamCalendar(
    teamId: number,
    userId: number,
    userRole: string | undefined,
    from: string,
    to: string,
    kinds: 'all' | 'events' | 'birthdays' = 'all',
  ) {
    const team = await this.teamRepository.findOne({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Equipo con ID ${teamId} no encontrado`);
    }

    const elevated =
      userRole === 'super_admin' || userRole === 'manager';
    const isMember = await this.teamsService.isTeamMember(userId, teamId);
    if (!isMember && !elevated) {
      throw new ForbiddenException('No tenés acceso al calendario de este equipo');
    }

    const start = this.startOfDay(new Date(from));
    const end = this.endOfDay(new Date(to));
    const items: TeamCalendarItem[] = [];

    if (kinds === 'all' || kinds === 'events') {
      const events = await this.sportEventRepository.find({
        where: {
          teamId,
          eventDate: Between(start, end),
        },
        relations: ['team'],
        order: { eventDate: 'ASC' },
      });

      for (const ev of events) {
        items.push({
          kind: 'event',
          id: `event-${ev.id}`,
          date: ev.eventDate.toISOString(),
          title: ev.title,
          subtitle: ev.type,
          sportEventId: ev.id,
          eventType: ev.type,
          location: ev.location ?? undefined,
        });
      }
    }

    if (kinds === 'all' || kinds === 'birthdays') {
      const users = await this.collectUsersWithBirthdays(teamId);
      for (const user of users) {
        items.push(...this.birthdayItemsForRange(user, start, end));
      }
    }

    items.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return {
      teamId,
      teamName: team.name,
      from: start.toISOString(),
      to: end.toISOString(),
      items,
    };
  }

  async getUsersWithBirthdayOnDate(
    teamId: number,
    month: number,
    day: number,
  ): Promise<User[]> {
    const users = await this.collectUsersWithBirthdays(teamId);
    return users.filter((user) => {
      const birth = this.parseBirthDate(user.fechaNacimiento!);
      return birth?.month === month && birth?.day === day;
    });
  }

  async listTeamUserIds(teamId: number): Promise<number[]> {
    const ids = new Set<number>();

    const roster = await this.rosterRepository.find({
      where: { teamId },
      relations: ['player', 'player.user'],
    });
    for (const row of roster) {
      if (row.player?.user?.id) ids.add(row.player.user.id);
    }

    const members = await this.teamMemberRepository.find({
      where: { teamId },
      relations: ['user'],
    });
    for (const member of members) {
      if (member.user?.id) ids.add(member.user.id);
    }

    return [...ids];
  }

  formatUserDisplayName(user: User): string {
    return (
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.username
    );
  }

  formatDayMonthLabel(user: User): string {
    const birth = this.parseBirthDate(user.fechaNacimiento!);
    if (!birth) return '';
    return `${birth.day} de ${MONTHS_ES[birth.month]}`;
  }

  private async collectUsersWithBirthdays(teamId: number): Promise<User[]> {
    const byId = new Map<number, User>();

    const roster = await this.rosterRepository.find({
      where: { teamId },
      relations: ['player', 'player.user'],
    });
    for (const row of roster) {
      const user = row.player?.user;
      if (user?.id && user.fechaNacimiento) {
        byId.set(user.id, user);
      }
    }

    const members = await this.teamMemberRepository.find({
      where: { teamId },
      relations: ['user'],
    });
    for (const member of members) {
      const user = member.user;
      if (user?.id && user.fechaNacimiento) {
        byId.set(user.id, user);
      }
    }

    return [...byId.values()];
  }

  private birthdayItemsForRange(
    user: User,
    start: Date,
    end: Date,
  ): TeamCalendarItem[] {
    const birth = this.parseBirthDate(user.fechaNacimiento!);
    if (!birth) return [];

    const month = birth.month;
    const day = birth.day;
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.username;
    const dayMonthLabel = `${day} de ${MONTHS_ES[month]}`;

    const items: TeamCalendarItem[] = [];
    for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
      const occurrence = new Date(year, month, day, 12, 0, 0, 0);
      if (occurrence < start || occurrence > end) continue;
      items.push({
        kind: 'birthday',
        id: `birthday-${user.id}-${year}`,
        date: occurrence.toISOString(),
        title: `Cumple de ${displayName}`,
        subtitle: dayMonthLabel,
        dayMonthLabel,
        userId: user.id,
        userName: displayName,
      });
    }
    return items;
  }

  private parseBirthDate(value: Date | string): { month: number; day: number } | null {
    if (value instanceof Date) {
      return { month: value.getUTCMonth(), day: value.getUTCDate() };
    }
    const raw = value.toString().slice(0, 10);
    const parts = raw.split('-').map((p) => parseInt(p, 10));
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return { month: parts[1] - 1, day: parts[2] };
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}
