import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RolePermission } from './entities/rolePermission.entity';
import { RolesPermissionsService } from './roles-permissions.service';

@Controller('roles-permissions')
export class RolesPermissionsController {
  constructor(
    private readonly rolePermissionService: RolesPermissionsService,
  ) {}

  @Post()
  async create(@Body() data: Partial<RolePermission>): Promise<RolePermission> {
    return this.rolePermissionService.create(data);
  }

  @Get()
  async findAll(): Promise<RolePermission[]> {
    return this.rolePermissionService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<RolePermission> {
    return this.rolePermissionService.findOne(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: number): Promise<void> {
    return this.rolePermissionService.delete(id);
  }
}
