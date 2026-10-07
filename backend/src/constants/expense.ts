/** 行程分账模块统一枚举与常量 */

/** 四个固定分项 */
export enum ExpenseCategory {
  Transport = 'TRANSPORT',
  Lodging = 'LODGING',
  Food = 'FOOD',
  Ticket = 'TICKET'
}
export const EXPENSE_CATEGORIES = [
  ExpenseCategory.Transport,
  ExpenseCategory.Lodging,
  ExpenseCategory.Food,
  ExpenseCategory.Ticket
] as const;
export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.Transport]: '交通',
  [ExpenseCategory.Lodging]: '住宿',
  [ExpenseCategory.Food]: '餐饮',
  [ExpenseCategory.Ticket]: '门票'
};

/** 分项对账状态 */
export enum AccountStatus {
  /** 待对账：还没有实际花费或垫付单 */
  Pending = 'PENDING',
  /** 对账相符：垫付合计 = 行程账实际花费，计入已花金额 */
  Matched = 'MATCHED',
  /** 挂起：垫付合计 != 实际花费，不计入已花金额 */
  Suspended = 'SUSPENDED',
  /** 已结清：冻结，成员改动不再回退 */
  Settled = 'SETTLED'
}

/** 垫付单状态 */
export enum SlipStatus {
  /** 正常上报，参与对账 */
  Reported = 'REPORTED',
  /** 成员撤单，不参与合计 */
  Withdrawn = 'WITHDRAWN',
  /** 对账不符随分项挂起，不计入已花金额 */
  Suspended = 'SUSPENDED',
  /** 分项结清后冻结 */
  Settled = 'SETTLED',
  /** 覆盖式结算后被新单替代，不参与合计 */
  Superseded = 'SUPERSEDED'
}

/** 参与合计的垫付单状态（撤单与被覆盖单不参与） */
export const ACTIVE_SLIP_STATUSES = [
  SlipStatus.Reported,
  SlipStatus.Suspended,
  SlipStatus.Settled
] as const;

/** 结算方式 */
export enum SettleMode {
  /** 保留原凭证，另开调整单 */
  Adjust = 'ADJUST',
  /** 覆盖旧单，新开一张合计单 */
  Overwrite = 'OVERWRITE'
}

/** 旧数据补齐结果 */
export enum LegacyStatus {
  Pending = 'PENDING',
  Filled = 'FILLED',
  /** 补不出（无成员/无总预算），单列处理 */
  Unresolved = 'UNRESOLVED'
}

/** 成员角色 */
export enum MemberRole {
  Owner = 'OWNER',
  Member = 'MEMBER'
}
