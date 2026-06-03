import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamDashboardService } from './team-dashboard.service';
import { AuthGuard } from '@nestjs/passport';
import {
  TeamOnboardingDto,
  JoinTeamDto,
  CreateTeamInviteDto,
} from './dtos/team-onboarding.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamSocialGuest } from '../events/entities/team-social-guest.entity';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly teamDashboardService: TeamDashboardService,
    @InjectRepository(TeamSocialGuest)
    private readonly teamSocialGuestRepository: Repository<TeamSocialGuest>,
  ) {}

  @Post('onboarding')
  @UseGuards(AuthGuard('jwt'))
  completeOnboarding(
    @Request() req: { user: { id: number } },
    @Body() dto: TeamOnboardingDto,
  ) {
    return this.teamsService.completeOnboarding(req.user.id, dto);
  }

  @Post('join')
  @UseGuards(AuthGuard('jwt'))
  joinTeam(
    @Request() req: { user: { id: number } },
    @Body() dto: JoinTeamDto,
  ) {
    return this.teamsService.joinWithCode(req.user.id, dto);
  }

  @Get('invites/:code')
  previewInvite(@Param('code') code: string) {
    return this.teamsService.previewInvite(code);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(
    @Request() req: { user: { id: number } },
    @Body() createTeamData: any,
  ) {
    return this.teamsService.create(createTeamData);
  }

  @Get()
  findAll() {
    return this.teamsService.findAll();
  }

  @Get('mine')
  @UseGuards(AuthGuard('jwt'))
  findMyTeams(@Request() req: { user: { id: number } }) {
    return this.teamsService.findMyTeams(req.user.id);
  }

  @Get(':teamId/admin-panel')
  @UseGuards(AuthGuard('jwt'))
  getAdminPanel(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.teamDashboardService.getDashboard(
      teamId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('search')
  searchTeams(@Query('q') query: string) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    return this.teamsService.searchTeams(query.trim());
  }

  @Get('sport/:sportId')
  findBySport(@Param('sportId', ParseIntPipe) sportId: number) {
    return this.teamsService.findBySport(sportId);
  }

  @Get('football')
  getFootballTeams() {
    return this.teamsService.getFootballTeams();
  }

  @Post('find-or-create')
  @UseGuards(AuthGuard('jwt'))
  findOrCreateByName(
    @Request() req: { user: { id: number } },
    @Body() data: { name: string; sportId: number; categoryId?: number },
  ) {
    return this.teamsService.findOrCreateByName(
      data.name,
      data.sportId,
      data.categoryId,
      req.user.id,
    );
  }

  @Get(':id/social-guests')
  @UseGuards(AuthGuard('jwt'))
  async listSocialGuests(@Param('id', ParseIntPipe) teamId: number) {
    const guests = await this.teamSocialGuestRepository.find({
      where: { teamId },
      order: { displayName: 'ASC' },
    });
    return guests.map((g) => ({
      id: g.id,
      teamId: g.teamId,
      displayName: g.displayName,
      phone: g.phone,
      email: g.email,
      userId: g.userId,
    }));
  }

  @Get(':id/invites')
  @UseGuards(AuthGuard('jwt'))
  listInvites(
    @Param('id', ParseIntPipe) teamId: number,
    @Request() req: { user: { id: number } },
  ) {
    return this.teamsService.listInvitesForTeam(teamId, req.user.id);
  }

  @Post(':id/invites')
  @UseGuards(AuthGuard('jwt'))
  createInvite(
    @Param('id', ParseIntPipe) teamId: number,
    @Request() req: { user: { id: number } },
    @Body() body: CreateTeamInviteDto,
  ) {
    return this.teamsService.createInvite(
      teamId,
      req.user.id,
      body.categoryIds,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id', ParseIntPipe) id: number, @Body() updateData: any) {
    return this.teamsService.update(id, updateData);
  }

  @Patch(':id/categories')
  @UseGuards(AuthGuard('jwt'))
  setCategories(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { categoryIds: number[] },
  ) {
    return this.teamsService.update(id, { categoryIds: body.categoryIds ?? [] });
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.remove(id);
  }
}
