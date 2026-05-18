import { IsNotEmpty, IsNumber, IsString, IsOptional, IsBoolean, IsDateString, IsIn } from 'class-validator';

export class CreateRosterDto {
  @IsNotEmpty()
  @IsNumber()
  playerId: number;

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
