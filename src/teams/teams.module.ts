import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './entities/teams-entity';
import { SportsModule } from 'src/sports/sports.module';
import { PlayersModule } from 'src/players/players.module';

@Module({
  imports: [TypeOrmModule.forFeature([Team]), SportsModule, PlayersModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class TeamsModule {}
