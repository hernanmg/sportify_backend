import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sport } from './entities/sport.entity';
import { SportPosition } from './entities/sport-position.entity';
import { SportsController } from './sports.controller';
import { SportsService } from './sports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sport, SportPosition])],
  controllers: [SportsController],
  providers: [SportsService],
  exports: [SportsService],
})
export class SportsModule {}
