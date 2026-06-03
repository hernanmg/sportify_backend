import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GenerateMonthlyQuotaDto {
  @IsInt()
  teamId: number;

  @IsInt()
  @Min(2000)
  year: number;

  @IsInt()
  @Min(1)
  month: number;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  season?: string;
}
