import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
// import { CreateUserDto } from './dtos/create-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Get('for-team/:teamId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  async findForTeam(@Param('teamId') teamId: string) {
    return this.userService.findUsersForTeam(parseInt(teamId, 10));
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  async findAll() {
    return this.userService.findAll();
  }

  @Post()
  async create(@Body() data: Partial<User>): Promise<User> {
    return this.userService.create(data);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req) {
    const user = await this.userService.findOne(req.user.id);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    const { passwordHash, ...profile } = user;
    return {
      ...profile,
      role: this.userService.getPrimaryRoleName(user),
    };
  }

  @Put('profile')
  @UseGuards(AuthGuard('jwt'))
  async updateProfile(@Req() req, @Body() updateProfileDto: UpdateProfileDto) {
    const user = await this.userService.updateProfile(req.user.id, updateProfileDto);
    const { passwordHash, ...profile } = user;
    return {
      ...profile,
      role: this.userService.getPrimaryRoleName(user),
    };
  }

  @Get('profile/completion')
  @UseGuards(AuthGuard('jwt'))
  async getProfileCompletion(@Req() req) {
    return this.userService.calculateProfileCompletion(req.user.id);
  }

  @Put('profile/change-password')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async changePassword(@Req() req, @Body() changePasswordDto: ChangePasswordDto) {
    await this.userService.changePassword(req.user.id, changePasswordDto);
    return { message: 'Contraseña cambiada exitosamente' };
  }

  // Endpoints administrativos - Solo admin/manager
  @Get('deleted')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  async getDeletedUsers(): Promise<User[]> {
    return this.userService.findDeleted();
  }

  @Put(':id/restore')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  async restoreUser(@Param('id') id: number): Promise<User> {
    return this.userService.restore(id);
  }

  @Delete(':id/permanent')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async permanentDelete(@Param('id') id: number): Promise<void> {
    return this.userService.permanentDelete(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<User> {
    return this.userService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() data: Partial<User>,
  ): Promise<User> {
    return this.userService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: number): Promise<void> {
    return this.userService.delete(id);
  }

  // Gestión de roles de usuarios
  @Post(':id/roles')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.OK)
  async assignRoleToUser(
    @Param('id') userId: number,
    @Body() body: { roleId: number }
  ): Promise<{ message: string }> {
    await this.userService.assignRoleToUser(userId, body.roleId);
    return { message: 'Rol asignado exitosamente' };
  }

  @Put(':id/role')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.OK)
  async updateUserRole(
    @Param('id') userId: number,
    @Body() body: { roleId: number }
  ): Promise<{ message: string; user: User }> {
    const updatedUser = await this.userService.updateUserRole(userId, body.roleId);
    return { 
      message: 'Rol actualizado exitosamente',
      user: updatedUser
    };
  }

  @Delete(':id/roles/:roleId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.OK)
  async removeRoleFromUser(
    @Param('id') userId: number,
    @Param('roleId') roleId: number
  ): Promise<{ message: string }> {
    await this.userService.removeRoleFromUser(userId, roleId);
    return { message: 'Rol removido exitosamente' };
  }
}
