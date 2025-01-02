import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(data: Partial<Role>): Promise<Role> {
    const role = this.roleRepository.create(data);
    return await this.roleRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    return await this.roleRepository.find({ relations: ['permissions'] });
  }

  async findOne(id: number): Promise<Role> {
    return await this.roleRepository.findOne({
      where: { id },
      relations: ['permissions'],
    });
  }

  async update(id: number, data: Partial<Role>): Promise<Role> {
    await this.roleRepository.update(id, data);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    await this.roleRepository.delete(id);
  }
}
