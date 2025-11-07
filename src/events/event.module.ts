import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesModule } from '../matches/matches.module';
import { Event } from './entities/event.entity';
import { EventsService } from './event.service';
import { EventsController } from './event.controller';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TypeEvent } from './entities/typeEvent.entity';
import { SportEvent } from './entities/sport-event.entity';
import { EventParticipant } from './entities/event-participant.entity';
import { SportEventsService } from './sport-events.service';
import { SportEventsController } from './sport-events.controller';
import { ConvocationsService } from './convocations.service';
import { ConvocationsController } from './convocations.controller';
import { DebugController } from './debug.controller';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { User } from '../users/entities/user.entity';
import { Team } from '../teams/entities/teams.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event, 
      TypeEvent, 
      SportEvent, 
      EventParticipant,
      PlayerRoster,
      User,
      Team
    ]),
    MatchesModule,
    NotificationsModule,
  ],
  controllers: [EventsController, SportEventsController, ConvocationsController, DebugController],
  providers: [EventsService, SportEventsService, ConvocationsService],
  exports: [EventsService, SportEventsService, ConvocationsService],
})
export class EventsModule {}
