import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RosterService } from './roster.service';
import { RosterController } from './roster.controller';
import { PlayerRoster } from './entities/player-roster.entity';
import { Player } from '../players/entities/player.entity';
import { Team } from '../teams/entities/teams.entity';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { TeamCategory } from '../teams/entities/team-category.entity';
import { TeamMember } from '../teams/entities/team-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlayerRoster,
      Player,
      Team,
      User,
      Category,
      TeamCategory,
      TeamMember,
    ]),
  ],
  controllers: [RosterController],
  providers: [RosterService],
  exports: [RosterService],
})
export class RosterModule {}
