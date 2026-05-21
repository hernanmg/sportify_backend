import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlayerEligibilityService } from './player-eligibility.service';
import { PlayerStatusService } from './player-status.service';
import { UpsertImpedimentDto } from './dtos/upsert-impediment.dto';

@Controller('teams/:teamId/player-status')
@UseGuards(AuthGuard('jwt'))
export class PlayerStatusController {
  constructor(
    private readonly eligibilityService: PlayerEligibilityService,
    private readonly playerStatusService: PlayerStatusService,
  ) {}

  @Get()
  async getEligibility(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('season') season?: string,
    @Query('orangeDays') orangeDays?: string,
  ) {
    const threshold = orangeDays ? parseInt(orangeDays, 10) : 7;
    return this.eligibilityService.getTeamEligibility(
      teamId,
      season,
      Number.isFinite(threshold) ? threshold : 7,
    );
  }

  @Get('impediments')
  async listImpediments(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('userId') userId?: string,
  ) {
    const uid = userId ? parseInt(userId, 10) : undefined;
    return this.playerStatusService.listImpediments(teamId, uid);
  }

  @Post('impediments')
  async createImpediment(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: UpsertImpedimentDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    await this.playerStatusService.assertCanReportImpediment(
      req.user.id,
      teamId,
      req.user.role,
    );
    return this.playerStatusService.createImpediment(teamId, dto, req.user.id);
  }

  @Delete('impediments/:impedimentId')
  async clearImpediment(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('impedimentId', ParseIntPipe) impedimentId: number,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    await this.playerStatusService.assertCanManageTeam(
      req.user.id,
      teamId,
      req.user.role,
    );
    return this.playerStatusService.clearImpediment(
      teamId,
      impedimentId,
      req.user.id,
    );
  }

  @Post('fee-override/:userId')
  async feeOverride(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { reason?: string },
    @Req() req: { user: { id: number; role?: string } },
  ) {
    await this.playerStatusService.assertCanManageTeam(
      req.user.id,
      teamId,
      req.user.role,
    );
    return this.playerStatusService.setFeeOverride(
      teamId,
      userId,
      req.user.id,
      body?.reason,
    );
  }

  @Delete('fee-override/:userId')
  async clearFeeOverride(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    await this.playerStatusService.assertCanManageTeam(
      req.user.id,
      teamId,
      req.user.role,
    );
    return this.playerStatusService.clearFeeOverride(
      teamId,
      userId,
      req.user.id,
    );
  }

  @Get('audit')
  async audit(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('userId') userId?: string,
  ) {
    const uid = userId ? parseInt(userId, 10) : undefined;
    return this.playerStatusService.getAuditLog(teamId, uid);
  }
}
