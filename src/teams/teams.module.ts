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
    ]),
    forwardRef(() => PlayerStatusModule),
  ],
  controllers: [
    TeamsController,
    TacticalBoardsController,
    TacticalBoardsPublicController,
  ],
  providers: [TeamsService, TacticalBoardsService],
  exports: [TeamsService, TacticalBoardsService],
})
export class TeamsModule {}
