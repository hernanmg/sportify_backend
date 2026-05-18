import { IsBoolean } from 'class-validator';

export class UpdateParticipantExpenseInclusionDto {
  @IsBoolean()
  includedInExpenseSplit: boolean;
}
