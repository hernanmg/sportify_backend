import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Team } from './entities/teams.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepository: Repository<Team>,
  ) {}

  async create(createTeamData: Partial<Team>): Promise<Team> {
    const team = this.teamRepository.create(createTeamData);
    return await this.teamRepository.save(team);
  }

  async findAll(): Promise<Team[]> {
    return await this.teamRepository.find({
      relations: ['sport', 'category'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Team> {
    const team = await this.teamRepository.findOne({
      where: { id },
      relations: ['sport', 'category', 'playerTeams'],
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async findBySport(sportId: number): Promise<Team[]> {
    return await this.teamRepository.find({
      where: { sport_id: sportId },
      relations: ['sport', 'category'],
      order: { name: 'ASC' },
    });
  }

  async searchTeams(query: string): Promise<Team[]> {
    return await this.teamRepository.find({
      where: [
        { name: Like(`%${query}%`) },
        { description: Like(`%${query}%`) },
      ],
      relations: ['sport', 'category'],
      order: { name: 'ASC' },
      take: 20, // Limitar resultados para mejor performance
    });
  }

  async update(id: number, updateData: Partial<Team>): Promise<Team> {
    const team = await this.findOne(id);
    Object.assign(team, updateData);
    return await this.teamRepository.save(team);
  }

  async remove(id: number): Promise<void> {
    const team = await this.findOne(id);
    await this.teamRepository.remove(team);
  }

  // Métodos útiles para el onboarding
  async findOrCreateByName(name: string, sportId: number, categoryId?: number): Promise<Team> {
    // Buscar si ya existe
    let team = await this.teamRepository.findOne({
      where: { name, sport_id: sportId },
      relations: ['sport', 'category'],
    });

    if (!team) {
      // Crear nuevo equipo si no existe
      team = await this.create({
        name,
        sport_id: sportId,
        categoryId,
        description: `Equipo creado durante onboarding`,
      });
    }

    return team;
  }

  async getFootballTeams(): Promise<Team[]> {
    return await this.teamRepository.find({
      where: { 
        sport: { name: 'Fútbol' }
      },
      relations: ['sport', 'category'],
      order: { name: 'ASC' },
    });
  }
}
