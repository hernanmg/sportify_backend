import { IsNotEmpty, IsString, IsDateString, IsInt } from 'class-validator';

export class CreateEventDto {
  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsDateString()
  timestamp: string;

  @IsNotEmpty()
  @IsInt()
  matchId: number;
}
