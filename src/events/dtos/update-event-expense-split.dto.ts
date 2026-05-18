import { IsEnum } from 'class-validator';
import { EventExpenseSplitMode } from '../event-expense.enums';

export class UpdateEventExpenseSplitDto {
  @IsEnum(EventExpenseSplitMode)
  splitMode: EventExpenseSplitMode;
}
