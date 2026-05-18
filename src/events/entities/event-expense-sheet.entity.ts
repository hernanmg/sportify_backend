import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SportEvent } from './sport-event.entity';
import { User } from '../../users/entities/user.entity';
import { EventExpenseSplitMode } from '../event-expense.enums';
import { EventExpenseItem } from './event-expense-item.entity';
import { EventExpenseShare } from './event-expense-share.entity';

@Entity('event_expense_sheets')
export class EventExpenseSheet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sport_event_id', unique: true })
  sportEventId: number;

  @ManyToOne(() => SportEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sport_event_id' })
  event: SportEvent;

  @Column({
    name: 'split_mode',
    type: 'varchar',
    length: 20,
    default: EventExpenseSplitMode.EQUAL,
  })
  splitMode: EventExpenseSplitMode;

  @Column({ name: 'payer_user_id', nullable: true })
  payerUserId?: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payer_user_id' })
  payer?: User;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @OneToMany(() => EventExpenseItem, (item) => item.sheet, { cascade: true })
  items: EventExpenseItem[];

  @OneToMany(() => EventExpenseShare, (share) => share.sheet, { cascade: true })
  shares: EventExpenseShare[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
