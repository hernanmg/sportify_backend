import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { ConvocationsService, ConvocationDto } from './convocations.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SetConvocationSquadDto } from './dtos/convocation-squad.dto';

@Controller('convocations')
@UseGuards(AuthGuard('jwt'))
export class ConvocationsController {
  constructor(private readonly convocationsService: ConvocationsService) {}

  private async assertManage(
    req: { user: { id: number; role?: string } },
    teamId: number,
  ) {
    await this.convocationsService.assertCanManageConvocation(
      req.user.id,
      teamId,
      req.user.role,
    );
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() convocationDto: ConvocationDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    await this.assertManage(req, convocationDto.teamId);
    return await this.convocationsService.createConvocation(
      convocationDto,
      req.user.id,
    );
  }

  @Get()
  async findAll(
    @Query('teamId') teamId?: string,
    @Query('status') status?: 'sent' | 'draft',
  ) {
    const parsedTeamId = teamId ? parseInt(teamId, 10) : undefined;
    return await this.convocationsService.getConvocations(parsedTeamId, status);
  }

  @Get('upcoming')
  async getUpcoming(@Query('teamId', ParseIntPipe) teamId: number) {
    return await this.convocationsService.getUpcomingConvocations(teamId);
  }

  @Get('my-convocations')
  async getMyConvocations(@Request() req: { user: { id: number } }) {
    return await this.convocationsService.getUserConvocations(req.user.id);
  }

  @Get('pending-responses')
  async getPendingResponses(@Request() req: { user: { id: number } }) {
    return await this.convocationsService.getPendingResponses(req.user.id);
  }

  @Get('player-history')
  async playerHistory(
    @Query('teamId', ParseIntPipe) teamId: number,
    @Query('userId', ParseIntPipe) userId: number,
  ) {
    return await this.convocationsService.getPlayerConvocationHistory(
      teamId,
      userId,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.convocationsService.findOne(id);
  }

  @Get(':id/eligible-roster')
  async eligibleRoster(@Param('id', ParseIntPipe) id: number) {
    return await this.convocationsService.getEligibleRoster(id);
  }

  @Get(':id/stats')
  async getStats(@Param('id', ParseIntPipe) id: number) {
    return await this.convocationsService.getConvocationStats(id);
  }

  @Get(':id/export')
  async export(@Param('id', ParseIntPipe) id: number) {
    return await this.convocationsService.getConvocationExport(id);
  }

  @Get(':id/responses')
  async getResponses(@Param('id', ParseIntPipe) id: number) {
    return await this.convocationsService.getConvocationResponses(id);
  }

  @Put(':id/squad')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  @HttpCode(HttpStatus.OK)
  async setSquad(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetConvocationSquadDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    const conv = await this.convocationsService.findOne(id);
    await this.assertManage(req, conv.teamId);
    return await this.convocationsService.setSquad(id, dto, req.user.id);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  @HttpCode(HttpStatus.OK)
  async send(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    const conv = await this.convocationsService.findOne(id);
    await this.assertManage(req, conv.teamId);
    return await this.convocationsService.sendConvocation(id);
  }

  @Post(':id/resend')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  @HttpCode(HttpStatus.OK)
  async resend(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    const conv = await this.convocationsService.findOne(id);
    await this.assertManage(req, conv.teamId);
    await this.convocationsService.resendConvocation(id);
    return { message: 'Convocatoria reenviada exitosamente' };
  }

  @Post(':id/participants/:userId/fee-override')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  async feeOverride(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { reason?: string },
    @Request() req: { user: { id: number; role?: string } },
  ) {
    const conv = await this.convocationsService.findOne(id);
    await this.assertManage(req, conv.teamId);
    return await this.convocationsService.overrideParticipantFee(
      id,
      userId,
      req.user.id,
      body?.reason,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: Partial<ConvocationDto>,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    const conv = await this.convocationsService.findOne(id);
    await this.assertManage(req, conv.teamId);
    return await this.convocationsService.updateConvocation(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    const conv = await this.convocationsService.findOne(id);
    await this.assertManage(req, conv.teamId);
    await this.convocationsService.deleteConvocation(id);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param('id', ParseIntPipe) convocationId: number,
    @Body() body: { notes?: string },
    @Request() req: { user: { id: number } },
  ) {
    return await this.convocationsService.confirmParticipation(
      convocationId,
      req.user.id,
      body.notes,
    );
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  async decline(
    @Param('id', ParseIntPipe) convocationId: number,
    @Body() body: { notes?: string },
    @Request() req: { user: { id: number } },
  ) {
    return await this.convocationsService.declineParticipation(
      convocationId,
      req.user.id,
      body.notes,
    );
  }

  @Post('official-match')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  @HttpCode(HttpStatus.CREATED)
  async createOfficialMatch(
    @Body() convocationDto: ConvocationDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    await this.assertManage(req, convocationDto.teamId);
    return await this.convocationsService.createConvocation(
      { ...convocationDto, isOfficialMatch: true },
      req.user.id,
    );
  }

  @Post('friendly-match')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  @HttpCode(HttpStatus.CREATED)
  async createFriendlyMatch(
    @Body() convocationDto: ConvocationDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    await this.assertManage(req, convocationDto.teamId);
    return await this.convocationsService.createConvocation(
      { ...convocationDto, isOfficialMatch: false },
      req.user.id,
    );
  }
}
