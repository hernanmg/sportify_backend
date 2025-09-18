import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { UserRoleService } from './users-roles.service';
import { UserRole } from './entities/userRole.entity';

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

  @Get(':userId/:roleId')
  async findOne(
    @Param('userId') userId: number, 
    @Param('roleId') roleId: number
  ): Promise<UserRole> {
    return this.userRoleService.findOne(userId, roleId);
  }

  @Delete(':userId/:roleId')
  async delete(
    @Param('userId') userId: number, 
    @Param('roleId') roleId: number
  ): Promise<void> {
    return this.userRoleService.delete(userId, roleId);
  }
}
