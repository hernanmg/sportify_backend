import { Injectable } from '@nestjs/common';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';

@Injectable()
export class RolesPermissionsService {
  private permissions: Permission[] = [
    { id: 1, name: 'read', roles: [] },
    { id: 2, name: 'write', roles: [] },
  ];

  private roles: Role[] = [
    {
      id: 1,
      name: 'admin',
      permissions: [this.permissions[0], this.permissions[1]],
      users: [],
    },
    { id: 2, name: 'user', permissions: [this.permissions[0]], users: [] },
  ];
  async findAllRoles(): Promise<Role[]> {
    return this.roles;
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissions;
  }

  async createRole(name: string, permissions: string[]): Promise<Role> {
    const newRole: Role = {
      id: this.roles.length + 1,
      name,
      permissions: this.permissions.filter((perm) =>
        permissions.includes(perm.name),
      ),
      users: [],
    };
    this.roles.push(newRole);
    return newRole;
  }
}
