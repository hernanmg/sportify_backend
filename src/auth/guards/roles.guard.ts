import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from 'src/users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      context.getHandler(),
    );
    if (!requiredRoles) return true;

    const { user }: { user: User } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('User not authenticated');

    const userRoles = user.userRoles.map((role) => role.role.name);
    if (!requiredRoles.some((role) => userRoles.includes(role))) {
      throw new ForbiddenException('User does not have the required role');
    }

    return true;
  }
}
