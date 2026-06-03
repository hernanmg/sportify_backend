import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AttendanceService } from './attendance.service';
import { UpdateEventAttendanceDto } from './dtos/update-event-attendance.dto';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Patch('sport-events/:id/attendance')
  updateEventAttendance(
    @Param('id', ParseIntPipe) eventId: number,
    @Body() dto: UpdateEventAttendanceDto,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.attendanceService.updateEventAttendance(
      eventId,
      req.user.id,
      dto.items,
      req.user.role,
    );
  }

  @Get('sport-events/:id/attendance')
  getEventAttendance(
    @Param('id', ParseIntPipe) eventId: number,
    @Request() req: { user: { id: number; role?: string } },
  ) {
    return this.attendanceService.getEventAttendance(
      eventId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('teams/:teamId/attendance-report')
  getTeamReport(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('categoryId') categoryIdRaw?: string,
    @Query('limit') limitRaw?: string,
    @Request() req?: { user: { id: number; role?: string } },
  ) {
    const categoryId = categoryIdRaw
      ? parseInt(categoryIdRaw, 10)
      : undefined;
    const limit = limitRaw ? parseInt(limitRaw, 10) : 30;
    return this.attendanceService.getTeamAttendanceReport(
      teamId,
      req!.user.id,
      req!.user.role,
      categoryId,
      limit,
    );
  }
}
