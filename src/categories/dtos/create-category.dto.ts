import { IsString, IsOptional, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  sportId: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  ageMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  ageMax?: number;

  @IsOptional()
  @IsString()
  gender?: string; // 'masculino', 'femenino', 'mixto'

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @IsInt()
  sortOrder?: number = 0;
}
