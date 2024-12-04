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
import { AuthGuards } from './auth.guards';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { AuthGuard } from '@nestjs/passport';

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

    // this.hashPassword(input.password);
  }
  private async hashPassword(password: string) {
    const bcrypt = await import('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);
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

  @UseGuards(AuthGuards)
  @Get('userDetail')
  getUserInfo(@Request() request) {
    return request.userDetail;
  }

  @Get('admin')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin') // Solo los administradores pueden acceder
  getAdminContent() {
    return 'Contenido exclusivo para administradores';
  }

  @Get('user')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('user') // Solo los usuarios con rol "user" pueden acceder
  getUserContent() {
    return 'Contenido exclusivo para usuarios regulares';
  }

  @Get('all')
  @UseGuards(AuthGuard('jwt'))
  getAllContent() {
    return 'Contenido para cualquier usuario autenticado';
  }
}
