import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class OpenTrainingCollectionDto {
  @IsNumber()
  @Min(0.01)
  amountPerPlayer: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
