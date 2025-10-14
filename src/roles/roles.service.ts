import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from 'src/permissions/entities/permission.entity';
import { RolePermission } from 'src/roles-permissions/entities/rolePermission.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  async create(data: Partial<Role>): Promise<Role> {
    const role = this.roleRepository.create(data);
    return await this.roleRepository.save(role);
  }

  async findAll(): Promise<Role[]> {
    try {
      return await this.roleRepository.find();
    } catch (error) {
      console.error('Error in findAll roles:', error);
      throw error;
    }
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['rolePermissions', 'rolePermissions.permission'],
    });
    if (!role) {
      throw new NotFoundException(`Rol con ID ${id} no encontrado`);
    }
    return role;
  }

  async update(id: number, data: Partial<Role>): Promise<Role> {
    await this.roleRepository.update(id, data);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    const role = await this.findOne(id);
    // Verificar si el rol está siendo usado por usuarios
    // TODO: Agregar validación si es necesario
    await this.roleRepository.delete(id);
  }

  // Gestión de permisos de roles
  async assignPermissionToRole(roleId: number, permissionId: number): Promise<void> {
    // Verificar que el rol existe
    const role = await this.findOne(roleId);
    
    // Verificar que el permiso existe
    const permission = await this.permissionRepository.findOne({ where: { id: permissionId } });
    if (!permission) {
      throw new NotFoundException(`Permiso con ID ${permissionId} no encontrado`);
    }

    // Verificar si ya existe la relación
    const existingRelation = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId }
    });
    if (existingRelation) {
      throw new BadRequestException('El rol ya tiene ese permiso asignado');
    }

    // Crear la relación
    const rolePermission = this.rolePermissionRepository.create({
      roleId,
      permissionId,
    });
    await this.rolePermissionRepository.save(rolePermission);
  }

  async removePermissionFromRole(roleId: number, permissionId: number): Promise<void> {
    const rolePermission = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId }
    });

    if (!rolePermission) {
      throw new NotFoundException('El rol no tiene ese permiso asignado');
    }

    await this.rolePermissionRepository.remove(rolePermission);
  }

  async updateRolePermissions(roleId: number, permissionIds: number[]): Promise<Role> {
    // Verificar que el rol existe
    const role = await this.findOne(roleId);

    // Verificar que todos los permisos existen
    for (const permissionId of permissionIds) {
      const permission = await this.permissionRepository.findOne({ where: { id: permissionId } });
      if (!permission) {
        throw new NotFoundException(`Permiso con ID ${permissionId} no encontrado`);
      }
    }

    // Eliminar todos los permisos actuales del rol
    await this.rolePermissionRepository.delete({ roleId });

    // Agregar los nuevos permisos
    for (const permissionId of permissionIds) {
      const rolePermission = this.rolePermissionRepository.create({
        roleId,
        permissionId,
      });
      await this.rolePermissionRepository.save(rolePermission);
    }

    // Retornar el rol actualizado
    return this.findOne(roleId);
  }
}
