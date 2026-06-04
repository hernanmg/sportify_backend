import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const isProduction =
    configService.get('NODE_ENV') === 'production' ||
    configService.get('RENDER') === 'true';

  const synchronize =
    configService.get('DB_SYNCHRONIZE', isProduction ? 'false' : 'true') ===
    'true';

  const base: TypeOrmModuleOptions = {
    type: 'postgres',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize,
    logging: configService.get('DB_LOGGING', 'false') === 'true',
    retryAttempts: 5,
    retryDelay: 3000,
  };

  if (databaseUrl) {
    return {
      ...base,
      url: databaseUrl,
      extra: { ssl: { rejectUnauthorized: false } },
    } as TypeOrmModuleOptions;
  }

  const useSsl = configService.get<string>('DB_SSL', 'false') === 'true';
  return {
    ...base,
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: parseInt(configService.get<string>('DB_PORT', '5445'), 10),
    username: configService.get<string>('DB_USERNAME', 'sportify_user'),
    password: configService.get<string>('DB_PASSWORD', 'sportify_password'),
    database: configService.get<string>('DB_NAME', 'sportify_amateur'),
    ...(useSsl ? { extra: { ssl: { rejectUnauthorized: false } } } : {}),
  } as TypeOrmModuleOptions;
};
