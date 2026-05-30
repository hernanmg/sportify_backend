import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BoardStrokePointDto {
  @IsNumber()
  @Min(0)
  x: number;

  @IsNumber()
  @Min(0)
  y: number;
}

export class BoardStrokeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoardStrokePointDto)
  points: BoardStrokePointDto[];

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  width?: number;
}

export class CreateTacticalBoardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  formation?: string;

  @IsOptional()
  lineupSlots?: Record<string, { x: number; y: number }>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoardStrokeDto)
  boardStrokes?: BoardStrokeDto[];
}

export class UpdateTacticalBoardDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  formation?: string;

  @IsOptional()
  lineupSlots?: Record<string, { x: number; y: number }>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BoardStrokeDto)
  boardStrokes?: BoardStrokeDto[];
}
