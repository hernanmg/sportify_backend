import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match-entity';
import { CreateMatchDto } from './dtos/create-matches.dto';
import { UpdateMatchDto } from './dtos/update-matches.dto';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ) {}

  async create(createMatchDto: CreateMatchDto): Promise<Match> {
    const match = this.matchRepository.create(createMatchDto);
    return this.matchRepository.save(match);
  }

  async findAll(): Promise<Match[]> {
    return this.matchRepository.find();
  }

  async findOne(id: number): Promise<Match> {
    const match = await this.matchRepository.findOne({ where: { id } });
    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }
    return match;
  }

  async update(id: number, updateMatchDto: UpdateMatchDto): Promise<Match> {
    await this.findOne(id); // Ensure the entity exists
    await this.matchRepository.update(id, updateMatchDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // Ensure the entity exists
    await this.matchRepository.delete(id);
  }
}
