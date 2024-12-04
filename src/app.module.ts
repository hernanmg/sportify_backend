import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { RolesPermissionsModule } from './roles-permissions/roles-permissions.module';

@Module({
  imports: [AuthModule, TypeOrmModule, UsersModule, RolesPermissionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
