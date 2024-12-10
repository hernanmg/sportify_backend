import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreateMatchDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsNotEmpty()
  @IsString()
  location: string;
}
