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

  async findOne(id: number): Promise<RolePermission> {
    return await this.rolePermissionRepository.findOne({
      where: { id },
      relations: ['role', 'permission'],
    });
  }

  async delete(id: number): Promise<void> {
    await this.rolePermissionRepository.delete(id);
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
