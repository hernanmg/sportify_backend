import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { PermissionService } from './permissions.service';
import { Permission } from './entities/permission.entity';

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  async create(@Body() data: Partial<Permission>): Promise<Permission> {
    return this.permissionService.create(data);
  }

  @Get()
  async findAll(): Promise<Permission[]> {
    return this.permissionService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number): Promise<Permission> {
    return this.permissionService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: number,
    @Body() data: Partial<Permission>,
  ): Promise<Permission> {
    return this.permissionService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: number): Promise<void> {
    return this.permissionService.delete(id);
  }
}
