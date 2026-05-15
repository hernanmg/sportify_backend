import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { FinanceService } from './finance.service';
import { CreateFeeBatchDto } from './dtos/create-fee-batch.dto';
import { RegisterPaymentDto } from './dtos/register-payment.dto';
import { CreateTeamExpenseDto } from './dtos/create-team-expense.dto';
import { SubmitPaymentDto } from './dtos/submit-payment.dto';
import { RejectPaymentDto } from './dtos/reject-payment.dto';
import { FeeChargeStatus } from './finance.enums';

@Controller('finance')
@UseGuards(AuthGuard('jwt'))
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('my-account')
  getMyAccount(
    @Req() req: { user: { id: number } },
    @Query('teamId') teamId?: string,
  ) {
    const parsedTeamId = teamId ? parseInt(teamId, 10) : undefined;
    return this.financeService.getMyAccount(req.user.id, parsedTeamId);
  }

  @Get('team/:teamId/summary')
  getTeamSummary(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.financeService.getTeamSummary(teamId);
  }

  @Get('team/:teamId/players-balance')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  getTeamPlayerBalances(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('season') season?: string,
  ) {
    return this.financeService.getTeamPlayerBalances(teamId, season);
  }

  @Post('team/:teamId/fees/sync-roster')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  syncRosterFees(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('season') season?: string,
  ) {
    return this.financeService.syncMissingFeeCharges(teamId, season);
  }

  @Get('team/:teamId/ledger')
  getTeamLedger(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.financeService.getTeamLedger(teamId, parsedLimit);
  }

  @Get('team/:teamId/charges')
  getTeamCharges(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('status') status?: FeeChargeStatus,
  ) {
    return this.financeService.getTeamCharges(teamId, status);
  }

  @Post('fees/batch')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  generateFeeBatch(
    @Body() dto: CreateFeeBatchDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.financeService.generateFeeBatch(dto, req.user.id);
  }

  @Post('payments')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  registerPayment(
    @Body() dto: RegisterPaymentDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.financeService.registerPayment(dto, req.user.id);
  }

  @Post('payments/submit')
  submitPayment(
    @Body() dto: SubmitPaymentDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.financeService.submitPayment(dto, req.user.id);
  }

  @Get('team/:teamId/payments/pending')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  getPendingPayments(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.financeService.getPendingPayments(teamId);
  }

  @Patch('payments/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { id: number } },
  ) {
    return this.financeService.confirmPayment(id, req.user.id);
  }

  @Patch('payments/:id/reject')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  rejectPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectPaymentDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.financeService.rejectPayment(id, req.user.id, dto);
  }

  @Post('expenses')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'manager', 'admin')
  createTeamExpense(
    @Body() dto: CreateTeamExpenseDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.financeService.createTeamExpense(dto, req.user.id);
  }
}
