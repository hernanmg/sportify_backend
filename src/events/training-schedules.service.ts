import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrainingSchedule } from './entities/training-schedule.entity';
import { CreateTrainingScheduleDto } from './dtos/create-training-schedule.dto';
import { SportEventsService } from './sport-events.service';
import {
  SportEvent,
  SportEventType,
  SportEventStatus,
} from './entities/sport-event.entity';
import { TeamsService } from '../teams/teams.service';
import { CreateSportEventDto } from './dtos/create-sport-event.dto';

@Injectable()
export class TrainingSchedulesService {
  constructor(
    @InjectRepository(TrainingSchedule)
    private readonly scheduleRepository: Repository<TrainingSchedule>,
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    private readonly sportEventsService: SportEventsService,
    private readonly teamsService: TeamsService,
  ) {}

  private async assertCanManage(
    userId: number,
    teamId: number,
    role?: string,
  ): Promise<void> {
    const elevated = role === 'super_admin' || role === 'manager' || role === 'admin';
    const isAdmin = await this.teamsService.isTeamAdmin(userId, teamId);
    const isDt =
      role === 'dt' && (await this.teamsService.isTeamMember(userId, teamId));
    const isCaptain = role === 'team_captain';
    if (!elevated && !isAdmin && !isDt && !isCaptain) {
      throw new ForbiddenException(
        'Solo el cuerpo técnico puede gestionar entrenamientos recurrentes',
      );
    }
  }

  async listByTeam(teamId: number) {
    return this.scheduleRepository.find({
      where: { teamId, active: true },
      order: { weekday: 'ASC', hour: 'ASC' },
    });
  }

  async create(
    dto: CreateTrainingScheduleDto,
    actorUserId: number,
    actorRole?: string,
  ) {
    await this.assertCanManage(actorUserId, dto.teamId, actorRole);

    const schedule = await this.scheduleRepository.save(
      this.scheduleRepository.create({
        teamId: dto.teamId,
        title: dto.title,
        weekday: dto.weekday,
        hour: dto.hour,
        minute: dto.minute,
        durationMinutes: dto.durationMinutes,
        location: dto.location,
        categoryIds: dto.categoryIds?.length ? dto.categoryIds : null,
        weeksAhead: dto.weeksAhead ?? 8,
        createdBy: actorUserId,
      }),
    );

    const created = await this.materializeSchedule(schedule.id, {
      description: dto.description,
      notes: dto.notes,
    });

    return {
      schedule,
      eventsCreated: created.length,
      events: created,
    };
  }

  async materializeSchedule(
    scheduleId: number,
    extras?: { description?: string; notes?: string },
  ): Promise<SportEvent[]> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId, active: true },
    });
    if (!schedule) {
      throw new NotFoundException('Cronograma de entrenamiento no encontrado');
    }

    const created: SportEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let week = 0; week < schedule.weeksAhead; week++) {
      const eventDate = this.resolveOccurrenceDate(
        today,
        schedule.weekday,
        schedule.hour,
        schedule.minute,
        week,
      );
      if (eventDate < today) continue;

      const dateKey = eventDate.toISOString().slice(0, 16);
      const existing = await this.sportEventRepository
        .createQueryBuilder('e')
        .where('e.team_id = :teamId', { teamId: schedule.teamId })
        .andWhere('e.type = :type', { type: SportEventType.TRAINING })
        .andWhere("e.metadata->>'trainingScheduleId' = :sid", {
          sid: String(schedule.id),
        })
        .andWhere("e.metadata->>'scheduleOccurrence' = :occ", {
          occ: dateKey,
        })
        .getOne();

      if (existing) continue;

      const event = await this.sportEventsService.create(
        {
          title: schedule.title,
          description: extras?.description,
          notes: extras?.notes,
          type: SportEventType.TRAINING,
          teamId: schedule.teamId,
          eventDate: eventDate.toISOString(),
          durationMinutes: schedule.durationMinutes,
          location: schedule.location,
          categoryIds: schedule.categoryIds ?? undefined,
          requiresConfirmation: true,
          sendNotifications: false,
          metadata: {
            trainingScheduleId: schedule.id,
            scheduleOccurrence: dateKey,
          },
          status: SportEventStatus.SCHEDULED,
          createdBy: schedule.createdBy,
        } as CreateSportEventDto,
        schedule.createdBy ?? 0,
        'dt',
      );
      created.push(event);
    }

    return created;
  }

  private resolveOccurrenceDate(
    from: Date,
    weekday: number,
    hour: number,
    minute: number,
    weekOffset: number,
  ): Date {
    const base = new Date(from);
    const currentDay = base.getDay();
    let daysUntil = (weekday - currentDay + 7) % 7;
    if (daysUntil === 0 && weekOffset === 0) {
      const candidate = new Date(base);
      candidate.setHours(hour, minute, 0, 0);
      if (candidate < new Date()) {
        daysUntil = 7;
      }
    }
    base.setDate(base.getDate() + daysUntil + weekOffset * 7);
    base.setHours(hour, minute, 0, 0);
    return base;
  }
}
