import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto, CreateBulkNotificationDto } from './dtos/create-notification.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return await this.notificationsService.createNotification(createNotificationDto);
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async createBulkNotifications(@Body() createBulkDto: CreateBulkNotificationDto) {
    return await this.notificationsService.createBulkNotifications(createBulkDto);
  }

  @Get('my')
  async getMyNotifications(
    @Request() req,
    @Query('limit') limit?: number
  ) {
    // Si es admin, mostrar todas las notificaciones
    if (req.user.role === 'super_admin' || req.user.role === 'manager') {
      return await this.notificationsService.getAllNotifications(limit || 50);
    }
    
    return await this.notificationsService.getUserNotifications(
      req.user.id,
      limit || 50
    );
  }

  @Get('my/unread-count')
  async getUnreadCount(@Request() req) {
    // Si es admin, contar todas las notificaciones no leídas
    if (req.user.role === 'super_admin' || req.user.role === 'manager') {
      const count = await this.notificationsService.getAllUnreadCount();
      return { count };
    }
    
    const count = await this.notificationsService.getUnreadCount(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id') id: number, @Request() req) {
    return await this.notificationsService.markAsRead(id, req.user.id, req.user.role);
  }

  @Patch('mark-all-read')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Request() req) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { message: 'Todas las notificaciones marcadas como leídas' };
  }

  // ENDPOINTS ESPECÍFICOS PARA GESTIÓN DEPORTIVA

  @Post('match-invitation')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async sendMatchInvitation(
    @Body() body: {
      eventId: number;
      teamId: number;
      matchDetails: {
        date: string;
        opponent: string;
        location: string;
      };
    }
  ) {
    return await this.notificationsService.sendMatchInvitation(
      body.eventId,
      body.teamId,
      body.matchDetails
    );
  }

  @Post('training-reminder')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async sendTrainingReminder(
    @Body() body: {
      eventId: number;
      teamId: number;
      trainingDetails: {
        date: string;
        location: string;
        duration: string;
      };
    }
  ) {
    return await this.notificationsService.sendTrainingReminder(
      body.eventId,
      body.teamId,
      body.trainingDetails
    );
  }

  @Post('payment-reminder')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async sendPaymentReminder(
    @Body() body: {
      userIds: number[];
      teamId: number;
      paymentDetails: {
        amount: number;
        dueDate: string;
        concept: string;
      };
    }
  ) {
    return await this.notificationsService.sendPaymentReminder(
      body.userIds,
      body.teamId,
      body.paymentDetails
    );
  }

  @Post('social-event')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async sendSocialEventNotification(
    @Body() body: {
      eventId: number;
      teamId: number;
      eventDetails: {
        title: string;
        date: string;
        location: string;
        hasExpenses?: boolean;
      };
    }
  ) {
    return await this.notificationsService.sendSocialEventNotification(
      body.eventId,
      body.teamId,
      body.eventDetails
    );
  }

  @Post('medical-expiry-alerts')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
  async sendMedicalExpiryAlerts() {
    return await this.notificationsService.sendMedicalExpiryAlerts();
  }

  @Post('process-scheduled')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager')
  @HttpCode(HttpStatus.OK)
  async processScheduledNotifications() {
    await this.notificationsService.processScheduledNotifications();
    return { message: 'Notificaciones programadas procesadas' };
  }
}
