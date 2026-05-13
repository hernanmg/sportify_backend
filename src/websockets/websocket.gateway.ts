import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: string;
  teamId?: number;
}

@WebSocketGateway({
  cors: {
    origin: '*', // En producción, especificar dominios exactos
    methods: ['GET', 'POST'],
  },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private connectedUsers = new Map<number, AuthenticatedSocket[]>(); // userId -> sockets[]

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extraer token del handshake
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn(`🔒 Cliente sin token rechazado: ${client.id}`);
        client.disconnect();
        return;
      }

      // Verificar JWT
      const payload = await this.jwtService.verifyAsync(token);
      client.userId = payload.sub;
      client.userRole = payload.role;
      client.teamId = payload.teamId;

      // Registrar conexión
      if (!this.connectedUsers.has(client.userId)) {
        this.connectedUsers.set(client.userId, []);
      }
      this.connectedUsers.get(client.userId).push(client);

      // Unir a salas por rol y equipo
      await client.join(`user_${client.userId}`);
      if (client.teamId) {
        await client.join(`team_${client.teamId}`);
      }
      if (['super_admin', 'manager'].includes(client.userRole)) {
        await client.join('admins');
      }

      this.logger.log(`🔗 Usuario ${client.userId} conectado (${client.userRole}) - Socket: ${client.id}`);
      
      // Confirmar conexión
      client.emit('connected', {
        message: 'Conectado al sistema de notificaciones',
        userId: client.userId,
        rooms: Array.from(client.rooms),
      });

    } catch (error) {
      this.logger.error(`❌ Error autenticando cliente ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userSockets = this.connectedUsers.get(client.userId) || [];
      const updatedSockets = userSockets.filter(socket => socket.id !== client.id);
      
      if (updatedSockets.length === 0) {
        this.connectedUsers.delete(client.userId);
      } else {
        this.connectedUsers.set(client.userId, updatedSockets);
      }

      this.logger.log(`🔌 Usuario ${client.userId} desconectado - Socket: ${client.id}`);
    }
  }

  // Método para enviar notificación a usuario específico
  sendNotificationToUser(userId: number, notification: any) {
    this.server.to(`user_${userId}`).emit('notification', notification);
    this.logger.log(`📱 Notificación enviada a usuario ${userId}: ${notification.title}`);
  }

  // Método para enviar notificación a equipo
  sendNotificationToTeam(teamId: number, notification: any) {
    this.server.to(`team_${teamId}`).emit('notification', notification);
    this.logger.log(`📱 Notificación enviada a equipo ${teamId}: ${notification.title}`);
  }

  // Método para enviar notificación a administradores
  sendNotificationToAdmins(notification: any) {
    this.server.to('admins').emit('notification', notification);
    this.logger.log(`📱 Notificación enviada a administradores: ${notification.title}`);
  }

  // Método para obtener usuarios conectados
  getConnectedUsers(): number[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Método para verificar si un usuario está conectado
  isUserConnected(userId: number): boolean {
    return this.connectedUsers.has(userId);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // Solo permitir unirse a salas autorizadas
    const allowedRooms = [
      `user_${client.userId}`,
      `team_${client.teamId}`,
    ];

    if (['super_admin', 'manager'].includes(client.userRole)) {
      allowedRooms.push('admins');
    }

    if (allowedRooms.includes(data.room)) {
      client.join(data.room);
      client.emit('joined_room', { room: data.room });
      this.logger.log(`👥 Usuario ${client.userId} se unió a sala: ${data.room}`);
    } else {
      client.emit('error', { message: 'No autorizado para unirse a esta sala' });
    }
  }
}
