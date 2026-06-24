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
  ForbiddenException,
} from '@nestjs/common';
import { SportEventsService } from './sport-events.service';
import { TrainingSchedulesService } from './training-schedules.service';
import { CreateSportEventDto, UpdateSportEventDto, AddParticipantDto, UpdateParticipantResponseDto } from './dtos/create-sport-event.dto';
import { CreateTrainingScheduleDto } from './dtos/create-training-schedule.dto';
import { AddSocialGuestDto } from './dtos/add-social-guest.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SportEventType, SportEventStatus } from './entities/sport-event.entity';

@Controller('sport-events')
@UseGuards(AuthGuard('jwt'))
export class SportEventsController {
  constructor(
    private readonly sportEventsService: SportEventsService,
    private readonly trainingSchedulesService: TrainingSchedulesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createSportEventDto: CreateSportEventDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    if (!createSportEventDto.createdBy) {
      createSportEventDto.createdBy = req.user.id;
    }
    return await this.sportEventsService.create(
      createSportEventDto,
      req.user.id,
      req.user.role,
    );
  }

  @Get()
  async findAll(
    @Query('teamId') teamId?: number,
    @Query('type') type?: SportEventType,
    @Query('status') status?: SportEventStatus,
  ) {
    return await this.sportEventsService.findAll(teamId, type, status);
  }

  @Get('upcoming')
  async getUpcomingEvents(
    @Query('teamId', ParseIntPipe) teamId: number,
    @Query('days') days?: number,
  ) {
    return await this.sportEventsService.getUpcomingEvents(teamId, days ? parseInt(days.toString()) : 7);
  }

  @Get('my-events')
  async getMyEvents(@Request() req) {
    return await this.sportEventsService.getUserEvents(req.user.id);
  }

  @Get('date-range')
  async getEventsByDateRange(
    @Query('teamId', ParseIntPipe) teamId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.sportEventsService.getEventsByDateRange(
      teamId,
      new Date(startDate),
      new Date(endDate)
    );
  }

  @Get('training-schedules')
  listTrainingSchedules(@Query('teamId', ParseIntPipe) teamId: number) {
    return this.trainingSchedulesService.listByTeam(teamId);
  }

  @Post('training-schedules')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'dt', 'team_captain')
  createTrainingSchedule(
    @Body() dto: CreateTrainingScheduleDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.trainingSchedulesService.create(
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.sportEventsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSportEventDto: UpdateSportEventDto,
    @Request() req,
  ) {
    return await this.sportEventsService.update(id, updateSportEventDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin', 'dt', 'team_captain')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.sportEventsService.remove(id);
  }

  // ENDPOINTS PARA PARTICIPANTES

  @Post(':id/participants')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  @HttpCode(HttpStatus.CREATED)
  async addParticipant(
    @Param('id', ParseIntPipe) eventId: number,
    @Body() addParticipantDto: AddParticipantDto,
  ) {
    return await this.sportEventsService.addParticipant(eventId, addParticipantDto);
  }

  @Get(':id/social-guests')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  async listSocialGuests(@Param('id', ParseIntPipe) eventId: number) {
    const event = await this.sportEventsService.findOne(eventId);
    return this.sportEventsService.listTeamSocialGuests(event.teamId);
  }

  @Post(':id/guest-participants')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  @HttpCode(HttpStatus.CREATED)
  async addGuestParticipant(
    @Param('id', ParseIntPipe) eventId: number,
    @Body() dto: AddSocialGuestDto,
    @Request() req: { user: { id: number } },
  ) {
    return this.sportEventsService.addSocialGuestParticipant(
      eventId,
      dto,
      req.user.id,
    );
  }

  @Post(':id/participants/bulk')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async addParticipants(
    @Param('id', ParseIntPipe) eventId: number,
    @Body() body: { userIds: number[] },
  ) {
    return await this.sportEventsService.addParticipants(eventId, body.userIds);
  }

  @Patch(':id/participants/:userId/response')
  @HttpCode(HttpStatus.OK)
  async updateParticipantResponse(
    @Param('id', ParseIntPipe) eventId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() updateDto: UpdateParticipantResponseDto,
    @Request() req,
  ) {
    // Verificar que el usuario solo puede actualizar su propia respuesta o ser manager
    const role = req.user.role ?? '';
    if (
      userId !== req.user.id &&
      !['super_admin', 'manager', 'admin'].includes(role)
    ) {
      throw new ForbiddenException(
        'No tienes permisos para actualizar esta respuesta',
      );
    }
    
    return await this.sportEventsService.updateParticipantResponse(eventId, userId, updateDto);
  }

  @Delete(':id/participants/:userId')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeParticipant(
    @Param('id', ParseIntPipe) eventId: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.sportEventsService.removeParticipant(eventId, userId);
  }

  // ENDPOINTS ESPECÍFICOS POR TIPO DE EVENTO

  @Post('training')
  @HttpCode(HttpStatus.CREATED)
  async createTraining(
    @Body() createDto: CreateSportEventDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    createDto.type = SportEventType.TRAINING;
    createDto.createdBy = req.user.id;
    return await this.sportEventsService.create(
      createDto,
      req.user.id,
      req.user.role,
    );
  }

  @Post('match')
  @HttpCode(HttpStatus.CREATED)
  async createMatch(
    @Body() createDto: CreateSportEventDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    createDto.type = SportEventType.MATCH;
    createDto.createdBy = req.user.id;
    return await this.sportEventsService.create(
      createDto,
      req.user.id,
      req.user.role,
    );
  }

  @Post('social')
  @HttpCode(HttpStatus.CREATED)
  async createSocialEvent(
    @Body() createDto: CreateSportEventDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    createDto.type = SportEventType.SOCIAL;
    createDto.createdBy = req.user.id;
    return await this.sportEventsService.create(
      createDto,
      req.user.id,
      req.user.role,
    );
  }
}
