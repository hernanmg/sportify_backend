import {
  BadRequestException,
  ForbiddenException,
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
import { TeamsService } from 'src/teams/teams.service';
import {
  SportEvent,
  SportEventType,
} from '../events/entities/sport-event.entity';
import {
  EventParticipant,
  ParticipantStatus,
} from '../events/entities/event-participant.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationPriority, NotificationType } from '../notifications/entities/notification.entity';
import { GenerateMonthlyQuotaDto } from './dtos/generate-monthly-quota.dto';
import { OpenTrainingCollectionDto } from './dtos/open-training-collection.dto';
import { CreateTrainingExpenseDto } from './dtos/create-training-expense.dto';
import {
  PaymentReceiptStorage,
  ReceiptUploadFile,
} from './payment-receipt.storage';

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
    private readonly teamsService: TeamsService,
    private readonly receiptStorage: PaymentReceiptStorage,
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async assertTeamMember(
    userId: number,
    teamId: number,
    globalRole?: string,
  ): Promise<void> {
    const elevated = ['super_admin', 'manager'];
    if (globalRole && elevated.includes(globalRole)) return;
    const member = await this.teamsService.isTeamMember(userId, teamId);
    if (!member) {
      throw new ForbiddenException('No pertenecés a este equipo');
    }
  }

  mapPaymentResponse(payment: PlayerPayment) {
    const user = payment.user;
    const fullName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.username
      : undefined;
    return {
      id: payment.id,
      teamId: payment.teamId,
      userId: payment.userId,
      amount: this.toNumber(payment.amount),
      method: payment.method,
      status: payment.status,
      notes: payment.notes,
      receiptPath: payment.receiptPath ?? null,
      receiptMimeType: payment.receiptMimeType ?? null,
      hasReceipt: !!payment.receiptPath,
      createdAt: payment.createdAt,
      confirmedAt: payment.confirmedAt,
      rejectionReason: payment.rejectionReason,
      user: user
        ? {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
          }
        : undefined,
      userName: fullName,
    };
  }

  private async assertCanViewReceipt(
    payment: PlayerPayment,
    userId: number,
    globalRole?: string,
  ): Promise<void> {
    if (payment.userId === userId) return;
    const elevated = ['super_admin', 'manager', 'admin'];
    if (globalRole && elevated.includes(globalRole)) {
      const isAdmin = await this.teamsService.isTeamAdmin(
        userId,
        payment.teamId,
      );
      if (isAdmin) return;
      if (['super_admin', 'manager'].includes(globalRole)) return;
    }
    throw new ForbiddenException(
      'No tenés permiso para ver este comprobante',
    );
  }

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

  async submitPayment(
    dto: SubmitPaymentDto,
    userId: number,
    receiptFile?: ReceiptUploadFile,
  ) {
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
    const saved = await this.paymentRepository.save(payment);

    if (receiptFile) {
      const { relativePath, mimeType } = this.receiptStorage.saveForPayment(
        saved.teamId,
        saved.id,
        receiptFile,
      );
      saved.receiptPath = relativePath;
      saved.receiptMimeType = mimeType;
      await this.paymentRepository.save(saved);
    }

    let trainingAutoConfirmed = false;
    if (dto.feeChargeIds?.length) {
      const linked = await this.feeChargeRepository.find({
        where: { id: In(dto.feeChargeIds) },
      });
      trainingAutoConfirmed =
        linked.length > 0 &&
        linked.every((c) => c.type === FeeChargeType.TRAINING);
    }

    if (trainingAutoConfirmed) {
      await this.confirmPayment(saved.id, userId);
    }

    return this.mapPaymentResponse(
      (await this.paymentRepository.findOne({
        where: { id: saved.id },
        relations: ['user'],
      })) ?? saved,
    );
  }

  async getPendingPayments(teamId: number) {
    const rows = await this.paymentRepository.find({
      where: {
        teamId,
        status: PaymentStatus.PENDING_CONFIRMATION,
      },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((p) => this.mapPaymentResponse(p));
  }

  async getPaymentReceipt(
    paymentId: number,
    userId: number,
    globalRole?: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const payment = await this.findPaymentOrThrow(paymentId);
    if (!payment.receiptPath) {
      throw new NotFoundException('Este pago no tiene comprobante');
    }
    await this.assertCanViewReceipt(payment, userId, globalRole);
    const { buffer, mimeType } = this.receiptStorage.readAbsolutePath(
      payment.receiptPath,
    );
    return {
      buffer,
      mimeType: payment.receiptMimeType ?? mimeType,
    };
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
      const chargeTypes = await this.feeChargeRepository.find({
        where: { id: In(allocations.map((a) => a.feeChargeId)) },
      });
      const hasTraining = chargeTypes.some(
        (c) => c.type === FeeChargeType.TRAINING,
      );
      const ledger = this.ledgerRepository.create({
        teamId: dto.teamId,
        type: LedgerEntryType.INCOME,
        category: hasTraining
          ? LedgerCategory.TRAINING
          : LedgerCategory.MONTHLY_FEE,
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
      pendingPayments: pendingPayments.map((p) => this.mapPaymentResponse(p)),
      charges,
      payments: payments.map((p) => this.mapPaymentResponse(p)),
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

  async generateMonthlyQuota(dto: GenerateMonthlyQuotaDto, createdBy?: number) {
    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const concept = `Cuota ${monthNames[dto.month - 1]} ${dto.year}`;
    const dueDate = new Date(dto.year, dto.month, 0);

    return this.generateFeeBatch(
      {
        teamId: dto.teamId,
        concept,
        amount: dto.amount,
        dueDate: dueDate.toISOString().slice(0, 10),
        season: dto.season,
        type: FeeChargeType.MONTHLY_QUOTA,
      },
      createdBy,
    );
  }

  async getQuotaOverview(
    teamId: number,
    userId: number,
    globalRole?: string,
    conceptPrefix?: string,
  ) {
    await this.assertTeamMember(userId, teamId, globalRole);

    const charges = await this.feeChargeRepository.find({
      where: { teamId, type: FeeChargeType.MONTHLY_QUOTA },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    let filtered = charges;
    if (conceptPrefix) {
      filtered = charges.filter((c) =>
        c.concept.toLowerCase().includes(conceptPrefix.toLowerCase()),
      );
    } else {
      const latestConcept = charges[0]?.concept;
      if (latestConcept) {
        filtered = charges.filter((c) => c.concept === latestConcept);
      }
    }

    const byUser = new Map<
      number,
      {
        userId: number;
        userName: string;
        totalCharged: number;
        totalPaid: number;
        balance: number;
        status: FeeChargeStatus;
      }
    >();

    for (const c of filtered) {
      const name = c.user
        ? [c.user.firstName, c.user.lastName].filter(Boolean).join(' ').trim() ||
          c.user.username
        : `Usuario ${c.userId}`;
      const existing = byUser.get(c.userId);
      const amount = this.toNumber(c.amount);
      const paid = this.toNumber(c.paidAmount);
      if (existing) {
        existing.totalCharged += amount;
        existing.totalPaid += paid;
        existing.balance = existing.totalCharged - existing.totalPaid;
        if (existing.balance > 0.01) {
          existing.status =
            existing.totalPaid > 0
              ? FeeChargeStatus.PARTIAL
              : FeeChargeStatus.PENDING;
        } else {
          existing.status = FeeChargeStatus.PAID;
        }
      } else {
        byUser.set(c.userId, {
          userId: c.userId,
          userName: name ?? `Usuario ${c.userId}`,
          totalCharged: amount,
          totalPaid: paid,
          balance: amount - paid,
          status: c.status,
        });
      }
    }

    const players = Array.from(byUser.values()).sort(
      (a, b) => b.balance - a.balance,
    );

    const totalCharged = players.reduce((s, p) => s + p.totalCharged, 0);
    const totalPaid = players.reduce((s, p) => s + p.totalPaid, 0);

    return {
      teamId,
      concept: filtered[0]?.concept ?? null,
      totalCharged,
      totalPaid,
      totalOutstanding: Math.max(0, totalCharged - totalPaid),
      playersCount: players.length,
      paidCount: players.filter((p) => p.balance <= 0.01).length,
      pendingCount: players.filter((p) => p.balance > 0.01).length,
      players,
    };
  }

  async sendQuotaReminders(
    teamId: number,
    managerId: number,
    globalRole?: string,
    concept?: string,
  ) {
    const overview = await this.getQuotaOverview(
      teamId,
      managerId,
      globalRole,
      concept,
    );
    const debtors = overview.players.filter((p) => p.balance > 0.01);
    if (!debtors.length) {
      return { sent: 0, message: 'No hay cuotas pendientes' };
    }

    await this.notificationsService.createBulkNotifications({
      userIds: debtors.map((d) => d.userId),
      teamId,
      type: NotificationType.PAYMENT_REMINDER,
      priority: NotificationPriority.HIGH,
      title: 'Cuota pendiente',
      message: `Recordá abonar ${overview.concept ?? 'la cuota del mes'}. Revisá el estado de cuotas en la app.`,
      data: {
        action: 'open_finance',
        teamId,
        concept: overview.concept,
      },
    });

    return { sent: debtors.length, concept: overview.concept };
  }

  async getPlayerFeeHistory(
    targetUserId: number,
    teamId: number,
    viewerId: number,
    globalRole?: string,
  ) {
    await this.assertTeamMember(viewerId, teamId, globalRole);

    const charges = await this.feeChargeRepository.find({
      where: { teamId, userId: targetUserId },
      order: { createdAt: 'DESC' },
    });

    const payments = await this.paymentRepository.find({
      where: { teamId, userId: targetUserId },
      order: { createdAt: 'DESC' },
    });

    return {
      userId: targetUserId,
      teamId,
      charges,
      payments: payments.map((p) => this.mapPaymentResponse(p)),
    };
  }

  async openTrainingCollection(
    eventId: number,
    dto: OpenTrainingCollectionDto,
    createdBy: number,
    globalRole?: string,
  ) {
    const event = await this.sportEventRepository.findOne({
      where: { id: eventId },
      relations: ['participants', 'participants.user'],
    });
    if (!event || event.type !== SportEventType.TRAINING) {
      throw new BadRequestException('El evento debe ser un entrenamiento');
    }

    const isAdmin = await this.teamsService.isTeamAdmin(
      createdBy,
      event.teamId,
    );
    const elevated = ['super_admin', 'manager', 'admin', 'team_captain', 'dt'];
    if (!isAdmin && !(globalRole && elevated.includes(globalRole))) {
      throw new ForbiddenException(
        'Solo el cuerpo técnico puede abrir cobro de entrenamiento',
      );
    }

    const existing = await this.feeChargeRepository.count({
      where: { sportEventId: eventId },
    });
    if (existing > 0) {
      throw new BadRequestException(
        'Ya se abrió el cobro para este entrenamiento',
      );
    }

    const targets = (event.participants ?? []).filter(
      (p) => p.status === ParticipantStatus.CONFIRMED || p.attended === true,
    );
    if (!targets.length) {
      targets.push(
        ...(event.participants ?? []).filter(
          (p) => p.status !== ParticipantStatus.DECLINED,
        ),
      );
    }

    const concept = `Entrenamiento ${event.eventDate.toLocaleDateString('es-AR')}`;
    const charges: FeeCharge[] = [];

    for (const p of targets) {
      const charge = this.feeChargeRepository.create({
        teamId: event.teamId,
        userId: p.userId,
        type: FeeChargeType.TRAINING,
        concept,
        amount: dto.amountPerPlayer,
        paidAmount: 0,
        status: FeeChargeStatus.PENDING,
        sportEventId: eventId,
        season: this.currentSeason(),
        createdBy,
      });
      charges.push(await this.feeChargeRepository.save(charge));
    }

    const meta = {
      ...(event.metadata ?? {}),
      trainingCollection: {
        amountPerPlayer: dto.amountPerPlayer,
        openedAt: new Date().toISOString(),
        notes: dto.notes,
      },
    };
    await this.sportEventRepository.update(eventId, { metadata: meta });

    return {
      eventId,
      concept,
      amountPerPlayer: dto.amountPerPlayer,
      chargesCreated: charges.length,
      charges,
    };
  }

  async getTrainingCollection(
    eventId: number,
    userId: number,
    globalRole?: string,
  ) {
    const event = await this.sportEventRepository.findOne({
      where: { id: eventId },
      relations: ['participants'],
    });
    if (!event || event.type !== SportEventType.TRAINING) {
      throw new NotFoundException('Entrenamiento no encontrado');
    }
    await this.assertTeamMember(userId, event.teamId, globalRole);

    const { total, items } = await this.sumTrainingEventExpenses(
      event.teamId,
      eventId,
    );

    const charges = await this.feeChargeRepository.find({
      where: { sportEventId: eventId },
      relations: ['user'],
      order: { userId: 'ASC' },
    });

    const confirmedCount = (event.participants ?? []).filter(
      (p) => p.status === ParticipantStatus.CONFIRMED,
    ).length;

    return {
      eventId,
      teamId: event.teamId,
      title: event.title,
      eventDate: event.eventDate.toISOString(),
      totalExpense: total,
      confirmedCount,
      expenses: items.map((e) => ({
        id: e.id,
        amount: this.toNumber(e.amount),
        description: e.description,
        createdAt: e.createdAt,
      })),
      amountPerPlayer: charges[0]
        ? this.toNumber(charges[0].amount)
        : event.metadata?.trainingCollection?.amountPerPlayer ?? null,
      metadata: event.metadata?.trainingCollection ?? null,
      players: charges.map((c) => ({
        userId: c.userId,
        userName: c.user
          ? [c.user.firstName, c.user.lastName].filter(Boolean).join(' ').trim() ||
            c.user.username
          : `Usuario ${c.userId}`,
        chargeId: c.id,
        amount: this.toNumber(c.amount),
        paidAmount: this.toNumber(c.paidAmount),
        status: c.status,
        balance: this.toNumber(c.amount) - this.toNumber(c.paidAmount),
      })),
      summary: {
        total: charges.length,
        paid: charges.filter((c) => c.status === FeeChargeStatus.PAID).length,
        pending: charges.filter(
          (c) =>
            c.status === FeeChargeStatus.PENDING ||
            c.status === FeeChargeStatus.PARTIAL,
        ).length,
      },
    };
  }

  async createTrainingExpense(
    dto: CreateTrainingExpenseDto,
    createdBy?: number,
  ) {
    const event = await this.sportEventRepository.findOne({
      where: { id: dto.sportEventId, teamId: dto.teamId },
    });
    if (!event || event.type !== SportEventType.TRAINING) {
      throw new BadRequestException(
        'El gasto debe asociarse a un entrenamiento del equipo',
      );
    }

    const entry = this.ledgerRepository.create({
      teamId: dto.teamId,
      type: LedgerEntryType.EXPENSE,
      category: LedgerCategory.TRAINING,
      amount: dto.amount,
      description: dto.description,
      referenceType: 'sport_event',
      referenceId: dto.sportEventId,
      createdBy,
    });
    const saved = await this.ledgerRepository.save(entry);
    await this.syncTrainingChargesFromExpenses(dto.sportEventId, createdBy);
    return saved;
  }

  private async sumTrainingEventExpenses(
    teamId: number,
    eventId: number,
  ): Promise<{ total: number; items: LedgerEntry[] }> {
    const items = await this.ledgerRepository.find({
      where: {
        teamId,
        type: LedgerEntryType.EXPENSE,
        category: LedgerCategory.TRAINING,
        referenceType: 'sport_event',
        referenceId: eventId,
      },
      order: { createdAt: 'ASC' },
    });
    const total = items.reduce((s, e) => s + this.toNumber(e.amount), 0);
    return { total, items };
  }

  /** Reparte gastos del entreno entre jugadores con confirmación asistencia. */
  async syncTrainingChargesFromExpenses(
    eventId: number,
    createdBy?: number,
  ) {
    const event = await this.sportEventRepository.findOne({
      where: { id: eventId },
      relations: ['participants', 'participants.user'],
    });
    if (!event || event.type !== SportEventType.TRAINING) {
      return { eventId, totalExpense: 0, confirmedCount: 0, amountPerPlayer: 0 };
    }

    const { total, items } = await this.sumTrainingEventExpenses(
      event.teamId,
      eventId,
    );

    const confirmed = (event.participants ?? []).filter(
      (p) => p.status === ParticipantStatus.CONFIRMED,
    );
    const splitCount = confirmed.length;
    const amountPerPlayer =
      splitCount > 0 && total > 0
        ? Math.round((total / splitCount) * 100) / 100
        : 0;

    const concept = `Entrenamiento ${event.eventDate.toLocaleDateString('es-AR')}`;
    const confirmedUserIds = new Set(confirmed.map((p) => p.userId));

    if (total > 0 && splitCount > 0) {
      for (const p of confirmed) {
        let charge = await this.feeChargeRepository.findOne({
          where: { sportEventId: eventId, userId: p.userId },
        });
        if (charge) {
          charge.amount = amountPerPlayer;
          charge.concept = concept;
          charge.status = this.resolveChargeStatus(
            amountPerPlayer,
            this.toNumber(charge.paidAmount),
          );
        } else {
          charge = this.feeChargeRepository.create({
            teamId: event.teamId,
            userId: p.userId,
            type: FeeChargeType.TRAINING,
            concept,
            amount: amountPerPlayer,
            paidAmount: 0,
            status: FeeChargeStatus.PENDING,
            sportEventId: eventId,
            season: this.currentSeason(),
            createdBy,
          });
        }
        await this.feeChargeRepository.save(charge);
      }
    }

    const existingCharges = await this.feeChargeRepository.find({
      where: { sportEventId: eventId },
    });
    for (const c of existingCharges) {
      if (!confirmedUserIds.has(c.userId)) {
        await this.feeChargeRepository.remove(c);
      }
    }

    const meta = {
      ...(event.metadata ?? {}),
      trainingCollection: {
        totalExpense: total,
        amountPerPlayer: splitCount > 0 ? amountPerPlayer : null,
        confirmedCount: splitCount,
        expenseCount: items.length,
        syncedAt: new Date().toISOString(),
      },
    };
    await this.sportEventRepository.update(eventId, { metadata: meta });

    return {
      eventId,
      totalExpense: total,
      confirmedCount: splitCount,
      amountPerPlayer: splitCount > 0 ? amountPerPlayer : null,
      expenses: items.map((e) => ({
        id: e.id,
        amount: this.toNumber(e.amount),
        description: e.description,
        createdAt: e.createdAt,
      })),
    };
  }
}
