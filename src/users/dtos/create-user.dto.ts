import { IsNotEmpty, IsEmail, IsArray } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsArray()
  roles: string[]; // Lista de nombres de roles
}
