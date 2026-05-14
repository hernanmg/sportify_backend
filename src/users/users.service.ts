import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository, Not, IsNull } from 'typeorm';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { UserRole } from 'src/users-roles/entities/userRole.entity';
import { Role } from 'src/roles/entities/role.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    try {
      return await this.userRepository.find({
        relations: ['userRoles', 'userRoles.role'],
      });
    } catch (error) {
      console.error('Error in findAll users:', error);
      throw error;
    }
  }

  async findOne(id: number): Promise<User> {
    return await this.userRepository.findOne({
      where: { id, deletedAt: IsNull() }, // Excluir eliminados
      relations: ['userRoles', 'userRoles.role'],
    });
  }
  async findByName(username: string): Promise<User> {
    return await this.userRepository.findOne({
      where: { username, deletedAt: IsNull() }, // Excluir eliminados
      relations: ['userRoles', 'userRoles.role'],
    });
  }
  async findByEmail(email: string): Promise<User | null> {
    const trimmed = email?.trim();
    if (!trimmed) {
      return null;
    }
    return await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .where('LOWER(user.email) = LOWER(:email)', { email: trimmed })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }
  async update(id: number, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    // Eliminación lógica: marcar como eliminado en lugar de borrar físicamente
    await this.userRepository.update(id, {
      deletedAt: new Date(),
      isActive: false,
    });
  }

  async restore(id: number): Promise<User> {
    // Restaurar usuario eliminado
    await this.userRepository.update(id, {
      deletedAt: null,
      isActive: true,
    });
    return this.findOne(id);
  }

  async findDeleted(): Promise<User[]> {
    // Encontrar usuarios eliminados (soft deleted)
    return await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .where('user.deletedAt IS NOT NULL')
      .getMany();
  }

  async permanentDelete(id: number): Promise<void> {
    // Eliminación física permanente (solo para casos excepcionales)
    await this.userRepository.delete(id);
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    // Buscar el usuario incluyendo eliminados para poder cambiar contraseña si está soft-deleted
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash', 'email', 'isActive'],
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!user.isActive) {
      throw new BadRequestException('No se puede cambiar la contraseña de un usuario inactivo');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('Este usuario no tiene contraseña configurada. Use autenticación OAuth o contacte al administrador.');
    }

    // Verificar contraseña actual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    // Hashear nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar contraseña
    await this.userRepository.update(userId, {
      passwordHash: hashedNewPassword,
      updatedAt: new Date(),
    });
  }

  async createGoogleUser(data: {
    email: string;
    username: string;
    googleId: string;
  }): Promise<User> {
    const user = this.userRepository.create({
      email: data.email,
      username: data.username,
      googleId: data.googleId,
      estadoRegistro: 'active',
      emailVerified: true, // Google ya verificó el email
      isActive: true,
    });
    
    const savedUser = await this.userRepository.save(user);

    // Asignar rol por defecto (user)
    // TODO: Implementar asignación de rol por defecto
    
    return this.findOne(savedUser.id); // Retorna con relaciones cargadas
  }

  async updateGoogleId(userId: number, googleId: string): Promise<void> {
    await this.userRepository.update(userId, { googleId });
  }

  async updateProfile(userId: number, updateProfileDto: UpdateProfileDto): Promise<User> {
    const payload: UpdateProfileDto = { ...updateProfileDto };

    if (payload.fechaNacimiento) {
      const normalized = this.normalizeBirthDate(payload.fechaNacimiento);
      if (normalized) {
        payload.fechaNacimiento = normalized;
      } else {
        delete payload.fechaNacimiento;
      }
    }

    await this.userRepository.update(userId, payload);
    
    // Recalcular completion después de la actualización
    const updatedUser = await this.findOne(userId);
    const completion = this.calculateProfileCompletionInternal(updatedUser);
    
    if (completion !== updatedUser.profileCompletion) {
      await this.userRepository.update(userId, { profileCompletion: completion });
      updatedUser.profileCompletion = completion;
    }
    
    return updatedUser;
  }

  private normalizeBirthDate(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const slashParts = trimmed.split('/');
    if (slashParts.length === 3) {
      const day = Number(slashParts[0]);
      const month = Number(slashParts[1]);
      const year = Number(slashParts[2]);
      if (
        Number.isInteger(day) &&
        Number.isInteger(month) &&
        Number.isInteger(year) &&
        year >= 1900 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
      ) {
        return `${year.toString().padStart(4, '0')}-${month
          .toString()
          .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return null;
  }

  async calculateProfileCompletion(userId: number): Promise<{ completion: number; missingFields: string[] }> {
    const user = await this.findOne(userId);
    const completion = this.calculateProfileCompletionInternal(user);
    const missingFields = this.getMissingProfileFields(user);
    
    return { completion, missingFields };
  }

  private calculateProfileCompletionInternal(user: User): number {
    const requiredFields = [
      'username', 'email', 'firstName', 'lastName', 
      'phone', 'fechaNacimiento', 'ciudad'
    ];
    
    const optionalFields = [
      'provincia', 'pais', 'bio', 'experienciaDeportiva', 'avatarUrl'
    ];
    
    let completedRequired = 0;
    let completedOptional = 0;
    
    // Campos obligatorios valen 70% del total
    requiredFields.forEach(field => {
      if (user[field] && user[field].toString().trim() !== '') {
        completedRequired++;
      }
    });
    
    // Campos opcionales valen 30% del total
    optionalFields.forEach(field => {
      if (user[field] && user[field].toString().trim() !== '') {
        completedOptional++;
      }
    });
    
    const requiredPercentage = (completedRequired / requiredFields.length) * 70;
    const optionalPercentage = (completedOptional / optionalFields.length) * 30;
    
    return Math.round(requiredPercentage + optionalPercentage);
  }

  private getMissingProfileFields(user: User): string[] {
    const allFields = [
      { key: 'firstName', label: 'Nombre' },
      { key: 'lastName', label: 'Apellido' },
      { key: 'phone', label: 'Teléfono' },
      { key: 'fechaNacimiento', label: 'Fecha de Nacimiento' },
      { key: 'ciudad', label: 'Ciudad' },
      { key: 'provincia', label: 'Provincia' },
      { key: 'pais', label: 'País' },
      { key: 'bio', label: 'Biografía' },
      { key: 'experienciaDeportiva', label: 'Experiencia Deportiva' },
    ];
    
    return allFields
      .filter(field => !user[field.key] || user[field.key].toString().trim() === '')
      .map(field => field.label);
  }
  // constructor() {} // @InjectRepository(Role) private roleRepository: Repository<Role>, // @InjectRepository(User) private userRepository: Repository<User>,

  // private roles: Role[] = [
  //   {
  //     id: 1,
  //     name: 'admin',
  //     permissions: [],
  //     userRoles: [],
  //     description: '',
  //     createdAt: undefined,
  //     updatedAt: undefined,
  //   },
  //   {
  //     id: 2,
  //     name: 'user',
  //     permissions: [],
  //     userRoles: [],
  //     description: '',
  //     createdAt: undefined,
  //     updatedAt: undefined,
  //   },
  // ];

  // private users: User[] = [
  //   {
  //     id: 1,
  //     username: 'Admin User',
  //     email: 'admin@example.com',
  //     passwordHash:
  //       '$2b$10$FEXUUCLIlPJ109U.DJb4j.74V9qgxqxMcNiCslJIk0suC6RdmWAXi', // "password123"
  //     userRoles: [this.roles[0]],
  //     userName: 'pepa',
  //   },
  //   {
  //     id: 2,
  //     username: 'Regular User',
  //     email: 'user@example.com',
  //     passwordHash:
  //       '$2b$10$FEXUUCLIlPJ109U.DJb4j.74V9qgxqxMcNiCslJIk0suC6RdmWAXi', // "password123"
  //     userRoles: [this.roles[1]],
  //     userName: 'pepapig',
  //   },
  // ];

  async assignRoleToUser(userId: number, roleId: number): Promise<UserRole> {
    // Verificar si ya existe la relación
    const existingUserRole = await this.userRoleRepository.findOne({
      where: { userId, roleId }
    });

    if (existingUserRole) {
      return existingUserRole;
    }

    // Crear nueva relación usuario-rol
    const userRole = this.userRoleRepository.create({
      userId,
      roleId
    });

    return await this.userRoleRepository.save(userRole);
  }

  // async findByUserName(userName: string): Promise<User | undefined> {
  //   console.log(userName);
  //   return this.users.find((user) => user.username === userName);
  // }

  // async createUser(dto: CreateUserDto): Promise<User> {
  //   const roles = await this.roleRepository.findByIds(dto.roles);
  //   const user = this.userRepository.create({ ...dto, roles });
  //   return this.userRepository.save(user);
  // }
  // async createUser(dto: any): Promise<User> {
  //   const role = this.roles.find((r) => dto.roles.includes(r.name));
  //   const user: User = {
  //     id: this.users.length + 1,
  //     name: dto.name,
  //     email: dto.email,
  //     password: await this.hashPassword(dto.password),
  //     roles: [role],
  //     userName: 'pepapig',
  //   };
  //   this.users.push(user);
  //   return user;
  // }
  // async findByEmail(email: string): Promise<User | undefined> {
  //   return this.users.find((user) => user.email === email);
  // }

  // async findAll(): Promise<User[]> {
  //   return this.users; //this.userRepository.find({ relations: ['roles'] });
  // }
  // private async hashPassword(password: string): Promise<string> {
  //   const bcrypt = await import('bcrypt');
  //   return bcrypt.hash(password, 10);
  // }

  // Gestión de roles de usuarios
  async updateUserRole(userId: number, newRoleId: number): Promise<User> {
    // Primero verificamos que el usuario existe
    const user = await this.findOne(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificamos que el nuevo rol existe
    const role = await this.roleRepository.findOne({ where: { id: newRoleId } });
    if (!role) {
      throw new Error('Rol no encontrado');
    }

    // Removemos todos los roles existentes del usuario
    await this.userRoleRepository.delete({ userId });

    // Asignamos el nuevo rol
    const userRole = this.userRoleRepository.create({
      userId,
      roleId: newRoleId,
    });
    await this.userRoleRepository.save(userRole);

    // Retornamos el usuario actualizado con relaciones
    return this.findOne(userId);
  }

  async removeRoleFromUser(userId: number, roleId: number): Promise<void> {
    const userRole = await this.userRoleRepository.findOne({
      where: { userId, roleId }
    });

    if (!userRole) {
      throw new Error('El usuario no tiene ese rol asignado');
    }

    await this.userRoleRepository.remove(userRole);
  }
}
