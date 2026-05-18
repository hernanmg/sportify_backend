import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class FeeOverrideItemDto {
  @IsInt()
  userId: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SetConvocationSquadDto {
  @IsArray()
  @IsInt({ each: true })
  convokedUserIds: number[];

  @IsOptional()
  @IsArray()
  feeOverrides?: FeeOverrideItemDto[];
}
