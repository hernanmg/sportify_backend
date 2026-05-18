import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { DevicesController } from './devices.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceToken]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [DevicesController],
})
export class DevicesModule {}
