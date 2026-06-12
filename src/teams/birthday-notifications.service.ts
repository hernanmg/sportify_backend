import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from './entities/teams.entity';
import { TeamCalendarService } from './team-calendar.service';
import {
  Notification,
  NotificationPriority,
  NotificationType,
} from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';

const AR_TIMEZONE = 'America/Argentina/Buenos_Aires';

@Injectable()
export class BirthdayNotificationsService {
  private readonly logger = new Logger(BirthdayNotificationsService.name);

  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly teamCalendarService: TeamCalendarService,
    private readonly notificationsService: NotificationsService,
  ) {}

  getArgentinaNow(): { hour: number; month: number; day: number; dateStr: string } {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: AR_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const hour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: AR_TIMEZONE,
        hour: 'numeric',
        hour12: false,
      }).format(now),
      10,
    );
    const [, monthStr, dayStr] = dateStr.split('-');
    return {
      hour,
      month: parseInt(monthStr, 10) - 1,
      day: parseInt(dayStr, 10),
      dateStr,
    };
  }

  async processScheduledBirthdayNotifications(): Promise<void> {
    const { hour, month, day, dateStr } = this.getArgentinaNow();
    const teams = await this.teamRepository.find();

    for (const team of teams) {
      const configHour = team.birthdayNotificationHour ?? 9;
      if (configHour !== hour) continue;

      try {
        const sent = await this.sendBirthdaysForTeam(team, month, day, dateStr);
        if (sent > 0) {
          this.logger.log(
            `🎂 ${team.name}: ${sent} notificaciones de cumpleaños enviadas`,
          );
        }
      } catch (error) {
        this.logger.error(
          `❌ Error en cumpleaños de ${team.name}: ${(error as Error).message}`,
        );
      }
    }
  }

  async sendBirthdaysForTeam(
    team: Team,
    month: number,
    day: number,
    dateStr: string,
  ): Promise<number> {
    const birthdayUsers = await this.teamCalendarService.getUsersWithBirthdayOnDate(
      team.id,
      month,
      day,
    );
    if (birthdayUsers.length === 0) return 0;

    const teamUserIds = await this.teamCalendarService.listTeamUserIds(team.id);
    if (teamUserIds.length === 0) return 0;

    let sentCount = 0;

    for (const birthdayUser of birthdayUsers) {
      const displayName =
        this.teamCalendarService.formatUserDisplayName(birthdayUser);
      const dayLabel =
        this.teamCalendarService.formatDayMonthLabel(birthdayUser);

      for (const userId of teamUserIds) {
        if (userId === birthdayUser.id) continue;
        const sent = await this.sendIfNotExists({
          userId,
          teamId: team.id,
          teamName: team.name,
          birthdayUserId: birthdayUser.id,
          dateStr,
          audience: 'team',
          title: '🎂 Cumpleaños en el plantel',
          message: `Hoy (${dayLabel}) es el cumple de ${displayName}. ¡Saludalo!`,
        });
        if (sent) sentCount++;
      }

      const personalSent = await this.sendIfNotExists({
        userId: birthdayUser.id,
        teamId: team.id,
        teamName: team.name,
        birthdayUserId: birthdayUser.id,
        dateStr,
        audience: 'birthday_person',
        title: '¡Feliz cumple! 🎂',
        message: `¡Feliz cumple! Te desea ${team.name} y todo el plantel.`,
      });
      if (personalSent) sentCount++;
    }

    return sentCount;
  }

  private buildDedupKey(params: {
    teamId: number;
    birthdayUserId: number;
    dateStr: string;
    audience: string;
  }): string {
    return `${params.teamId}-${params.birthdayUserId}-${params.dateStr}-${params.audience}`;
  }

  private async sendIfNotExists(params: {
    userId: number;
    teamId: number;
    teamName: string;
    birthdayUserId: number;
    dateStr: string;
    audience: 'team' | 'birthday_person';
    title: string;
    message: string;
  }): Promise<boolean> {
    const dedupKey = this.buildDedupKey(params);

    const existing = await this.notificationRepository
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId: params.userId })
      .andWhere('n.team_id = :teamId', { teamId: params.teamId })
      .andWhere('n.type = :type', { type: NotificationType.BIRTHDAY })
      .andWhere("n.data->>'dedupKey' = :dedupKey", { dedupKey })
      .getOne();

    if (existing) return false;

    await this.notificationsService.createNotification({
      userId: params.userId,
      teamId: params.teamId,
      type: NotificationType.BIRTHDAY,
      priority: NotificationPriority.MEDIUM,
      title: params.title,
      message: params.message,
      data: {
        dedupKey,
        birthdayUserId: params.birthdayUserId,
        birthdayDate: params.dateStr,
        audience: params.audience,
        teamName: params.teamName,
        action: 'open_team_calendar',
        deepLink: '/sports/calendar',
        teamId: params.teamId,
      },
    });

    return true;
  }
}
