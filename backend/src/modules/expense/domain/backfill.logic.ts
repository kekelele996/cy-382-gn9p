import { EXPENSE_CATEGORIES, ExpenseCategory, LegacyStatus } from '../../../constants/expense';
import { ExpenseCategoryEntityLike } from './types';

export interface BackfillInput {
  /** 旧数据金额（分） */
  amount: number;
  /** 行程总预算（分），缺 0 表示旧数据没记总预算 */
  totalBudget: number;
  /** 四项计划数 */
  categories: Pick<ExpenseCategoryEntityLike, 'category' | 'planned'>[];
  /** 同行成员 id（分摊人），空表示没人可摊 */
  memberIds: number[];
}

export interface BackfillAllocation {
  category: ExpenseCategory;
  amount: number;
}

export interface BackfillResult {
  status: LegacyStatus;
  reason?: string;
  sharerMemberIds: number[];
  allocations: BackfillAllocation[];
}

/**
 * 旧数据没记分摊人和分项：
 * 1. 分摊人按同行人数补齐（全部成员均摊）；
 * 2. 分项金额按四项计划数占总预算的比例拆分，尾差分给计划数最大的分项；
 * 3. 补不出（无成员，或四项计划数全为 0 无法定比例）的单列。
 */
export function backfillLegacy(input: BackfillInput): BackfillResult {
  if (input.memberIds.length === 0) {
    return { status: LegacyStatus.Unresolved, reason: '旧数据无同行成员，无法确定分摊人', sharerMemberIds: [], allocations: [] };
  }
  const plannedByCategory = new Map(input.categories.map(c => [c.category as ExpenseCategory, c.planned]));
  const plannedList = EXPENSE_CATEGORIES.map(cat => ({ category: cat, planned: plannedByCategory.get(cat) ?? 0 }));
  const plannedTotal = plannedList.reduce((sum, item) => sum + item.planned, 0);
  if (plannedTotal <= 0) {
    return { status: LegacyStatus.Unresolved, reason: '总预算/四项计划数缺失，无法按比例拆分分项', sharerMemberIds: [], allocations: [] };
  }

  // 按计划数比例拆分；尾差（小于分项数的分值）补给计划数最大的分项
  let allocated = 0;
  let maxPlannedIdx = 0;
  const allocations: BackfillAllocation[] = plannedList.map((item, idx) => {
    if (item.planned > plannedList[maxPlannedIdx].planned) maxPlannedIdx = idx;
    const amount = Math.floor((input.amount * item.planned) / plannedTotal);
    allocated += amount;
    return { category: item.category, amount };
  });
  allocations[maxPlannedIdx].amount += input.amount - allocated;

  return { status: LegacyStatus.Filled, sharerMemberIds: [...input.memberIds], allocations };
}
