import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sport } from './entities/sport.entity';
import { SportPosition } from './entities/sport-position.entity';
import { CreateSportDto } from './dtos/create-sport.dto';
import { UpdateSportDto } from './dtos/update-sport.dto';

@Injectable()
export class SportsService {
  constructor(
    @InjectRepository(Sport)
    private readonly sportRepository: Repository<Sport>,
    @InjectRepository(SportPosition)
    private readonly positionRepository: Repository<SportPosition>,
  ) {}

  async create(createSportDto: CreateSportDto): Promise<Sport> {
    const existing = await this.sportRepository.findOne({
      where: { name: createSportDto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un deporte con el nombre "${createSportDto.name}"`,
      );
    }

    const sport = this.sportRepository.create(createSportDto);
    return await this.sportRepository.save(sport);
  }

  async findAll(): Promise<Sport[]> {
    return await this.sportRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Sport> {
    const sport = await this.sportRepository.findOne({ where: { id } });
    if (!sport) {
      throw new NotFoundException(`Sport with ID ${id} not found`);
    }
    return sport;
  }

  async update(id: number, updateSportDto: UpdateSportDto): Promise<Sport> {
    const sport = await this.findOne(id);

    if (updateSportDto.name && updateSportDto.name !== sport.name) {
      const existing = await this.sportRepository.findOne({
        where: { name: updateSportDto.name },
      });
      if (existing) {
        throw new ConflictException(
          `Ya existe un deporte con el nombre "${updateSportDto.name}"`,
        );
      }
    }

    Object.assign(sport, updateSportDto);
    return await this.sportRepository.save(sport);
  }

  async remove(id: number): Promise<void> {
    const sport = await this.findOne(id);
    await this.sportRepository.remove(sport);
  }

  async seedDefaults(): Promise<Sport[]> {
    const defaults = ['Fútbol', 'Básquet', 'Vóley'];
    const created: Sport[] = [];

    for (const name of defaults) {
      const existing = await this.sportRepository.findOne({ where: { name } });
      if (existing) {
        created.push(existing);
        continue;
      }
      created.push(await this.sportRepository.save({ name }));
    }

    return created;
  }

  async getPositions(sportId: number): Promise<SportPosition[]> {
    await this.findOne(sportId);
    const rows = await this.positionRepository.find({
      where: { sportId },
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
    if (rows.length > 0) return rows;
    return this.positionRepository.find({
      where: { sportId: -1 },
    });
  }

  async getPositionsForTeam(teamSportId: number): Promise<SportPosition[]> {
    const rows = await this.positionRepository.find({
      where: { sportId: teamSportId },
      order: { sortOrder: 'ASC' },
    });
    if (rows.length > 0) return rows;
    return [
      { id: 0, sportId: teamSportId, code: 'player', label: 'Jugador', sortOrder: 99 } as SportPosition,
    ];
  }
}
