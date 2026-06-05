import { IsNotEmpty, IsNumber } from 'class-validator';

export class LinkRosterPlayerDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;
}
