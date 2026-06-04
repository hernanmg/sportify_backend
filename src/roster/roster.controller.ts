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
  HttpCode,
  HttpStatus,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { RosterService } from './roster.service';
import { CreateRosterDto } from './dtos/create-roster.dto';
import { UpdateRosterDto } from './dtos/update-roster.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('roster')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Post()
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createRosterDto: CreateRosterDto) {
    return await this.rosterService.create(createRosterDto);
  }

  @Get()
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'player')
  async findAll() {
    return await this.rosterService.findAll();
  }

  @Get('team/:teamId')
  @Roles(
    'super_admin',
    'manager',
    'admin',
    'team_captain',
    'dt',
    'player',
    'guest',
    'user',
  )
  async findByTeam(
    @Param('teamId') teamId: number,
    @Query('season') season?: string,
    @Query('categoryIds') categoryIdsRaw?: string,
    @Request() req?: { user: { id: number; role?: string } },
  ) {
    const categoryIds = categoryIdsRaw
      ? categoryIdsRaw.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !Number.isNaN(id))
      : undefined;
    try {
      return await this.rosterService.findByTeam(
        teamId,
        season,
        categoryIds,
        req?.user?.id,
        req?.user?.role,
      );
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      const message =
        e instanceof Error ? e.message : 'No se pudo cargar el plantel';
      throw new ForbiddenException(message);
    }
  }

  @Get('season/:season')
  @Roles('super_admin', 'manager', 'admin')
  async findBySeason(@Param('season') season: string) {
    return await this.rosterService.findBySeason(season);
  }

  @Get('team/:teamId/enabled')
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  async getEnabledPlayersByTeam(
    @Param('teamId') teamId: number,
    @Query('season') season: string
  ) {
    return await this.rosterService.getEnabledPlayersByTeam(teamId, season);
  }

  @Get('team/:teamId/available-numbers')
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  async getAvailableJerseyNumbers(
    @Param('teamId') teamId: number,
    @Query('season') season: string
  ) {
    return await this.rosterService.getAvailableJerseyNumbers(teamId, season);
  }

  @Get(':id')
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'player')
  async findOne(@Param('id') id: number) {
    return await this.rosterService.findOne(id);
  }

  @Patch(':id')
  @Roles('super_admin', 'manager', 'admin', 'team_captain', 'dt')
  async update(
    @Param('id') id: number,
    @Body() updateRosterDto: UpdateRosterDto,
    @Request() req: { user: { id: number } },
  ) {
    return await this.rosterService.update(id, updateRosterDto, req.user.id);
  }

  @Patch(':id/medical-status')
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  async updateMedicalStatus(
    @Param('id') id: number,
    @Body() body: { status: 'pending' | 'approved' | 'expired' | 'rejected' }
  ) {
    return await this.rosterService.updateMedicalStatus(id, body.status);
  }

  @Delete(':id')
  @Roles('super_admin', 'manager', 'admin', 'team_captain')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: number) {
    await this.rosterService.remove(id);
  }
}
