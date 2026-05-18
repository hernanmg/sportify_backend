import { Module } from '@nestjs/common';
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
    ]),
  ],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
