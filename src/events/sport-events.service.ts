import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { SportEvent, SportEventType, SportEventStatus } from './entities/sport-event.entity';
import { EventParticipant, ParticipantStatus, ParticipantRole } from './entities/event-participant.entity';
import { CreateSportEventDto, UpdateSportEventDto, AddParticipantDto, UpdateParticipantResponseDto } from './dtos/create-sport-event.dto';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { User } from '../users/entities/user.entity';
import { Team } from '../teams/entities/teams.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SportEventsService {
  constructor(
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createSportEventDto: CreateSportEventDto): Promise<SportEvent> {
    // Verificar que el equipo existe
    const team = await this.teamRepository.findOne({
      where: { id: createSportEventDto.teamId }
    });
    if (!team) {
      throw new NotFoundException(`Equipo con ID ${createSportEventDto.teamId} no encontrado`);
    }

    // Verificar que el creador existe
    const creator = await this.userRepository.findOne({
      where: { id: createSportEventDto.createdBy }
    });
    if (!creator) {
      throw new NotFoundException(`Usuario creador con ID ${createSportEventDto.createdBy} no encontrado`);
    }

    // Crear el evento
    const sportEvent = this.sportEventRepository.create({
      ...createSportEventDto,
      eventDate: new Date(createSportEventDto.eventDate),
      confirmationDeadline: createSportEventDto.confirmationDeadline 
        ? new Date(createSportEventDto.confirmationDeadline) 
        : null,
      status: createSportEventDto.status || SportEventStatus.SCHEDULED,
    });

    const savedEvent = await this.sportEventRepository.save(sportEvent);

    // Si se proporcionaron participantes, agregarlos
    if (createSportEventDto.participantIds && createSportEventDto.participantIds.length > 0) {
      await this.addParticipants(savedEvent.id, createSportEventDto.participantIds);
    } else if (createSportEventDto.autoInviteParticipants !== false) {
      // Auto-invitar jugadores según el tipo de evento (por defecto true)
      await this.autoInviteParticipants(savedEvent);
    }

    // Enviar notificaciones según el tipo de evento (solo si está habilitado)
    if (createSportEventDto.sendNotifications !== false) {
      await this.sendEventNotifications(savedEvent);
    }

    return await this.findOne(savedEvent.id);
  }

  async findAll(teamId?: number, type?: SportEventType, status?: SportEventStatus): Promise<SportEvent[]> {
    const whereCondition: any = {};
    
    if (teamId) whereCondition.teamId = teamId;
    if (type) whereCondition.type = type;
    if (status) whereCondition.status = status;

    return await this.sportEventRepository.find({
      where: whereCondition,
      relations: ['team', 'creator', 'participants', 'participants.user'],
      order: { eventDate: 'ASC' }
    });
  }

  async findOne(id: number): Promise<SportEvent> {
    const event = await this.sportEventRepository.findOne({
      where: { id },
      relations: ['team', 'creator', 'participants', 'participants.user']
    });

    if (!event) {
      throw new NotFoundException(`Evento con ID ${id} no encontrado`);
    }

    return event;
  }

  async update(id: number, updateSportEventDto: UpdateSportEventDto): Promise<SportEvent> {
    const event = await this.findOne(id);

    // Actualizar campos
    Object.assign(event, {
      ...updateSportEventDto,
      eventDate: updateSportEventDto.eventDate ? new Date(updateSportEventDto.eventDate) : event.eventDate,
      confirmationDeadline: updateSportEventDto.confirmationDeadline 
        ? new Date(updateSportEventDto.confirmationDeadline) 
        : event.confirmationDeadline,
    });

    await this.sportEventRepository.save(event);
    return await this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const event = await this.findOne(id);
    await this.sportEventRepository.remove(event);
  }

  // GESTIÓN DE PARTICIPANTES

  async addParticipant(eventId: number, addParticipantDto: AddParticipantDto): Promise<EventParticipant> {
    const event = await this.findOne(eventId);
    
    // Verificar que el usuario existe
    const user = await this.userRepository.findOne({
      where: { id: addParticipantDto.userId }
    });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${addParticipantDto.userId} no encontrado`);
    }

    // Verificar que no esté ya participando
    const existingParticipant = await this.participantRepository.findOne({
      where: { eventId, userId: addParticipantDto.userId }
    });
    if (existingParticipant) {
      throw new BadRequestException('El usuario ya está participando en este evento');
    }

    // Verificar límite de participantes
    if (event.maxParticipants && event.participantCount >= event.maxParticipants) {
      throw new BadRequestException('Se ha alcanzado el límite máximo de participantes');
    }

    // Para partidos oficiales, verificar que el jugador esté habilitado
    if (event.type === SportEventType.MATCH && event.isOfficialMatch && event.requiresPaymentUpToDate) {
      const roster = await this.rosterRepository.findOne({
        where: {
          playerId: addParticipantDto.userId,
          teamId: event.teamId,
          isEnabled: true,
          medicalStatus: 'approved'
        }
      });
      if (!roster) {
        throw new ForbiddenException('El jugador no está habilitado para partidos oficiales');
      }
    }

    const participant = this.participantRepository.create({
      eventId,
      userId: addParticipantDto.userId,
      role: addParticipantDto.role || ParticipantRole.PLAYER,
      notes: addParticipantDto.notes,
      playingPosition: addParticipantDto.playingPosition,
      status: ParticipantStatus.PENDING,
    });

    return await this.participantRepository.save(participant);
  }

  async addParticipants(eventId: number, userIds: number[]): Promise<EventParticipant[]> {
    const participants: EventParticipant[] = [];
    
    for (const userId of userIds) {
      try {
        const participant = await this.addParticipant(eventId, { userId } as AddParticipantDto);
        participants.push(participant);
      } catch (error) {
        console.warn(`No se pudo agregar participante ${userId}: ${error.message}`);
      }
    }

    return participants;
  }


  async updateParticipantResponse(
    eventId: number, 
    userId: number, 
    updateDto: UpdateParticipantResponseDto
  ): Promise<EventParticipant> {
    const participant = await this.participantRepository.findOne({
      where: { eventId, userId },
      relations: ['event', 'user']
    });

    if (!participant) {
      throw new NotFoundException('Participación no encontrada');
    }

    participant.status = updateDto.status as ParticipantStatus;
    participant.responseDate = new Date();
    participant.notes = updateDto.notes || participant.notes;
    participant.playingPosition = updateDto.playingPosition || participant.playingPosition;

    return await this.participantRepository.save(participant);
  }

  async removeParticipant(eventId: number, userId: number): Promise<void> {
    const participant = await this.participantRepository.findOne({
      where: { eventId, userId }
    });

    if (!participant) {
      throw new NotFoundException('Participación no encontrada');
    }

    await this.participantRepository.remove(participant);
  }

  // MÉTODOS AUXILIARES

  private async autoInviteParticipants(event: SportEvent): Promise<void> {
    let eligibleUsers: number[] = [];
    console.log(`🔍 Auto-inviting participants for event ${event.id}, team ${event.teamId}, type ${event.type}`);

    switch (event.type) {
      case SportEventType.TRAINING:
        // Invitar a todos los jugadores del equipo
        const trainingRoster = await this.rosterRepository.find({
          where: { teamId: event.teamId, isEnabled: true },
          relations: ['player', 'player.user']
        });
        console.log(`📋 Found ${trainingRoster.length} roster entries for training`);
        console.log('Roster entries:', trainingRoster.map(r => ({
          rosterId: r.id,
          playerId: r.playerId,
          playerUserId: r.player?.user?.id,
          playerUsername: r.player?.user?.username,
          isEnabled: r.isEnabled
        })));
        
        eligibleUsers = trainingRoster
          .map(r => r.player?.user?.id)
          .filter(id => id !== undefined);
        console.log(`👥 Eligible users for training: ${eligibleUsers}`);
        break;

      case SportEventType.MATCH:
        if (event.isOfficialMatch && event.requiresPaymentUpToDate) {
          // Solo jugadores habilitados con apto médico aprobado
          const matchRoster = await this.rosterRepository.find({
            where: { 
              teamId: event.teamId, 
              isEnabled: true, 
              medicalStatus: 'approved' 
            },
            relations: ['player', 'player.user']
          });
          eligibleUsers = matchRoster
            .map(r => r.player?.user?.id)
            .filter(id => id !== undefined);
        } else {
          // Todos los jugadores del equipo para amistosos
          const friendlyRoster = await this.rosterRepository.find({
            where: { teamId: event.teamId, isEnabled: true },
            relations: ['player', 'player.user']
          });
          eligibleUsers = friendlyRoster
            .map(r => r.player?.user?.id)
            .filter(id => id !== undefined);
        }
        break;

      case SportEventType.SOCIAL:
        // Invitar a todos los jugadores del equipo
        const socialRoster = await this.rosterRepository.find({
          where: { teamId: event.teamId },
          relations: ['player', 'player.user']
        });
        eligibleUsers = socialRoster
          .map(r => r.player?.user?.id)
          .filter(id => id !== undefined);
        break;
    }

    console.log(`🎯 Final eligible users count: ${eligibleUsers.length}`);
    if (eligibleUsers.length > 0) {
      console.log(`📨 Adding ${eligibleUsers.length} participants to event ${event.id}`);
      await this.addParticipants(event.id, eligibleUsers);
      console.log(`✅ Successfully added participants to event ${event.id}`);
    } else {
      console.log(`⚠️ No eligible users found for event ${event.id} (team ${event.teamId}, type ${event.type})`);
    }
  }

  private async sendEventNotifications(event: SportEvent): Promise<void> {
    try {
      console.log(`📧 Sending notifications for event ${event.id}, type ${event.type}, team ${event.teamId}`);
      switch (event.type) {
        case SportEventType.TRAINING:
          console.log(`🏃 Sending training reminder for event ${event.id}`);
          await this.notificationsService.sendTrainingReminder(
            event.id,
            event.teamId,
            {
              date: event.eventDate.toISOString(),
              location: event.location || 'Por definir',
              duration: event.durationMinutes ? `${event.durationMinutes} minutos` : 'Por definir',
            }
          );
          console.log(`✅ Training reminder sent for event ${event.id}`);
          break;

        case SportEventType.MATCH:
          await this.notificationsService.sendMatchInvitation(
            event.id,
            event.teamId,
            {
              date: event.eventDate.toISOString(),
              opponent: event.opponentName || 'Por definir',
              location: event.location || 'Por definir',
            }
          );
          break;

        case SportEventType.SOCIAL:
          await this.notificationsService.sendSocialEventNotification(
            event.id,
            event.teamId,
            {
              title: event.title,
              date: event.eventDate.toISOString(),
              location: event.location || 'Por definir',
              hasExpenses: event.hasExpenses,
            }
          );
          break;
      }
    } catch (error) {
      console.error('Error sending event notifications:', error);
    }
  }

  // MÉTODOS DE CONSULTA ESPECÍFICOS

  async getUpcomingEvents(teamId: number, days: number = 7): Promise<SportEvent[]> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return await this.sportEventRepository.find({
      where: {
        teamId,
        eventDate: Between(startDate, endDate),
        status: In([SportEventStatus.SCHEDULED, SportEventStatus.CONFIRMED])
      },
      relations: ['team', 'participants', 'participants.user'],
      order: { eventDate: 'ASC' }
    });
  }

  async getEventsByDateRange(
    teamId: number, 
    startDate: Date, 
    endDate: Date
  ): Promise<SportEvent[]> {
    return await this.sportEventRepository.find({
      where: {
        teamId,
        eventDate: Between(startDate, endDate)
      },
      relations: ['team', 'participants', 'participants.user'],
      order: { eventDate: 'ASC' }
    });
  }

  async getUserEvents(userId: number): Promise<SportEvent[]> {
    const participants = await this.participantRepository.find({
      where: { userId },
      relations: ['event', 'event.team']
    });

    return participants.map(p => p.event);
  }
}
