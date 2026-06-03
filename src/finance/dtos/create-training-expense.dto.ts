import { IsInt, IsNumber, IsString, Min } from 'class-validator';

export class CreateTrainingExpenseDto {
  @IsInt()
  teamId: number;

  @IsInt()
  sportEventId: number;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  description: string;
}
