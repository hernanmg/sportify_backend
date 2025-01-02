import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { UserRoleService } from './users-roles.service';
import { UserRole } from './entities/userRole-entity';

@Controller('user-roles')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @Post()
  async create(@Body() data: Partial<UserRole>): Promise<UserRole> {
    return this.userRoleService.create(data);
  }

  @Get()
  async findAll(): Promise<UserRole[]> {
    return this.userRoleService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<UserRole> {
    return this.userRoleService.findOne(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: number): Promise<void> {
    return this.userRoleService.delete(id);
  }
}
