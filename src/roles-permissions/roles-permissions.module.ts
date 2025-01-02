import { Module } from '@nestjs/common';
import { RolesPermissionsController } from './roles-permissions.controller';
import { RolesPermissionsService } from './roles-permissions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermission } from './entities/rolePermission.entity';
import { PermissionModule } from 'src/permissions/permissions.module';

@Module({
  imports: [TypeOrmModule.forFeature([RolePermission]), PermissionModule],
  controllers: [RolesPermissionsController],
  providers: [RolesPermissionsService],
  exports: [RolesPermissionsService],
})
export class RolesPermissionsModule {}
