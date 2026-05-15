import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { LedgerCategory } from '../finance.enums';

export class CreateTeamExpenseDto {
  @IsNumber()
  teamId: number;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @IsOptional()
  @IsEnum(LedgerCategory)
  category?: LedgerCategory;
}
