import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerImpediment } from './entities/player-impediment.entity';
import { PlayerFeeOverride } from './entities/player-fee-override.entity';
import { PlayerStatusAuditLog } from './entities/player-status-audit.entity';
import { PlayerRoster } from '../roster/entities/player-roster.entity';
import { User } from '../users/entities/user.entity';
import { PlayerEligibilityService } from './player-eligibility.service';
import { PlayerStatusService } from './player-status.service';
import { PlayerStatusController } from './player-status.controller';
import { FinanceModule } from '../finance/finance.module';
import { TeamsModule } from '../teams/teams.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlayerStatusSchedulerService } from './player-status-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlayerImpediment,
      PlayerFeeOverride,
      PlayerStatusAuditLog,
      PlayerRoster,
      User,
    ]),
    forwardRef(() => FinanceModule),
    forwardRef(() => TeamsModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [PlayerStatusController],
  providers: [
    PlayerEligibilityService,
    PlayerStatusService,
    PlayerStatusSchedulerService,
  ],
  exports: [PlayerEligibilityService, PlayerStatusService],
})
export class PlayerStatusModule {}
