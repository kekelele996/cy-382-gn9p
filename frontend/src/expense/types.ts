export interface LedgerItem {
  id: number;
  ledgerId: number;
  category: string;
  planned: number;
  actual: number;
  matched: number;
  remaining: number;
  status: string;
  settledAt?: string | null;
}

export interface LedgerOverview {
  id: number;
  tripId: number;
  totalBudget: number;
  memberCount: number;
  settlementMode: string;
  items: LedgerItem[];
}

export interface AdvanceOrder {
  id: number;
  ledgerId: number;
  memberId: number;
  memberName: string;
  category: string;
  amount: number;
  splitMembers: number[];
  status: string;
  reportStatus: string;
  version: number;
  overwritten: boolean;
  createdAt: string;
}

export interface ReconcileCategory {
  category: string;
  planned: number;
  actual: number;
  advanceTotal: number;
  matched: number;
  suspendedTotal: number;
  diff: number;
  state: 'BALANCED' | 'SUSPENDED' | 'GAP' | 'SETTLED';
  suspendedOrders: AdvanceOrder[];
}

export interface SettlementVoucher {
  orderId: number;
  memberName: string;
  amount: number;
  version: number;
  overwritten: boolean;
  status: string;
}

export interface SettlementAdjustment {
  adjustmentId: number;
  advanceOrderId: number;
  deltaAmount: number;
  reason: string;
  createdAt: string;
}

export interface SettlementCategory {
  category: string;
  status: string;
  settledAt?: string | null;
  vouchers: SettlementVoucher[];
  adjustments: SettlementAdjustment[];
}

export interface SettlementView {
  mode: string;
  categories: SettlementCategory[];
}

export interface LegacyExpense {
  id: number;
  tripId: number;
  amount: number;
  note?: string;
  migrationStatus: string;
  migratedCategory?: string | null;
  failReason?: string | null;
}

export interface MigrationView {
  pending: LegacyExpense[];
  migrated: LegacyExpense[];
  unfillable: LegacyExpense[];
}
