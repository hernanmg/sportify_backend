import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google/google-strategy';
import { PassportModule } from '@nestjs/passport';
import { SessionSerializer } from './serializer';

@Module({
  imports: [PassportModule.register({ session: true })],
  providers: [AuthService, GoogleStrategy, SessionSerializer],
  exports: [AuthService],
  controllers: [],
})
export class AuthModule {}
