export class User {
  id: number;
  name: string = '';
  userName: string = '';
  password: string = '';

  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }
}
