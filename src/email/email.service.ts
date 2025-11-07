import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { NotificationType } from '../notifications/entities/notification.entity';
import * as nodemailer from 'nodemailer';

export interface EmailData {
  to: string;
  subject: string;
  template: string;
  context: any;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private directTransporter: nodemailer.Transporter;

  constructor(private readonly mailerService: MailerService) {
    // Crear transporter directo con nodemailer (backup)
    this.directTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      },
      debug: false, // Menos verbose para producción
      logger: false
    });
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      this.logger.log(`📧 Enviando email a: ${emailData.to}`);
      
      // Intentar primero con MailerService de NestJS
      await this.mailerService.sendMail({
        to: emailData.to,
        subject: emailData.subject,
        template: emailData.template,
        context: emailData.context,
      });

      this.logger.log(`✅ Email enviado exitosamente a: ${emailData.to} (vía NestJS MailerService)`);
      return true;
    } catch (nestjsError) {
      this.logger.warn(`⚠️ NestJS MailerService falló, usando fallback directo`);
      
      try {
        // Fallback: usar nodemailer directo
        await this.sendEmailDirect(emailData);
        this.logger.log(`✅ Email enviado exitosamente a: ${emailData.to} (vía nodemailer directo)`);
        return true;
      } catch (directError) {
        this.logger.error(`❌ Error con ambos métodos para ${emailData.to}:`);
        this.logger.error(`   NestJS: ${nestjsError.message}`);
        this.logger.error(`   Directo: ${directError.message}`);
        throw directError;
      }
    }
  }

  // Método auxiliar para envío directo con nodemailer
  private async sendEmailDirect(emailData: EmailData): Promise<void> {
    // Para nodemailer directo, necesitamos renderizar la plantilla manualmente
    // Por simplicidad, enviamos HTML básico
    const htmlContent = this.generateSimpleHTML(emailData);
    
    await this.directTransporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@sportify.com',
      to: emailData.to,
      subject: emailData.subject,
      html: htmlContent,
    });
  }

  // Generar HTML simple para las plantillas
  private generateSimpleHTML(emailData: EmailData): string {
    const { template, context } = emailData;
    
    switch (template) {
      case 'training-reminder':
        return `
          <h2>🏃‍♂️ Recordatorio de Entrenamiento</h2>
          <p><strong>Evento:</strong> ${context.eventTitle}</p>
          <p><strong>Fecha:</strong> ${context.eventDate}</p>
          <p><strong>Ubicación:</strong> ${context.location}</p>
          <p><strong>Equipo:</strong> ${context.teamName}</p>
          <p>¡No faltes al entrenamiento!</p>
        `;
      case 'match-invitation':
        return `
          <h2>⚽ Convocatoria para Partido</h2>
          <p><strong>Partido:</strong> ${context.eventTitle}</p>
          <p><strong>Fecha:</strong> ${context.eventDate}</p>
          <p><strong>Ubicación:</strong> ${context.location}</p>
          <p><strong>Equipo:</strong> ${context.teamName}</p>
          <p>¡Estás convocado para el partido!</p>
        `;
      default:
        return `
          <h2>📧 Notificación de Sportify Amateur</h2>
          <p><strong>Asunto:</strong> ${emailData.subject}</p>
          <p>Tienes una nueva notificación en la aplicación.</p>
        `;
    }
  }

  // Enviar notificación por email basada en el tipo
  async sendNotificationEmail(
    email: string,
    type: NotificationType,
    data: any
  ): Promise<boolean> {
    const emailConfig = this.getEmailConfigByType(type, data);
    
    if (!emailConfig) {
      this.logger.warn(`⚠️ No hay configuración de email para tipo: ${type}`);
      return false;
    }

    return await this.sendEmail({
      to: email,
      ...emailConfig,
    });
  }

  private getEmailConfigByType(type: NotificationType, data: any) {
    switch (type) {
      case NotificationType.MATCH_INVITATION:
        return {
          subject: '⚽ Convocatoria a Partido Oficial',
          template: 'match-invitation',
          context: {
            playerName: data.playerName,
            matchDate: data.matchDate,
            opponent: data.opponent,
            location: data.location,
            teamName: data.teamName,
          },
        };

      case NotificationType.TRAINING_REMINDER:
        return {
          subject: '🏃‍♂️ Recordatorio de Entrenamiento',
          template: 'training-reminder',
          context: {
            playerName: data.playerName,
            trainingDate: data.trainingDate,
            location: data.location,
            duration: data.duration,
            teamName: data.teamName,
          },
        };

      case NotificationType.PAYMENT_REMINDER:
        return {
          subject: '💰 Recordatorio de Pago',
          template: 'payment-reminder',
          context: {
            playerName: data.playerName,
            amount: data.amount,
            dueDate: data.dueDate,
            concept: data.concept,
            teamName: data.teamName,
          },
        };

      case NotificationType.SOCIAL_EVENT:
        return {
          subject: '🎉 Evento Social del Equipo',
          template: 'social-event',
          context: {
            playerName: data.playerName,
            eventTitle: data.eventTitle,
            eventDate: data.eventDate,
            location: data.location,
            hasExpenses: data.hasExpenses,
            teamName: data.teamName,
          },
        };

      case NotificationType.MEDICAL_EXPIRY:
        return {
          subject: '🏥 Apto Médico por Vencer',
          template: 'medical-expiry',
          context: {
            playerName: data.playerName,
            expiryDate: data.expiryDate,
            daysLeft: data.daysLeft,
            teamName: data.teamName,
          },
        };

      default:
        return null;
    }
  }

  // Método para enviar emails masivos
  async sendBulkEmails(emails: EmailData[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const emailData of emails) {
      const success = await this.sendEmail(emailData);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      
      // Pequeña pausa para evitar spam
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.log(`📊 Emails enviados: ${sent}, Fallidos: ${failed}`);
    return { sent, failed };
  }
}
