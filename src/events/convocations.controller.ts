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
} from '@nestjs/common';
import { ConvocationsService, ConvocationDto } from './convocations.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('convocations')
@UseGuards(AuthGuard('jwt'))
export class ConvocationsController {
  constructor(private readonly convocationsService: ConvocationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() convocationDto: ConvocationDto, @Request() req) {
    return await this.convocationsService.createConvocation(convocationDto, req.user.id);
  }

  @Get()
  async findAll(
    @Query('teamId') teamId?: number,
    @Query('status') status?: 'sent' | 'draft',
  ) {
    return await this.convocationsService.getConvocations(teamId, status);
  }

  @Get('upcoming')
  async getUpcoming(@Query('teamId', ParseIntPipe) teamId: number) {
    return await this.convocationsService.getUpcomingConvocations(teamId);
  }

  @Get('my-convocations')
  async getMyConvocations(@Request() req) {
    return await this.convocationsService.getUserConvocations(req.user.id);
  }

  @Get('pending-responses')
  async getPendingResponses(@Request() req) {
    return await this.convocationsService.getPendingResponses(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.convocationsService.getConvocations(undefined, undefined);
  }

  @Get(':id/stats')
  async getStats(@Param('id', ParseIntPipe) id: number) {
    return await this.convocationsService.getConvocationStats(id);
  }

  @Get(':id/responses')
  async getResponses(@Param('id', ParseIntPipe) id: number) {
    return await this.convocationsService.getConvocationResponses(id);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.OK)
  async send(@Param('id', ParseIntPipe) id: number) {
    return await this.convocationsService.sendConvocation(id);
  }

  @Post(':id/resend')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.OK)
  async resend(@Param('id', ParseIntPipe) id: number) {
    await this.convocationsService.resendConvocation(id);
    return { message: 'Convocatoria reenviada exitosamente' };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: Partial<ConvocationDto>,
  ) {
    return await this.convocationsService.updateConvocation(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.convocationsService.deleteConvocation(id);
  }

  // ENDPOINTS PARA RESPUESTAS DE JUGADORES

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param('id', ParseIntPipe) convocationId: number,
    @Body() body: { notes?: string },
    @Request() req,
  ) {
    return await this.convocationsService.confirmParticipation(
      convocationId,
      req.user.id,
      body.notes
    );
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  async decline(
    @Param('id', ParseIntPipe) convocationId: number,
    @Body() body: { notes?: string },
    @Request() req,
  ) {
    return await this.convocationsService.declineParticipation(
      convocationId,
      req.user.id,
      body.notes
    );
  }

  // ENDPOINTS ESPECÍFICOS PARA MANAGERS

  @Post('official-match')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createOfficialMatch(@Body() convocationDto: ConvocationDto, @Request() req) {
    const officialMatchDto = {
      ...convocationDto,
      isOfficialMatch: true,
    };
    return await this.convocationsService.createConvocation(officialMatchDto, req.user.id);
  }

  @Post('friendly-match')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createFriendlyMatch(@Body() convocationDto: ConvocationDto, @Request() req) {
    const friendlyMatchDto = {
      ...convocationDto,
      isOfficialMatch: false,
    };
    return await this.convocationsService.createConvocation(friendlyMatchDto, req.user.id);
  }
}
