export interface CategoryPlanInput {
  category: string;
  planned: number;
}

export interface CreateLedgerInput {
  tripId: number;
  totalBudget: number;
  memberCount: number;
  settlementMode?: string;
  plans: CategoryPlanInput[];
}

export interface RecordActualInput {
  category: string;
  actual: number;
}

export interface UpdateModeInput {
  mode: string;
}

export interface CreateAdvanceInput {
  memberId: number;
  memberName: string;
  category: string;
  amount: number;
  splitMembers: number[];
  failReport?: boolean;
}

export interface UpdateAdvanceInput {
  amount?: number;
  splitMembers?: number[];
}

export interface RetryReportInput {
  memberId: number;
}

export interface SettleCategoryInput {
  category: string;
}
