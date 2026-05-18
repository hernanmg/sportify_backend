import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class AddEventExpenseItemDto {
  @IsString()
  @MaxLength(255)
  description: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsNumber()
  paidByUserId?: number;
}
