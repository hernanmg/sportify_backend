import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      clientID:
        '643857245475-re1l4hhi8rhrkog5tmp8fr41glr10msr.apps.googleusercontent.com',
      clientSecret: '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',
      callbackURL: 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
      prompt: 'select_account',
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    done(null, profile);
  }
}
