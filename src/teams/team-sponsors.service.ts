import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamSponsor } from './entities/team-sponsor.entity';

@Injectable()
export class TeamSponsorsService {
  constructor(
    @InjectRepository(TeamSponsor)
    private readonly sponsorRepository: Repository<TeamSponsor>,
  ) {}

  findByTeam(teamId: number) {
    return this.sponsorRepository.find({
      where: { teamId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async create(
    teamId: number,
    data: {
      name: string;
      description?: string;
      logoUrl?: string;
      website?: string;
      amountContributed?: number;
    },
    createdBy?: number,
  ) {
    const row = this.sponsorRepository.create({
      teamId,
      ...data,
      createdBy,
    });
    return this.sponsorRepository.save(row);
  }

  async remove(id: number, teamId: number) {
    const row = await this.sponsorRepository.findOne({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Sponsor no encontrado');
    row.isActive = false;
    return this.sponsorRepository.save(row);
  }
}
