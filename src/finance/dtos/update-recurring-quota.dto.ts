import { IsNumber, Min } from 'class-validator';

export class UpdateRecurringQuotaDto {
  @IsNumber()
  @Min(0.01)
  amount: number;
}
