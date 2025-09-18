// import { User } from 'src/users/entities/user-entity'; // Removido para evitar dependencia circular
import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity('user_auth_providers')
@Index(['user_id', 'provider'], { unique: true })
@Index(['provider', 'providerId'], { unique: true })
export class UserAuthProvider {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ 
    name: 'provider', 
    type: 'varchar', 
    length: 20 
  })
  provider: string; // 'email', 'google', 'facebook', 'apple'

  @Column({ 
    name: 'provider_id', 
    type: 'varchar', 
    length: 100,
    nullable: false
    })
  providerId: string; // ID del proveedor externo (para OAuth)

  @Column({ 
    name: 'provider_email', 
    type: 'varchar', 
    length: 100, 
    nullable: true 
  })
  providerEmail?: string; // Email del proveedor (puede diferir del email principal)

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary: boolean; // Método principal de autenticación

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // @ManyToOne(() => User, (user) => user.authProviders, {
  //   onDelete: 'CASCADE',
  // })
  // @JoinColumn({ name: 'user_id' })
  // user: User; // Comentado temporalmente
}
