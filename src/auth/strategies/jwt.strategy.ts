import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    try {
      // payload contiene: { sub: userId, userName, role, iat, exp }
      const user = await this.usersService.findOne(payload.sub);
      
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      // Esto se asigna a req.user en los controllers
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: payload.role,
        ...user, // Incluir todos los datos del usuario
      };
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
