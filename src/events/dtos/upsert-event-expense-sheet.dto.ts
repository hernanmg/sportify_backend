import { IsArray, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { EventExpenseSplitMode } from '../event-expense.enums';

export class UpsertEventExpenseSheetDto {
  @IsEnum(EventExpenseSplitMode)
  splitMode: EventExpenseSplitMode;

  @IsNumber()
  payerUserId: number;

  @IsArray()
  items: Array<{
    description: string;
    amount: number;
  }>;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  participantUserIds?: number[];

  @IsOptional()
  @IsArray()
  shares?: Array<{
    userId: number;
    amount: number;
  }>;
}
