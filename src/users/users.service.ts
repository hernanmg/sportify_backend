import { Injectable } from '@nestjs/common';
import { User } from 'src/models/user';

@Injectable()
export class UsersService {
  private users: User[] = [
    { id: 1, name: 'John Doe', userName: 'email', password: 'password' },
    {
      id: 2,
      name: 'Jane Smith',
      userName: 'janesmith',
      password: 'password456',
    },
  ];

  async findByUserName(userName: string): Promise<User | undefined> {
    console.log(userName);
    return this.users.find((user) => user.userName === userName);
  }
}
