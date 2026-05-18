import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AddSocialGuestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;
}
