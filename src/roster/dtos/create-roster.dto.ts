import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsIn,
  ValidateIf,
} from 'class-validator';

export class CreateRosterDto {
  /** ID de usuario registrado (legacy: también aceptado como user id al crear player). */
  @ValidateIf((o) => !o.guestFirstName && !o.guestLastName)
  @IsNotEmpty()
  @IsNumber()
  playerId?: number;

  /** Jugador sin app: nombre de pila. */
  @ValidateIf((o) => !o.playerId)
  @IsNotEmpty()
  @IsString()
  guestFirstName?: string;

  /** Jugador sin app: apellido. */
  @ValidateIf((o) => !o.playerId)
  @IsNotEmpty()
  @IsString()
  guestLastName?: string;

  @IsNotEmpty()
  @IsNumber()
  teamId: number;

  @IsNotEmpty()
  @IsNumber()
  jerseyNumber: number;

  @IsOptional()
  @IsDateString()
  medicalCertificateDate?: string;

  @IsOptional()
  @IsDateString()
  medicalCertificateExpires?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsNotEmpty()
  @IsString()
  @IsIn(['goalkeeper', 'defender', 'midfielder', 'forward', 'player'])
  position: 'goalkeeper' | 'defender' | 'midfielder' | 'forward' | 'player';

  @IsNotEmpty()
  @IsString()
  documentNumber: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsNotEmpty()
  @IsString()
  season: string;

  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @IsNotEmpty()
  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'approved', 'expired', 'rejected'])
  medicalStatus?: 'pending' | 'approved' | 'expired' | 'rejected';

  @IsOptional()
  @IsString()
  notes?: string;
}
