import { IsNotEmpty, IsOptional, IsEnum, IsNumber, IsString, IsBoolean, IsDateString, IsObject } from 'class-validator';
import { NotificationType, NotificationPriority } from '../entities/notification.entity';

export class CreateNotificationDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsOptional()
  @IsNumber()
  teamId?: number;

  @IsOptional()
  @IsNumber()
  eventId?: number;

  @IsOptional()
  @IsNumber()
  sportEventId?: number;

  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsObject()
  data?: any;

  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

export class CreateBulkNotificationDto {
  @IsNotEmpty()
  userIds: number[];

  @IsOptional()
  @IsNumber()
  teamId?: number;

  @IsOptional()
  @IsNumber()
  eventId?: number;

  @IsOptional()
  @IsNumber()
  sportEventId?: number;

  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsObject()
  data?: any;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}