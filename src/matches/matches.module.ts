import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Match } from './entities/match-entity';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { TeamsModule } from 'src/teams/teams.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match]),
    NotificationsModule,
    MatchesModule,
    TeamsModule,
  ],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
