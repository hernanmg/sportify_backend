import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/roles-permissions/entities/role.entity';
import { User } from 'src/users/entities/user-entity';
// import { Repository } from 'typeorm';
// import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UsersService {
  constructor() {} // @InjectRepository(Role) private roleRepository: Repository<Role>, // @InjectRepository(User) private userRepository: Repository<User>,

  private roles: Role[] = [
    { id: 1, name: 'admin', permissions: [], users: [] },
    { id: 2, name: 'user', permissions: [], users: [] },
  ];

  private users: User[] = [
    {
      id: 1,
      name: 'Admin User',
      email: 'admin@example.com',
      password: '$2b$10$FEXUUCLIlPJ109U.DJb4j.74V9qgxqxMcNiCslJIk0suC6RdmWAXi', // "password123"
      roles: [this.roles[0]],
      userName: 'pepa',
    },
    {
      id: 2,
      name: 'Regular User',
      email: 'user@example.com',
      password: '$2b$10$FEXUUCLIlPJ109U.DJb4j.74V9qgxqxMcNiCslJIk0suC6RdmWAXi', // "password123"
      roles: [this.roles[1]],
      userName: 'pepapig',
    },
  ];

  async findByUserName(userName: string): Promise<User | undefined> {
    console.log(userName);
    return this.users.find((user) => user.userName === userName);
  }

  // async createUser(dto: CreateUserDto): Promise<User> {
  //   const roles = await this.roleRepository.findByIds(dto.roles);
  //   const user = this.userRepository.create({ ...dto, roles });
  //   return this.userRepository.save(user);
  // }
  async createUser(dto: any): Promise<User> {
    const role = this.roles.find((r) => dto.roles.includes(r.name));
    const user: User = {
      id: this.users.length + 1,
      name: dto.name,
      email: dto.email,
      password: await this.hashPassword(dto.password),
      roles: [role],
      userName: 'pepapig',
    };
    this.users.push(user);
    return user;
  }
  async findByEmail(email: string): Promise<User | undefined> {
    return this.users.find((user) => user.email === email);
  }

  async findAll(): Promise<User[]> {
    return this.users; //this.userRepository.find({ relations: ['roles'] });
  }
  private async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcrypt');
    return bcrypt.hash(password, 10);
  }
}
