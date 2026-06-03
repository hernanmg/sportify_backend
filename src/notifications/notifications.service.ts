import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { Notification, NotificationType, NotificationPriority } from './entities/notification.entity';
import { CreateNotificationDto, CreateBulkNotificationDto } from './dtos/create-notification.dto';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { User } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';
import { PushService, PushNotificationData } from '../push/push.service';
import * as AWS from 'aws-sdk';

@Injectable()
export class NotificationsService {
  private sns: AWS.SNS;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
  ) {
    this.sns = new AWS.SNS({ region: 'us-east-1' });
  }

  // Enviar notificación a todo el equipo
  async sendTeamNotification(
    teamId: number,
    title: string,
    message: string,
    type: NotificationType,
    sportEventId?: number,
  ): Promise<void> {
    // Obtener todos los jugadores del equipo
    const teamPlayers = await this.rosterRepository.find({
      where: { teamId },
      relations: ['player', 'player.user'],
    });

    // Crear notificaciones para cada jugador
    for (const roster of teamPlayers) {
      if (roster.player && roster.player.user) {
        await this.createNotification({
          userId: roster.player.user.id,
          title,
          message,
          type,
          sportEventId,
        });
      }
    }
  }

  // Crear notificación individual
  async createNotification(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      scheduledFor: createNotificationDto.scheduledFor ? new Date(createNotificationDto.scheduledFor) : null,
    });
    
    const savedNotification = await this.notificationRepository.save(notification);
    
    // Si no está programada, enviarla inmediatamente
    if (!notification.scheduledFor) {
      await this.sendNotification(savedNotification);
    }
    
    return savedNotification;
  }

  // Crear notificaciones masivas
  async createBulkNotifications(createBulkDto: CreateBulkNotificationDto): Promise<Notification[]> {
    const notifications = createBulkDto.userIds.map(userId => 
      this.notificationRepository.create({
        userId,
        teamId: createBulkDto.teamId,
        eventId: createBulkDto.eventId,
        sportEventId: createBulkDto.sportEventId,
        type: createBulkDto.type,
        priority: createBulkDto.priority || NotificationPriority.MEDIUM,
        title: createBulkDto.title,
        message: createBulkDto.message,
        data: createBulkDto.data,
        scheduledFor: createBulkDto.scheduledFor ? new Date(createBulkDto.scheduledFor) : null,
      })
    );

    const savedNotifications = await this.notificationRepository.save(notifications);

    // Enviar en segundo plano para no bloquear la respuesta HTTP
    for (const notification of savedNotifications) {
      if (!notification.scheduledFor) {
        void this.sendNotification(notification).catch((err) =>
          console.error(
            `❌ Error enviando notificación ${notification.id}:`,
            err,
          ),
        );
      }
    }

    return savedNotifications;
  }

  // Obtener notificaciones de un usuario
  async getUserNotifications(userId: number, limit: number = 50): Promise<Notification[]> {
    return await this.notificationRepository.find({
      where: { userId },
      relations: ['team', 'event', 'sportEvent'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // Obtener todas las notificaciones (para administradores)
  async getAllNotifications(limit: number = 50): Promise<Notification[]> {
    return await this.notificationRepository.find({
      relations: ['team', 'event', 'sportEvent', 'user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // Marcar como leída
  async markAsRead(notificationId: number, userId: number, userRole?: string): Promise<Notification> {
    let notification;
    
    // Si es admin, puede marcar cualquier notificación
    if (userRole === 'super_admin' || userRole === 'manager') {
      notification = await this.notificationRepository.findOne({
        where: { id: notificationId },
      });
    } else {
      // Usuarios normales solo pueden marcar sus propias notificaciones
      notification = await this.notificationRepository.findOne({
        where: { id: notificationId, userId },
      });
    }

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    
    return await this.notificationRepository.save(notification);
  }

  // Marcar todas como leídas
  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );
  }

  // Obtener notificaciones no leídas
  async getUnreadCount(userId: number): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  // Obtener cantidad total de notificaciones no leídas (para administradores)
  async getAllUnreadCount(): Promise<number> {
    return await this.notificationRepository.count({
      where: { isRead: false },
    });
  }

  // MÉTODOS ESPECÍFICOS PARA GESTIÓN DEPORTIVA

  // Convocatoria a partido oficial (solo jugadores con cuotas al día)
  async sendMatchInvitation(
    eventId: number,
    teamId: number,
    matchDetails: any,
    additionalUserIds: number[] = [],
  ): Promise<Notification[]> {
    const enabledPlayers = await this.rosterRepository.find({
      where: { 
        teamId, 
        isEnabled: true, 
        medicalStatus: 'approved' 
      },
      relations: ['player', 'player.user'],
    });

    const rosterUserIds = enabledPlayers
      .map(roster => roster.player?.user?.id)
      .filter((id): id is number => id !== undefined);

    const userIds =
      additionalUserIds.length > 0
        ? [...new Set(additionalUserIds)]
        : [...new Set(rosterUserIds)];

    if (userIds.length === 0) {
      return [];
    }

    const isOfficial = matchDetails.isOfficial !== false;
    return await this.createBulkNotifications({
      userIds,
      teamId,
      sportEventId: eventId,
      type: NotificationType.MATCH_INVITATION,
      priority: NotificationPriority.HIGH,
      title: isOfficial
        ? '⚽ Convocatoria — partido oficial'
        : '⚽ Convocatoria — partido amistoso',
      message: `Partido vs ${matchDetails.opponent ?? 'rival'} · ${matchDetails.location ?? ''}. Confirmá tu asistencia.`,
      data: {
        action: 'convocation_response',
        sportEventId: eventId,
        teamId,
        matchDate: matchDetails.date,
        opponent: matchDetails.opponent,
        location: matchDetails.location,
        courtNumber: matchDetails.courtNumber,
        squadSummary: matchDetails.squadSummary,
        deepLink: `/convocations/${eventId}`,
      },
    });
  }

  async sendImpedimentCreated(
    userId: number,
    teamId: number,
    payload: {
      playerName: string;
      reportedByName: string;
      selfReported: boolean;
      impedimentTypeLabel: string;
      categoryLabel?: string;
      clinicalDescription?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<Notification | null> {
    const tipo = payload.impedimentTypeLabel;
    const messageParts: string[] = [];
    if (payload.selfReported) {
      messageParts.push(`Registraste una ${tipo.toLowerCase()} en tu ficha.`);
    } else {
      messageParts.push(
        `${payload.reportedByName} registró una ${tipo.toLowerCase()} en la ficha de ${payload.playerName}.`,
      );
    }
    if (payload.categoryLabel) {
      messageParts.push(`Categoría ${payload.categoryLabel}.`);
    }
    if (payload.endDate) {
      messageParts.push(`Válida hasta el ${payload.endDate}.`);
    }

    const details: Array<{ label: string; value: string }> = [];
    if (!payload.selfReported) {
      details.push({ label: 'Registrado por', value: payload.reportedByName });
    }
    details.push({ label: 'Jugador', value: payload.playerName });
    if (payload.categoryLabel) {
      details.push({ label: 'Categoría', value: payload.categoryLabel });
    }
    details.push({ label: 'Tipo', value: tipo });
    if (payload.startDate) {
      details.push({ label: 'Desde', value: payload.startDate });
    }
    if (payload.endDate) {
      details.push({ label: 'Hasta', value: payload.endDate });
    }
    const notes = payload.clinicalDescription?.trim();
    if (notes) {
      details.push({ label: 'Observaciones', value: notes });
    }

    return this.createNotification({
      userId,
      teamId,
      type: NotificationType.GENERAL,
      priority: NotificationPriority.HIGH,
      title: '🏥 Impedimento registrado',
      message: messageParts.join(' '),
      data: {
        action: 'open_player_status',
        deepLink: '/sports/roster',
        teamId,
        details,
      },
    });
  }

  /** Aviso al cuerpo técnico (DT / admin del equipo). */
  async sendImpedimentStaffAlert(
    staffUserId: number,
    teamId: number,
    payload: {
      playerName: string;
      reportedByName: string;
      selfReported: boolean;
      impedimentTypeLabel: string;
      categoryLabel?: string;
      clinicalDescription?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<Notification | null> {
    const tipo = payload.impedimentTypeLabel;
    const message = payload.selfReported
      ? `${payload.playerName} informó una ${tipo.toLowerCase()} en su ficha.`
      : `${payload.reportedByName} registró una ${tipo.toLowerCase()} en la ficha de ${payload.playerName}.`;

    const details: Array<{ label: string; value: string }> = [
      { label: 'Jugador', value: payload.playerName },
    ];
    if (!payload.selfReported) {
      details.unshift({ label: 'Registrado por', value: payload.reportedByName });
    }
    if (payload.categoryLabel) {
      details.push({ label: 'Categoría', value: payload.categoryLabel });
    }
    details.push({ label: 'Tipo', value: tipo });
    if (payload.startDate) {
      details.push({ label: 'Desde', value: payload.startDate });
    }
    if (payload.endDate) {
      details.push({ label: 'Hasta', value: payload.endDate });
    }
    const notes = payload.clinicalDescription?.trim();
    if (notes) {
      details.push({ label: 'Observaciones', value: notes });
    }

    const suffix = [
      payload.categoryLabel ? `Categoría ${payload.categoryLabel}.` : '',
      payload.endDate ? `Hasta el ${payload.endDate}.` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return this.createNotification({
      userId: staffUserId,
      teamId,
      type: NotificationType.GENERAL,
      priority: NotificationPriority.HIGH,
      title: '🏥 Impedimento en el plantel',
      message: `${message}${suffix ? ' $suffix' : ''}`,
      data: {
        action: 'open_player_status',
        deepLink: '/sports/roster',
        teamId,
        details,
      },
    });
  }

  /**
   * Jugador afectado: solo si no se auto-reportó.
   * Staff (DT/admin del equipo): siempre, salvo quien ya registró como admin.
   */
  async notifyImpedimentCreated(
    teamId: number,
    affectedUserId: number,
    actorId: number,
    staffUserIds: number[],
    payload: {
      playerName: string;
      reportedByName: string;
      impedimentTypeLabel: string;
      categoryLabel?: string;
      clinicalDescription?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<void> {
    const selfReported = actorId === affectedUserId;
    const base = { ...payload, selfReported };

    if (!selfReported) {
      await this.sendImpedimentCreated(affectedUserId, teamId, {
        ...base,
        reportedByName: payload.reportedByName,
      });
    }

    const uniqueStaff = [...new Set(staffUserIds)].filter(
      (id) => id !== affectedUserId || !selfReported,
    );
    for (const staffId of uniqueStaff) {
      if (staffId === actorId) continue;
      await this.sendImpedimentStaffAlert(staffId, teamId, base);
    }
  }

  async sendImpedimentCleared(
    userId: number,
    teamId: number,
    payload: {
      playerName?: string;
      reason?: string;
      impedimentTypeLabel?: string;
      clearedByName?: string;
    },
  ): Promise<Notification | null> {
    const details: Array<{ label: string; value: string }> = [];
    if (payload.playerName) {
      details.push({ label: 'Jugador', value: payload.playerName });
    }
    if (payload.impedimentTypeLabel) {
      details.push({ label: 'Tipo', value: payload.impedimentTypeLabel });
    }
    if (payload.clearedByName) {
      details.push({ label: 'Dado de alta por', value: payload.clearedByName });
    }

    return this.createNotification({
      userId,
      teamId,
      type: NotificationType.IMPEDIMENT_CLEARED,
      priority: NotificationPriority.MEDIUM,
      title: '✅ Alta médica / habilitado',
      message:
        payload.reason ??
        'Ya podés ser convocado: tu impedimento fue dado de alta.',
      data: {
        action: 'open_player_status',
        deepLink: '/sports/roster',
        teamId,
        details,
      },
    });
  }

  // Recordatorio de entrenamiento
  async sendTrainingReminder(
    eventId: number,
    teamId: number,
    trainingDetails: any,
    additionalUserIds: number[] = [],
  ): Promise<Notification[]> {
    const teamPlayers = await this.rosterRepository.find({
      where: { teamId, isEnabled: true },
      relations: ['player', 'player.user'],
    });

    const rosterUserIds = teamPlayers
      .map(roster => roster.player?.user?.id)
      .filter((id): id is number => id !== undefined);

    const userIds = [...new Set([...rosterUserIds, ...additionalUserIds])];

    if (userIds.length === 0) {
      console.log(`⚠️ Sin destinatarios para recordatorio de entrenamiento (evento ${eventId}, equipo ${teamId})`);
      return [];
    }

    const alreadyNotified = await this.notificationRepository.find({
      where: {
        sportEventId: eventId,
        type: NotificationType.TRAINING_REMINDER,
        userId: In(userIds),
      },
      select: ['userId'],
    });
    const notifiedIds = new Set(alreadyNotified.map((n) => n.userId));
    const pendingUserIds = userIds.filter((id) => !notifiedIds.has(id));

    if (pendingUserIds.length === 0) {
      console.log(`ℹ️ Recordatorio de entrenamiento ya enviado para evento ${eventId}`);
      return [];
    }

    return await this.createBulkNotifications({
      userIds: pendingUserIds,
      teamId,
      sportEventId: eventId, // eventId es en realidad sportEventId
      type: NotificationType.TRAINING_REMINDER,
      priority: NotificationPriority.MEDIUM,
      title: '🏃‍♂️ Recordatorio de Entrenamiento',
      message: `Entrenamiento programado para el ${trainingDetails.date}. ¡No faltes!`,
      data: {
        eventTitle: trainingDetails.eventTitle,
        trainingDate: trainingDetails.date,
        date: trainingDetails.date,
        location: trainingDetails.location,
        duration: trainingDetails.duration,
        description: trainingDetails.description,
        notes: trainingDetails.notes,
      },
    });
  }

  // Alerta de apto médico próximo a vencer
  async sendMedicalExpiryAlerts(): Promise<Notification[]> {
    const expiringRosters = await this.rosterRepository
      .createQueryBuilder('roster')
      .leftJoinAndSelect('roster.player', 'player')
      .leftJoinAndSelect('player.user', 'user')
      .where('roster.medical_certificate_expires <= :date', {
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      })
      .andWhere('roster.medical_certificate_expires > :now', {
        date: new Date(),
      })
      .getMany();

    const notifications: Notification[] = [];

    for (const roster of expiringRosters) {
      if (roster.player?.user?.id) {
        const daysUntilExpiry = Math.ceil(
          (roster.medicalCertificateExpires!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        const notification = await this.createNotification({
          userId: roster.player.user.id,
          teamId: roster.teamId,
          type: NotificationType.MEDICAL_EXPIRY,
          priority: daysUntilExpiry <= 7 ? NotificationPriority.URGENT : NotificationPriority.HIGH,
          title: '🏥 Apto Médico por Vencer',
          message: `Tu apto médico vence en ${daysUntilExpiry} días. Renuévalo para seguir jugando.`,
          data: {
            expiryDate: roster.medicalCertificateExpires,
            daysUntilExpiry,
            playerRosterId: roster.id,
          },
        });

        notifications.push(notification);
      }
    }

    return notifications;
  }

  // Recordatorio de pago de cuotas
  async sendPaymentReminder(userIds: number[], teamId: number, paymentDetails: any): Promise<Notification[]> {
    return await this.createBulkNotifications({
      userIds,
      teamId,
      type: NotificationType.PAYMENT_REMINDER,
      priority: NotificationPriority.HIGH,
      title: '💰 Recordatorio de Pago',
      message: `Tienes cuotas pendientes. Paga antes del ${paymentDetails.dueDate} para mantener tu habilitación.`,
      data: {
        amount: paymentDetails.amount,
        dueDate: paymentDetails.dueDate,
        concept: paymentDetails.concept,
      },
    });
  }

  // Notificación de evento social
  async sendSocialEventNotification(
    eventId: number,
    teamId: number,
    eventDetails: any,
    additionalUserIds: number[] = [],
  ): Promise<Notification[]> {
    const teamPlayers = await this.rosterRepository.find({
      where: { teamId },
      relations: ['player', 'player.user'],
    });

    const rosterUserIds = teamPlayers
      .map(roster => roster.player?.user?.id)
      .filter((id): id is number => id !== undefined);

    const userIds = [...new Set([...rosterUserIds, ...additionalUserIds])];

    if (userIds.length === 0) {
      return [];
    }

    return await this.createBulkNotifications({
      userIds,
      teamId,
      sportEventId: eventId, // eventId es en realidad sportEventId
      type: NotificationType.SOCIAL_EVENT,
      priority: NotificationPriority.LOW,
      title: '🎉 Evento Social del Equipo',
      message: `${eventDetails.title} - ${eventDetails.date}. ¡Acompáñanos!`,
      data: {
        eventTitle: eventDetails.title,
        eventDate: eventDetails.date,
        location: eventDetails.location,
        hasExpenses: eventDetails.hasExpenses || false,
      },
    });
  }

  // Procesar notificaciones programadas
  async processScheduledNotifications(): Promise<void> {
    const scheduledNotifications = await this.notificationRepository.find({
      where: {
        scheduledFor: LessThanOrEqual(new Date()),
        sent: false,
      },
    });

    for (const notification of scheduledNotifications) {
      await this.sendNotification(notification);
    }
  }

  // Enviar notificación (Email + Push + AWS SNS)
  private async sendNotification(notification: Notification): Promise<void> {
    try {
      console.log(`📤 Enviando notificación: ${notification.title} a usuario ${notification.userId}`);
      
      // Obtener información del usuario
      const user = await this.userRepository.findOne({
        where: { id: notification.userId },
        relations: ['userRoles', 'userRoles.role'],
      });

      if (!user) {
        console.warn(`⚠️ Usuario ${notification.userId} no encontrado`);
        return;
      }

      // Preparar datos para email y push
      const notificationData = {
        playerName: `${user.firstName || user.username}`,
        teamName: notification.team?.name || 'Equipo',
        ...notification.data,
      };

      let emailSent = false;
      let pushSent = false;

      const requireVerifiedEmail =
        process.env.EMAIL_REQUIRE_VERIFIED === 'true';
      const canSendEmail =
        !!user.email &&
        (!requireVerifiedEmail || user.emailVerified);

      if (canSendEmail) {
        try {
          emailSent = await this.emailService.sendNotificationEmail(
            user.email,
            notification.type,
            notificationData,
          );
          console.log(`📧 Email ${emailSent ? 'enviado' : 'falló'} a ${user.email}`);
        } catch (error) {
          console.error(`❌ Error enviando email a ${user.email}:`, error);
        }
      } else if (!user.email) {
        console.log(`📧 Email omitido: usuario ${user.id} sin email`);
      } else {
        console.log(
          `📧 Email omitido: usuario ${user.id} (${user.email}) sin verificar. ` +
            `Seteá EMAIL_REQUIRE_VERIFIED=false o verificá el email.`,
        );
      }

      // 2. Enviar push notification
      try {
        const pushData: PushNotificationData = {
          userId: notification.userId,
          title: notification.title,
          body: notification.message,
          type: notification.type,
          data: notification.data,
        };
        
        pushSent = await this.pushService.sendPushNotification(pushData, notification);
        console.log(`📱 Push notification ${pushSent ? 'enviada' : 'falló'} a usuario ${notification.userId}`);
      } catch (error) {
        console.error(`❌ Error enviando push notification:`, error);
      }

      // 3. Marcar como enviada
      notification.sent = true;
      await this.notificationRepository.save(notification);
      
      console.log(`✅ Notificación procesada - Email: ${emailSent}, Push: ${pushSent}`);
    } catch (error) {
      console.error('❌ Error enviando notificación:', error);
    }
  }

  // Legacy method para compatibilidad
  async publish(topicArn: string, message: string): Promise<void> {
    try {
      await this.sns
        .publish({
          TopicArn: topicArn,
          Message: message,
        })
        .promise();
      console.log(`Message sent to topic ${topicArn}`);
    } catch (error) {
      console.error('Error publishing message:', error);
      throw error;
    }
  }
}
