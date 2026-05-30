import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ParticipantRole } from '../entities/event-participant.entity';

export class AttendanceItemDto {
  @IsInt()
  userId: number;

  @IsBoolean()
  attended: boolean;
}

export class UpdateMatchAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  items: AttendanceItemDto[];
}

export class LineupItemDto {
  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  playingPosition?: string;

  @IsOptional()
  @IsEnum(ParticipantRole)
  role?: ParticipantRole;

  @IsOptional()
  @IsBoolean()
  isStarter?: boolean;
}

export class UpdateMatchLineupDto {
  @IsArray()
  @ValidateNested({ each: true })
  items: LineupItemDto[];

  @IsOptional()
  @IsString()
  formation?: string;

  @IsOptional()
  lineupSlots?: Record<string, { x: number; y: number }>;

  @IsOptional()
  @IsArray()
  boardStrokes?: Array<{
    points: { x: number; y: number }[];
    color?: string;
    width?: number;
  }>;
}

export class PlayerStatsItemDto {
  @IsInt()
  userId: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  goals?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  assists?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  yellowCards?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  redCards?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  minutesPlayed?: number;
}

export class UpdateMatchStatsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  teamScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  opponentScore?: number;

  @IsArray()
  @ValidateNested({ each: true })
  players: PlayerStatsItemDto[];
}

export class CompleteMatchDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  teamScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  opponentScore?: number;
}
