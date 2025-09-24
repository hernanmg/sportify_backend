import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Role } from 'src/roles/entities/role.entity';

@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'role_id' })
  roleId: number;

  @ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
