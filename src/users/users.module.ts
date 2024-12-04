import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { User } from './entities/user-entity';
import { RolesPermissionsModule } from '../roles-permissions/roles-permissions.module';
// import { Role } from 'src/roles-permissions/entities/role.entity';
@Module({
  imports: [
    // TypeOrmModule.forFeature([User, Role]), // Registra el repositorio de User
    RolesPermissionsModule, // Importa el módulo de roles si se utiliza en UsersService
  ],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
