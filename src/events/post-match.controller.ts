import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PostMatchService } from './post-match.service';
import {
  SubmitMatchVotesDto,
  SetOfficialMatchRatingsDto,
} from './dtos/submit-match-votes.dto';

@Controller('sport-events/:id/post-match')
@UseGuards(AuthGuard('jwt'))
export class PostMatchController {
  constructor(private readonly postMatchService: PostMatchService) {}

  @Get()
  async getPostMatch(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.postMatchService.getPostMatch(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Post('votes')
  @HttpCode(HttpStatus.OK)
  async submitVotes(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitMatchVotesDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.postMatchService.submitVotes(
      id,
      req.user.id,
      dto,
      req.user.role,
    );
  }

  @Put('official')
  @HttpCode(HttpStatus.OK)
  async setOfficial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetOfficialMatchRatingsDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.postMatchService.setOfficialRatings(
      id,
      req.user.id,
      dto,
      req.user.role,
    );
  }

  @Post('close-voting')
  @HttpCode(HttpStatus.OK)
  async closeVoting(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.postMatchService.closeVoting(
      id,
      req.user.id,
      req.user.role,
    );
  }
}
