export const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: '交通',
  LODGING: '住宿',
  FOOD: '餐饮',
  TICKET: '门票'
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export const ADVANCE_STATUS_TAGS: Record<string, { label: string; color: string }> = {
  REPORTED: { label: '已上报', color: 'default' },
  MATCHED: { label: '已入帐', color: 'processing' },
  SUSPENDED: { label: '已挂起', color: 'warning' },
  CANCELLED: { label: '已撤单', color: 'default' },
  SETTLED: { label: '已结清', color: 'success' }
};

export const RECONCILE_STATE_TAGS: Record<string, { label: string; color: string }> = {
  BALANCED: { label: '已对平', color: 'success' },
  SUSPENDED: { label: '有挂起', color: 'warning' },
  GAP: { label: '有差额', color: 'error' },
  SETTLED: { label: '已结清', color: 'success' }
};

export const SETTLEMENT_MODE_LABELS: Record<string, string> = {
  ADJUSTMENT: '保留原凭证另开调整单',
  OVERWRITE: '覆盖旧单'
};
