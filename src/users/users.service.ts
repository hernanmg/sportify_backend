import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
// import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user-entity';
import { Repository } from 'typeorm';
// import { Repository } from 'typeorm';
// import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  async findOne(id: number): Promise<User> {
    return await this.userRepository.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.role'],
    });
  }
  async findByName(username: string): Promise<User> {
    return await this.userRepository.findOne({
      where: { username },
      relations: ['userRoles', 'userRoles.role'],
    });
  }
  async findByEmail(email: string): Promise<User> {
    return await this.userRepository.findOne({
      where: { email },
      relations: ['userRoles', 'userRoles.role'],
    });
  }
  async update(id: number, data: Partial<User>): Promise<User> {
    await this.userRepository.update(id, data);
    return this.findOne(id);
  }

  async delete(id: number): Promise<void> {
    await this.userRepository.delete(id);
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
}
