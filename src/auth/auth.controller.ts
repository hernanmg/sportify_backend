import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleAuthGuard } from './google/google-guards';
import { AuthGuard } from './auth.guards';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('facebook-login')
  async facebookLogin(@Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    // Llama al servicio para validar el token de Facebook y obtener un JWT
    return {
      accessToken: await this.authService.validateFacebookToken(token),
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() input: { userName: string; password: string; email: string }) {
    console.log('controller input   ' + input.userName);
    return this.authService.authenticate(input);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Req() req) {
    console.log(req);
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleAuthRedirect(@Req() req) {
    return this.authService.validateUser(req);
  }

  @UseGuards(AuthGuard)
  @Get('userDetail')
  getUserInfo(@Request() request) {
    return request.userDetail;
  }
}
