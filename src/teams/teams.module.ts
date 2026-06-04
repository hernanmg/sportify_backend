import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { Team } from './entities/teams.entity';
import { TeamCategory } from './entities/team-category.entity';
import { TeamMember } from './entities/team-member.entity';
import { TeamInvite } from './entities/team-invite.entity';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { Player } from '../players/entities/player.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { UserRole } from '../users-roles/entities/userRole.entity';
import { Category } from '../categories/entities/category.entity';
import { TeamSocialGuest } from '../events/entities/team-social-guest.entity';
import { TeamTacticalBoard } from './entities/team-tactical-board.entity';
import { TacticalBoardsService } from './tactical-boards.service';
import {
  TacticalBoardsController,
  TacticalBoardsPublicController,
} from './tactical-boards.controller';
import { PlayerStatusModule } from '../player-status/player-status.module';
import { SportEvent } from '../events/entities/sport-event.entity';
import { EventParticipant } from '../events/entities/event-participant.entity';
import { LedgerEntry } from '../finance/entities/ledger-entry.entity';
import { FinanceModule } from '../finance/finance.module';
import { TeamDashboardService } from './team-dashboard.service';
import { TeamSponsor } from './entities/team-sponsor.entity';
import { TeamAuditLog } from './entities/team-audit-log.entity';
import { TeamAuditService } from './team-audit.service';
import { TeamReportsService } from './team-reports.service';
import { TeamSponsorsService } from './team-sponsors.service';
import { RosterModule } from '../roster/roster.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      TeamCategory,
      TeamMember,
      TeamInvite,
      PlayerRoster,
      Player,
      User,
      Role,
      UserRole,
      Category,
      TeamSocialGuest,
      TeamTacticalBoard,
      SportEvent,
      EventParticipant,
      LedgerEntry,
      TeamSponsor,
      TeamAuditLog,
    ]),
    forwardRef(() => PlayerStatusModule),
    forwardRef(() => FinanceModule),
    forwardRef(() => RosterModule),
  ],
  controllers: [
    TeamsController,
    TacticalBoardsController,
    TacticalBoardsPublicController,
  ],
  providers: [
    TeamsService,
    TacticalBoardsService,
    TeamDashboardService,
    TeamAuditService,
    TeamReportsService,
    TeamSponsorsService,
  ],
  exports: [
    TeamsService,
    TacticalBoardsService,
    TeamAuditService,
    TeamReportsService,
    TeamSponsorsService,
  ],
})
export class TeamsModule {}
