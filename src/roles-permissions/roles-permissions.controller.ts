import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { RolesPermissionsService } from './roles-permissions.service';

@Controller('roles-permissions')
export class RolesPermissionsController {
  constructor(
    private readonly rolesPermissionsService: RolesPermissionsService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin') // Solo administradores pueden ver todos los roles
  async findAllRoles() {
    return this.rolesPermissionsService.findAllRoles();
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin') // Solo administradores pueden crear nuevos roles
  async createRole(@Body() body: { name: string; permissions: string[] }) {
    return this.rolesPermissionsService.createRole(body.name, body.permissions);
  }
}
