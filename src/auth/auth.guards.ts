import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuards implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    const token = authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const tokenPailod = await this.jwtService.verifyAsync(token);
      request.userDetail = {
        usierId: tokenPailod.sub,
        userName: tokenPailod.userName,
      };
      return true;
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }
}
