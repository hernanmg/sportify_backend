// export class User {
//   id: number;
//   name: string = '';
//   userName: string = '';
//   password: string = '';

//   constructor(init?: Partial<User>) {
//     Object.assign(this, init);
//   }
// }

import { Notification } from 'src/notifications/entities/notification-entity';
import { Player } from 'src/players/entities/player-entity';
import { UserRole } from 'src/users-roles/entities/userRole-entity';
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

  @Column({ name: 'username', type: 'varchar', length: '50', unique: true })
  username: string;

  @Column({ name: 'email', type: 'varchar', length: '100', unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  userRoles: UserRole[];

  @OneToMany(() => Player, (player) => player.user)
  players: Player[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];
}
