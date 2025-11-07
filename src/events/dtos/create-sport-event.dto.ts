import { IsNotEmpty, IsOptional, IsEnum, IsNumber, IsString, IsBoolean, IsDateString, IsArray, Min, Max } from 'class-validator';
import { SportEventType, SportEventStatus } from '../entities/sport-event.entity';
import { ParticipantRole } from '../entities/event-participant.entity';

export class CreateSportEventDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsEnum(SportEventType)
  type: SportEventType;

  @IsOptional()
  @IsEnum(SportEventStatus)
  status?: SportEventStatus;

  @IsNotEmpty()
  @IsDateString()
  eventDate: string;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480) // Máximo 8 horas
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsNotEmpty()
  @IsNumber()
  teamId: number;

  @IsNotEmpty()
  @IsNumber()
  createdBy: number;

  // Para partidos
  @IsOptional()
  @IsString()
  opponentName?: string;

  @IsOptional()
  @IsBoolean()
  isHomeMatch?: boolean;

  @IsOptional()
  @IsBoolean()
  isOfficialMatch?: boolean;

  // Para eventos sociales
  @IsOptional()
  @IsBoolean()
  hasExpenses?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  // Configuración de participación
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsBoolean()
  requiresConfirmation?: boolean;

  @IsOptional()
  @IsDateString()
  confirmationDeadline?: string;

  @IsOptional()
  @IsBoolean()
  requiresPaymentUpToDate?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  metadata?: any;

  // Lista de participantes a invitar
  @IsOptional()
  @IsArray()
  participantIds?: number[];

  // Configuración de comportamiento
  @IsOptional()
  @IsBoolean()
  autoInviteParticipants?: boolean;

  @IsOptional()
  @IsBoolean()
  sendNotifications?: boolean;
}

export class UpdateSportEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SportEventStatus)
  status?: SportEventStatus;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  opponentName?: string;

  @IsOptional()
  @IsBoolean()
  isHomeMatch?: boolean;

  @IsOptional()
  @IsBoolean()
  isOfficialMatch?: boolean;

  @IsOptional()
  @IsBoolean()
  hasExpenses?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsBoolean()
  requiresConfirmation?: boolean;

  @IsOptional()
  @IsDateString()
  confirmationDeadline?: string;

  @IsOptional()
  @IsBoolean()
  requiresPaymentUpToDate?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  metadata?: any;
}

export class AddParticipantDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsOptional()
  @IsEnum(ParticipantRole)
  role?: ParticipantRole;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  playingPosition?: string;
}

export class UpdateParticipantResponseDto {
  @IsNotEmpty()
  @IsEnum(['confirmed', 'declined'])
  status: 'confirmed' | 'declined';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  playingPosition?: string;
}
