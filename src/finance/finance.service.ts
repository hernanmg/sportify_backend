import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FeeCharge } from './entities/fee-charge.entity';
import { PlayerPayment } from './entities/player-payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import {
  FeeChargeStatus,
  FeeChargeType,
  LedgerCategory,
  LedgerEntryType,
  PaymentMethod,
  PaymentStatus,
} from './finance.enums';
import { CreateFeeBatchDto } from './dtos/create-fee-batch.dto';
import { RegisterPaymentDto } from './dtos/register-payment.dto';
import { CreateTeamExpenseDto } from './dtos/create-team-expense.dto';
import { SubmitPaymentDto } from './dtos/submit-payment.dto';
import { RejectPaymentDto } from './dtos/reject-payment.dto';
import { RosterService } from 'src/roster/roster.service';
import { PlayerRoster } from 'src/roster/entities/player-roster.entity';

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(FeeCharge)
    private readonly feeChargeRepository: Repository<FeeCharge>,
    @InjectRepository(PlayerPayment)
    private readonly paymentRepository: Repository<PlayerPayment>,
    @InjectRepository(PaymentAllocation)
    private readonly allocationRepository: Repository<PaymentAllocation>,
    @InjectRepository(LedgerEntry)
    private readonly ledgerRepository: Repository<LedgerEntry>,
    private readonly rosterService: RosterService,
  ) {}

  private toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    return typeof value === 'number' ? value : parseFloat(value);
  }

  private currentSeason(): string {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const half = month <= 6 ? 'Apertura' : 'Clausura';
    return `${year}-${half}`;
  }

  private userNameFromRoster(entry: PlayerRoster): string {
    const user = entry.player?.user;
    const userId = entry.player?.user_id;
    if (!user) return `Usuario ${userId ?? entry.playerId}`;
    const fullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || user.username;
  }

  private async findRosterForFinance(
    teamId: number,
    season?: string,
  ): Promise<{ roster: PlayerRoster[]; resolvedSeason: string }> {
    const requested = season?.trim() || this.currentSeason();

    let roster = await this.rosterService.findByTeam(teamId, requested);
    if (roster.length > 0) {
      return { roster, resolvedSeason: requested };
    }

    if (/^\d{4}$/.test(requested)) {
      const all = await this.rosterService.findByTeam(teamId);
      roster = all.filter((entry) => entry.season.startsWith(requested));
      if (roster.length > 0) {
        return { roster, resolvedSeason: roster[0].season };
      }
    }

    roster = await this.rosterService.findByTeam(teamId);
    if (roster.length > 0) {
      return { roster, resolvedSeason: roster[0].season };
    }

    return { roster: [], resolvedSeason: requested };
  }

  private async resolveRosterForFinance(
    teamId: number,
    season?: string,
  ): Promise<{ roster: PlayerRoster[]; resolvedSeason: string }> {
    const result = await this.findRosterForFinance(teamId, season);
    if (result.roster.length === 0) {
      throw new BadRequestException(
        `No hay jugadores en la lista de buena fe del equipo (temporada: ${result.resolvedSeason}).`,
      );
    }
    return result;
  }

  private async getActiveFeeTemplates(
    teamId: number,
    season: string,
  ): Promise<FeeCharge[]> {
    let charges = await this.feeChargeRepository.find({
      where: { teamId, season },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    if (charges.length === 0) {
      charges = await this.feeChargeRepository.find({
        where: { teamId },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
    }

    const byConcept = new Map<string, FeeCharge>();
    for (const charge of charges) {
      if (!byConcept.has(charge.concept)) {
        byConcept.set(charge.concept, charge);
      }
    }
    return Array.from(byConcept.values());
  }

  async syncMissingFeeCharges(teamId: number, season?: string) {
    const { roster, resolvedSeason } = await this.findRosterForFinance(
      teamId,
      season,
    );

    if (roster.length === 0) {
      return { created: 0, season: resolvedSeason };
    }

    const templates = await this.getActiveFeeTemplates(teamId, resolvedSeason);

    if (templates.length === 0) {
      return { created: 0, season: resolvedSeason };
    }

    const existingCharges = await this.feeChargeRepository.find({
      where: { teamId },
    });

    let created = 0;
    for (const entry of roster) {
      const userId = entry.player?.user_id;
      if (!userId) continue;

      for (const template of templates) {
        const alreadyExists = existingCharges.some(
          (charge) =>
            charge.userId === userId &&
            charge.concept === template.concept &&
            charge.season === template.season &&
            this.toNumber(charge.amount) === this.toNumber(template.amount),
        );
        if (alreadyExists) continue;

        const charge = this.feeChargeRepository.create({
          teamId,
          userId,
          type: template.type,
          concept: template.concept,
          amount: template.amount,
          paidAmount: 0,
          status: FeeChargeStatus.PENDING,
          dueDate: template.dueDate,
          season: template.season,
          createdBy: template.createdBy,
        });
        const saved = await this.feeChargeRepository.save(charge);
        existingCharges.push(saved);
        created++;
      }
    }

    return { created, season: resolvedSeason };
  }

  async generateFeeBatch(dto: CreateFeeBatchDto, createdBy?: number) {
    const { roster, resolvedSeason } = await this.resolveRosterForFinance(
      dto.teamId,
      dto.season,
    );

    const existingCharges = await this.feeChargeRepository.find({
      where: { teamId: dto.teamId, season: resolvedSeason, concept: dto.concept },
    });

    const charges: FeeCharge[] = [];
    for (const entry of roster) {
      const userId = entry.player?.user_id;
      if (!userId) continue;

      const duplicate = existingCharges.find(
        (charge) =>
          charge.userId === userId &&
          this.toNumber(charge.amount) === this.toNumber(dto.amount),
      );
      if (duplicate) continue;

      const charge = this.feeChargeRepository.create({
        teamId: dto.teamId,
        userId,
        type: dto.type ?? FeeChargeType.MONTHLY_QUOTA,
        concept: dto.concept,
        amount: dto.amount,
        paidAmount: 0,
        status: FeeChargeStatus.PENDING,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        season: resolvedSeason,
        createdBy,
      });
      charges.push(await this.feeChargeRepository.save(charge));
    }

    return {
      season: resolvedSeason,
      created: charges.length,
      charges,
    };
  }

  private resolveChargeStatus(
    amount: number,
    paidAmount: number,
  ): FeeChargeStatus {
    if (paidAmount <= 0) return FeeChargeStatus.PENDING;
    if (paidAmount >= amount) return FeeChargeStatus.PAID;
    return FeeChargeStatus.PARTIAL;
  }

  async registerPayment(dto: RegisterPaymentDto, recordedBy?: number) {
    const payment = this.paymentRepository.create({
      teamId: dto.teamId,
      userId: dto.userId,
      amount: dto.amount,
      method: dto.method ?? PaymentMethod.TRANSFER,
      status: PaymentStatus.CONFIRMED,
      notes: dto.notes,
      recordedBy,
      confirmedAt: new Date(),
    });
    const savedPayment = await this.paymentRepository.save(payment);
    return this.finalizePaymentAllocations(
      savedPayment,
      dto.feeChargeIds,
      recordedBy,
    );
  }

  async submitPayment(dto: SubmitPaymentDto, userId: number) {
    const payment = this.paymentRepository.create({
      teamId: dto.teamId,
      userId,
      amount: dto.amount,
      method: dto.method ?? PaymentMethod.TRANSFER,
      status: PaymentStatus.PENDING_CONFIRMATION,
      notes: dto.notes,
      recordedBy: userId,
      pendingFeeChargeIds: dto.feeChargeIds,
    });
    return this.paymentRepository.save(payment);
  }

  async getPendingPayments(teamId: number) {
    return this.paymentRepository.find({
      where: {
        teamId,
        status: PaymentStatus.PENDING_CONFIRMATION,
      },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async confirmPayment(paymentId: number, managerId: number) {
    const payment = await this.findPaymentOrThrow(paymentId);
    if (payment.status !== PaymentStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException('El pago no está pendiente de confirmación');
    }

    payment.status = PaymentStatus.CONFIRMED;
    payment.confirmedAt = new Date();
    const feeChargeIds = payment.pendingFeeChargeIds;
    payment.pendingFeeChargeIds = undefined;
    await this.paymentRepository.save(payment);

    return this.finalizePaymentAllocations(payment, feeChargeIds, managerId);
  }

  async rejectPayment(
    paymentId: number,
    managerId: number,
    dto?: RejectPaymentDto,
  ) {
    const payment = await this.findPaymentOrThrow(paymentId);
    if (payment.status !== PaymentStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException('El pago no está pendiente de confirmación');
    }

    payment.status = PaymentStatus.REJECTED;
    payment.rejectionReason = dto?.reason;
    payment.pendingFeeChargeIds = undefined;
    payment.confirmedAt = undefined;
    await this.paymentRepository.save(payment);

    return payment;
  }

  private async findPaymentOrThrow(paymentId: number): Promise<PlayerPayment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['user'],
    });
    if (!payment) {
      throw new NotFoundException(`Pago #${paymentId} no encontrado`);
    }
    return payment;
  }

  private async finalizePaymentAllocations(
    savedPayment: PlayerPayment,
    feeChargeIds: number[] | undefined,
    recordedBy?: number,
  ) {
    const dto: RegisterPaymentDto = {
      teamId: savedPayment.teamId,
      userId: savedPayment.userId,
      amount: this.toNumber(savedPayment.amount),
      feeChargeIds,
    };

    let remaining = dto.amount;
    const charges = await this.resolveChargesForPayment(dto);

    const allocations: PaymentAllocation[] = [];
    for (const charge of charges) {
      if (remaining <= 0) break;

      const chargeAmount = this.toNumber(charge.amount);
      const alreadyPaid = this.toNumber(charge.paidAmount);
      const pending = chargeAmount - alreadyPaid;
      if (pending <= 0) continue;

      const applied = Math.min(remaining, pending);
      remaining -= applied;

      const allocation = this.allocationRepository.create({
        paymentId: savedPayment.id,
        feeChargeId: charge.id,
        amount: applied,
      });
      allocations.push(await this.allocationRepository.save(allocation));

      charge.paidAmount = alreadyPaid + applied;
      charge.status = this.resolveChargeStatus(chargeAmount, charge.paidAmount);
      await this.feeChargeRepository.save(charge);
    }

    const allocatedTotal = allocations.reduce(
      (sum, a) => sum + this.toNumber(a.amount),
      0,
    );

    if (allocatedTotal > 0) {
      const ledger = this.ledgerRepository.create({
        teamId: dto.teamId,
        type: LedgerEntryType.INCOME,
        category: LedgerCategory.MONTHLY_FEE,
        amount: allocatedTotal,
        description: `Pago de jugador #${dto.userId}`,
        userId: dto.userId,
        referenceType: 'player_payment',
        referenceId: savedPayment.id,
        createdBy: recordedBy,
      });
      await this.ledgerRepository.save(ledger);
    }

    return {
      payment: savedPayment,
      allocations,
      unallocatedAmount: remaining,
    };
  }

  private async resolveChargesForPayment(
    dto: RegisterPaymentDto,
  ): Promise<FeeCharge[]> {
    if (dto.feeChargeIds?.length) {
      const charges = await this.feeChargeRepository.find({
        where: {
          id: In(dto.feeChargeIds),
          teamId: dto.teamId,
          userId: dto.userId,
        },
        order: { dueDate: 'ASC', id: 'ASC' },
      });
      if (charges.length === 0) {
        throw new BadRequestException('No se encontraron cargos para asignar');
      }
      return charges;
    }

    return this.feeChargeRepository.find({
      where: {
        teamId: dto.teamId,
        userId: dto.userId,
        status: In([
          FeeChargeStatus.PENDING,
          FeeChargeStatus.PARTIAL,
        ]),
      },
      order: { dueDate: 'ASC', id: 'ASC' },
    });
  }

  async createTeamExpense(dto: CreateTeamExpenseDto, createdBy?: number) {
    const entry = this.ledgerRepository.create({
      teamId: dto.teamId,
      type: LedgerEntryType.EXPENSE,
      category: dto.category ?? LedgerCategory.OTHER,
      amount: dto.amount,
      description: dto.description,
      createdBy,
    });
    return this.ledgerRepository.save(entry);
  }

  async getMyAccount(userId: number, teamId?: number) {
    const chargeWhere: Record<string, unknown> = { userId };
    if (teamId) chargeWhere.teamId = teamId;

    const charges = await this.feeChargeRepository.find({
      where: chargeWhere,
      relations: ['team'],
      order: { dueDate: 'DESC', id: 'DESC' },
    });

    const paymentWhere: Record<string, unknown> = { userId };
    if (teamId) paymentWhere.teamId = teamId;

    const payments = await this.paymentRepository.find({
      where: paymentWhere,
      order: { createdAt: 'DESC' },
    });

    const pendingPayments = payments.filter(
      (p) => p.status === PaymentStatus.PENDING_CONFIRMATION,
    );

    const totalCharged = charges.reduce(
      (sum, c) => sum + this.toNumber(c.amount),
      0,
    );
    const totalPaidOnCharges = charges.reduce(
      (sum, c) => sum + this.toNumber(c.paidAmount),
      0,
    );
    const balance = totalCharged - totalPaidOnCharges;

    return {
      userId,
      teamId: teamId ?? null,
      totalCharged,
      totalPaid: totalPaidOnCharges,
      balance,
      pendingCharges: charges.filter(
        (c) =>
          c.status === FeeChargeStatus.PENDING ||
          c.status === FeeChargeStatus.PARTIAL,
      ),
      pendingPayments,
      charges,
      payments,
    };
  }

  async getTeamSummary(teamId: number) {
    const ledger = await this.ledgerRepository.find({ where: { teamId } });

    const income = ledger
      .filter((e) => e.type === LedgerEntryType.INCOME)
      .reduce((sum, e) => sum + this.toNumber(e.amount), 0);

    const expenses = ledger
      .filter((e) => e.type === LedgerEntryType.EXPENSE)
      .reduce((sum, e) => sum + this.toNumber(e.amount), 0);

    const charges = await this.feeChargeRepository.find({ where: { teamId } });
    const totalOutstanding = charges.reduce((sum, c) => {
      const pending =
        this.toNumber(c.amount) - this.toNumber(c.paidAmount);
      return sum + Math.max(0, pending);
    }, 0);

    const pendingPaymentsCount = await this.paymentRepository.count({
      where: {
        teamId,
        status: PaymentStatus.PENDING_CONFIRMATION,
      },
    });

    return {
      teamId,
      cashBalance: income - expenses,
      totalIncome: income,
      totalExpenses: expenses,
      totalOutstanding,
      chargesCount: charges.length,
      pendingPaymentsCount,
    };
  }

  async getTeamPlayerBalances(teamId: number, season?: string) {
    await this.syncMissingFeeCharges(teamId, season);

    const { roster } = await this.findRosterForFinance(teamId, season);
    const charges = await this.feeChargeRepository.find({
      where: { teamId },
      relations: ['user'],
    });

    const totalsByUser = new Map<
      number,
      { totalCharged: number; totalPaid: number; userName?: string }
    >();

    for (const charge of charges) {
      const existing = totalsByUser.get(charge.userId) ?? {
        totalCharged: 0,
        totalPaid: 0,
        userName: charge.user
          ? [charge.user.firstName, charge.user.lastName]
              .filter(Boolean)
              .join(' ')
              .trim() || charge.user.username
          : undefined,
      };
      existing.totalCharged += this.toNumber(charge.amount);
      existing.totalPaid += this.toNumber(charge.paidAmount);
      totalsByUser.set(charge.userId, existing);
    }

    const results: Array<{
      userId: number;
      userName: string;
      totalCharged: number;
      totalPaid: number;
      balance: number;
      jerseyNumber?: number;
    }> = [];

    const rosterUserIds = new Set<number>();

    for (const entry of roster) {
      const userId = entry.player?.user_id;
      if (!userId) continue;
      rosterUserIds.add(userId);

      const totals = totalsByUser.get(userId) ?? {
        totalCharged: 0,
        totalPaid: 0,
      };

      results.push({
        userId,
        userName: this.userNameFromRoster(entry),
        totalCharged: totals.totalCharged,
        totalPaid: totals.totalPaid,
        balance: totals.totalCharged - totals.totalPaid,
        jerseyNumber: entry.jerseyNumber,
      });
    }

    for (const [userId, totals] of totalsByUser.entries()) {
      if (rosterUserIds.has(userId)) continue;
      results.push({
        userId,
        userName: totals.userName ?? `Usuario ${userId}`,
        totalCharged: totals.totalCharged,
        totalPaid: totals.totalPaid,
        balance: totals.totalCharged - totals.totalPaid,
      });
    }

    return results.sort((a, b) => b.balance - a.balance);
  }

  async getTeamLedger(teamId: number, limit = 50) {
    return this.ledgerRepository.find({
      where: { teamId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getTeamCharges(teamId: number, status?: FeeChargeStatus) {
    const where: Record<string, unknown> = { teamId };
    if (status) where.status = status;

    return this.feeChargeRepository.find({
      where,
      relations: ['user'],
      order: { dueDate: 'DESC', id: 'DESC' },
    });
  }
}
