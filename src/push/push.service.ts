import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationType, Notification } from '../notifications/entities/notification.entity';
import { NotificationGateway } from '../websockets/websocket.gateway';
import { DeviceToken } from '../devices/entities/device-token.entity';

export interface PushNotificationData {
  userId: number;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  type: NotificationType;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private fcmInitialized = false;
  private firebaseAdmin: typeof import('firebase-admin') | null = null;

  constructor(
    @Inject(forwardRef(() => NotificationGateway))
    private readonly webSocketGateway: NotificationGateway,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
  ) {
    this.initFirebase();
  }

  private initFirebase(): void {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!json) {
      this.logger.log('FCM: FIREBASE_SERVICE_ACCOUNT_JSON no configurado');
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const admin = require('firebase-admin') as typeof import('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(json)),
        });
      }
      this.firebaseAdmin = admin;
      this.fcmInitialized = true;
      this.logger.log('FCM inicializado correctamente');
    } catch (e) {
      this.logger.warn(`FCM no disponible: ${e}`);
    }
  }

  async registerDeviceToken(
    userId: number,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<void> {
    let row = await this.deviceTokenRepository.findOne({
      where: { userId, token },
    });
    if (row) {
      row.isActive = true;
      row.platform = platform;
    } else {
      row = this.deviceTokenRepository.create({
        userId,
        token,
        platform,
        isActive: true,
      });
    }
    await this.deviceTokenRepository.save(row);
  }

  async unregisterDeviceToken(userId: number, token: string): Promise<void> {
    await this.deviceTokenRepository.update(
      { userId, token },
      { isActive: false },
    );
  }

  private async getActiveTokens(userId: number): Promise<DeviceToken[]> {
    return this.deviceTokenRepository.find({
      where: { userId, isActive: true },
    });
  }

  async sendPushNotification(
    notification: PushNotificationData,
    savedNotification?: Notification,
  ): Promise<boolean> {
    try {
      const realtimePayload = savedNotification
        ? this.buildRealtimePayload(savedNotification)
        : this.buildRealtimePayload(notification);

      const isConnected = this.webSocketGateway.isUserConnected(
        notification.userId,
      );
      if (isConnected) {
        this.webSocketGateway.sendNotificationToUser(
          notification.userId,
          realtimePayload,
        );
      }

      const tokens = await this.getActiveTokens(notification.userId);
      if (tokens.length > 0) {
        await this.sendToFCM(tokens, notification, savedNotification);
      }

      return isConnected || tokens.length > 0;
    } catch (error) {
      this.logger.error(`Error enviando push:`, error);
      return false;
    }
  }

  async sendBulkPushNotifications(
    notifications: PushNotificationData[],
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const n of notifications) {
      const ok = await this.sendPushNotification(n);
      if (ok) sent++;
      else failed++;
    }
    return { sent, failed };
  }

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

  private async sendToFCM(
    tokens: DeviceToken[],
    notification: PushNotificationData,
    saved?: Notification,
  ): Promise<void> {
    if (!this.fcmInitialized || !this.firebaseAdmin) return;

    const active = tokens.filter((t) => t.isActive).map((t) => t.token);
    if (!active.length) return;

    const data: Record<string, string> = {};
    const payload = saved?.data ?? notification.data;
    if (payload && typeof payload === 'object') {
      for (const [k, v] of Object.entries(payload)) {
        data[k] = v == null ? '' : String(v);
      }
    }
    if (saved?.sportEventId) {
      data.sportEventId = String(saved.sportEventId);
    }
    data.type = notification.type;
    const payloadAction =
      payload && typeof payload === 'object' && payload.action != null
        ? String(payload.action)
        : '';
    data.action =
      payloadAction || this.actionForType(notification.type);
    if (payload && typeof payload === 'object' && payload.deepLink != null) {
      data.deepLink = String(payload.deepLink);
    }
    if (payload && typeof payload === 'object' && payload.teamId != null) {
      data.teamId = String(payload.teamId);
    }

    try {
      const messaging = this.firebaseAdmin.messaging();
      const response = await messaging.sendEachForMulticast({
        tokens: active,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'sportify_alerts',
            sound: 'default',
          },
        },
        webpush: {
          fcmOptions: {
            link: data.deepLink ?? '/notifications',
          },
        },
      });
      this.logger.log(
        `FCM: ${response.successCount} ok, ${response.failureCount} fail`,
      );
      for (let i = 0; i < response.responses.length; i++) {
        const r = response.responses[i];
        if (
          !r.success &&
          r.error?.code === 'messaging/registration-token-not-registered'
        ) {
          await this.unregisterDeviceToken(tokens[i].userId, tokens[i].token);
        }
      }
    } catch (e) {
      this.logger.warn(`FCM send error: ${e}`);
    }
  }

  private actionForType(type: NotificationType): string {
    switch (type) {
      case NotificationType.MATCH_INVITATION:
        return 'convocation_response';
      case NotificationType.IMPEDIMENT_CLEARED:
      case NotificationType.PLAYER_ELIGIBLE:
        return 'open_player_status';
      default:
        return 'open_notifications';
    }
  }

  getTokenStats(): {
    totalUsers: number;
    totalTokens: number;
    activeTokens: number;
  } {
    return { totalUsers: 0, totalTokens: 0, activeTokens: 0 };
  }
}
