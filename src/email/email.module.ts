import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { existsSync } from 'fs';
import { EmailService } from './email.service';

// Función para encontrar la ruta correcta de las plantillas
function getTemplatesPath(): string {
  // Intentar primero en dist/ (producción)
  const distPath = join(__dirname, 'templates');
  if (existsSync(distPath)) {
    console.log(`📧 Usando plantillas desde: ${distPath}`);
    return distPath;
  }
  
  // Intentar en src/ (desarrollo)
  const srcPath = join(__dirname, '../../src/email/templates');
  if (existsSync(srcPath)) {
    console.log(`📧 Usando plantillas desde: ${srcPath}`);
    return srcPath;
  }
  
  // Ruta absoluta como fallback
  const absolutePath = join(process.cwd(), 'src/email/templates');
  console.log(`📧 Usando plantillas desde (fallback): ${absolutePath}`);
  return absolutePath;
}

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'your-email@gmail.com',
          pass: process.env.SMTP_PASS || 'your-app-password',
        },
        tls: {
          rejectUnauthorized: false
        },
        debug: false, // Desactivar logs verbose en producción
        logger: false
      },
      defaults: {
        from: `"Sportify Amateur" <${process.env.SMTP_FROM || 'noreply@sportify.com'}>`,
      },
      template: {
        dir: getTemplatesPath(),
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
