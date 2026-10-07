import { api } from '../api';
import type { AdvanceOrder, LedgerOverview, MigrationView, ReconcileCategory, SettlementView } from './types';

export interface CreateLedgerBody {
  tripId: number;
  totalBudget: number;
  memberCount: number;
  settlementMode: string;
  plans: { category: string; planned: number }[];
}

export interface CreateAdvanceBody {
  memberId: number;
  memberName: string;
  category: string;
  amount: number;
  splitMembers: number[];
  failReport?: boolean;
}

const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const expenseApi = {
  createLedger: (body: CreateLedgerBody) => post<LedgerOverview>('/ledgers', body),
  overview: (tripId: number) => api<LedgerOverview>(`/ledgers/${tripId}`),
  recordActual: (tripId: number, category: string, actual: number) => patch<LedgerOverview>(`/ledgers/${tripId}/actual`, { category, actual }),
  updateMode: (tripId: number, mode: string) => patch<LedgerOverview>(`/ledgers/${tripId}/mode`, { mode }),
  listAdvances: (tripId: number) => api<AdvanceOrder[]>(`/ledgers/${tripId}/advances`),
  createAdvance: (tripId: number, body: CreateAdvanceBody) => post<AdvanceOrder>(`/ledgers/${tripId}/advances`, body),
  updateAdvance: (id: number, body: { amount?: number; splitMembers?: number[] }) => patch(`/advances/${id}`, body),
  cancelAdvance: (id: number) => api(`/advances/${id}`, { method: 'DELETE' }),
  retryFailed: (tripId: number, memberId: number) => post<{ reran: number; categories: string[] }>(`/ledgers/${tripId}/retry`, { memberId }),
  reconcileView: (tripId: number) => api<ReconcileCategory[]>(`/ledgers/${tripId}/reconcile`),
  settle: (tripId: number, category: string) => post(`/ledgers/${tripId}/settle`, { category }),
  settlementView: (tripId: number) => api<SettlementView>(`/ledgers/${tripId}/settlement`),
  migrate: (tripId: number) => post<{ migrated: number; unfillable: number; pending: number }>(`/ledgers/${tripId}/migrate`),
  migrationView: (tripId: number) => api<MigrationView>(`/ledgers/${tripId}/migration`)
};
