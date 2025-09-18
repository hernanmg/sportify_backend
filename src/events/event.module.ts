import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesModule } from '../matches/matches.module';
import { Event } from './entities/event.entity';
import { EventsService } from './event.service';
import { EventsController } from './event.controller';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TypeEvent } from './entities/typeEvent.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, TypeEvent]),
    MatchesModule,
    NotificationsModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
