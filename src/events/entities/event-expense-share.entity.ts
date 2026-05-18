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

@Entity('event_expense_shares')
export class EventExpenseShare {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sheet_id' })
  sheetId: number;

  @ManyToOne(() => EventExpenseSheet, (sheet) => sheet.shares, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sheet_id' })
  sheet: EventExpenseSheet;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
