import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesPermissionsModule } from '../roles-permissions/roles-permissions.module';
import { User } from './entities/user-entity';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
  imports: [
    TypeOrmModule.forFeature([User]), // Registra el repositorio de User
    RolesPermissionsModule, // Importa el módulo de roles si se utiliza en UsersService
  ],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
