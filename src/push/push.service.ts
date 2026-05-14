import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { NotificationType, Notification } from '../notifications/entities/notification.entity';
import { NotificationGateway } from '../websockets/websocket.gateway';

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

  constructor(
    @Inject(forwardRef(() => NotificationGateway))
    private readonly webSocketGateway: NotificationGateway,
  ) {}

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
  async sendPushNotification(
    notification: PushNotificationData,
    savedNotification?: Notification,
  ): Promise<boolean> {
    try {
      this.logger.log(`🔔 Enviando push notification a usuario ${notification.userId}`);
      
      const realtimePayload = savedNotification
        ? this.buildRealtimePayload(savedNotification)
        : this.buildRealtimePayload(notification);

      const isConnected = this.webSocketGateway.isUserConnected(notification.userId);
      if (isConnected) {
        this.webSocketGateway.sendNotificationToUser(
          notification.userId,
          realtimePayload,
        );
        this.logger.log(`✅ Notificación WebSocket enviada a usuario ${notification.userId}`);
      } else {
        this.logger.log(`📱 Usuario ${notification.userId} no conectado via WebSocket`);
      }

      // 2. Verificar tokens para push nativo (futuro)
      const userTokens = this.deviceTokens.get(notification.userId);
      if (!userTokens || userTokens.length === 0) {
        this.logger.log(`⚠️ No hay tokens push registrados para usuario ${notification.userId}`);
        return isConnected; // Si se envió via WebSocket, consideramos éxito
      }

      // 3. Envío push nativo (preparado para futuro)
      this.logger.log(`📤 Push notification preparada:`);
      this.logger.log(`   Título: ${notification.title}`);
      this.logger.log(`   Mensaje: ${notification.body}`);
      this.logger.log(`   Tipo: ${notification.type}`);
      this.logger.log(`   Tokens activos: ${userTokens.filter(t => t.isActive).length}`);

      // TODO: Implementar envío real con Service Workers
      // await this.sendToServiceWorker(userTokens, notification);

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
  private buildRealtimePayload(
    notification: PushNotificationData | Notification,
    messageOverride?: string,
  ) {
    const isEntity = 'userId' in notification && 'message' in notification;
    const now = new Date().toISOString();

    if (isEntity) {
      const entity = notification as Notification;
      return {
        id: entity.id,
        userId: entity.userId,
        teamId: entity.teamId,
        sportEventId: entity.sportEventId,
        type: entity.type,
        priority: entity.priority,
        title: entity.title,
        message: entity.message,
        body: entity.message,
        data: entity.data,
        isRead: entity.isRead,
        sent: entity.sent,
        createdAt: entity.createdAt?.toISOString?.() ?? now,
        updatedAt: entity.updatedAt?.toISOString?.() ?? now,
      };
    }

    const push = notification as PushNotificationData;
    return {
      id: Date.now(),
      userId: push.userId,
      title: push.title,
      message: messageOverride ?? push.body,
      body: push.body,
      type: push.type,
      priority: 'medium',
      data: push.data,
      isRead: false,
      sent: true,
      createdAt: now,
      updatedAt: now,
    };
  }

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
