import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { EmailModule } from '../email/email.module';
import { PushService } from '../push/push.service';
import { WebSocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, PlayerRoster]),
    EmailModule,
    forwardRef(() => WebSocketsModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
