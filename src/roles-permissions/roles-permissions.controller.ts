import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
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

  @Get(':roleId/:permissionId')
  async findOne(
    @Param('roleId') roleId: number, 
    @Param('permissionId') permissionId: number
  ): Promise<RolePermission> {
    return this.rolePermissionService.findOne(roleId, permissionId);
  }

  @Delete(':roleId/:permissionId')
  async delete(
    @Param('roleId') roleId: number, 
    @Param('permissionId') permissionId: number
  ): Promise<void> {
    return this.rolePermissionService.delete(roleId, permissionId);
  }

  @Get('role/:roleId')
  async findByRole(@Param('roleId',ParseIntPipe) roleId: number) {
    return this.rolePermissionService.findByRole(roleId);
  }
  
}
