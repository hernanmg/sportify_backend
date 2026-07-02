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
import { GenerateMonthlyQuotaDto } from './dtos/generate-monthly-quota.dto';
import { GenerateRecurringQuotaDto } from './dtos/generate-recurring-quota.dto';
import { UpdateRecurringQuotaDto } from './dtos/update-recurring-quota.dto';
import { OpenTrainingCollectionDto } from './dtos/open-training-collection.dto';
import { CreateTrainingExpenseDto } from './dtos/create-training-expense.dto';

const FINANCE_MANAGER_ROLES = [
  'super_admin',
  'manager',
  'admin',
  'dt',
  'tesorero',
  'delegado',
] as const;

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
  @Roles(...FINANCE_MANAGER_ROLES)
  getTeamPlayerBalances(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('season') season?: string,
    @Query('categoryId') categoryId?: string,
    @Req() req?: { user: { id: number; role?: string } },
  ) {
    const parsedCategoryId =
      categoryId != null && categoryId !== ''
        ? parseInt(categoryId, 10)
        : undefined;
    return this.financeService.getTeamPlayerBalances(
      teamId,
      season,
      req!.user.id,
      req!.user.role,
      Number.isFinite(parsedCategoryId) ? parsedCategoryId : undefined,
    );
  }

  @Post('team/:teamId/fees/sync-roster')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  syncRosterFees(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('season') season?: string,
    @Req() req?: { user: { id: number; role?: string } },
  ) {
    return this.financeService.syncMissingFeeCharges(
      teamId,
      season,
      req!.user.id,
      req!.user.role,
    );
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
  @Roles(...FINANCE_MANAGER_ROLES)
  generateFeeBatch(
    @Body() dto: CreateFeeBatchDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.generateFeeBatch(
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Post('payments')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  registerPayment(
    @Body() dto: RegisterPaymentDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.registerPayment(
      dto,
      req.user.id,
      req.user.role,
    );
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
    @Body() body: Record<string, unknown>,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    const teamId = parseInt(String(body.teamId ?? ''), 10);
    const amount = parseFloat(String(body.amount ?? ''));
    if (!teamId || Number.isNaN(amount) || amount <= 0) {
      throw new BadRequestException('teamId y amount son requeridos');
    }
    const feeChargeIds = this.parseFeeChargeIds(body.feeChargeIds);
    const dto: SubmitPaymentDto = {
      teamId,
      amount,
      method:
        (String(body.method ?? '') as PaymentMethod) || PaymentMethod.TRANSFER,
      notes: body.notes != null ? String(body.notes) : undefined,
      feeChargeIds,
    };
    return this.financeService.submitPayment(dto, req.user.id, receipt);
  }

  private parseFeeChargeIds(raw: unknown): number[] | undefined {
    if (raw == null) return undefined;
    if (Array.isArray(raw)) {
      const ids = raw
        .map((n) => Number(n))
        .filter((n) => !Number.isNaN(n) && n > 0);
      return ids.length ? ids : undefined;
    }
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const ids = parsed
            .map((n) => Number(n))
            .filter((n) => !Number.isNaN(n) && n > 0);
          return ids.length ? ids : undefined;
        }
      } catch {
        const ids = raw
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !Number.isNaN(n) && n > 0);
        return ids.length ? ids : undefined;
      }
    }
    return undefined;
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
  @Roles(...FINANCE_MANAGER_ROLES)
  getPendingPayments(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.financeService.getPendingPayments(teamId);
  }

  @Patch('payments/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  confirmPayment(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.confirmPayment(id, req.user.id, req.user.role);
  }

  @Patch('payments/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  rejectPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectPaymentDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.rejectPayment(
      id,
      req.user.id,
      dto,
      req.user.role,
    );
  }

  @Post('expenses')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  createTeamExpense(
    @Body() dto: CreateTeamExpenseDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.createTeamExpense(
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Post('fees/monthly-quota')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  generateMonthlyQuota(
    @Body() dto: GenerateMonthlyQuotaDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.generateMonthlyQuota(
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Post('fees/monthly-quota/recurring')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  generateRecurringMonthlyQuota(
    @Body() dto: GenerateRecurringQuotaDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.generateRecurringMonthlyQuota(
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Get('team/:teamId/quota-series')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  listQuotaSeries(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.listRecurringQuotaSeries(
      teamId,
      req.user.id,
      req.user.role,
    );
  }

  @Patch('fees/quota-series/:groupId')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  updateQuotaSeries(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateRecurringQuotaDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.updateRecurringQuotaSeries(
      groupId,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Get('team/:teamId/quota-overview')
  getQuotaOverview(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Req() req: { user: { id: number; role?: string } },
    @Query('concept') concept?: string,
    @Query('season') season?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    const parsedCategoryId =
      categoryId != null && categoryId !== ''
        ? parseInt(categoryId, 10)
        : undefined;
    return this.financeService.getQuotaOverview(
      teamId,
      req.user.id,
      req.user.role,
      concept,
      season,
      Number.isFinite(parsedCategoryId) ? parsedCategoryId : undefined,
    );
  }

  @Post('team/:teamId/quota-reminders')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  sendQuotaReminders(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query('concept') concept: string | undefined,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.sendQuotaReminders(
      teamId,
      req.user.id,
      req.user.role,
      concept,
    );
  }

  @Get('team/:teamId/players/:userId/fee-history')
  getPlayerFeeHistory(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('userId', ParseIntPipe) targetUserId: number,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.getPlayerFeeHistory(
      targetUserId,
      teamId,
      req.user.id,
      req.user.role,
    );
  }

  @Post('sport-events/:eventId/training-collection')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  openTrainingCollection(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: OpenTrainingCollectionDto,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.openTrainingCollection(
      eventId,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Get('sport-events/:eventId/training-collection')
  getTrainingCollection(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Req() req: { user: { id: number; role?: string } },
  ) {
    return this.financeService.getTrainingCollection(
      eventId,
      req.user.id,
      req.user.role,
    );
  }

  @Post('training-expenses')
  @UseGuards(RolesGuard)
  @Roles(...FINANCE_MANAGER_ROLES)
  createTrainingExpense(
    @Body() dto: CreateTrainingExpenseDto,
    @Req() req: { user: { id: number } },
  ) {
    return this.financeService.createTrainingExpense(dto, req.user.id);
  }
}
