import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateRecurringQuotaDto {
  @IsInt()
  teamId: number;

  @IsInt()
  @Min(2000)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsInt()
  @Min(1)
  @Max(24)
  monthCount: number;

  @IsOptional()
  @IsString()
  season?: string;
}
