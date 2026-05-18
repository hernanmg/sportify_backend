import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlayerStatusService } from './player-status.service';

@Injectable()
export class PlayerStatusSchedulerService {
  private readonly logger = new Logger(PlayerStatusSchedulerService.name);

  constructor(private readonly playerStatusService: PlayerStatusService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredImpediments(): Promise<void> {
    try {
      const n = await this.playerStatusService.processExpiredImpediments();
      if (n > 0) {
        this.logger.log(`Impedimentos vencidos procesados: ${n}`);
      }
    } catch (e) {
      this.logger.warn(`Error en cron impedimentos: ${e}`);
    }
  }
}
