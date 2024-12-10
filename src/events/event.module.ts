import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesModule } from '../matches/matches.module';
import { Event } from './entities/event-entity';
import { EventsService } from './event.service';
import { EventsController } from './event.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Event]), MatchesModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
