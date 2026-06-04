import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as session from 'express-session';
import * as passport from 'passport';
import { config } from 'dotenv';

// Cargar variables de entorno explícitamente
config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : [
        'http://localhost:3000',
        /^http:\/\/localhost:\d+$/,
      ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Sportify Amateur')
    .setDescription('Documentación de la API de ejemplo con Swagger')
    .setVersion('1.0')
    // .addBearerAuth() // Agrega esta línea si tienes autenticación con Bearer token
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  app.use(
    session({
      secret:
        process.env.SESSION_SECRET ||
        '62cBBruDLHqvLlVJoZv1Q0n3YWEEn0P94OWDZNX9Yq0=',
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 3600000 }, // 1 hora, ajusta según sea necesario
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();