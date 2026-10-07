import { AccountStatus, ACTIVE_SLIP_STATUSES, SlipStatus } from '../../../constants/expense';
import { ExpenseCategoryEntityLike, ExpenseSlipEntityLike } from './types';

/**
 * 分账对账纯逻辑：金额一律用「分」整数。
 * 与数据库/Nest 解耦，便于直接单测。
 */

/** 垫付合计：撤单与被覆盖单不计，其余状态（含挂起）都参与合计 */
export function sumSlips(slips: Pick<ExpenseSlipEntityLike, 'amount' | 'status'>[]): number {
  return slips
    .filter(s => (ACTIVE_SLIP_STATUSES as readonly SlipStatus[]).includes(s.status))
    .reduce((total, s) => total + s.amount, 0);
}

export interface CategorySummary {
  category: string;
  planned: number;
  actualAmount: number;
  advanceTotal: number;
  difference: number;
  status: AccountStatus;
}

/**
 * 单个分项对账：
 * - 已结清永远冻结，不随成员改单/撤单回退；
 * - 垫付合计与行程账实际花费对得上 -> MATCHED（计入已花）；
 * - 对不上 -> SUSPENDED（挂起，不计入已花）；
 * - 两边都还没数 -> PENDING。
 */
export function summarizeCategory(
  category: ExpenseCategoryEntityLike,
  slips: Pick<ExpenseSlipEntityLike, 'amount' | 'status'>[]
): CategorySummary {
  const advanceTotal = sumSlips(slips);
  let status: AccountStatus;
  if (category.status === AccountStatus.Settled) {
    status = AccountStatus.Settled;
  } else if (category.actualAmount <= 0 && advanceTotal <= 0) {
    status = AccountStatus.Pending;
  } else {
    status = advanceTotal === category.actualAmount ? AccountStatus.Matched : AccountStatus.Suspended;
  }
  return {
    category: category.category,
    planned: category.planned,
    actualAmount: category.actualAmount,
    advanceTotal,
    difference: category.actualAmount - advanceTotal,
    status
  };
}

/** 重算一个行程下所有分项 */
export function reconcile(
  categories: ExpenseCategoryEntityLike[],
  slips: ExpenseSlipEntityLike[]
): CategorySummary[] {
  return EXPENSE_CATEGORIES_ORDER.map(cat => {
    const entity = categories.find(c => c.category === cat);
    if (!entity) {
      return { category: cat, planned: 0, actualAmount: 0, advanceTotal: 0, difference: 0, status: AccountStatus.Pending };
    }
    return summarizeCategory(entity, slips.filter(s => s.category === cat));
  });
}

// 避免循环依赖常量列表，直接在此声明遍历顺序
const EXPENSE_CATEGORIES_ORDER = ['TRANSPORT', 'LODGING', 'FOOD', 'TICKET'];

/**
 * 已花金额：只有 MATCHED / SETTLED 的分项计入；
 * PENDING 与 SUSPENDED（挂起）一律不计。
 */
export function calcSpent(summaries: Pick<CategorySummary, 'status' | 'actualAmount' | 'category'>[]): number {
  return summaries
    .filter(s => s.status === AccountStatus.Matched || s.status === AccountStatus.Settled)
    .reduce((total, s) => total + s.actualAmount, 0);
}

/** 成员改金额/撤单后，单张单子对应的新状态（已结清的不回退） */
export function nextSlipStatus(categoryStatus: AccountStatus): SlipStatus {
  if (categoryStatus === AccountStatus.Settled) return SlipStatus.Settled;
  if (categoryStatus === AccountStatus.Suspended) return SlipStatus.Suspended;
  return SlipStatus.Reported;
}
