import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { SportEvent, SportEventType, SportEventStatus } from './entities/sport-event.entity';
import { EventParticipant, ParticipantStatus, ParticipantRole } from './entities/event-participant.entity';
import { CreateSportEventDto, UpdateSportEventDto, AddParticipantDto, UpdateParticipantResponseDto } from './dtos/create-sport-event.dto';
import { AddSocialGuestDto } from './dtos/add-social-guest.dto';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { Player } from '../players/entities/player.entity';
import { User } from '../users/entities/user.entity';
import { Team } from '../teams/entities/teams.entity';
import { TeamSocialGuest } from './entities/team-social-guest.entity';
import { UserRole } from '../users-roles/entities/userRole.entity';
import { Role } from '../roles/entities/role.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EventStateService } from './event-state.service';

@Injectable()
export class SportEventsService {
  constructor(
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
    @InjectRepository(TeamSocialGuest)
    private readonly teamSocialGuestRepository: Repository<TeamSocialGuest>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly notificationsService: NotificationsService,
    private readonly eventStateService: EventStateService,
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

    if (createSportEventDto.participantIds?.length) {
      await this.addParticipants(savedEvent.id, createSportEventDto.participantIds);
    } else if (createSportEventDto.autoInviteParticipants !== false) {
      await this.autoInviteParticipants(
        savedEvent,
        createSportEventDto.categoryIds,
      );
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

  async update(id: number, updateSportEventDto: UpdateSportEventDto, changedBy?: number): Promise<SportEvent> {
    const event = await this.findOne(id);
    const oldStatus = event.status;

    // Actualizar campos
    Object.assign(event, {
      ...updateSportEventDto,
      eventDate: updateSportEventDto.eventDate ? new Date(updateSportEventDto.eventDate) : event.eventDate,
      confirmationDeadline: updateSportEventDto.confirmationDeadline 
        ? new Date(updateSportEventDto.confirmationDeadline) 
        : event.confirmationDeadline,
    });

    await this.sportEventRepository.save(event);
    
    // Verificar si cambió el estado y notificar
    if (updateSportEventDto.status && oldStatus !== updateSportEventDto.status) {
      const participants = await this.participantRepository.find({
        where: { eventId: id },
        relations: ['user'],
      });

      await this.eventStateService.handleEventStateChange({
        eventId: id,
        eventTitle: event.title,
        eventType: event.type,
        oldStatus,
        newStatus: updateSportEventDto.status,
        changedBy: changedBy || event.createdBy,
        teamId: event.teamId,
        participants,
      });
    }

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

    // Eventos sociales: permitir invitar usuarios fuera del roster
    if (event.type !== SportEventType.SOCIAL) {
      if (
        event.type === SportEventType.MATCH &&
        event.isOfficialMatch &&
        event.requiresPaymentUpToDate
      ) {
        const player = await this.playerRepository.findOne({
          where: { user_id: addParticipantDto.userId },
        });
        if (!player) {
          throw new ForbiddenException('El jugador no está registrado en el equipo');
        }
        const roster = await this.rosterRepository.findOne({
          where: {
            playerId: player.id,
            teamId: event.teamId,
            isEnabled: true,
            medicalStatus: 'approved',
          },
        });
        if (!roster) {
          throw new ForbiddenException(
            'El jugador no está habilitado para partidos oficiales',
          );
        }
      }
    }

    const isSocial = event.type === SportEventType.SOCIAL;
    const status = ParticipantStatus.PENDING;

    const participant = this.participantRepository.create({
      eventId,
      userId: addParticipantDto.userId,
      role: addParticipantDto.role || ParticipantRole.PLAYER,
      notes: addParticipantDto.notes,
      playingPosition: addParticipantDto.playingPosition,
      status,
      includedInExpenseSplit: isSocial ? false : true,
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

    const event = await this.sportEventRepository.findOne({
      where: { id: eventId },
    });
    if (event?.type === SportEventType.SOCIAL) {
      if (participant.status === ParticipantStatus.CONFIRMED) {
        participant.includedInExpenseSplit = true;
      } else {
        participant.includedInExpenseSplit = false;
      }
    }

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

  private async resolveEligibleUserIds(
    teamId: number,
    categoryIds?: number[],
    onlyEnabled = false,
    medicalApproved = false,
  ): Promise<number[]> {
    const where: Record<string, unknown> = { teamId };
    if (onlyEnabled) where.isEnabled = true;
    if (medicalApproved) where.medicalStatus = 'approved';
    if (categoryIds?.length) {
      where.categoryId = In(categoryIds);
    }

    const roster = await this.rosterRepository.find({
      where,
      relations: ['player', 'player.user'],
    });

    const userIds = new Set<number>();
    for (const row of roster) {
      const uid = row.player?.user?.id;
      if (uid) userIds.add(uid);
    }
    return Array.from(userIds);
  }

  private async autoInviteParticipants(
    event: SportEvent,
    categoryIds?: number[],
  ): Promise<void> {
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
        eligibleUsers = await this.resolveEligibleUserIds(
          event.teamId,
          categoryIds?.length ? categoryIds : undefined,
        );
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
              eventTitle: event.title,
              date: event.eventDate.toLocaleString('es-AR', { 
                dateStyle: 'full', 
                timeStyle: 'short' 
              }),
              location: event.location || 'Por definir',
              duration: event.durationMinutes ? `${event.durationMinutes} minutos` : 'Por definir',
              description: event.description?.trim() || undefined,
              notes: event.notes?.trim() || undefined,
            },
            [event.createdBy],
          );
          console.log(`✅ Training reminder sent for event ${event.id}`);
          break;

        case SportEventType.MATCH:
          await this.notificationsService.sendMatchInvitation(
            event.id,
            event.teamId,
            {
              eventTitle: event.title,
              date: event.eventDate.toLocaleString('es-AR', { 
                dateStyle: 'full', 
                timeStyle: 'short' 
              }),
              opponent: event.opponentName || 'Por definir',
              location: event.location || 'Por definir',
            },
            [event.createdBy],
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
            },
            [event.createdBy],
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

  async getUserEvents(userId: number) {
    const participants = await this.participantRepository.find({
      where: { userId },
      relations: ['event', 'event.team', 'event.participants', 'event.participants.user'],
      order: { event: { eventDate: 'ASC' } },
    });

    return participants.map((p) => ({
      ...p.event,
      myParticipation: {
        status: p.status,
        includedInExpenseSplit: p.includedInExpenseSplit !== false,
        responseDate: p.responseDate,
      },
    }));
  }

  async listTeamSocialGuests(teamId: number) {
    const guests = await this.teamSocialGuestRepository.find({
      where: { teamId },
      relations: ['user'],
      order: { displayName: 'ASC' },
    });
    return guests.map((g) => ({
      id: g.id,
      teamId: g.teamId,
      displayName: g.displayName,
      phone: g.phone,
      email: g.email,
      userId: g.userId,
    }));
  }

  async addSocialGuestParticipant(
    eventId: number,
    dto: AddSocialGuestDto,
    createdBy: number,
  ): Promise<EventParticipant> {
    const event = await this.findOne(eventId);
    if (event.type !== SportEventType.SOCIAL) {
      throw new BadRequestException(
        'Solo se pueden agregar invitados externos a eventos sociales',
      );
    }

    const displayName = dto.displayName.trim();
    const phone = dto.phone?.trim() || undefined;
    const email = dto.email?.trim().toLowerCase() || undefined;

    let guest: TeamSocialGuest | null = null;
    if (phone) {
      guest = await this.teamSocialGuestRepository.findOne({
        where: { teamId: event.teamId, phone },
      });
    }
    if (!guest) {
      guest = await this.teamSocialGuestRepository.findOne({
        where: { teamId: event.teamId, displayName },
      });
    }

    let userId: number;

    if (guest) {
      userId = guest.userId;
      if (phone && !guest.phone) {
        guest.phone = phone;
        await this.teamSocialGuestRepository.save(guest);
      }
    } else {
      userId = await this.createShadowGuestUser(
        event.teamId,
        displayName,
        email,
        phone,
      );
      guest = await this.teamSocialGuestRepository.save(
        this.teamSocialGuestRepository.create({
          teamId: event.teamId,
          displayName,
          phone,
          email,
          userId,
          createdBy,
        }),
      );
    }

    const existing = await this.participantRepository.findOne({
      where: { eventId, userId },
    });
    if (existing) {
      throw new BadRequestException(
        `${displayName} ya está en la lista del evento`,
      );
    }

    const participant = this.participantRepository.create({
      eventId,
      userId,
      role: ParticipantRole.PLAYER,
      status: ParticipantStatus.CONFIRMED,
      includedInExpenseSplit: true,
      notes: phone ? `Tel: ${phone}` : undefined,
    });

    return await this.participantRepository.save(participant);
  }

  private async createShadowGuestUser(
    teamId: number,
    displayName: string,
    email?: string,
    phone?: string,
  ): Promise<number> {
    const parts = displayName.split(/\s+/).filter(Boolean);
    const firstName = parts[0] ?? displayName;
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 20);
    const username = `guest_${teamId}_${slug}_${Date.now()}`;
    const guestEmail =
      email ||
      `guest.${teamId}.${Date.now()}@sportify-guest.local`;

    const user = await this.userRepository.save(
      this.userRepository.create({
        username,
        email: guestEmail,
        firstName,
        lastName,
        phone,
        estadoRegistro: 'social_guest',
        isActive: true,
      }),
    );

    const guestRole = await this.roleRepository.findOne({
      where: { name: 'guest' },
    });
    if (guestRole) {
      const hasRole = await this.userRoleRepository.findOne({
        where: { userId: user.id, roleId: guestRole.id },
      });
      if (!hasRole) {
        await this.userRoleRepository.save(
          this.userRoleRepository.create({
            userId: user.id,
            roleId: guestRole.id,
          }),
        );
      }
    }

    return user.id;
  }
}
