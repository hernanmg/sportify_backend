import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationGateway } from './websocket.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [NotificationGateway],
  exports: [NotificationGateway],
})
export class WebSocketsModule {}
