import { api } from '../api';
import type {
  AccountOverview,
  ExpenseCategory,
  ExpenseSlip,
  LegacyExpense,
  SettleMode,
  SettlementDetail,
  Settlement as SettlementRecord,
  TripMember
} from './types';

const base = (tripId: number) => `/trips/${tripId}/expense`;

export const expenseApi = {
  overview: (tripId: number) => api<AccountOverview>(`${base(tripId)}/overview`),

  setupAccount: (tripId: number, body: { ownerId?: number; totalBudget: number; planned: Record<string, number> }) =>
    api<AccountOverview>(`${base(tripId)}/account`, { method: 'POST', body: JSON.stringify(body) }),

  setActual: (tripId: number, category: ExpenseCategory, actualAmount: number) =>
    api<AccountOverview>(`${base(tripId)}/categories/${category}/actual`, {
      method: 'PUT',
      body: JSON.stringify({ actualAmount })
    }),

  listMembers: (tripId: number) => api<TripMember[]>(`${base(tripId)}/members`),
  addMember: (tripId: number, body: { name: string }) =>
    api<TripMember>(`${base(tripId)}/members`, { method: 'POST', body: JSON.stringify(body) }),

  listSlips: (tripId: number) => api<ExpenseSlip[]>(`${base(tripId)}/slips`),
  reportSlip: (
    tripId: number,
    body: { payerMemberId: number; category: ExpenseCategory; amount: number; sharerMemberIds: number[]; note?: string; clientKey?: string }
  ) => api<ExpenseSlip>(`${base(tripId)}/slips`, { method: 'POST', body: JSON.stringify(body) }),
  batchReportSlips: (tripId: number, items: unknown[], retryOf?: number) =>
    api<{ accepted: ExpenseSlip[]; failed: unknown[] }>(`${base(tripId)}/slips/batch`, {
      method: 'POST',
      body: JSON.stringify({ items, retryOf })
    }),
  updateSlip: (tripId: number, id: number, body: Partial<{ amount: number; category: ExpenseCategory; sharerMemberIds: number[]; note: string }>) =>
    api<ExpenseSlip>(`${base(tripId)}/slips/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  withdrawSlip: (tripId: number, id: number) =>
    api<ExpenseSlip>(`${base(tripId)}/slips/${id}/withdraw`, { method: 'POST' }),

  listSettlements: (tripId: number) => api<SettlementRecord[]>(`${base(tripId)}/settlements`),
  settlementDetail: (tripId: number, id: number) =>
    api<SettlementDetail>(`${base(tripId)}/settlements/${id}`),
  settle: (
    tripId: number,
    body: { category: ExpenseCategory; mode: SettleMode; payerMemberId: number; sharerMemberIds?: number[]; note?: string }
  ) => api<SettlementDetail>(`${base(tripId)}/settlements`, { method: 'POST', body: JSON.stringify(body) }),

  listLegacy: (tripId: number) => api<LegacyExpense[]>(`${base(tripId)}/legacy`),
  addLegacy: (tripId: number, body: { amount: number; payerName?: string }) =>
    api<LegacyExpense>(`${base(tripId)}/legacy`, { method: 'POST', body: JSON.stringify(body) }),
  upgradeLegacy: (tripId: number, id: number, body: { defaultPayerMemberId?: number }) =>
    api<{ record: LegacyExpense; createdSlipIds: number[] }>(`${base(tripId)}/legacy/${id}/upgrade`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
};
