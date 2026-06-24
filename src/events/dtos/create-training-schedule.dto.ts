import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateTrainingScheduleDto {
  @IsInt()
  teamId: number;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;

  @IsInt()
  @Min(0)
  @Max(59)
  minute: number;

  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categoryIds?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(26)
  weeksAhead?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
