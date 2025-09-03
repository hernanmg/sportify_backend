// export class User {
//   id: number;
//   name: string = '';
//   userName: string = '';
//   password: string = '';

//   constructor(init?: Partial<User>) {
//     Object.assign(this, init);
//   }
// }

// Importaciones removidas para evitar dependencias circulares
// import { Notification } from 'src/notifications/entities/notification-entity';
// import { Player } from 'src/players/entities/player-entity';
// import { UserRole } from 'src/users-roles/entities/userRole-entity';
import { UserAuthProvider } from 'src/auth/entities/user-auth-provider.entity';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

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

  // Estado y configuración
  @Column({ 
    name: 'estado_registro', 
    type: 'varchar', 
    length: 20, 
    default: 'pending' 
  })
  estadoRegistro: string;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'phone_verified', type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Timestamps
  @Column({ name: 'ultimo_login', type: 'timestamp', nullable: true })
  ultimoLogin?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relaciones
  @OneToMany('UserRole', 'user')
  userRoles: any[];

  @OneToMany('Player', 'user')
  players: any[];

  @OneToMany('Notification', 'user')
  notifications: any[];

  @OneToMany(() => UserAuthProvider, (authProvider) => authProvider.user, {
    cascade: true, // opcional: persiste authProviders automáticamente al guardar user
  })
  authProviders: UserAuthProvider[];
}
