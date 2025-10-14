import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { RoleService } from './roles.service';
import { Role } from './entities/role.entity';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  async create(@Body() data: Partial<Role>): Promise<Role> {
    return this.roleService.create(data);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager', 'team_captain', 'player', 'guest')
  async findAll(): Promise<Role[]> {
    return this.roleService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Role> {
    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      throw new BadRequestException('ID de rol inválido');
    }
    return this.roleService.findOne(roleId);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  async update(
    @Param('id') id: number,
    @Body() data: Partial<Role>,
  ): Promise<Role> {
    return this.roleService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin')
  async delete(@Param('id') id: number): Promise<void> {
    return this.roleService.delete(id);
  }

  // Gestión de permisos de roles
  @Post(':id/permissions')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  async assignPermissionToRole(
    @Param('id') roleId: number,
    @Body() body: { permissionId: number }
  ): Promise<{ message: string }> {
    await this.roleService.assignPermissionToRole(roleId, body.permissionId);
    return { message: 'Permiso asignado exitosamente' };
  }

  @Delete(':id/permissions/:permissionId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  async removePermissionFromRole(
    @Param('id') roleId: number,
    @Param('permissionId') permissionId: number
  ): Promise<{ message: string }> {
    await this.roleService.removePermissionFromRole(roleId, permissionId);
    return { message: 'Permiso removido exitosamente' };
  }

  @Put(':id/permissions')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  async updateRolePermissions(
    @Param('id') roleId: number,
    @Body() body: { permissionIds: number[] }
  ): Promise<{ message: string; role: Role }> {
    const updatedRole = await this.roleService.updateRolePermissions(roleId, body.permissionIds);
    return { 
      message: 'Permisos actualizados exitosamente',
      role: updatedRole
    };
  }
}
