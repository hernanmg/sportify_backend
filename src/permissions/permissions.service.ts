import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission } from 'src/permissions/entities/permission.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async create(data: Partial<Permission>): Promise<Permission> {
    const permission = this.permissionRepository.create(data);
    return await this.permissionRepository.save(permission);
  }

  async findAll(): Promise<Permission[]> {
    return await this.permissionRepository.find();
  }

  async findOne(id: number): Promise<Permission> {
    return await this.permissionRepository.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<Permission>): Promise<Permission> {
    await this.permissionRepository.update(id, data);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    await this.permissionRepository.delete(id);
  }
}
