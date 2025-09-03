import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { lastValueFrom } from 'rxjs';
import { UserResponseDto } from 'src/users/dtos/userResponseDto';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';

type AuthInput = { email: string; password: string };
type AuthResult = {
  accessToken: string;
  userId: number;
  userName: string;
  role: string;
};
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
    const user = await this.userService.findByEmail(input.email);
    if (user && (await bcrypt.compare(input.password, user.passwordHash))) {
      return {
        id: user.id,
        name: user.username,
        userName: user.username,
        accessToken: '',
        role: user.userRoles[0].role.name,
      };
    } else {
      throw new UnauthorizedException();
    }
  }

  async authenticate(input: AuthInput): Promise<AuthResult> {
    const user = await this.validateUserLogin(input);

    if (!user) {
      throw new UnauthorizedException('Usuario o password incorrectos.');
    }

    return this.singIn(user);
  }

  async singIn(user: UserResponseDto): Promise<AuthResult> {
    // const tokenPayload = {
    //   sub: user.id,
    //   userName: user.userName,
    // };

    const tokens = await this.generateTokens(user);
    return {
      ...tokens,
      userId: user.id,
      userName: user.userName,
      role: user.role,
    };
    // const accessToken = await this.jwtService.signAsync(tokenPayload);

    // return { accessToken, userName: user.userName, userId: user.id };
  }

  async generateTokens(
    user: UserResponseDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenPayload = {
      sub: user.id,
      userName: user.userName,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '20m',
    });

    // Guardar el `refreshToken` en la base de datos
    // await this.userService.update(user.id, { refreshToken });

    return { accessToken, refreshToken };
  }
  async refreshTokens(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // Aquí podrías validar el token contra una lista negra si implementas esta lógica

      const user = await this.userService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      return this.generateTokens({
        id: user.id,
        name: user.username,
        userName: user.username,
        accessToken: '',
        role: user.userRoles[0].role.name,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }
}
