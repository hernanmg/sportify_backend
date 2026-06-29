export enum FeeChargeType {
  MONTHLY_QUOTA = 'monthly_quota',
  TRAINING = 'training',
  OTHER = 'other',
}

export enum FeeChargeStatus {
  SCHEDULED = 'scheduled',
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  WAIVED = 'waived',
}

export enum PaymentMethod {
  CASH = 'cash',
  TRANSFER = 'transfer',
  MERCADOPAGO = 'mercadopago',
  OTHER = 'other',
}

export enum PaymentStatus {
  PENDING_CONFIRMATION = 'pending_confirmation',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

export enum LedgerEntryType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum LedgerCategory {
  MONTHLY_FEE = 'monthly_fee',
  TRAINING = 'training',
  SPONSOR = 'sponsor',
  REGISTRATION = 'registration',
  EQUIPMENT = 'equipment',
  MATCH = 'match',
  OTHER = 'other',
}

