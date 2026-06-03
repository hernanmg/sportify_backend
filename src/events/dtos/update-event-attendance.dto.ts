import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const ATTENDANCE_STATUSES = ['present', 'absent', 'justified'] as const;
export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number];

export class AttendanceItemDto {
  @IsInt()
  userId: number;

  @IsIn(ATTENDANCE_STATUSES)
  status: AttendanceStatusValue;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEventAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceItemDto)
  items: AttendanceItemDto[];
}
