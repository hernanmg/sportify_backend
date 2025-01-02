import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sport } from './entities/sport-entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sport])],
  controllers: [],
  providers: [],
  exports: [],
})
export class SportsModule {}
