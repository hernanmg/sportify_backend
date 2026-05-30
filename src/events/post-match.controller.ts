import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import {
  UpdateMatchAttendanceDto,
  UpdateMatchLineupDto,
  UpdateMatchStatsDto,
  CompleteMatchDto,
} from './dtos/post-match-update.dto';
import { UpdatePostMatchReportDto } from './dtos/post-match-report.dto';

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

  @Patch('attendance')
  @HttpCode(HttpStatus.OK)
  async updateAttendance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMatchAttendanceDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.postMatchService.updateAttendance(
      id,
      req.user.id,
      dto,
      req.user.role,
    );
  }

  @Patch('lineup')
  @HttpCode(HttpStatus.OK)
  async updateLineup(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMatchLineupDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.postMatchService.updateLineup(
      id,
      req.user.id,
      dto,
      req.user.role,
    );
  }

  @Patch('stats')
  @HttpCode(HttpStatus.OK)
  async updateStats(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMatchStatsDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.postMatchService.updateStats(
      id,
      req.user.id,
      dto,
      req.user.role,
    );
  }

  @Patch('report')
  @HttpCode(HttpStatus.OK)
  async updateReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostMatchReportDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.postMatchService.updateReport(
      id,
      req.user.id,
      dto,
      req.user.role,
    );
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async completeMatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteMatchDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.postMatchService.completeMatch(
      id,
      req.user.id,
      dto,
      req.user.role,
    );
  }
}
