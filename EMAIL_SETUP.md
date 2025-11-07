# 📧 Configuración de Email para Sportify Amateur

## 🚨 Error Actual
```
535-5.7.8 Username and Password not accepted
```

Este error indica que Gmail rechaza las credenciales. **NO uses tu contraseña normal de Gmail**.

## ✅ Solución: Contraseña de Aplicación

### 1️⃣ Generar Contraseña de Aplicación en Gmail

1. **Ve a tu cuenta de Google**: https://myaccount.google.com/
2. **Seguridad** → **Verificación en 2 pasos** (debe estar activada)
3. **Contraseñas de aplicación** → **Generar nueva**
4. Selecciona **"Correo"** y **"Otro (nombre personalizado)"**
5. Escribe **"Sportify Amateur"**
6. **Copia la contraseña de 16 caracteres** (formato: abcd-efgh-ijkl-mnop)

### 2️⃣ Configurar Variables de Entorno

Crea o edita tu archivo `.env` con:

```env
# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=abcd-efgh-ijkl-mnop  # ← Contraseña de aplicación (16 caracteres)
SMTP_FROM=noreply@sportify.com
```

### 3️⃣ Proveedores Alternativos

#### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_USER=tu-email@outlook.com
SMTP_PASS=tu-contraseña-normal  # Outlook permite contraseña normal
```

#### Yahoo
```env
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
SMTP_USER=tu-email@yahoo.com
SMTP_PASS=tu-contraseña-de-aplicacion  # Yahoo también requiere contraseña de app
```

#### SendGrid (Recomendado para producción)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=tu-api-key-de-sendgrid
```

## 🧪 Probar Configuración

Después de configurar las credenciales:

1. **Reinicia el servidor**: `npm run start:dev`
2. **Crea un evento** desde la app
3. **Verifica los logs**:
   ```
   📧 Usando plantillas desde: /path/to/templates
   📧 Email enviado a usuario@email.com
   ✅ Notificación procesada - Email: true
   ```

## 🔧 Troubleshooting

### Error: "Username and Password not accepted"
- ✅ Usar contraseña de aplicación, no contraseña normal
- ✅ Verificar que la verificación en 2 pasos esté activada
- ✅ Verificar que el email sea correcto

### Error: "Connection timeout"
- ✅ Verificar SMTP_HOST y SMTP_PORT
- ✅ Verificar conexión a internet
- ✅ Probar con otro proveedor (Outlook, SendGrid)

### Error: "Authentication failed"
- ✅ Regenerar contraseña de aplicación
- ✅ Verificar que no haya espacios en la contraseña
- ✅ Probar con otro email

## 🚀 Recomendación para Producción

Para producción, usa **SendGrid** o **AWS SES**:

### SendGrid (Fácil)
1. Registrarse en https://sendgrid.com/
2. Crear API Key
3. Configurar SMTP con la API Key

### AWS SES (Escalable)
1. Configurar AWS SES
2. Verificar dominio
3. Usar credenciales IAM específicas

## 📧 Servicio Actual

El servicio que envía emails es:
- **Clase**: `EmailService` (`src/email/email.service.ts`)
- **Proveedor**: `@nestjs-modules/mailer` con `nodemailer`
- **Plantillas**: Handlebars (`.hbs`)
- **SMTP**: Configurable (Gmail, Outlook, SendGrid, etc.)
