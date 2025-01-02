import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './entities/userRole-entity';

@Injectable()
export class UserRoleService {
  constructor(
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async create(data: Partial<UserRole>): Promise<UserRole> {
    const userRole = this.userRoleRepository.create(data);
    return await this.userRoleRepository.save(userRole);
  }

  async findAll(): Promise<UserRole[]> {
    return await this.userRoleRepository.find({ relations: ['user', 'role'] });
  }

  async findOne(id: number): Promise<UserRole> {
    return await this.userRoleRepository.findOne({
      where: { id },
      relations: ['user', 'role'],
    });
  }

  async delete(id: number): Promise<void> {
    await this.userRoleRepository.delete(id);
  }
}
