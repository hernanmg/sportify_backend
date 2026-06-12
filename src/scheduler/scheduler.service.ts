import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { SportEvent, SportEventType, SportEventStatus } from '../events/entities/sport-event.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { BirthdayNotificationsService } from '../teams/birthday-notifications.service';

export interface ScheduledEmail {
  id: string;
  to: string;
  subject: string;
  template: string;
  context: any;
  scheduledFor: Date;
  sent: boolean;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private scheduledEmails: Map<string, ScheduledEmail> = new Map();

  constructor(
    @InjectRepository(SportEvent)
    private sportEventRepository: Repository<SportEvent>,
    private notificationsService: NotificationsService,
    private emailService: EmailService,
    private birthdayNotificationsService: BirthdayNotificationsService,
  ) {}

  // Programar email para envío diferido
  scheduleEmail(emailData: {
    to: string;
    subject: string;
    template: string;
    context: any;
    scheduledFor: Date;
    maxAttempts?: number;
  }): string {
    const id = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const scheduledEmail: ScheduledEmail = {
      id,
      to: emailData.to,
      subject: emailData.subject,
      template: emailData.template,
      context: emailData.context,
      scheduledFor: emailData.scheduledFor,
      sent: false,
      attempts: 0,
      maxAttempts: emailData.maxAttempts || 3,
      createdAt: new Date(),
    };

    this.scheduledEmails.set(id, scheduledEmail);
    this.logger.log(`📅 Email programado para ${emailData.scheduledFor.toISOString()}: ${emailData.subject}`);
    
    return id;
  }

  // Cancelar email programado
  cancelScheduledEmail(emailId: string): boolean {
    const email = this.scheduledEmails.get(emailId);
    if (email && !email.sent) {
      this.scheduledEmails.delete(emailId);
      this.logger.log(`❌ Email programado cancelado: ${emailId}`);
      return true;
    }
    return false;
  }

  // Ejecutar cada minuto para procesar emails programados
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledEmails() {
    const now = new Date();
    const emailsToSend = Array.from(this.scheduledEmails.values())
      .filter(email => !email.sent && email.scheduledFor <= now && email.attempts < email.maxAttempts);

    if (emailsToSend.length === 0) return;

    this.logger.log(`📧 Procesando ${emailsToSend.length} emails programados...`);

    for (const email of emailsToSend) {
      try {
        email.attempts++;
        
        await this.emailService.sendEmail({
          to: email.to,
          subject: email.subject,
          template: email.template,
          context: email.context,
        });

        email.sent = true;
        this.logger.log(`✅ Email programado enviado: ${email.subject} → ${email.to}`);
        
        // Limpiar emails enviados después de 24h
        setTimeout(() => {
          this.scheduledEmails.delete(email.id);
        }, 24 * 60 * 60 * 1000);

      } catch (error) {
        this.logger.error(`❌ Error enviando email programado (intento ${email.attempts}/${email.maxAttempts}): ${error.message}`);
        
        if (email.attempts >= email.maxAttempts) {
          this.logger.error(`💀 Email programado falló definitivamente: ${email.id}`);
          // Mantener en memoria para auditoría pero marcar como fallido
          email.sent = false;
        }
      }
    }
  }

  // Recordatorios automáticos de entrenamientos (2 horas antes)
  // Se ejecuta cada 10 minutos pero solo envía si el evento está en la ventana correcta
  @Cron(CronExpression.EVERY_10_MINUTES)
  async sendTrainingReminders() {
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twoHoursAndTenMinutesFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 10 * 60 * 1000);

    try {
      // Buscar entrenamientos que estén entre 2h y 2h10min en el futuro
      const upcomingTrainings = await this.sportEventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.team', 'team')
        .where('event.type = :type', { type: SportEventType.TRAINING })
        .andWhere('event.status = :status', { status: SportEventStatus.SCHEDULED })
        .andWhere('event.eventDate > :minDate', { minDate: twoHoursFromNow })
        .andWhere('event.eventDate <= :maxDate', { maxDate: twoHoursAndTenMinutesFromNow })
        .andWhere('(event.reminderSent IS NULL OR event.reminderSent = false)')
        .getMany();

      for (const training of upcomingTrainings) {
        this.logger.log(`⏰ Enviando recordatorio de entrenamiento: ${training.title}`);
        
        await this.notificationsService.sendTrainingReminder(
          training.id,
          training.teamId,
          {
            eventTitle: training.title,
            date: training.eventDate.toLocaleString('es-AR', { 
              dateStyle: 'full', 
              timeStyle: 'short' 
            }),
            location: training.location || 'Por definir',
            duration: training.durationMinutes ? `${training.durationMinutes} minutos` : 'Por definir',
          },
        );

        // Marcar como recordatorio enviado para evitar duplicados
        await this.sportEventRepository.update(training.id, { reminderSent: true });
        this.logger.log(`✅ Recordatorio marcado como enviado para evento ${training.id}`);
      }

      if (upcomingTrainings.length > 0) {
        this.logger.log(`📅 Enviados ${upcomingTrainings.length} recordatorios de entrenamiento`);
      }

    } catch (error) {
      this.logger.error(`❌ Error enviando recordatorios de entrenamiento: ${error.message}`);
    }
  }

  // Recordatorios automáticos de partidos (24 horas antes)
  @Cron(CronExpression.EVERY_HOUR)
  async sendMatchReminders() {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    try {
      // Buscar partidos que estén entre 24h y 25h en el futuro
      const upcomingMatches = await this.sportEventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.team', 'team')
        .where('event.type = :type', { type: SportEventType.MATCH })
        .andWhere('event.status = :status', { status: SportEventStatus.SCHEDULED })
        .andWhere('event.eventDate > :minDate', { minDate: twentyFourHoursFromNow })
        .andWhere('event.eventDate <= :maxDate', { maxDate: twentyFiveHoursFromNow })
        .andWhere('(event.reminderSent IS NULL OR event.reminderSent = false)')
        .getMany();

      for (const match of upcomingMatches) {
        this.logger.log(`⚽ Enviando recordatorio de partido: ${match.title}`);
        
        await this.notificationsService.sendMatchInvitation(
          match.id,
          match.teamId,
          {
            eventTitle: match.title,
            date: match.eventDate.toLocaleString('es-AR', { 
              dateStyle: 'full', 
              timeStyle: 'short' 
            }),
            opponent: match.opponentName || 'Por definir',
            location: match.location || 'Por definir',
          },
        );

        // Marcar como recordatorio enviado para evitar duplicados
        await this.sportEventRepository.update(match.id, { reminderSent: true });
        this.logger.log(`✅ Recordatorio marcado como enviado para evento ${match.id}`);
      }

      if (upcomingMatches.length > 0) {
        this.logger.log(`⚽ Enviados ${upcomingMatches.length} recordatorios de partido`);
      }

    } catch (error) {
      this.logger.error(`❌ Error enviando recordatorios de partido: ${error.message}`);
    }
  }

  // Recordatorios de vencimiento de documentos médicos (7 días antes)
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendMedicalExpiryReminders() {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    try {
      // TODO: Implementar cuando tengamos entidad de documentos médicos
      this.logger.log(`🏥 Verificando vencimientos médicos para ${sevenDaysFromNow.toDateString()}`);
      
      // Ejemplo de implementación futura:
      // const expiringDocuments = await this.medicalDocumentRepository.find({
      //   where: {
      //     expiryDate: LessThan(sevenDaysFromNow),
      //     status: 'active',
      //   },
      //   relations: ['player'],
      // });
      //
      // for (const doc of expiringDocuments) {
      //   await this.notificationsService.sendMedicalExpiryReminder(
      //     doc.playerId,
      //     doc.type,
      //     doc.expiryDate,
      //   );
      // }

    } catch (error) {
      this.logger.error(`❌ Error enviando recordatorios médicos: ${error.message}`);
    }
  }

  // Obtener estadísticas de emails programados
  getScheduledEmailStats(): {
    total: number;
    pending: number;
    sent: number;
    failed: number;
  } {
    const emails = Array.from(this.scheduledEmails.values());
    
    return {
      total: emails.length,
      pending: emails.filter(e => !e.sent && e.attempts < e.maxAttempts).length,
      sent: emails.filter(e => e.sent).length,
      failed: emails.filter(e => !e.sent && e.attempts >= e.maxAttempts).length,
    };
  }

  // Notificaciones de cumpleaños (hora configurable por equipo, zona Argentina)
  @Cron(CronExpression.EVERY_HOUR)
  async sendBirthdayNotifications() {
    try {
      await this.birthdayNotificationsService.processScheduledBirthdayNotifications();
    } catch (error) {
      this.logger.error(
        `❌ Error procesando cumpleaños: ${(error as Error).message}`,
      );
    }
  }

  // Limpiar emails antiguos (más de 7 días)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  cleanupOldEmails() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const emailsToDelete = Array.from(this.scheduledEmails.entries())
      .filter(([_, email]) => email.createdAt < sevenDaysAgo)
      .map(([id, _]) => id);

    emailsToDelete.forEach(id => this.scheduledEmails.delete(id));
    
    if (emailsToDelete.length > 0) {
      this.logger.log(`🧹 Limpiados ${emailsToDelete.length} emails antiguos`);
    }
  }
}
