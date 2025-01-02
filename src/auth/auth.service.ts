import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { lastValueFrom } from 'rxjs';
import { UserResponseDto } from 'src/users/dtos/userResponseDto';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';

type AuthInput = { userName: string; password: string };
type AuthResult = { accessToken: string; userId: number; userName: string };
@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
  ) {}
  async validateUser(profile: any) {
    // Lógica para buscar o crear el usuario en la base de datos
    // Retorna el usuario o los datos que deseas.
    console.log(profile);
    return {
      email: profile.user.emails[0].value,
      name: profile.user.displayName,
    };
  }

  async validateFacebookToken(facebookToken: string) {
    const url = `https://graph.facebook.com/me?access_token=${facebookToken}`;
    try {
      const response = await lastValueFrom(this.httpService.get(url));
      const { id, name, email } = response.data;

      if (!id) {
        throw new UnauthorizedException('Invalid Facebook token');
      }

      // Aquí podrías hacer verificaciones adicionales o almacenar el usuario en tu base de datos

      const payload = { facebookId: id, name, email };
      return this.jwtService.sign(payload);
    } catch (error) {
      throw new UnauthorizedException('Invalid Facebook token' + error);
    }
  }
  async validateUserLogin(input: AuthInput): Promise<UserResponseDto | null> {
    const user = await this.userService.findByName(input.userName);
    console.log('validate input in validateUserLogin  ' + user.username);
    console.log('validate input in user.password   ' + user.passwordHash);
    console.log('validate input in input.password    ' + input.password);
    if (user && (await bcrypt.compare(input.password, user.passwordHash))) {
      return {
        id: user.id,
        name: user.username,
        userName: user.username,
      };
    }
    return null;
  }

  async authenticate(input: AuthInput): Promise<AuthResult> {
    const user = await this.validateUserLogin(input);

    if (!user) {
      throw new UnauthorizedException('Usuario o password incorrectos.');
    }

    return this.singIn(user);
  }

  async singIn(user: UserResponseDto): Promise<AuthResult> {
    const tokenPayload = {
      sub: user.id,
      userName: user.userName,
    };
    const accessToken = await this.jwtService.signAsync(tokenPayload);

    return { accessToken, userName: user.userName, userId: user.id };
  }
}
