import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from 'src/roles-permissions/entities/role.entity';
import { User } from 'src/users/entities/user-entity';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dtos/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Role) private roleRepository: Repository<Role>,
  ) {}

  private users: User[] = [
    {
      id: 1,
      name: 'John Doe',
      userName: 'email',
      password: 'password',
      email: '',
      roles: [],
    },
    {
      id: 2,
      name: 'Jane Smith',
      userName: 'janesmith',
      password: 'password456',
      email: '',
      roles: [],
    },
  ];

  async findByUserName(userName: string): Promise<User | undefined> {
    console.log(userName);
    return this.users.find((user) => user.userName === userName);
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    const roles = await this.roleRepository.findByIds(dto.roles);
    const user = this.userRepository.create({ ...dto, roles });
    return this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({ relations: ['roles'] });
  }
}
