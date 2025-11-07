import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SportEvent, SportEventType, SportEventStatus } from './entities/sport-event.entity';
import { EventParticipant, ParticipantStatus } from './entities/event-participant.entity';
import { SportEventsService } from './sport-events.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface ConvocationDto {
  title: string;
  description?: string;
  eventDate: string;
  location?: string;
  teamId: number;
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
  ) {}

  async createConvocation(convocationDto: ConvocationDto, createdBy: number): Promise<SportEvent> {
    const eventData = {
      ...convocationDto,
      type: SportEventType.MATCH,
      status: SportEventStatus.DRAFT,
      createdBy,
      requiresConfirmation: true,
      requiresPaymentUpToDate: convocationDto.isOfficialMatch || false,
    };

    return await this.sportEventsService.create(eventData);
  }

  async getConvocations(teamId?: number, status?: 'sent' | 'draft'): Promise<SportEvent[]> {
    const whereCondition: any = {
      type: SportEventType.MATCH,
    };

    if (teamId) {
      whereCondition.teamId = teamId;
    }

    if (status) {
      whereCondition.status = status === 'sent' ? SportEventStatus.SCHEDULED : SportEventStatus.DRAFT;
    }

    return await this.sportEventRepository.find({
      where: whereCondition,
      relations: ['team', 'creator', 'participants', 'participants.user'],
      order: { eventDate: 'ASC' }
    });
  }

  async sendConvocation(convocationId: number): Promise<SportEvent> {
    const convocation = await this.sportEventsService.findOne(convocationId);

    if (convocation.type !== SportEventType.MATCH) {
      throw new BadRequestException('Solo se pueden enviar convocatorias para partidos');
    }

    if (convocation.status !== SportEventStatus.DRAFT) {
      throw new BadRequestException('La convocatoria ya fue enviada');
    }

    // Cambiar estado a programado (enviado)
    await this.sportEventsService.update(convocationId, {
      status: SportEventStatus.SCHEDULED
    });

    // Enviar notificaciones
    await this.notificationsService.sendMatchInvitation(
      convocation.id,
      convocation.teamId,
      {
        date: convocation.eventDate.toISOString(),
        opponent: convocation.opponentName || 'Por definir',
        location: convocation.location || 'Por definir',
      }
    );

    return await this.sportEventsService.findOne(convocationId);
  }

  async getConvocationStats(convocationId: number): Promise<ConvocationStats> {
    const participants = await this.participantRepository.find({
      where: { eventId: convocationId }
    });

    const stats: ConvocationStats = {
      total: participants.length,
      confirmed: 0,
      pending: 0,
      declined: 0,
      noResponse: 0,
    };

    participants.forEach(participant => {
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

  async getConvocationResponses(convocationId: number): Promise<EventParticipant[]> {
    return await this.participantRepository.find({
      where: { eventId: convocationId },
      relations: ['user'],
      order: { status: 'ASC', createdAt: 'ASC' }
    });
  }

  async resendConvocation(convocationId: number): Promise<void> {
    const convocation = await this.sportEventsService.findOne(convocationId);

    if (convocation.type !== SportEventType.MATCH) {
      throw new BadRequestException('Solo se pueden reenviar convocatorias para partidos');
    }

    // Reenviar notificaciones
    await this.notificationsService.sendMatchInvitation(
      convocation.id,
      convocation.teamId,
      {
        date: convocation.eventDate.toISOString(),
        opponent: convocation.opponentName || 'Por definir',
        location: convocation.location || 'Por definir',
      }
    );
  }

  async updateConvocation(convocationId: number, updateData: Partial<ConvocationDto>): Promise<SportEvent> {
    const convocation = await this.sportEventsService.findOne(convocationId);

    if (convocation.type !== SportEventType.MATCH) {
      throw new BadRequestException('Solo se pueden actualizar convocatorias para partidos');
    }

    return await this.sportEventsService.update(convocationId, {
      title: updateData.title,
      description: updateData.description,
      eventDate: updateData.eventDate,
      location: updateData.location,
      opponentName: updateData.opponentName,
      isHomeMatch: updateData.isHomeMatch,
      isOfficialMatch: updateData.isOfficialMatch,
      confirmationDeadline: updateData.confirmationDeadline,
      notes: updateData.notes,
      requiresPaymentUpToDate: updateData.isOfficialMatch,
    });
  }

  async deleteConvocation(convocationId: number): Promise<void> {
    const convocation = await this.sportEventsService.findOne(convocationId);

    if (convocation.type !== SportEventType.MATCH) {
      throw new BadRequestException('Solo se pueden eliminar convocatorias para partidos');
    }

    await this.sportEventsService.remove(convocationId);
  }

  // Métodos específicos para respuestas de jugadores

  async confirmParticipation(convocationId: number, userId: number, notes?: string): Promise<EventParticipant> {
    return await this.sportEventsService.updateParticipantResponse(
      convocationId,
      userId,
      { status: 'confirmed', notes }
    );
  }

  async declineParticipation(convocationId: number, userId: number, notes?: string): Promise<EventParticipant> {
    return await this.sportEventsService.updateParticipantResponse(
      convocationId,
      userId,
      { status: 'declined', notes }
    );
  }

  // Métodos de consulta específicos

  async getUpcomingConvocations(teamId: number): Promise<SportEvent[]> {
    const now = new Date();
    
    return await this.sportEventRepository.find({
      where: {
        teamId,
        type: SportEventType.MATCH,
        eventDate: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Desde mañana
        status: SportEventStatus.SCHEDULED,
      },
      relations: ['team', 'participants', 'participants.user'],
      order: { eventDate: 'ASC' },
      take: 5,
    });
  }

  async getUserConvocations(userId: number): Promise<SportEvent[]> {
    const participants = await this.participantRepository.find({
      where: { userId },
      relations: ['event', 'event.team']
    });

    return participants
      .filter(p => p.event.type === SportEventType.MATCH)
      .map(p => p.event)
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
  }

  async getPendingResponses(userId: number): Promise<SportEvent[]> {
    const participants = await this.participantRepository.find({
      where: { 
        userId,
        status: ParticipantStatus.PENDING 
      },
      relations: ['event', 'event.team']
    });

    return participants
      .filter(p => p.event.type === SportEventType.MATCH)
      .filter(p => p.event.eventDate > new Date()) // Solo futuros
      .map(p => p.event)
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime());
  }
}
