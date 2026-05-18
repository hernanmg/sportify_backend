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
      const user = await this.usersService.findOne(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      const resolvedRole = this.usersService.getPrimaryRoleName(user);

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: resolvedRole,
        userRoles: user.userRoles ?? [],
      };
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
