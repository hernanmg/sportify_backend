import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { FeeChargeType } from '../finance.enums';

export class CreateFeeBatchDto {
  @IsNumber()
  teamId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  concept: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  season?: string;

  @IsOptional()
  @IsEnum(FeeChargeType)
  type?: FeeChargeType;
}
