// export class User {
//   id: number;
//   name: string = '';
//   userName: string = '';
//   password: string = '';

//   constructor(init?: Partial<User>) {
//     Object.assign(this, init);
//   }
// }

import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from 'src/users-roles/entities/userRole.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'username', type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ name: 'email', type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'text', nullable: true })
  passwordHash?: string;

  // Información personal
  @Column({ name: 'first_name', type: 'varchar', length: 50, nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', type: 'varchar', length: 50, nullable: true })
  lastName?: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ name: 'fecha_nacimiento', type: 'date', nullable: true })
  fechaNacimiento?: Date;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl?: string;

  // Información adicional de perfil
  @Column({ name: 'ciudad', type: 'varchar', length: 100, nullable: true })
  ciudad?: string;

  @Column({ name: 'provincia', type: 'varchar', length: 100, nullable: true })
  provincia?: string;

  @Column({ name: 'pais', type: 'varchar', length: 100, nullable: true })
  pais?: string;

  @Column({ name: 'bio', type: 'text', nullable: true })
  bio?: string;

  @Column({ name: 'experiencia_deportiva', type: 'text', nullable: true })
  experienciaDeportiva?: string;

  /** Club de origen / ficha previa (ej. "Club Atlético X"). */
  @Column({ name: 'ficha_origen', type: 'varchar', length: 150, nullable: true })
  fichaOrigen?: string;

  // Estado y configuración
  @Column({ 
    name: 'estado_registro', 
    type: 'varchar', 
    length: 20, 
    default: 'pending' 
  })
  estadoRegistro: string;

  @Column({ 
    name: 'profile_completion', 
    type: 'int', 
    default: 0 
  })
  profileCompletion: number; // Porcentaje de 0-100

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'phone_verified', type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt?: Date;

  // IDs de proveedores OAuth
  @Column({ name: 'google_id', type: 'varchar', length: 255, nullable: true, unique: true })
  googleId?: string;

  @Column({ name: 'facebook_id', type: 'varchar', length: 255, nullable: true, unique: true })
  facebookId?: string;

  // Timestamps
  @Column({ name: 'ultimo_login', type: 'timestamp', nullable: true })
  ultimoLogin?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relaciones
  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];

  // @OneToMany(() => UserAuthProvider, (authProvider) => authProvider.user, {
  //   cascade: true, // opcional: persiste authProviders automáticamente al guardar user
  // })
  // authProviders: UserAuthProvider[]; // Comentado temporalmente
}
