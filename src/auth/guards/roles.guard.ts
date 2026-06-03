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

    const userRoles = (user.userRoles ?? [])
      .map((ur) => ur.role?.name)
      .filter((name): name is string => !!name);
    const jwtRole = (user as User & { role?: string }).role;
    if (jwtRole && !userRoles.includes(jwtRole)) {
      userRoles.push(jwtRole);
    }
    if (!requiredRoles.some((role) => userRoles.includes(role))) {
      throw new ForbiddenException('User does not have the required role');
    }

    return true;
  }
}
