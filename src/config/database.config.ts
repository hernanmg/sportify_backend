import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { glob } from 'glob';

export const databaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  console.log('🔧 Buscando entidades en:', __dirname + '/../**/*.entity{.ts,.js}');
  
  return {
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: parseInt(configService.get('DB_PORT', '5445'), 10),
    username: configService.get('DB_USERNAME', 'sportify_user'),
    password: configService.get('DB_PASSWORD', 'sportify_password'),
    database: configService.get('DB_NAME', 'sportify_amateur'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: true,
    logging:
      configService.get('DB_LOGGING', 'false') === 'true'
        ? ['query', 'error', 'schema', 'warn']
        : ['error'],
    ssl: false,
    retryAttempts: 3,
    retryDelay: 3000,
  };
};