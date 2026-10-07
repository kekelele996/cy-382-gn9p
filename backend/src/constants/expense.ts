export const EXPENSE_CATEGORIES = ['TRANSPORT', 'LODGING', 'FOOD', 'TICKET'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRANSPORT: '交通',
  LODGING: '住宿',
  FOOD: '餐饮',
  TICKET: '门票'
};

export enum AdvanceStatus {
  Reported = 'REPORTED',
  Matched = 'MATCHED',
  Suspended = 'SUSPENDED',
  Cancelled = 'CANCELLED',
  Settled = 'SETTLED'
}

export enum ReportStatus {
  Success = 'SUCCESS',
  Failed = 'FAILED'
}

export enum SettlementMode {
  Adjustment = 'ADJUSTMENT',
  Overwrite = 'OVERWRITE'
}

export enum LedgerItemStatus {
  Open = 'OPEN',
  Settled = 'SETTLED'
}

export enum MigrationStatus {
  Pending = 'PENDING',
  Migrated = 'MIGRATED',
  Unfillable = 'UNFILLABLE'
}

export const MIGRATION_MEMBER_NAME = '历史导入';
