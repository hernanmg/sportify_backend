import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
// import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth/auth.service';
// import { GoogleAuthGuard } from './auth/google/google-guards';
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly appAuthService: AuthService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // @Get('google')
  // @UseGuards(GoogleAuthGuard)
  // async googleAuth(@Req() req) {
  //   console.log(req);
  // }

  // @Get('auth/google/callback')
  // @UseGuards(GoogleAuthGuard)
  // googleAuthRedirect(@Req() req) {
  //   return this.appAuthService.validateUser(req);
  // }
}
