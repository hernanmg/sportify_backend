import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerRoster } from '../roster/entities/player-roster.entity';

@Controller('debug')
export class DebugController {
  constructor(
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
  ) {}

  @Get('roster/:teamId')
  async getRosterDebug(@Param('teamId', ParseIntPipe) teamId: number) {
    console.log(`🔍 Debug: Getting roster for team ${teamId}`);
    
    // Consulta básica sin relaciones
    const basicRoster = await this.rosterRepository.find({
      where: { teamId, isEnabled: true }
    });
    console.log('Basic roster:', basicRoster);

    // Consulta con relaciones
    const rosterWithRelations = await this.rosterRepository.find({
      where: { teamId, isEnabled: true },
      relations: ['player', 'player.user']
    });
    console.log('Roster with relations:', rosterWithRelations);

    // Consulta con query builder
    const queryBuilderResult = await this.rosterRepository
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.player', 'p')
      .leftJoinAndSelect('p.user', 'u')
      .where('pr.teamId = :teamId', { teamId })
      .andWhere('pr.isEnabled = :isEnabled', { isEnabled: true })
      .getMany();
    console.log('Query builder result:', queryBuilderResult);

    return {
      teamId,
      basicCount: basicRoster.length,
      relationsCount: rosterWithRelations.length,
      queryBuilderCount: queryBuilderResult.length,
      basicRoster,
      rosterWithRelations,
      queryBuilderResult,
      eligibleUsers: rosterWithRelations
        .map(r => r.player?.user?.id)
        .filter(id => id !== undefined)
    };
  }
}
