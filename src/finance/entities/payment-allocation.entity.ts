import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { PlayerPayment } from './player-payment.entity';
import { FeeCharge } from './fee-charge.entity';

@Entity('payment_allocations')
export class PaymentAllocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'payment_id' })
  paymentId: number;

  @ManyToOne(() => PlayerPayment, (payment) => payment.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payment_id' })
  payment: PlayerPayment;

  @Column({ name: 'fee_charge_id' })
  feeChargeId: number;

  @ManyToOne(() => FeeCharge, (feeCharge) => feeCharge.allocations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fee_charge_id' })
  feeCharge: FeeCharge;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
