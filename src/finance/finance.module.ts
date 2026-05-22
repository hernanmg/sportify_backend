import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FeeCharge } from './entities/fee-charge.entity';
import { PlayerPayment } from './entities/player-payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { RosterModule } from 'src/roster/roster.module';
import { TeamsModule } from 'src/teams/teams.module';
import { PaymentReceiptStorage } from './payment-receipt.storage';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeeCharge,
      PlayerPayment,
      PaymentAllocation,
      LedgerEntry,
    ]),
    RosterModule,
    TeamsModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService, PaymentReceiptStorage],
  exports: [FinanceService],
})
export class FinanceModule {}
