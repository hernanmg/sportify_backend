import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { Sport } from 'src/sports/entities/sport.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Sport)
    private readonly sportRepository: Repository<Sport>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoryRepository.create(createCategoryDto);
    return await this.categoryRepository.save(category);
  }

  async findAll(): Promise<Category[]> {
    return await this.categoryRepository.find({
      relations: ['sport'],
      order: { sportId: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findBySport(sportId: number): Promise<Category[]> {
    return await this.categoryRepository.find({
      where: { sportId, isActive: true },
      relations: ['sport'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['sport'],
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async update(id: number, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);
    
    Object.assign(category, updateCategoryDto);
    
    return await this.categoryRepository.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
  }

  async toggleActive(id: number): Promise<Category> {
    const category = await this.findOne(id);
    category.isActive = !category.isActive;
    return await this.categoryRepository.save(category);
  }

  // Métodos útiles para el onboarding
  async getFootballCategories(): Promise<Category[]> {
    return await this.categoryRepository.find({
      where: { 
        sport: { name: 'Fútbol' },
        isActive: true 
      },
      relations: ['sport'],
      order: { sortOrder: 'ASC', ageMin: 'ASC', name: 'ASC' },
    });
  }

  async resolveSportId(sportId?: number): Promise<number> {
    if (sportId) {
      const sport = await this.sportRepository.findOne({ where: { id: sportId } });
      if (!sport) {
        throw new NotFoundException(`Sport with ID ${sportId} not found`);
      }
      return sport.id;
    }

    const football = await this.sportRepository.findOne({
      where: { name: 'Fútbol' },
    });
    if (football) {
      return football.id;
    }

    const firstSport = await this.sportRepository.find({
      order: { id: 'ASC' },
      take: 1,
    });
    if (!firstSport.length) {
      throw new BadRequestException(
        'No hay deportes cargados. Creá al menos un deporte antes de sembrar categorías.',
      );
    }

    return firstSport[0].id;
  }

  async seedFootballCategories(sportId?: number): Promise<Category[]> {
    const resolvedSportId = await this.resolveSportId(sportId);

    const footballCategories = [
      { name: 'Libre', description: 'Categoría libre sin restricciones de edad', gender: 'mixto', sortOrder: 1 },
      { name: 'Masculino', description: 'Categoría masculina', gender: 'masculino', sortOrder: 2 },
      { name: 'Femenino', description: 'Categoría femenina', gender: 'femenino', sortOrder: 3 },
      { name: '+35', description: 'Categoría para jugadores de 35 años en adelante', ageMin: 35, gender: 'masculino', sortOrder: 4 },
      { name: '+40', description: 'Categoría para jugadores de 40 años en adelante', ageMin: 40, gender: 'masculino', sortOrder: 5 },
      { name: '+45', description: 'Categoría para jugadores de 45 años en adelante', ageMin: 45, gender: 'masculino', sortOrder: 6 },
      { name: 'Femenino +30', description: 'Categoría femenina para jugadoras de 30 años en adelante', ageMin: 30, gender: 'femenino', sortOrder: 7 },
      { name: 'Juvenil', description: 'Categoría juvenil (hasta 18 años)', ageMax: 18, gender: 'mixto', sortOrder: 8 },
    ];

    const createdCategories: Category[] = [];
    for (const categoryData of footballCategories) {
      const existing = await this.categoryRepository.findOne({
        where: { name: categoryData.name, sportId: resolvedSportId },
      });
      if (existing) {
        createdCategories.push(existing);
        continue;
      }

      const category = this.categoryRepository.create({
        ...categoryData,
        sportId: resolvedSportId,
      });
      createdCategories.push(await this.categoryRepository.save(category));
    }

    return createdCategories;
  }
}
