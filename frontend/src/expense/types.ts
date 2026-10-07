/** 行程分账前端类型，与后端 constants/expense.ts 对齐 */

export type ExpenseCategory = 'TRANSPORT' | 'LODGING' | 'FOOD' | 'TICKET';
export type AccountStatus = 'PENDING' | 'MATCHED' | 'SUSPENDED' | 'SETTLED';
export type SlipStatus = 'REPORTED' | 'WITHDRAWN' | 'SUSPENDED' | 'SETTLED' | 'SUPERSEDED';
export type SettleMode = 'ADJUST' | 'OVERWRITE';
export type LegacyStatus = 'PENDING' | 'FILLED' | 'UNRESOLVED';

export interface CategorySummary {
  category: ExpenseCategory;
  planned: number;
  actualAmount: number;
  advanceTotal: number;
  difference: number;
  status: AccountStatus;
}

export interface AccountOverview {
  tripId: number;
  totalBudget: number;
  spent: number;
  remaining: number;
  categories: CategorySummary[];
  suspendedCategories: ExpenseCategory[];
  accountInitialized: boolean;
}

export interface TripMember {
  id: number;
  tripId: number;
  name: string;
  role: string;
}

export interface ExpenseSlip {
  id: number;
  tripId: number;
  payerMemberId: number;
  payerName?: string;
  category: ExpenseCategory;
  amount: number;
  sharerMemberIds: number[];
  status: SlipStatus;
  source: 'MEMBER' | 'ADJUST' | 'OVERWRITE';
  settlementId?: number | null;
  note?: string;
  clientKey: string;
}

export interface Settlement {
  id: number;
  tripId: number;
  category: ExpenseCategory;
  mode: SettleMode;
  finalAmount: number;
  beforeAmount: number;
  difference: number;
  newSlipId: number;
  coveredSlipIds?: number[] | null;
  note?: string;
}

export interface SettlementDetail extends Settlement {
  display: {
    mode: SettleMode;
    label: string;
    originalSlips?: ExpenseSlip[];
    adjustmentSlip?: ExpenseSlip | null;
    activeSlip?: ExpenseSlip | null;
    supersededSlips?: ExpenseSlip[];
  };
}

export interface LegacyExpense {
  id: number;
  tripId: number;
  amount: number;
  payerName?: string;
  category?: string | null;
  filledSharerMemberIds?: number[] | null;
  filledSlipId?: number | null;
  status: LegacyStatus;
  reason?: string;
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRANSPORT: '交通',
  LODGING: '住宿',
  FOOD: '餐饮',
  TICKET: '门票'
};

export const CATEGORY_ORDER: ExpenseCategory[] = ['TRANSPORT', 'LODGING', 'FOOD', 'TICKET'];

export const ACCOUNT_STATUS_META: Record<AccountStatus, { label: string; color: string }> = {
  PENDING: { label: '待对账', color: 'default' },
  MATCHED: { label: '对账相符', color: 'green' },
  SUSPENDED: { label: '挂起', color: 'orange' },
  SETTLED: { label: '已结清', color: 'blue' }
};

export const SLIP_STATUS_META: Record<SlipStatus, { label: string; color: string }> = {
  REPORTED: { label: '正常', color: 'green' },
  SUSPENDED: { label: '随分项挂起', color: 'orange' },
  SETTLED: { label: '已结清冻结', color: 'blue' },
  WITHDRAWN: { label: '已撤单', color: 'default' },
  SUPERSEDED: { label: '已被覆盖', color: 'default' }
};

/** 分 → 元展示 */
export const formatYuan = (cents: number): string => `¥${(cents / 100).toFixed(2)}`;
/** 元输入 → 分 */
export const yuanToCents = (yuan: number | null): number => Math.round((yuan ?? 0) * 100);
