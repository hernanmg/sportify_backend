import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from './entities/rolePermission.entity';
// import { Permission } from './entities/permission.entity';
// import { Role } from './entities/role.entity';

@Injectable()
export class RolesPermissionsService {
  constructor(
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async create(data: Partial<RolePermission>): Promise<RolePermission> {
    const rolePermission = this.rolePermissionRepository.create(data);
    return await this.rolePermissionRepository.save(rolePermission);
  }

  async findAll(): Promise<RolePermission[]> {
    return await this.rolePermissionRepository.find({
      relations: ['role', 'permission'],
    });
  }

  async findOne(roleId: number, permissionId: number): Promise<RolePermission> {
    return await this.rolePermissionRepository.findOne({
      where: { role_id: roleId, permission_id: permissionId },
      relations: ['role', 'permission'],
    });
  }

  async delete(roleId: number, permissionId: number): Promise<void> {
    await this.rolePermissionRepository.delete({ 
      role_id: roleId, 
      permission_id: permissionId 
    });
  }
  // private permissions: Permission[] = [
  //   { id: 1, name: 'read', roles: [] },
  //   { id: 2, name: 'write', roles: [] },
  // ];

  // private roles: Role[] = [
  //   {
  //     id: 1,
  //     name: 'admin',
  //     permissions: [this.permissions[0], this.permissions[1]],
  //     users: [],
  //   },
  //   { id: 2, name: 'user', permissions: [this.permissions[0]], users: [] },
  // ];
  // async findAllRoles(): Promise<Role[]> {
  //   return this.roles;
  // }

  // async findAllPermissions(): Promise<Permission[]> {
  //   return this.permissions;
  // }

  // async createRole(name: string, permissions: string[]): Promise<Role> {
  //   const newRole: Role = {
  //     id: this.roles.length + 1,
  //     name,
  //     permissions: this.permissions.filter((perm) =>
  //       permissions.includes(perm.name),
  //     ),
  //     users: [],
  //   };
  //   this.roles.push(newRole);
  //   return newRole;
  // }
}
