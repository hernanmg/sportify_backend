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
import { TeamReportsService } from './team-reports.service';
import { TeamSponsorsService } from './team-sponsors.service';
import { TeamAuditService } from './team-audit.service';
import { TeamCalendarService } from './team-calendar.service';
import { AuthGuard } from '@nestjs/passport';
import {
  TeamOnboardingDto,
  JoinTeamDto,
  CreateTeamInviteDto,
} from './dtos/team-onboarding.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamSocialGuest } from '../events/entities/team-social-guest.entity';
import { TeamMemberRole } from './entities/team-member.entity';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly teamDashboardService: TeamDashboardService,
    private readonly teamReportsService: TeamReportsService,
    private readonly teamSponsorsService: TeamSponsorsService,
    private readonly teamAuditService: TeamAuditService,
    private readonly teamCalendarService: TeamCalendarService,
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
    @Request() req: { user: { id: number; role?: string } },
    @Body() createTeamData: any,
  ) {
    return this.teamsService.createWithCreator(
      req.user.id,
      createTeamData,
      req.user.role,
    );
  }

  @Post(':id/claim-admin')
  @UseGuards(AuthGuard('jwt'))
  claimAsAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.teamsService.claimTeamAsAdmin(
      req.user.id,
      id,
      req.user.role,
    );
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

  @Get(':teamId/calendar')
  @UseGuards(AuthGuard('jwt'))
  getTeamCalendar(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('kinds') kinds: 'all' | 'events' | 'birthdays' = 'all',
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.teamCalendarService.getTeamCalendar(
      teamId,
      req.user.id,
      req.user.role,
      from,
      to,
      kinds,
    );
  }

  @Patch(':teamId/birthday-notification-hour')
  @UseGuards(AuthGuard('jwt'))
  updateBirthdayNotificationHour(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() body: { birthdayNotificationHour: number },
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.teamsService.updateBirthdayNotificationHour(
      teamId,
      req.user.id,
      req.user.role,
      body.birthdayNotificationHour,
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

  @Get(':teamId/reports')
  @UseGuards(AuthGuard('jwt'))
  getReports(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('season') season?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const parsedCategoryId = categoryId
      ? parseInt(categoryId, 10)
      : undefined;
    return this.teamReportsService.getSummary(
      teamId,
      season,
      Number.isNaN(parsedCategoryId) ? undefined : parsedCategoryId,
    );
  }

  @Get(':teamId/members')
  @UseGuards(AuthGuard('jwt'))
  listMembers(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.teamsService.listTeamMembers(teamId);
  }

  @Patch(':teamId/members/:userId/role')
  @UseGuards(AuthGuard('jwt'))
  updateMemberRole(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { role: TeamMemberRole },
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.teamsService.updateTeamMemberRole(
      teamId,
      userId,
      body.role,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':teamId/sponsors')
  @UseGuards(AuthGuard('jwt'))
  listSponsors(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.teamSponsorsService.findByTeam(teamId);
  }

  @Post(':teamId/sponsors')
  @UseGuards(AuthGuard('jwt'))
  createSponsor(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Request() req: { user: { id: number } },
    @Body()
    body: {
      name: string;
      description?: string;
      logoUrl?: string;
      website?: string;
      amountContributed?: number;
    },
  ) {
    return this.teamSponsorsService.create(teamId, body, req.user.id);
  }

  @Patch(':teamId/sponsors/:sponsorId')
  @UseGuards(AuthGuard('jwt'))
  updateSponsor(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('sponsorId', ParseIntPipe) sponsorId: number,
    @Body()
    body: {
      name?: string;
      description?: string;
      logoUrl?: string;
      website?: string;
      amountContributed?: number;
    },
  ) {
    return this.teamSponsorsService.update(sponsorId, teamId, body);
  }

  @Delete(':teamId/sponsors/:sponsorId')
  @UseGuards(AuthGuard('jwt'))
  removeSponsor(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('sponsorId', ParseIntPipe) sponsorId: number,
  ) {
    return this.teamSponsorsService.remove(sponsorId, teamId);
  }

  @Get(':teamId/audit-log')
  @UseGuards(AuthGuard('jwt'))
  getAuditLog(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Math.min(parseInt(limit, 10) || 80, 200) : 80;
    return this.teamAuditService.findByTeam(teamId, n);
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
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: any,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.teamsService.update(
      id,
      updateData,
      req.user.id,
      req.user.role,
    );
  }

  @Patch(':id/categories')
  @UseGuards(AuthGuard('jwt'))
  setCategories(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { categoryIds: number[] },
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.teamsService.update(
      id,
      { categoryIds: body.categoryIds ?? [] },
      req.user.id,
      req.user.role,
    );
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.remove(id);
  }
}
