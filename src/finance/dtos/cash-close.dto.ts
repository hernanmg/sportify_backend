import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CashCloseDto {
  @IsOptional()
  @IsBoolean()
  /** Por defecto true: las cuotas pendientes quedan como saldo a cobrar (negativo). */
  carryPendingQuotas?: boolean;

  @IsOptional()
  @IsBoolean()
  /** Por defecto true: deja la caja en 0 con un asiento de ajuste. */
  resetCashToZero?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  season?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
