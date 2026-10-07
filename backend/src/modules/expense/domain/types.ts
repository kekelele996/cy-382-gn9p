import { AccountStatus, SlipStatus } from '../../../constants/expense';

/** 对账逻辑依赖的最小结构，便于不连库单测 */
export interface ExpenseCategoryEntityLike {
  category: string;
  planned: number;
  actualAmount: number;
  status: AccountStatus;
}

export interface ExpenseSlipEntityLike {
  id?: number;
  category: string;
  amount: number;
  status: SlipStatus;
  sharerMemberIds?: number[];
}
