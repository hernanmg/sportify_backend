import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ImpedimentType } from '../eligibility.enums';

export class UpsertImpedimentDto {
  @IsInt()
  userId: number;

  @IsEnum(ImpedimentType)
  impedimentType: ImpedimentType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationDays?: number;
}
