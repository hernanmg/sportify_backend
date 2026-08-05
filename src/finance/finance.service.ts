import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository, In } from 'typeorm';
import { FeeCharge } from './entities/fee-charge.entity';
import { PlayerPayment } from './entities/player-payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { CashClosure } from './entities/cash-closure.entity';
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
import { CashCloseDto } from './dtos/cash-close.dto';
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
import { GenerateRecurringQuotaDto } from './dtos/generate-recurring-quota.dto';
import { UpdateRecurringQuotaDto } from './dtos/update-recurring-quota.dto';
import { OpenTrainingCollectionDto } from './dtos/open-training-collection.dto';
import { CreateTrainingExpenseDto } from './dtos/create-training-expense.dto';
import {
  PaymentReceiptStorage,
  ReceiptUploadFile,
} from './payment-receipt.storage';
import { TeamAuditService } from '../teams/team-audit.service';

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
    @InjectRepository(CashClosure)
    private readonly cashClosureRepository: Repository<CashClosure>,
    private readonly rosterService: RosterService,
    private readonly teamsService: TeamsService,
    private readonly receiptStorage: PaymentReceiptStorage,
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => TeamAuditService))
    private readonly teamAuditService: TeamAuditService,
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

  async syncMissingFeeCharges(
    teamId: number,
    season?: string,
    viewerId?: number,
    globalRole?: string,
  ) {
    if (viewerId) {
      await this.teamsService.assertCanManageTeamFinance(
        viewerId,
        teamId,
        globalRole,
      );
    }
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
    const seenUserIds = new Set<number>();
    for (const entry of roster) {
      const userId = entry.player?.user_id;
      if (!userId || seenUserIds.has(userId)) continue;
      seenUserIds.add(userId);

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
          status: this.initialMonthlyQuotaStatus(
            template.type,
            template.dueDate,
            template.concept,
          ),
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

  async generateFeeBatch(
    dto: CreateFeeBatchDto,
    createdBy?: number,
    globalRole?: string,
  ) {
    if (createdBy) {
      await this.teamsService.assertCanManageTeamFinance(
        createdBy,
        dto.teamId,
        globalRole,
      );
    }
    const { roster, resolvedSeason } = await this.resolveRosterForFinance(
      dto.teamId,
      dto.season,
    );

    const existingCharges = await this.feeChargeRepository.find({
      where: { teamId: dto.teamId, season: resolvedSeason, concept: dto.concept },
    });

    const charges: FeeCharge[] = [];
    const seenUserIds = new Set<number>();
    for (const entry of roster) {
      const userId = entry.player?.user_id;
      if (!userId || seenUserIds.has(userId)) continue;
      seenUserIds.add(userId);

      const duplicate = existingCharges.find(
        (charge) =>
          charge.userId === userId && charge.concept === dto.concept,
      );
      if (duplicate) continue;

      const charge = this.feeChargeRepository.create({
        teamId: dto.teamId,
        userId,
        type: dto.type ?? FeeChargeType.MONTHLY_QUOTA,
        concept: dto.concept,
        amount: dto.amount,
        paidAmount: 0,
        status: this.initialMonthlyQuotaStatus(
          dto.type ?? FeeChargeType.MONTHLY_QUOTA,
          dto.dueDate,
          dto.concept,
        ),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        season: resolvedSeason,
        createdBy,
        recurringGroupId: dto.recurringGroupId,
      });
      const saved = await this.feeChargeRepository.save(charge);
      charges.push(saved);
      existingCharges.push(saved);
    }

    if (charges.length > 0) {
      await this.teamAuditService.log({
        teamId: dto.teamId,
        actorUserId: createdBy,
        action: 'quota_generated',
        entityType: 'fee_charge',
        summary: `Cuotas: ${dto.concept} (${charges.length} cargos, temporada ${resolvedSeason})`,
        metadata: {
          concept: dto.concept,
          amount: dto.amount,
          season: resolvedSeason,
          count: charges.length,
        },
      });
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

  private currentBillingPeriod(ref = new Date()): { year: number; month: number } {
    return { year: ref.getFullYear(), month: ref.getMonth() + 1 };
  }

  private chargeBillingPeriod(
    charge: Pick<FeeCharge, 'dueDate' | 'concept' | 'type'>,
  ): { year: number; month: number } | null {
    if (charge.type !== FeeChargeType.MONTHLY_QUOTA) return null;
    if (charge.dueDate) {
      const d = new Date(charge.dueDate);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    }
    const match = charge.concept.match(/Cuota\s+(\w+)\s+(\d{4})/i);
    if (!match) return null;
    const monthNames = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    const idx = monthNames.indexOf(match[1].toLowerCase());
    if (idx < 0) return null;
    return { year: parseInt(match[2], 10), month: idx + 1 };
  }

  private isFutureMonthlyQuota(
    charge: Pick<FeeCharge, 'dueDate' | 'concept' | 'type' | 'status'>,
    ref = new Date(),
  ): boolean {
    if (charge.status === FeeChargeStatus.SCHEDULED) return true;
    if (charge.type !== FeeChargeType.MONTHLY_QUOTA) return false;
    const period = this.chargeBillingPeriod(charge);
    if (!period) return false;
    const now = this.currentBillingPeriod(ref);
    return (
      period.year > now.year ||
      (period.year === now.year && period.month > now.month)
    );
  }

  private isChargePayable(charge: FeeCharge, ref = new Date()): boolean {
    if (
      charge.status === FeeChargeStatus.PAID ||
      charge.status === FeeChargeStatus.WAIVED
    ) {
      return false;
    }
    if (this.isFutureMonthlyQuota(charge, ref)) return false;
    const outstanding =
      this.toNumber(charge.amount) - this.toNumber(charge.paidAmount);
    return outstanding > 0.01;
  }

  private chargeOutstanding(charge: FeeCharge, ref = new Date()): number {
    if (!this.isChargePayable(charge, ref)) return 0;
    return Math.max(
      0,
      this.toNumber(charge.amount) - this.toNumber(charge.paidAmount),
    );
  }

  private initialMonthlyQuotaStatus(
    type: FeeChargeType,
    dueDate?: Date | string,
    concept?: string,
  ): FeeChargeStatus {
    if (type !== FeeChargeType.MONTHLY_QUOTA) {
      return FeeChargeStatus.PENDING;
    }
    const probe = {
      type,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      concept: concept ?? '',
      status: FeeChargeStatus.PENDING,
    } as FeeCharge;
    return this.isFutureMonthlyQuota(probe)
      ? FeeChargeStatus.SCHEDULED
      : FeeChargeStatus.PENDING;
  }

  private async promoteScheduledCharges(teamId?: number): Promise<number> {
    const charges = await this.feeChargeRepository.find({
      where: {
        ...(teamId ? { teamId } : {}),
        type: FeeChargeType.MONTHLY_QUOTA,
        status: In([FeeChargeStatus.SCHEDULED, FeeChargeStatus.PENDING]),
      },
    });
    let promoted = 0;
    for (const charge of charges) {
      if (this.isFutureMonthlyQuota(charge)) {
        if (charge.status !== FeeChargeStatus.SCHEDULED) {
          charge.status = FeeChargeStatus.SCHEDULED;
          await this.feeChargeRepository.save(charge);
        }
        continue;
      }
      if (charge.status === FeeChargeStatus.SCHEDULED) {
        charge.status = FeeChargeStatus.PENDING;
        await this.feeChargeRepository.save(charge);
        promoted += 1;
      }
    }
    return promoted;
  }

  async registerPayment(
    dto: RegisterPaymentDto,
    recordedBy?: number,
    globalRole?: string,
  ) {
    if (recordedBy) {
      await this.teamsService.assertCanManageTeamFinance(
        recordedBy,
        dto.teamId,
        globalRole,
      );
    }
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

  async confirmPayment(
    paymentId: number,
    managerId: number,
    globalRole?: string,
  ) {
    const payment = await this.findPaymentOrThrow(paymentId);
    await this.teamsService.assertCanManageTeamFinance(
      managerId,
      payment.teamId,
      globalRole,
    );
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
    globalRole?: string,
  ) {
    const payment = await this.findPaymentOrThrow(paymentId);
    await this.teamsService.assertCanManageTeamFinance(
      managerId,
      payment.teamId,
      globalRole,
    );
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
    }).then((charges) => charges.filter((c) => this.isChargePayable(c)));
  }

  async createTeamExpense(
    dto: CreateTeamExpenseDto,
    createdBy?: number,
    globalRole?: string,
  ) {
    if (createdBy) {
      await this.teamsService.assertCanManageTeamFinance(
        createdBy,
        dto.teamId,
        globalRole,
      );
    }
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

    if (teamId) {
      await this.promoteScheduledCharges(teamId);
    }

    const charges = await this.feeChargeRepository.find({
      where: chargeWhere,
      relations: ['team'],
      order: { dueDate: 'DESC', id: 'DESC' },
    });

    const paymentWhere: Record<string, unknown> = { userId };
    if (teamId) paymentWhere.teamId = teamId;

    const payments = await this.paymentRepository.find({
      where: paymentWhere,
      relations: ['user', 'allocations', 'allocations.feeCharge'],
      order: { createdAt: 'DESC' },
    });

    const pendingPayments = payments.filter(
      (p) => p.status === PaymentStatus.PENDING_CONFIRMATION,
    );

    const paymentHistory = payments
      .filter((p) => p.status !== PaymentStatus.PENDING_CONFIRMATION)
      .map((p) => this.mapPaymentResponse(p));

    const paidChargeHistory = charges
      .filter(
        (c) =>
          this.toNumber(c.paidAmount) > 0 &&
          !this.isFutureMonthlyQuota(c) &&
          !payments.some((p) =>
            (p.allocations ?? []).some((a) => a.feeChargeId === c.id),
          ),
      )
      .map((c) => ({
        id: -c.id,
        teamId: c.teamId,
        userId: c.userId,
        amount: this.toNumber(c.paidAmount),
        method: 'transfer',
        status: PaymentStatus.CONFIRMED,
        notes: `Abono aplicado a: ${c.concept}`,
        receiptPath: null,
        receiptMimeType: null,
        hasReceipt: false,
        createdAt: c.updatedAt ?? c.createdAt,
        confirmedAt: c.updatedAt ?? c.createdAt,
        rejectionReason: null,
        user: undefined,
        userName: undefined,
      }));

    const totalCharged = charges.reduce(
      (sum, c) =>
        sum +
        (this.isFutureMonthlyQuota(c) ? 0 : this.toNumber(c.amount)),
      0,
    );
    const totalPaidOnCharges = charges.reduce(
      (sum, c) =>
        sum +
        (this.isFutureMonthlyQuota(c) ? 0 : this.toNumber(c.paidAmount)),
      0,
    );
    const balance = charges.reduce(
      (sum, c) => sum + this.chargeOutstanding(c),
      0,
    );

    return {
      userId,
      teamId: teamId ?? null,
      totalCharged,
      totalPaid: totalPaidOnCharges,
      balance,
      pendingCharges: charges.filter((c) => this.isChargePayable(c)),
      scheduledCharges: charges.filter((c) => this.isFutureMonthlyQuota(c)),
      pendingPayments: pendingPayments.map((p) => this.mapPaymentResponse(p)),
      charges,
      payments: [...paymentHistory, ...paidChargeHistory].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      ),
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
    const totalOutstanding = charges.reduce(
      (sum, c) => sum + this.chargeOutstanding(c),
      0,
    );

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

  async getTeamPlayerBalances(
    teamId: number,
    season?: string,
    viewerId?: number,
    globalRole?: string,
    categoryId?: number,
  ) {
    if (viewerId) {
      await this.teamsService.assertCanManageTeamFinance(
        viewerId,
        teamId,
        globalRole,
      );
    }
    await this.syncMissingFeeCharges(teamId, season);
    await this.promoteScheduledCharges(teamId);

    let { roster } = await this.findRosterForFinance(teamId, season);
    if (categoryId != null) {
      roster = roster.filter((entry) => entry.categoryId === categoryId);
    }
    const charges = await this.feeChargeRepository.find({
      where: { teamId },
      relations: ['user'],
    });

    const totalsByUser = new Map<
      number,
      { totalCharged: number; totalPaid: number; userName?: string }
    >();

    for (const charge of charges) {
      if (this.isFutureMonthlyQuota(charge)) continue;
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
    const processedUserIds = new Set<number>();

    for (const entry of roster) {
      const userId = entry.player?.user_id;
      if (!userId || processedUserIds.has(userId)) continue;
      processedUserIds.add(userId);
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
        balance: charges
          .filter((c) => c.userId === userId)
          .reduce((sum, c) => sum + this.chargeOutstanding(c), 0),
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
        balance: charges
          .filter((c) => c.userId === userId)
          .reduce((sum, c) => sum + this.chargeOutstanding(c), 0),
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

  async generateMonthlyQuota(
    dto: GenerateMonthlyQuotaDto,
    createdBy?: number,
    globalRole?: string,
  ) {
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
      globalRole,
    );
  }

  async generateRecurringMonthlyQuota(
    dto: GenerateRecurringQuotaDto,
    createdBy?: number,
    globalRole?: string,
  ) {
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
    const groupId = randomUUID();
    let year = dto.year;
    let month = dto.month;
    let totalCreated = 0;
    const months: Array<{ year: number; month: number; concept: string }> = [];

    for (let i = 0; i < dto.monthCount; i++) {
      const concept = `Cuota ${monthNames[month - 1]} ${year}`;
      const dueDate = new Date(year, month, 0);
      const result = await this.generateFeeBatch(
        {
          teamId: dto.teamId,
          concept,
          amount: dto.amount,
          dueDate: dueDate.toISOString().slice(0, 10),
          season: dto.season,
          type: FeeChargeType.MONTHLY_QUOTA,
          recurringGroupId: groupId,
        },
        createdBy,
        globalRole,
      );
      totalCreated += result.created;
      months.push({ year, month, concept });
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    return {
      recurringGroupId: groupId,
      monthCount: dto.monthCount,
      amount: dto.amount,
      months,
      chargesCreated: totalCreated,
    };
  }

  async listRecurringQuotaSeries(
    teamId: number,
    userId: number,
    globalRole?: string,
  ) {
    await this.assertTeamMember(userId, teamId, globalRole);

    const charges = await this.feeChargeRepository.find({
      where: {
        teamId,
        type: FeeChargeType.MONTHLY_QUOTA,
      },
      order: { dueDate: 'ASC', id: 'ASC' },
    });

    const groups = new Map<
      string,
      {
        recurringGroupId: string;
        amount: number;
        concepts: string[];
        chargeCount: number;
        pendingCount: number;
        paidCount: number;
        startDueDate?: string;
        endDueDate?: string;
      }
    >();

    for (const charge of charges) {
      if (!charge.recurringGroupId) continue;
      const key = charge.recurringGroupId;
      const amount = this.toNumber(charge.amount);
      const entry = groups.get(key) ?? {
        recurringGroupId: key,
        amount,
        concepts: [],
        chargeCount: 0,
        pendingCount: 0,
        paidCount: 0,
        startDueDate: charge.dueDate
          ? charge.dueDate.toISOString().slice(0, 10)
          : undefined,
        endDueDate: charge.dueDate
          ? charge.dueDate.toISOString().slice(0, 10)
          : undefined,
      };

      entry.chargeCount += 1;
      if (!entry.concepts.includes(charge.concept)) {
        entry.concepts.push(charge.concept);
      }
      if (this.isFutureMonthlyQuota(charge)) {
        // Cuotas de meses futuros: no cuentan como pendientes de cobro.
      } else if (
        charge.status === FeeChargeStatus.PENDING ||
        charge.status === FeeChargeStatus.PARTIAL
      ) {
        entry.pendingCount += 1;
      } else if (charge.status === FeeChargeStatus.PAID) {
        entry.paidCount += 1;
      }
      if (charge.dueDate) {
        const due = charge.dueDate.toISOString().slice(0, 10);
        if (!entry.startDueDate || due < entry.startDueDate) {
          entry.startDueDate = due;
        }
        if (!entry.endDueDate || due > entry.endDueDate) {
          entry.endDueDate = due;
        }
      }
      groups.set(key, entry);
    }

    return [...groups.values()].sort((a, b) =>
      (b.startDueDate ?? '').localeCompare(a.startDueDate ?? ''),
    );
  }

  async updateRecurringQuotaSeries(
    recurringGroupId: string,
    dto: UpdateRecurringQuotaDto,
    actorId: number,
    globalRole?: string,
  ) {
    const charges = await this.feeChargeRepository.find({
      where: { recurringGroupId },
    });
    if (!charges.length) {
      throw new NotFoundException('Serie de cuotas no encontrada');
    }

    await this.teamsService.assertCanManageTeamFinance(
      actorId,
      charges[0].teamId,
      globalRole,
    );

    let updated = 0;
    for (const charge of charges) {
      if (
        charge.status !== FeeChargeStatus.PENDING ||
        this.toNumber(charge.paidAmount) > 0
      ) {
        continue;
      }
      charge.amount = dto.amount;
      await this.feeChargeRepository.save(charge);
      updated += 1;
    }

    return {
      recurringGroupId,
      updatedCharges: updated,
      amount: dto.amount,
    };
  }

  async updateFeeCharge(
    chargeId: number,
    dto: {
      amount?: number;
      concept?: string;
      dueDate?: string;
      status?: FeeChargeStatus;
    },
    actorId: number,
    globalRole?: string,
  ) {
    const charge = await this.feeChargeRepository.findOne({
      where: { id: chargeId },
    });
    if (!charge) {
      throw new NotFoundException(`Cuota #${chargeId} no encontrada`);
    }
    await this.teamsService.assertCanManageTeamFinance(
      actorId,
      charge.teamId,
      globalRole,
    );

    const paid = this.toNumber(charge.paidAmount);
    if (dto.amount != null) {
      if (paid > 0.01 && dto.amount + 0.001 < paid) {
        throw new BadRequestException(
          'El monto no puede ser menor a lo ya pagado',
        );
      }
      charge.amount = dto.amount;
      if (charge.status !== FeeChargeStatus.SCHEDULED) {
        charge.status = this.resolveChargeStatus(
          this.toNumber(charge.amount),
          paid,
        );
      }
    }
    if (dto.concept != null && dto.concept.trim()) {
      charge.concept = dto.concept.trim();
    }
    if (dto.dueDate != null) {
      charge.dueDate = new Date(dto.dueDate);
      if (
        charge.type === FeeChargeType.MONTHLY_QUOTA &&
        paid <= 0.01 &&
        charge.status !== FeeChargeStatus.PAID &&
        charge.status !== FeeChargeStatus.WAIVED
      ) {
        charge.status = this.initialMonthlyQuotaStatus(
          charge.type,
          charge.dueDate,
          charge.concept,
        );
      }
    }
    if (dto.status != null) {
      if (
        dto.status === FeeChargeStatus.WAIVED ||
        dto.status === FeeChargeStatus.PENDING ||
        dto.status === FeeChargeStatus.SCHEDULED
      ) {
        charge.status = dto.status;
      } else {
        throw new BadRequestException(
          'Estado no permitido. Usá pending, scheduled o waived.',
        );
      }
    }

    return this.feeChargeRepository.save(charge);
  }

  async deleteFeeCharge(
    chargeId: number,
    actorId: number,
    globalRole?: string,
  ) {
    const charge = await this.feeChargeRepository.findOne({
      where: { id: chargeId },
    });
    if (!charge) {
      throw new NotFoundException(`Cuota #${chargeId} no encontrada`);
    }
    await this.teamsService.assertCanManageTeamFinance(
      actorId,
      charge.teamId,
      globalRole,
    );

    if (this.toNumber(charge.paidAmount) > 0.01) {
      throw new BadRequestException(
        'No se puede eliminar una cuota con pagos aplicados. Anulá primero o dejala en waived.',
      );
    }

    await this.allocationRepository.delete({ feeChargeId: chargeId });
    await this.feeChargeRepository.delete(chargeId);
    return { deleted: true, id: chargeId };
  }

  async deleteRecurringQuotaSeries(
    recurringGroupId: string,
    actorId: number,
    globalRole?: string,
  ) {
    const charges = await this.feeChargeRepository.find({
      where: { recurringGroupId },
    });
    if (!charges.length) {
      throw new NotFoundException('Serie de cuotas no encontrada');
    }
    await this.teamsService.assertCanManageTeamFinance(
      actorId,
      charges[0].teamId,
      globalRole,
    );

    let deleted = 0;
    let skippedPaid = 0;
    for (const charge of charges) {
      if (this.toNumber(charge.paidAmount) > 0.01) {
        skippedPaid += 1;
        continue;
      }
      await this.allocationRepository.delete({ feeChargeId: charge.id });
      await this.feeChargeRepository.delete(charge.id);
      deleted += 1;
    }

    return {
      recurringGroupId,
      deleted,
      skippedPaid,
      message:
        skippedPaid > 0
          ? `Se eliminaron ${deleted} cuotas. ${skippedPaid} con pagos se conservaron.`
          : `Se eliminaron ${deleted} cuotas.`,
    };
  }

  async getQuotaOverview(
    teamId: number,
    userId: number,
    globalRole?: string,
    conceptPrefix?: string,
    season?: string,
    categoryId?: number,
  ) {
    await this.assertTeamMember(userId, teamId, globalRole);
    await this.promoteScheduledCharges(teamId);

    const balances = await this.getTeamPlayerBalances(
      teamId,
      season,
      undefined,
      globalRole,
      categoryId,
    );

    let players = balances.map((b) => ({
      userId: b.userId,
      userName: b.userName,
      totalCharged: b.totalCharged,
      totalPaid: b.totalPaid,
      balance: b.balance,
      status:
        b.balance <= 0.01
          ? FeeChargeStatus.PAID
          : b.totalPaid > 0
            ? FeeChargeStatus.PARTIAL
            : FeeChargeStatus.PENDING,
    }));

    if (conceptPrefix?.trim()) {
      const prefix = conceptPrefix.trim().toLowerCase();
      const charges = await this.feeChargeRepository.find({
        where: { teamId, type: FeeChargeType.MONTHLY_QUOTA },
      });
      const userIdsForConcept = new Set(
        charges
          .filter(
            (c) =>
              c.concept.toLowerCase().includes(prefix) &&
              !this.isFutureMonthlyQuota(c),
          )
          .map((c) => c.userId),
      );
      players = players.filter(
        (p) => p.balance > 0.01 || userIdsForConcept.has(p.userId),
      );
    }

    players.sort((a, b) => b.balance - a.balance);

    const totalCharged = players.reduce((s, p) => s + p.totalCharged, 0);
    const totalPaid = players.reduce((s, p) => s + p.totalPaid, 0);

    const scheduledCount = await this.feeChargeRepository.count({
      where: {
        teamId,
        type: FeeChargeType.MONTHLY_QUOTA,
        status: FeeChargeStatus.SCHEDULED,
      },
    });

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
    const now = new Date();
    const defaultConcept = `Cuota ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    return {
      teamId,
      concept: conceptPrefix?.trim() || defaultConcept,
      totalCharged,
      totalPaid,
      totalOutstanding: Math.max(
        0,
        players.reduce((s, p) => s + p.balance, 0),
      ),
      playersCount: players.length,
      paidCount: players.filter((p) => p.balance <= 0.01).length,
      pendingCount: players.filter((p) => p.balance > 0.01).length,
      scheduledCount,
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

  async closeCashRegister(
    teamId: number,
    dto: CashCloseDto,
    actorId: number,
    globalRole?: string,
  ) {
    await this.teamsService.assertCanManageTeamFinance(
      actorId,
      teamId,
      globalRole,
    );

    const summary = await this.getTeamSummary(teamId);
    const cashBalance = this.toNumber(summary.cashBalance);
    const outstanding = this.toNumber(summary.totalOutstanding);
    const carryPending = dto.carryPendingQuotas !== false;
    const resetToZero = dto.resetCashToZero !== false;

    if (resetToZero && Math.abs(cashBalance) > 0.01) {
      if (cashBalance > 0) {
        await this.ledgerRepository.save(
          this.ledgerRepository.create({
            teamId,
            type: LedgerEntryType.EXPENSE,
            category: LedgerCategory.CASH_ADJUSTMENT,
            amount: cashBalance,
            description:
              dto.notes?.trim() ||
              `Cierre de caja — ajuste a cero (saldo previo $${cashBalance.toFixed(2)})`,
            createdBy: actorId,
            referenceType: 'cash_closure',
          }),
        );
      } else {
        await this.ledgerRepository.save(
          this.ledgerRepository.create({
            teamId,
            type: LedgerEntryType.INCOME,
            category: LedgerCategory.CASH_ADJUSTMENT,
            amount: Math.abs(cashBalance),
            description:
              dto.notes?.trim() ||
              `Cierre de caja — ajuste a cero (saldo previo $${cashBalance.toFixed(2)})`,
            createdBy: actorId,
            referenceType: 'cash_closure',
          }),
        );
      }
    }

    const closure = await this.cashClosureRepository.save(
      this.cashClosureRepository.create({
        teamId,
        season: dto.season,
        closedBy: actorId,
        closedAt: new Date(),
        previousCashBalance: cashBalance,
        outstandingCarried: carryPending ? outstanding : 0,
        carryPendingQuotas: carryPending,
        resetCashToZero: resetToZero,
        notes: dto.notes,
      }),
    );

    const fresh = await this.getTeamSummary(teamId);
    return {
      closure,
      previousCashBalance: cashBalance,
      newCashBalance: this.toNumber(fresh.cashBalance),
      outstandingCarried: carryPending ? outstanding : 0,
      carryPendingQuotas: carryPending,
      message: carryPending
        ? `Caja cerrada. Cuotas pendientes ($${outstanding.toFixed(2)}) pasan como saldo a cobrar.`
        : 'Caja cerrada. Las cuotas pendientes no se arrastran en el cierre.',
    };
  }

  async resetCashToZero(
    teamId: number,
    actorId: number,
    globalRole?: string,
    notes?: string,
  ) {
    return this.closeCashRegister(
      teamId,
      {
        carryPendingQuotas: true,
        resetCashToZero: true,
        notes: notes || 'Caja llevada a cero',
      },
      actorId,
      globalRole,
    );
  }

  async listCashClosures(teamId: number, limit = 20) {
    return this.cashClosureRepository.find({
      where: { teamId },
      order: { closedAt: 'DESC' },
      take: limit,
      relations: ['closer'],
    });
  }
}
