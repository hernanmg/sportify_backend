import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { SportEvent, SportEventStatus, SportEventType } from './entities/sport-event.entity';
import { EventParticipant, ParticipantStatus } from './entities/event-participant.entity';
import { NotificationType } from '../notifications/entities/notification.entity';

export interface StateChangeNotification {
  eventId: number;
  eventTitle: string;
  eventType: SportEventType;
  oldStatus: SportEventStatus;
  newStatus: SportEventStatus;
  changedBy: number;
  teamId: number;
  participants?: EventParticipant[];
}

@Injectable()
export class EventStateService {
  private readonly logger = new Logger(EventStateService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly schedulerService: SchedulerService,
  ) {}

  // Manejar cambio de estado de evento
  async handleEventStateChange(stateChange: StateChangeNotification): Promise<void> {
    this.logger.log(`🔄 Cambio de estado: ${stateChange.eventTitle} (${stateChange.oldStatus} → ${stateChange.newStatus})`);

    try {
      // Procesar según el tipo de cambio
      switch (stateChange.newStatus) {
        case SportEventStatus.SCHEDULED:
          await this.handleEventScheduled(stateChange);
          break;
        
        case SportEventStatus.CANCELLED:
          await this.handleEventCancelled(stateChange);
          break;
        
        case SportEventStatus.POSTPONED:
          await this.handleEventPostponed(stateChange);
          break;
        
        case SportEventStatus.COMPLETED:
          await this.handleEventCompleted(stateChange);
          break;
        
        case SportEventStatus.IN_PROGRESS:
          await this.handleEventStarted(stateChange);
          break;
        
        default:
          this.logger.log(`ℹ️ Estado ${stateChange.newStatus} no requiere notificaciones especiales`);
      }

      // Programar recordatorios automáticos si es necesario
      await this.scheduleAutomaticReminders(stateChange);

    } catch (error) {
      this.logger.error(`❌ Error procesando cambio de estado: ${error.message}`);
    }
  }

  // Evento programado/confirmado
  private async handleEventScheduled(stateChange: StateChangeNotification): Promise<void> {
    if (stateChange.oldStatus === SportEventStatus.DRAFT) {
      // Evento recién publicado
      await this.handleEventPublished(stateChange);
    } else {
      // Evento reprogramado
      await this.handleEventRescheduled(stateChange);
    }
  }

  // Evento cancelado
  private async handleEventCancelled(stateChange: StateChangeNotification): Promise<void> {
    const notification = {
      title: `❌ ${stateChange.eventType === SportEventType.MATCH ? 'Partido' : 'Entrenamiento'} Cancelado`,
      body: `${stateChange.eventTitle} ha sido cancelado`,
      type: NotificationType.EVENT_CANCELLED,
    };

    // Notificar a todos los participantes
    if (stateChange.participants && stateChange.participants.length > 0) {
      for (const participant of stateChange.participants) {
        await this.notificationsService.createNotification({
          userId: participant.userId,
          title: notification.title,
          message: notification.body,
          type: notification.type,
          sportEventId: stateChange.eventId,
        });
      }
    } else {
      // Notificar a todo el equipo
      await this.notificationsService.sendTeamNotification(
        stateChange.teamId,
        notification.title,
        notification.body,
        notification.type,
        stateChange.eventId,
      );
    }

    this.logger.log(`📢 Notificaciones de cancelación enviadas para evento ${stateChange.eventId}`);
  }

  // Evento pospuesto
  private async handleEventPostponed(stateChange: StateChangeNotification): Promise<void> {
    const notification = {
      title: `⏰ ${stateChange.eventType === SportEventType.MATCH ? 'Partido' : 'Entrenamiento'} Pospuesto`,
      body: `${stateChange.eventTitle} ha sido pospuesto. Se informará nueva fecha pronto.`,
      type: NotificationType.EVENT_POSTPONED,
    };

    // Notificar a todos los participantes
    if (stateChange.participants && stateChange.participants.length > 0) {
      for (const participant of stateChange.participants) {
        await this.notificationsService.createNotification({
          userId: participant.userId,
          title: notification.title,
          message: notification.body,
          type: notification.type,
          sportEventId: stateChange.eventId,
        });
      }
    } else {
      // Notificar a todo el equipo
      await this.notificationsService.sendTeamNotification(
        stateChange.teamId,
        notification.title,
        notification.body,
        notification.type,
        stateChange.eventId,
      );
    }

    this.logger.log(`📢 Notificaciones de posposición enviadas para evento ${stateChange.eventId}`);
  }

  // Evento completado
  private async handleEventCompleted(stateChange: StateChangeNotification): Promise<void> {
    const notification = {
      title: `✅ ${stateChange.eventType === SportEventType.MATCH ? 'Partido' : 'Entrenamiento'} Finalizado`,
      body: `${stateChange.eventTitle} ha finalizado. ¡Gracias por participar!`,
      type: NotificationType.EVENT_COMPLETED,
    };

    // Solo notificar a participantes confirmados
    if (stateChange.participants && stateChange.participants.length > 0) {
      const confirmedParticipants = stateChange.participants.filter(
        p => p.status === ParticipantStatus.CONFIRMED
      );

      for (const participant of confirmedParticipants) {
        await this.notificationsService.createNotification({
          userId: participant.userId,
          title: notification.title,
          message: notification.body,
          type: notification.type,
          sportEventId: stateChange.eventId,
        });
      }
    }

    this.logger.log(`📢 Notificaciones de finalización enviadas para evento ${stateChange.eventId}`);
  }

  // Evento iniciado
  private async handleEventStarted(stateChange: StateChangeNotification): Promise<void> {
    const notification = {
      title: `🚀 ${stateChange.eventType === SportEventType.MATCH ? 'Partido' : 'Entrenamiento'} Iniciado`,
      body: `${stateChange.eventTitle} ha comenzado`,
      type: NotificationType.EVENT_STARTED,
    };

    // Solo notificar a participantes confirmados
    if (stateChange.participants && stateChange.participants.length > 0) {
      const confirmedParticipants = stateChange.participants.filter(
        p => p.status === ParticipantStatus.CONFIRMED
      );

      for (const participant of confirmedParticipants) {
        await this.notificationsService.createNotification({
          userId: participant.userId,
          title: notification.title,
          message: notification.body,
          type: notification.type,
          sportEventId: stateChange.eventId,
        });
      }
    }

    this.logger.log(`📢 Notificaciones de inicio enviadas para evento ${stateChange.eventId}`);
  }

  // Evento publicado por primera vez
  private async handleEventPublished(stateChange: StateChangeNotification): Promise<void> {
    if (stateChange.eventType === SportEventType.MATCH) {
      // Es una convocatoria
      await this.notificationsService.sendMatchInvitation(
        stateChange.eventId,
        stateChange.teamId,
        stateChange.eventTitle,
      );
    } else {
      // Es un entrenamiento u otro evento
      await this.notificationsService.sendTrainingReminder(
        stateChange.eventId,
        stateChange.teamId,
        stateChange.eventTitle,
      );
    }

    this.logger.log(`📢 Notificaciones de publicación enviadas para evento ${stateChange.eventId}`);
  }

  // Evento reprogramado
  private async handleEventRescheduled(stateChange: StateChangeNotification): Promise<void> {
    const notification = {
      title: `📅 ${stateChange.eventType === SportEventType.MATCH ? 'Partido' : 'Entrenamiento'} Reprogramado`,
      body: `${stateChange.eventTitle} ha sido reprogramado. Revisa los nuevos detalles.`,
      type: NotificationType.EVENT_RESCHEDULED,
    };

    // Notificar a todos los participantes
    if (stateChange.participants && stateChange.participants.length > 0) {
      for (const participant of stateChange.participants) {
        await this.notificationsService.createNotification({
          userId: participant.userId,
          title: notification.title,
          message: notification.body,
          type: notification.type,
          sportEventId: stateChange.eventId,
        });
      }
    } else {
      // Notificar a todo el equipo
      await this.notificationsService.sendTeamNotification(
        stateChange.teamId,
        notification.title,
        notification.body,
        notification.type,
        stateChange.eventId,
      );
    }

    this.logger.log(`📢 Notificaciones de reprogramación enviadas para evento ${stateChange.eventId}`);
  }

  // Programar recordatorios automáticos
  private async scheduleAutomaticReminders(stateChange: StateChangeNotification): Promise<void> {
    if (stateChange.newStatus !== SportEventStatus.SCHEDULED) {
      return; // Solo programar recordatorios para eventos confirmados
    }

    // TODO: Obtener la fecha real del evento desde la base de datos
    const eventDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Placeholder

    if (stateChange.eventType === SportEventType.MATCH) {
      // Recordatorio 24 horas antes del partido
      const reminderDate = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
      
      if (reminderDate > new Date()) {
        this.schedulerService.scheduleEmail({
          to: 'team@example.com', // TODO: Obtener emails del equipo
          subject: `Recordatorio: Partido mañana - ${stateChange.eventTitle}`,
          template: 'match-reminder',
          context: {
            eventTitle: stateChange.eventTitle,
            eventDate: eventDate.toISOString(),
          },
          scheduledFor: reminderDate,
        });

        this.logger.log(`📅 Recordatorio de partido programado para ${reminderDate.toISOString()}`);
      }
    } else if (stateChange.eventType === SportEventType.TRAINING) {
      // Recordatorio 2 horas antes del entrenamiento
      const reminderDate = new Date(eventDate.getTime() - 2 * 60 * 60 * 1000);
      
      if (reminderDate > new Date()) {
        this.schedulerService.scheduleEmail({
          to: 'team@example.com', // TODO: Obtener emails del equipo
          subject: `Recordatorio: Entrenamiento en 2 horas - ${stateChange.eventTitle}`,
          template: 'training-reminder',
          context: {
            eventTitle: stateChange.eventTitle,
            eventDate: eventDate.toISOString(),
          },
          scheduledFor: reminderDate,
        });

        this.logger.log(`📅 Recordatorio de entrenamiento programado para ${reminderDate.toISOString()}`);
      }
    }
  }

  // Método auxiliar para crear notificación de cambio de estado genérica
  private async createStateChangeNotification(
    stateChange: StateChangeNotification,
    title: string,
    body: string,
    type: string,
  ): Promise<void> {
    if (stateChange.participants && stateChange.participants.length > 0) {
      // Notificar a participantes específicos
      for (const participant of stateChange.participants) {
        await this.notificationsService.createNotification({
          userId: participant.userId,
          title,
          message: body,
          type: type as any,
          sportEventId: stateChange.eventId,
        });
      }
    } else {
      // Notificar a todo el equipo
      await this.notificationsService.sendTeamNotification(
        stateChange.teamId,
        title,
        body,
        type as any,
        stateChange.eventId,
      );
    }
  }
}
