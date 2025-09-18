import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './entities/userRole.entity';

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

  async findOne(userId: number, roleId: number): Promise<UserRole> {
    return await this.userRoleRepository.findOne({
      where: { user_id: userId, role_id: roleId },
      relations: ['user', 'role'],
    });
  }

  async delete(userId: number, roleId: number): Promise<void> {
    await this.userRoleRepository.delete({ 
      user_id: userId, 
      role_id: roleId 
    });
  }
}
