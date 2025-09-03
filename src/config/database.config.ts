import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import glob from 'glob';

export const databaseConfig = (configService: ConfigService): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  const config = {
    type: 'postgres' as const,
    host: configService.get('DB_HOST', 'localhost'),
    port: parseInt(configService.get('DB_PORT', '5445'), 10),
    username: configService.get('DB_USERNAME', 'sportify_user'),
    password: configService.get('DB_PASSWORD', 'sportify_password'),
    database: configService.get('DB_NAME', 'sportify_amateur'),
    entities:  [isProduction
    ? __dirname + '/../**/*.entity.js'
    : __dirname + '/../**/*.entity.ts'],
    synchronize: configService.get('DB_SYNCHRONIZE', 'true') === 'true',
    logging: configService.get('DB_LOGGING', 'true') === 'true',
    ssl: false,
    retryAttempts: 3,
    retryDelay: 3000,
  };

  // Debug logging
  //console.log('🔧 Database config:', {
  //  host: config.host,
  //  port: config.port,
  //  username: config.username,
  //  database: config.database,
  //  password: config.password ? '***hidden***' : 'NOT SET'
  //});
  //console.log('🔎 Entity files:', glob.sync(join(__dirname, '/../**/*.entity.{ts,js}')));
  return config;
};
