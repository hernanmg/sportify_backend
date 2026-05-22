import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { FinanceService } from './finance.service';
import { CreateFeeBatchDto } from './dtos/create-fee-batch.dto';
import { RegisterPaymentDto } from './dtos/register-payment.dto';
import { CreateTeamExpenseDto } from './dtos/create-team-expense.dto';
import { SubmitPaymentDto } from './dtos/submit-payment.dto';
import { RejectPaymentDto } from './dtos/reject-payment.dto';
import { FeeChargeStatus, PaymentMethod } from './finance.enums';
import { ReceiptUploadFile } from './payment-receipt.storage';

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
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  submitPayment(
    @UploadedFile() receipt: ReceiptUploadFile | undefined,
    @Body() body: Record<string, string>,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    const teamId = parseInt(body.teamId, 10);
    const amount = parseFloat(body.amount);
    if (!teamId || Number.isNaN(amount) || amount <= 0) {
      throw new BadRequestException('teamId y amount son requeridos');
    }
    let feeChargeIds: number[] | undefined;
    if (body.feeChargeIds?.trim()) {
      try {
        const parsed = JSON.parse(body.feeChargeIds);
        if (Array.isArray(parsed)) {
          feeChargeIds = parsed.map((n) => Number(n)).filter((n) => !Number.isNaN(n));
        }
      } catch {
        feeChargeIds = body.feeChargeIds
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !Number.isNaN(n));
      }
    }
    const dto: SubmitPaymentDto = {
      teamId,
      amount,
      method: (body.method as PaymentMethod) || PaymentMethod.TRANSFER,
      notes: body.notes,
      feeChargeIds,
    };
    return this.financeService.submitPayment(dto, req.user.id, receipt);
  }

  @Get('payments/:id/receipt')
  async getPaymentReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { id: number; role?: string } },
    @Res() res: Response,
  ) {
    const { buffer, mimeType } = await this.financeService.getPaymentReceipt(
      id,
      req.user.id,
      req.user.role,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
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
