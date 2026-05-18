import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export enum TeamOnboardingMode {
  CREATE = 'create',
  JOIN = 'join',
  SKIP = 'skip',
}

export class TeamOnboardingDto {
  @IsEnum(TeamOnboardingMode)
  mode: TeamOnboardingMode;

  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsNumber()
  sportId?: number;

  @IsOptional()
  @IsArray()
  categoryIds?: number[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  inviteCode?: string;
}

export class JoinTeamDto {
  @IsNotEmpty()
  @IsString()
  inviteCode: string;

  @IsOptional()
  @IsArray()
  categoryIds?: number[];
}

export class CreateTeamInviteDto {
  @IsOptional()
  @IsArray()
  categoryIds?: number[];
}
