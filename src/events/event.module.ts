import { Module, forwardRef } from '@nestjs/common';
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
import { Player } from '../players/entities/player.entity';
import { User } from '../users/entities/user.entity';
import { Team } from '../teams/entities/teams.entity';
import { TeamSocialGuest } from './entities/team-social-guest.entity';
import { UserRole } from '../users-roles/entities/userRole.entity';
import { Role } from '../roles/entities/role.entity';
import { EventExpenseSheet } from './entities/event-expense-sheet.entity';
import { EventExpenseItem } from './entities/event-expense-item.entity';
import { EventExpenseShare } from './entities/event-expense-share.entity';
import { EventExpensesService } from './event-expenses.service';
import { EventExpensesController } from './event-expenses.controller';
import { EventStateService } from './event-state.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { WebSocketsModule } from '../websockets/websockets.module';
import { PlayerStatusModule } from '../player-status/player-status.module';
import { TeamsModule } from '../teams/teams.module';
import { ConvocationTemplate } from './entities/convocation-template.entity';
import { ConvocationTemplatesService } from './convocation-templates.service';
import { ConvocationTemplatesController } from './convocation-templates.controller';
import { MatchPeerRating } from './entities/match-peer-rating.entity';
import { MatchOfficialRating } from './entities/match-official-rating.entity';
import { PostMatchService } from './post-match.service';
import { PostMatchController } from './post-match.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Event, 
      TypeEvent, 
      SportEvent, 
      EventParticipant,
      MatchPeerRating,
      MatchOfficialRating,
      ConvocationTemplate,
      PlayerRoster,
      Player,
      User,
      Team,
      TeamSocialGuest,
      UserRole,
      Role,
      EventExpenseSheet,
      EventExpenseItem,
      EventExpenseShare,
    ]),
    MatchesModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => SchedulerModule),
    forwardRef(() => WebSocketsModule),
    PlayerStatusModule,
    TeamsModule,
  ],
  controllers: [
    EventsController,
    SportEventsController,
    EventExpensesController,
    ConvocationsController,
    ConvocationTemplatesController,
    PostMatchController,
    DebugController,
  ],
  providers: [
    EventsService,
    SportEventsService,
    EventExpensesService,
    ConvocationsService,
    ConvocationTemplatesService,
    EventStateService,
    PostMatchService,
  ],
  exports: [EventsService, SportEventsService, ConvocationsService, EventStateService, PostMatchService],
})
export class EventsModule {}
