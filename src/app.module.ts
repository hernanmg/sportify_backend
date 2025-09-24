import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesModule } from './matches/matches.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { RoleModule } from './roles/roles.module';
import { PermissionModule } from './permissions/permissions.module';
import { UserRoleModule } from './users-roles/users.roles.module';
import { RolesPermissionsModule } from './roles-permissions/roles-permissions.module';
import { PlayersModule } from './players/players.module';
import { SportsModule } from './sports/sports.module';
import { TeamsModule } from './teams/teams.module';
import { EventsModule } from './events/event.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CategoriesModule } from './categories/categories.module';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    RoleModule,
    PermissionModule,
    UserRoleModule,
    RolesPermissionsModule,
    MatchesModule,
    PlayersModule,
    SportsModule,
    TeamsModule,
    EventsModule,
    NotificationsModule,
    CategoriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
