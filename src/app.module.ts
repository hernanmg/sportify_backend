import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesPermissionsModule } from './roles-permissions/roles-permissions.module';

@Module({
  imports: [AuthModule, UsersModule, RolesPermissionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
