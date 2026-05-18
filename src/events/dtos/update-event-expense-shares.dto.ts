import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export class ExpenseShareAmountDto {
  @IsNumber()
  userId: number;

  @IsNumber()
  @IsPositive()
  amount: number;
}

export class UpdateEventExpenseSharesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  shares: ExpenseShareAmountDto[];
}
