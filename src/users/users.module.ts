import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesPermissionsModule } from '../roles-permissions/roles-permissions.module';
import { User } from './entities/user.entity';
import { UserAuthProvider } from '../auth/entities/user-auth-provider.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserAuthProvider]), // Registra ambos repositorios
    RolesPermissionsModule, // Importa el módulo de roles si se utiliza en UsersService
  ],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
