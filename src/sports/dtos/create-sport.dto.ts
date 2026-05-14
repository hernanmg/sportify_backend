import { IsString, MinLength } from 'class-validator';

export class CreateSportDto {
  @IsString()
  @MinLength(2)
  name: string;
}
