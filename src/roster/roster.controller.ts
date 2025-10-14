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
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createRosterDto: CreateRosterDto) {
    return await this.rosterService.create(createRosterDto);
  }

  @Get()
  @Roles('super_admin', 'manager', 'team_captain', 'player')
  async findAll() {
    return await this.rosterService.findAll();
  }

  @Get('team/:teamId')
  @Roles('super_admin', 'manager', 'team_captain', 'player')
  async findByTeam(
    @Param('teamId') teamId: number,
    @Query('season') season?: string
  ) {
    return await this.rosterService.findByTeam(teamId, season);
  }

  @Get('season/:season')
  @Roles('super_admin', 'manager')
  async findBySeason(@Param('season') season: string) {
    return await this.rosterService.findBySeason(season);
  }

  @Get('team/:teamId/enabled')
  @Roles('super_admin', 'manager')
  async getEnabledPlayersByTeam(
    @Param('teamId') teamId: number,
    @Query('season') season: string
  ) {
    return await this.rosterService.getEnabledPlayersByTeam(teamId, season);
  }

  @Get('team/:teamId/available-numbers')
  @Roles('super_admin', 'manager')
  async getAvailableJerseyNumbers(
    @Param('teamId') teamId: number,
    @Query('season') season: string
  ) {
    return await this.rosterService.getAvailableJerseyNumbers(teamId, season);
  }

  @Get(':id')
  @Roles('super_admin', 'manager', 'team_captain', 'player')
  async findOne(@Param('id') id: number) {
    return await this.rosterService.findOne(id);
  }

  @Patch(':id')
  @Roles('super_admin', 'manager')
  async update(
    @Param('id') id: number,
    @Body() updateRosterDto: UpdateRosterDto
  ) {
    return await this.rosterService.update(id, updateRosterDto);
  }

  @Patch(':id/medical-status')
  @Roles('super_admin', 'manager')
  async updateMedicalStatus(
    @Param('id') id: number,
    @Body() body: { status: 'pending' | 'approved' | 'expired' | 'rejected' }
  ) {
    return await this.rosterService.updateMedicalStatus(id, body.status);
  }

  @Delete(':id')
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: number) {
    await this.rosterService.remove(id);
  }
}
