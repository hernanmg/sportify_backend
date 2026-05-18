import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EventExpensesService } from './event-expenses.service';
import { AddEventExpenseItemDto } from './dtos/add-event-expense-item.dto';
import { UpdateEventExpenseSplitDto } from './dtos/update-event-expense-split.dto';
import { UpdateEventExpenseSharesDto } from './dtos/update-event-expense-shares.dto';
import { UpdateParticipantExpenseInclusionDto } from './dtos/update-participant-expense-inclusion.dto';

@Controller('sport-events')
@UseGuards(AuthGuard('jwt'))
export class EventExpensesController {
  constructor(private readonly eventExpensesService: EventExpensesService) {}

  @Get(':eventId/expense-sheet')
  getExpenseSheet(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.eventExpensesService.getExpenseSheet(eventId);
  }

  @Post(':eventId/expense-items')
  addExpenseItem(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: AddEventExpenseItemDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.eventExpensesService.addExpenseItem(eventId, dto, req.user.id);
  }

  @Delete(':eventId/expense-items/:itemId')
  deleteExpenseItem(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    const managerRoles = ['super_admin', 'manager', 'admin'];
    const isManager = managerRoles.includes(req.user.role ?? '');
    return this.eventExpensesService.deleteExpenseItem(
      eventId,
      itemId,
      req.user.id,
      isManager,
    );
  }

  @Patch(':eventId/expense-sheet/split-mode')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  updateSplitMode(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: UpdateEventExpenseSplitDto,
  ) {
    return this.eventExpensesService.updateSplitMode(eventId, dto);
  }

  @Patch(':eventId/expense-sheet/shares')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  updateManualShares(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: UpdateEventExpenseSharesDto,
  ) {
    return this.eventExpensesService.updateManualShares(eventId, dto);
  }

  @Patch(':eventId/participants/:userId/expense-inclusion')
  updateParticipantExpenseInclusion(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateParticipantExpenseInclusionDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    const managerRoles = ['super_admin', 'manager', 'admin'];
    const isManager = managerRoles.includes(req.user.role ?? '');
    return this.eventExpensesService.updateParticipantExpenseInclusion(
      eventId,
      userId,
      dto,
      req.user.id,
      isManager,
    );
  }
}
