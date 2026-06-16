import {
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerImpediment } from './entities/player-impediment.entity';
import { PlayerFeeOverride } from './entities/player-fee-override.entity';
import { PlayerStatusAuditLog } from './entities/player-status-audit.entity';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { Category } from '../categories/entities/category.entity';
import { RosterService } from '../roster/roster.service';
import { shortCategoryLabel } from '../common/category-label';
import {
  EligibilityColor,
  EligibilityStatus,
  ImpedimentType,
} from './eligibility.enums';
import { FinanceService } from '../finance/finance.service';

export interface PlayerEligibilityView {
  userId: number;
  playerName: string;
  avatarUrl?: string | null;
  jerseyNumber?: number;
  position?: string;
  category?: string;
  status: EligibilityStatus;
  statusLabel: string;
  reason: string;
  color: EligibilityColor;
  daysRemaining?: number;
  endDate?: string;
  feeBalance?: number;
  feeOverride?: {
    overriddenBy: number;
    overriddenAt: string;
    reason?: string;
  };
  activeImpedimentId?: number;
}

const STATUS_LABELS: Record<EligibilityStatus, string> = {
  [EligibilityStatus.ELIGIBLE]: 'Habilitado',
  [EligibilityStatus.FEE_UNPAID]: 'Cuota impaga',
  [EligibilityStatus.NO_MEDICAL]: 'Sin apto médico',
  [EligibilityStatus.INJURED]: 'Lesionado',
  [EligibilityStatus.SUSPENDED]: 'Suspendido',
  [EligibilityStatus.OTHER]: 'Otro',
  [EligibilityStatus.DISABLED]: 'Inhabilitado',
};

@Injectable()
export class PlayerEligibilityService {
  constructor(
    @InjectRepository(PlayerImpediment)
    private readonly impedimentRepository: Repository<PlayerImpediment>,
    @InjectRepository(PlayerFeeOverride)
    private readonly feeOverrideRepository: Repository<PlayerFeeOverride>,
    @InjectRepository(PlayerStatusAuditLog)
    private readonly auditRepository: Repository<PlayerStatusAuditLog>,
    @InjectRepository(PlayerRoster)
    private readonly rosterRepository: Repository<PlayerRoster>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly financeService: FinanceService,
    @Inject(forwardRef(() => RosterService))
    private readonly rosterService: RosterService,
  ) {}

  private seasonFilterVariants(season: string): string[] {
    const variants = new Set<string>([season.trim()]);
    const apertura = /^(\d{4})-Apertura$/i.exec(season);
    if (apertura) {
      const y = parseInt(apertura[1], 10);
      variants.add(`${y - 1}-${y}`);
    }
    const clausura = /^(\d{4})-Clausura$/i.exec(season);
    if (clausura) {
      const y = parseInt(clausura[1], 10);
      variants.add(`${y}-${y + 1}`);
    }
    const legacy = /^(\d{4})-(\d{4})$/.exec(season);
    if (legacy) {
      const start = parseInt(legacy[1], 10);
      const end = parseInt(legacy[2], 10);
      variants.add(`${end}-Apertura`);
      variants.add(`${start}-Clausura`);
    }
    return [...variants];
  }

  private currentSeason(): string {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const half = month <= 6 ? 'Apertura' : 'Clausura';
    return `${year}-${half}`;
  }

  private parseDate(value: string | Date): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private daysBetween(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  private computeEndDate(
    startDate: string,
    durationDays?: number,
    endDate?: string,
  ): string | undefined {
    if (endDate) return endDate;
    if (!durationDays) return undefined;
    const start = this.parseDate(startDate);
    start.setDate(start.getDate() + durationDays);
    return start.toISOString().slice(0, 10);
  }

  async deactivateExpiredImpediments(teamId: number): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const active = await this.impedimentRepository.find({
      where: { teamId, isActive: true },
    });
    for (const imp of active) {
      const end =
        imp.endDate ??
        this.computeEndDate(imp.startDate, imp.durationDays, imp.endDate);
      if (end && end < today) {
        imp.isActive = false;
        await this.impedimentRepository.save(imp);
      }
    }
  }

  private colorForImpediment(
    daysRemaining?: number,
    orangeThreshold = 7,
  ): EligibilityColor {
    if (daysRemaining === undefined) return EligibilityColor.RED;
    if (daysRemaining <= 0) return EligibilityColor.GREEN;
    if (daysRemaining < 3) return EligibilityColor.YELLOW;
    if (daysRemaining <= orangeThreshold) return EligibilityColor.ORANGE;
    return EligibilityColor.ORANGE;
  }

  private userDisplayName(roster: PlayerRoster): string {
    const user = roster.player?.user;
    if (!user) return `Jugador #${roster.playerId}`;
    const full = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return full || user.username || `Usuario ${user.id}`;
  }

  /** userIds con ficha en una categoría del equipo (lista de buena fe). */
  async getRosterUserIdsByCategory(
    teamId: number,
    categoryId: number,
  ): Promise<number[]> {
    const target = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    const targetLabel = shortCategoryLabel(target?.name ?? '');

    const rows = await this.rosterRepository.find({
      where: { teamId },
      relations: ['player', 'categoryRef'],
    });

    const ids = new Set<number>();
    for (const row of rows) {
      const uid = row.player?.user_id;
      if (!uid) continue;

      if (row.categoryId === categoryId) {
        ids.add(uid);
        continue;
      }

      const rowLabel = shortCategoryLabel(
        row.categoryRef?.name ?? row.category,
      );
      if (targetLabel && rowLabel && rowLabel === targetLabel) {
        ids.add(uid);
      }
    }
    return [...ids];
  }

  async getTeamEligibility(
    teamId: number,
    season?: string,
    orangeThresholdDays = 7,
  ): Promise<PlayerEligibilityView[]> {
    const resolvedSeason = season?.trim() || this.currentSeason();
    await this.deactivateExpiredImpediments(teamId);
    await this.rosterService.ensureTeamMembersOnRoster(teamId);

    const allRoster = await this.rosterRepository.find({
      where: { teamId },
      relations: ['player', 'player.user'],
      order: { jerseyNumber: 'ASC' },
    });

    const seasonVariants = new Set(this.seasonFilterVariants(resolvedSeason));
    const seenUsers = new Map<number, PlayerRoster>();

    for (const row of allRoster) {
      const uid = row.player?.user_id;
      if (!uid || !seasonVariants.has(row.season)) continue;
      if (!seenUsers.has(uid)) seenUsers.set(uid, row);
    }

    for (const row of allRoster) {
      const uid = row.player?.user_id;
      if (!uid || seenUsers.has(uid)) continue;
      seenUsers.set(uid, row);
    }

    let balances: Array<{
      userId: number;
      balance: number;
      userName: string;
      jerseyNumber?: number;
    }> = [];
    try {
      balances = await this.financeService.getTeamPlayerBalances(
        teamId,
        resolvedSeason,
      );
    } catch {
      balances = [];
    }
    const balanceByUser = new Map(balances.map((b) => [b.userId, b]));

    const impediments = await this.impedimentRepository.find({
      where: { teamId, isActive: true },
      relations: ['user'],
    });
    const impByUser = new Map<number, PlayerImpediment>();
    for (const imp of impediments) {
      impByUser.set(imp.userId, imp);
    }

    const overrides = await this.feeOverrideRepository.find({
      where: { teamId, isActive: true },
      relations: ['overrider'],
    });
    const overrideByUser = new Map(overrides.map((o) => [o.userId, o]));

    const today = new Date();
    const results: PlayerEligibilityView[] = [];

    for (const [userId, row] of seenUsers.entries()) {
      const balance = balanceByUser.get(userId)?.balance ?? 0;
      const feeOverride = overrideByUser.get(userId);
      const impediment = impByUser.get(userId);

      let status = EligibilityStatus.ELIGIBLE;
      let reason = 'Cumple todos los requisitos';
      let color = EligibilityColor.GREEN;
      let daysRemaining: number | undefined;
      let endDate: string | undefined;
      let activeImpedimentId: number | undefined;

      if (!row.isEnabled) {
        status = EligibilityStatus.DISABLED;
        reason = 'Jugador deshabilitado en lista de buena fe';
        color = EligibilityColor.RED;
      } else if (row.medicalStatus !== 'approved') {
        status = EligibilityStatus.NO_MEDICAL;
        reason =
          row.medicalStatus === 'expired'
            ? 'Apto médico vencido'
            : row.medicalStatus === 'rejected'
              ? 'Apto médico rechazado'
              : 'Apto médico pendiente de aprobación';
        color = EligibilityColor.RED;
      } else if (balance > 0.01 && !feeOverride) {
        status = EligibilityStatus.FEE_UNPAID;
        reason = `Saldo pendiente: $${balance.toFixed(2)}`;
        color = EligibilityColor.RED;
      } else if (impediment) {
        activeImpedimentId = impediment.id;
        endDate = this.computeEndDate(
          impediment.startDate,
          impediment.durationDays,
          impediment.endDate,
        );
        if (endDate) {
          daysRemaining = this.daysBetween(
            today,
            this.parseDate(endDate),
          );
        }
        if (impediment.impedimentType === ImpedimentType.INJURY) {
          status = EligibilityStatus.INJURED;
          reason =
            impediment.description?.trim() ||
            'Lesión activa';
        } else if (impediment.impedimentType === ImpedimentType.SUSPENSION) {
          status = EligibilityStatus.SUSPENDED;
          reason =
            impediment.description?.trim() ||
            'Suspensión activa';
        } else {
          status = EligibilityStatus.OTHER;
          reason = impediment.description?.trim() || 'Otro impedimento';
        }
        color = this.colorForImpediment(daysRemaining, orangeThresholdDays);
        if (daysRemaining !== undefined && daysRemaining <= 0) {
          impediment.isActive = false;
          await this.impedimentRepository.save(impediment);
          status = EligibilityStatus.ELIGIBLE;
          reason = 'Cumple todos los requisitos';
          color = EligibilityColor.GREEN;
          daysRemaining = undefined;
          endDate = undefined;
          activeImpedimentId = undefined;
        }
      }

      results.push({
        userId,
        playerName: this.userDisplayName(row),
        avatarUrl: row.player?.user?.avatarUrl ?? null,
        jerseyNumber: row.jerseyNumber,
        position: row.position,
        category: row.category,
        status,
        statusLabel: STATUS_LABELS[status],
        reason,
        color,
        daysRemaining,
        endDate,
        feeBalance: balance > 0 ? balance : undefined,
        feeOverride: feeOverride
          ? {
              overriddenBy: feeOverride.overriddenBy,
              overriddenAt: feeOverride.overriddenAt.toISOString(),
              reason: feeOverride.reason,
            }
          : undefined,
        activeImpedimentId,
      });
    }

    return results.sort(
      (a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999),
    );
  }

  async logAudit(
    teamId: number,
    userId: number,
    action: string,
    performedBy: number,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditRepository.save(
      this.auditRepository.create({
        teamId,
        userId,
        action,
        performedBy,
        payload,
      }),
    );
  }
}
