import {
  IsArray,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class MatchVoteItemDto {
  @IsInt()
  ratedUserId: number;

  @IsInt()
  @Min(1)
  @Max(10)
  score: number;
}

export class SubmitMatchVotesDto {
  @IsArray()
  @ValidateNested({ each: true })
  ratings: MatchVoteItemDto[];
}

export class SetOfficialMatchRatingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  ratings: MatchVoteItemDto[];

  @IsOptional()
  @IsInt()
  playerOfMatchUserId?: number;
}
