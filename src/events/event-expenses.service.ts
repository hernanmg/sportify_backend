import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SportEvent, SportEventType } from './entities/sport-event.entity';
import { EventParticipant, ParticipantStatus } from './entities/event-participant.entity';
import { EventExpenseSheet } from './entities/event-expense-sheet.entity';
import { EventExpenseItem } from './entities/event-expense-item.entity';
import { EventExpenseShare } from './entities/event-expense-share.entity';
import { EventExpenseSplitMode } from './event-expense.enums';
import { AddEventExpenseItemDto } from './dtos/add-event-expense-item.dto';
import { UpdateEventExpenseSplitDto } from './dtos/update-event-expense-split.dto';
import { UpdateEventExpenseSharesDto } from './dtos/update-event-expense-shares.dto';
import { UpdateParticipantExpenseInclusionDto } from './dtos/update-participant-expense-inclusion.dto';

export interface ParticipantBalance {
  userId: number;
  userName: string;
  totalPaid: number;
  shareOwed: number;
  netBalance: number;
}

@Injectable()
export class EventExpensesService {
  constructor(
    @InjectRepository(SportEvent)
    private readonly sportEventRepository: Repository<SportEvent>,
    @InjectRepository(EventParticipant)
    private readonly participantRepository: Repository<EventParticipant>,
    @InjectRepository(EventExpenseSheet)
    private readonly sheetRepository: Repository<EventExpenseSheet>,
    @InjectRepository(EventExpenseItem)
    private readonly itemRepository: Repository<EventExpenseItem>,
    @InjectRepository(EventExpenseShare)
    private readonly shareRepository: Repository<EventExpenseShare>,
  ) {}

  private toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    return typeof value === 'number' ? value : parseFloat(value);
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private splitEqualCents(total: number, count: number): number[] {
    const cents = Math.round(this.toNumber(total) * 100);
    if (count <= 0) return [];
    const base = Math.floor(cents / count);
    const remainder = cents - base * count;
    const parts: number[] = [];
    for (let i = 0; i < count; i++) {
      parts.push((base + (i < remainder ? 1 : 0)) / 100);
    }
    return parts;
  }

  private userDisplayName(user?: {
    firstName?: string;
    lastName?: string;
    username?: string;
  }): string {
    if (!user) return 'Usuario';
    const full = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return full || user.username || 'Usuario';
  }

  private async loadSocialEvent(eventId: number): Promise<SportEvent> {
    const event = await this.sportEventRepository.findOne({
      where: { id: eventId },
      relations: ['participants', 'participants.user', 'team'],
    });
    if (!event) {
      throw new NotFoundException(`Evento ${eventId} no encontrado`);
    }
    if (event.type !== SportEventType.SOCIAL) {
      throw new BadRequestException(
        'Los gastos compartidos solo aplican a eventos sociales',
      );
    }
    return event;
  }

  private eligibleParticipants(event: SportEvent): EventParticipant[] {
    return (event.participants || []).filter(
      (p) =>
        p.status === ParticipantStatus.CONFIRMED &&
        p.includedInExpenseSplit !== false,
    );
  }

  private eligibleParticipantUserIds(event: SportEvent): number[] {
    return this.eligibleParticipants(event)
      .map((p) => p.userId)
      .sort((a, b) => a - b);
  }

  private async ensureSheet(
    eventId: number,
    createdBy?: number,
  ): Promise<EventExpenseSheet> {
    let sheet = await this.sheetRepository.findOne({
      where: { sportEventId: eventId },
    });
    if (!sheet) {
      sheet = this.sheetRepository.create({
        sportEventId: eventId,
        splitMode: EventExpenseSplitMode.EQUAL,
        createdBy,
      });
      sheet = await this.sheetRepository.save(sheet);
    }
    return sheet;
  }

  private async recalculateShares(
    sheet: EventExpenseSheet,
    event: SportEvent,
  ): Promise<EventExpenseShare[]> {
    const participantIds = this.eligibleParticipantUserIds(event);
    const items = await this.itemRepository.find({
      where: { sheetId: sheet.id },
    });
    const itemsTotal = items.reduce(
      (s, i) => s + this.toNumber(i.amount),
      0,
    );

    if (participantIds.length === 0 || itemsTotal <= 0) {
      await this.shareRepository.delete({ sheetId: sheet.id });
      return [];
    }

    if (sheet.splitMode === EventExpenseSplitMode.MANUAL) {
      const existing = await this.shareRepository.find({
        where: { sheetId: sheet.id },
      });
      if (existing.length > 0) {
        const existingSum = this.round2(
          existing.reduce((s, sh) => s + this.toNumber(sh.amount), 0),
        );
        if (Math.abs(existingSum - itemsTotal) <= 0.02) {
          return existing;
        }
        sheet.splitMode = EventExpenseSplitMode.EQUAL;
        await this.sheetRepository.save(sheet);
      }
    }

    await this.shareRepository.delete({ sheetId: sheet.id });

    const parts = this.splitEqualCents(itemsTotal, participantIds.length);
    const shareRows = participantIds.map((userId, idx) => ({
      userId,
      amount: this.round2(parts[idx] ?? 0),
    }));

    const saved: EventExpenseShare[] = [];
    for (const row of shareRows) {
      saved.push(
        await this.shareRepository.save(
          this.shareRepository.create({
            sheetId: sheet.id,
            userId: row.userId,
            amount: row.amount,
          }),
        ),
      );
    }

    for (const p of event.participants || []) {
      const share = shareRows.find((s) => s.userId === p.userId);
      p.expenseShare = share ? share.amount : null;
      await this.participantRepository.save(p);
    }

    return saved;
  }

  private computeBalances(
    sheet: EventExpenseSheet | null,
    event: SportEvent,
    items: EventExpenseItem[],
  ): ParticipantBalance[] {
    const participantIds = this.eligibleParticipantUserIds(event);
    const itemsTotal = items.reduce(
      (s, i) => s + this.toNumber(i.amount),
      0,
    );

    const paidByUser = new Map<number, number>();
    for (const item of items) {
      const uid = item.paidByUserId;
      paidByUser.set(uid, (paidByUser.get(uid) ?? 0) + this.toNumber(item.amount));
    }

    const shareByUser = new Map<number, number>();
    if (sheet?.shares?.length) {
      for (const sh of sheet.shares) {
        shareByUser.set(sh.userId, this.toNumber(sh.amount));
      }
    } else if (participantIds.length > 0 && itemsTotal > 0) {
      const parts = this.splitEqualCents(itemsTotal, participantIds.length);
      participantIds.forEach((uid, idx) => {
        shareByUser.set(uid, parts[idx] ?? 0);
      });
    }

    const nameByUser = new Map<number, string>();
    for (const p of event.participants || []) {
      nameByUser.set(p.userId, this.userDisplayName(p.user));
    }

    return participantIds.map((userId) => {
      const totalPaid = this.round2(paidByUser.get(userId) ?? 0);
      const shareOwed = this.round2(shareByUser.get(userId) ?? 0);
      return {
        userId,
        userName: nameByUser.get(userId) ?? `Usuario ${userId}`,
        totalPaid,
        shareOwed,
        netBalance: this.round2(totalPaid - shareOwed),
      };
    });
  }

  private buildSettlements(balances: ParticipantBalance[]) {
    const creditors = balances
      .filter((b) => b.netBalance > 0.01)
      .map((b) => ({ ...b }))
      .sort((a, b) => b.netBalance - a.netBalance);
    const debtors = balances
      .filter((b) => b.netBalance < -0.01)
      .map((b) => ({ ...b, netBalance: -b.netBalance }))
      .sort((a, b) => b.netBalance - a.netBalance);

    const settlements: Array<{
      fromUserId: number;
      fromUserName: string;
      toUserId: number;
      toUserName: string;
      amount: number;
    }> = [];

    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const pay = Math.min(debtors[i].netBalance, creditors[j].netBalance);
      if (pay > 0.01) {
        settlements.push({
          fromUserId: debtors[i].userId,
          fromUserName: debtors[i].userName,
          toUserId: creditors[j].userId,
          toUserName: creditors[j].userName,
          amount: this.round2(pay),
        });
      }
      debtors[i].netBalance = this.round2(debtors[i].netBalance - pay);
      creditors[j].netBalance = this.round2(creditors[j].netBalance - pay);
      if (debtors[i].netBalance <= 0.01) i++;
      if (creditors[j].netBalance <= 0.01) j++;
    }

    return settlements;
  }

  async getExpenseSheet(eventId: number) {
    const event = await this.loadSocialEvent(eventId);
    let sheet = await this.sheetRepository.findOne({
      where: { sportEventId: eventId },
      relations: ['items', 'items.paidBy', 'shares', 'shares.user'],
    });

    if (sheet?.items) {
      sheet.items.sort((a, b) => a.id - b.id);
    }

    if (sheet && sheet.items.length > 0) {
      await this.recalculateShares(sheet, event);
      sheet = await this.sheetRepository.findOne({
        where: { sportEventId: eventId },
        relations: ['items', 'items.paidBy', 'shares', 'shares.user'],
      });
      if (sheet?.items) sheet.items.sort((a, b) => a.id - b.id);
    }

    const items = sheet?.items ?? [];
    const itemsTotal = items.reduce(
      (s, i) => s + this.toNumber(i.amount),
      0,
    );
    const balances = this.computeBalances(sheet, event, items);
    const settlements = this.buildSettlements(balances);

    const participants = (event.participants || []).map((p) => ({
      userId: p.userId,
      userName: this.userDisplayName(p.user),
      status: p.status,
      includedInExpenseSplit: p.includedInExpenseSplit !== false,
    }));

    return {
      event: {
        id: event.id,
        title: event.title,
        teamId: event.teamId,
        type: event.type,
        hasExpenses: event.hasExpenses,
      },
      participants,
      sheet,
      itemsTotal: this.round2(itemsTotal),
      balances,
      settlements,
      splitMode: sheet?.splitMode ?? EventExpenseSplitMode.EQUAL,
    };
  }

  async addExpenseItem(
    eventId: number,
    dto: AddEventExpenseItemDto,
    actorUserId: number,
  ) {
    const event = await this.loadSocialEvent(eventId);
    const eligible = new Set(this.eligibleParticipantUserIds(event));

    if (!eligible.has(actorUserId)) {
      throw new ForbiddenException(
        'Solo participantes del evento pueden cargar gastos',
      );
    }

    const paidBy = dto.paidByUserId ?? actorUserId;
    if (!eligible.has(paidBy)) {
      throw new BadRequestException(
        'Quien pagó debe ser un participante del evento',
      );
    }

    const sheet = await this.ensureSheet(eventId, actorUserId);

    const item = await this.itemRepository.save(
      this.itemRepository.create({
        sheetId: sheet.id,
        description: dto.description.trim(),
        amount: this.round2(this.toNumber(dto.amount)),
        paidByUserId: paidBy,
        createdBy: actorUserId,
      }),
    );

    await this.recalculateShares(sheet, event);

    if (!event.hasExpenses) {
      event.hasExpenses = true;
      await this.sportEventRepository.save(event);
    }

    return { item, sheet: await this.getExpenseSheet(eventId) };
  }

  async deleteExpenseItem(
    eventId: number,
    itemId: number,
    actorUserId: number,
    isManager: boolean,
  ) {
    const event = await this.loadSocialEvent(eventId);
    const sheet = await this.sheetRepository.findOne({
      where: { sportEventId: eventId },
    });
    if (!sheet) {
      throw new NotFoundException('No hay gastos cargados en este evento');
    }

    const item = await this.itemRepository.findOne({
      where: { id: itemId, sheetId: sheet.id },
    });
    if (!item) {
      throw new NotFoundException('Ítem de gasto no encontrado');
    }

    if (!isManager && item.createdBy !== actorUserId && item.paidByUserId !== actorUserId) {
      throw new ForbiddenException('No podés eliminar este gasto');
    }

    await this.itemRepository.delete(item.id);
    await this.recalculateShares(sheet, event);

    return this.getExpenseSheet(eventId);
  }

  async updateSplitMode(
    eventId: number,
    dto: UpdateEventExpenseSplitDto,
  ) {
    const event = await this.loadSocialEvent(eventId);
    const sheet = await this.ensureSheet(eventId);
    sheet.splitMode = dto.splitMode;
    await this.sheetRepository.save(sheet);
    if (dto.splitMode === EventExpenseSplitMode.EQUAL) {
      await this.recalculateShares(sheet, event);
    }
    return this.getExpenseSheet(eventId);
  }

  async updateManualShares(
    eventId: number,
    dto: UpdateEventExpenseSharesDto,
  ) {
    const event = await this.loadSocialEvent(eventId);
    const sheet = await this.ensureSheet(eventId);
    const items = await this.itemRepository.find({ where: { sheetId: sheet.id } });
    const itemsTotal = this.round2(
      items.reduce((s, i) => s + this.toNumber(i.amount), 0),
    );
    if (itemsTotal <= 0) {
      throw new BadRequestException('Agregá gastos antes de definir el reparto manual');
    }

    const eligible = new Set(this.eligibleParticipantUserIds(event));
    let sharesSum = 0;
    for (const row of dto.shares) {
      if (!eligible.has(row.userId)) {
        throw new BadRequestException(
          `El usuario ${row.userId} no participa en el reparto`,
        );
      }
      sharesSum += this.toNumber(row.amount);
    }
    if (Math.abs(sharesSum - itemsTotal) > 0.02) {
      throw new BadRequestException(
        `La suma de partes (${this.round2(sharesSum)}) debe igualar el total (${itemsTotal})`,
      );
    }

    sheet.splitMode = EventExpenseSplitMode.MANUAL;
    await this.sheetRepository.save(sheet);
    await this.shareRepository.delete({ sheetId: sheet.id });

    for (const row of dto.shares) {
      await this.shareRepository.save(
        this.shareRepository.create({
          sheetId: sheet.id,
          userId: row.userId,
          amount: this.round2(this.toNumber(row.amount)),
        }),
      );
    }

    for (const p of event.participants || []) {
      const share = dto.shares.find((s) => s.userId === p.userId);
      p.expenseShare = share ? this.round2(this.toNumber(share.amount)) : null;
      await this.participantRepository.save(p);
    }

    return this.getExpenseSheet(eventId);
  }

  async updateParticipantExpenseInclusion(
    eventId: number,
    targetUserId: number,
    dto: UpdateParticipantExpenseInclusionDto,
    actorUserId: number,
    isManager: boolean,
  ) {
    const event = await this.loadSocialEvent(eventId);
    const participant = await this.participantRepository.findOne({
      where: { eventId, userId: targetUserId },
    });
    if (!participant) {
      throw new NotFoundException('Participante no encontrado');
    }
    if (!isManager && targetUserId !== actorUserId) {
      throw new ForbiddenException('No podés modificar la asistencia de otro');
    }

    if (
      dto.includedInExpenseSplit &&
      participant.status !== ParticipantStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Solo quien confirmó asistencia puede entrar en el reparto de gastos',
      );
    }

    participant.includedInExpenseSplit = dto.includedInExpenseSplit;
    await this.participantRepository.save(participant);

    const sheet = await this.sheetRepository.findOne({
      where: { sportEventId: eventId },
    });
    if (sheet) {
      if (sheet.splitMode === EventExpenseSplitMode.EQUAL) {
        await this.recalculateShares(sheet, event);
      }
    }

    return this.getExpenseSheet(eventId);
  }
}
