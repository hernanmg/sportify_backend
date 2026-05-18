import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { EventExpenseSheet } from './event-expense-sheet.entity';
import { User } from '../../users/entities/user.entity';

@Entity('event_expense_items')
export class EventExpenseItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sheet_id' })
  sheetId: number;

  @ManyToOne(() => EventExpenseSheet, (sheet) => sheet.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sheet_id' })
  sheet: EventExpenseSheet;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'paid_by_user_id' })
  paidByUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paid_by_user_id' })
  paidBy: User;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
