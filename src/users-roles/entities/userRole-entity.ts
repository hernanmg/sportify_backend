import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
// import { Role } from 'src/roles/entities/role.entity'; // Removido para evitar dependencia circular
import { User } from 'src/users/entities/user-entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @ManyToOne('User', 'userRoles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: any;

  @Column()
  role_id: number;

  @ManyToOne('Role', 'userRoles', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: any;

  //@ManyToOne(() => User, (user) => user.authProviders, {
  //  onDelete: 'CASCADE',
  //})
 // @JoinColumn({ name: 'user_id' })
 // user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
