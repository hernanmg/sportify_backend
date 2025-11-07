import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '../notifications/entities/notification.entity';

export interface PushNotificationData {
  userId: number;
  title: string;
  body: string;
  data?: any;
  type: NotificationType;
}

export interface DeviceToken {
  userId: number;
  token: string;
  platform: 'ios' | 'android' | 'web';
  isActive: boolean;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  
  // En el futuro, aquí se almacenarán los tokens de dispositivos
  private deviceTokens: Map<number, DeviceToken[]> = new Map();

  // Registrar token de dispositivo
  async registerDeviceToken(userId: number, token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
    this.logger.log(`📱 Registrando token para usuario ${userId} (${platform})`);
    
    const userTokens = this.deviceTokens.get(userId) || [];
    
    // Verificar si el token ya existe
    const existingToken = userTokens.find(t => t.token === token);
    if (existingToken) {
      existingToken.isActive = true;
      this.logger.log(`✅ Token actualizado para usuario ${userId}`);
      return;
    }

    // Agregar nuevo token
    userTokens.push({
      userId,
      token,
      platform,
      isActive: true,
    });
    
    this.deviceTokens.set(userId, userTokens);
    this.logger.log(`✅ Nuevo token registrado para usuario ${userId}`);
  }

  // Enviar notificación push a un usuario
  async sendPushNotification(notification: PushNotificationData): Promise<boolean> {
    try {
      this.logger.log(`🔔 Enviando push notification a usuario ${notification.userId}`);
      
      const userTokens = this.deviceTokens.get(notification.userId);
      if (!userTokens || userTokens.length === 0) {
        this.logger.warn(`⚠️ No hay tokens registrados para usuario ${notification.userId}`);
        return false;
      }

      // Por ahora, solo logueamos la notificación
      // En el futuro, aquí se integrará con Firebase Cloud Messaging (FCM)
      this.logger.log(`📤 Push notification preparada:`);
      this.logger.log(`   Título: ${notification.title}`);
      this.logger.log(`   Mensaje: ${notification.body}`);
      this.logger.log(`   Tipo: ${notification.type}`);
      this.logger.log(`   Tokens activos: ${userTokens.filter(t => t.isActive).length}`);

      // TODO: Implementar envío real con FCM
      // await this.sendToFCM(userTokens, notification);

      return true;
    } catch (error) {
      this.logger.error(`❌ Error enviando push notification:`, error);
      return false;
    }
  }

  // Enviar notificaciones push masivas
  async sendBulkPushNotifications(notifications: PushNotificationData[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const notification of notifications) {
      const success = await this.sendPushNotification(notification);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    this.logger.log(`📊 Push notifications - Enviadas: ${sent}, Fallidas: ${failed}`);
    return { sent, failed };
  }

  // Desactivar token de dispositivo
  async unregisterDeviceToken(userId: number, token: string): Promise<void> {
    const userTokens = this.deviceTokens.get(userId);
    if (!userTokens) return;

    const tokenIndex = userTokens.findIndex(t => t.token === token);
    if (tokenIndex >= 0) {
      userTokens[tokenIndex].isActive = false;
      this.logger.log(`🔕 Token desactivado para usuario ${userId}`);
    }
  }

  // Obtener estadísticas de tokens
  getTokenStats(): { totalUsers: number; totalTokens: number; activeTokens: number } {
    let totalTokens = 0;
    let activeTokens = 0;

    for (const tokens of this.deviceTokens.values()) {
      totalTokens += tokens.length;
      activeTokens += tokens.filter(t => t.isActive).length;
    }

    return {
      totalUsers: this.deviceTokens.size,
      totalTokens,
      activeTokens,
    };
  }

  // Método privado para envío real con FCM (para implementar en el futuro)
  private async sendToFCM(tokens: DeviceToken[], notification: PushNotificationData): Promise<void> {
    // TODO: Implementar integración con Firebase Cloud Messaging
    // 
    // Ejemplo de implementación futura:
    // 
    // const admin = require('firebase-admin');
    // 
    // const message = {
    //   notification: {
    //     title: notification.title,
    //     body: notification.body,
    //   },
    //   data: notification.data || {},
    //   tokens: tokens.filter(t => t.isActive).map(t => t.token),
    // };
    // 
    // const response = await admin.messaging().sendMulticast(message);
    // this.logger.log(`FCM Response: ${response.successCount} success, ${response.failureCount} failures`);
    
    this.logger.log('🚧 FCM integration pendiente de implementación');
  }
}
