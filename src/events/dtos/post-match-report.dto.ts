import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePostMatchReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;
}

