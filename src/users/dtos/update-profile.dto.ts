import { IsString, IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsString()
  pais?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  experienciaDeportiva?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  profileCompletion?: number;

  @IsOptional()
  @IsString()
  estadoRegistro?: string;
}
