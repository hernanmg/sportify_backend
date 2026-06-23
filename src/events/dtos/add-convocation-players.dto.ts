import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class AddConvocationPlayersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  userIds: number[];
}
