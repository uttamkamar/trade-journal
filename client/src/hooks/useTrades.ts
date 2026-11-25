import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Direction, Settings, Trade, TradeStatus } from '../types';

export interface TradeFilters {
  search?: string;
  symbol?: string;
  direction?: Direction | '';
  status?: TradeStatus | '';
  pnl?: 'profit' | 'loss' | 'breakeven' | '';
  mistake?: string;
  date_from?: string;
  date_to?: string;
  sort?: 'newest' | 'oldest' | 'pnl_desc' | 'pnl_asc';
}

export interface TradeInput {
  trade_date: string;
  symbol: string;
  direction: Direction;
  status: TradeStatus;
  entry_price: number;
  exit_price: number | null;
  quantity_or_lot_size: number | null;
  realized_pnl: number | null;
  currency: string;
  setup: string | null;
  entry_reason: string | null;
  exit_reason: string | null;
  mistakes: string[];
  custom_mistake: string | null;
  emotion: string | null;
  plan_followed: 'Yes' | 'No' | 'Partially' | null;
  lesson: string | null;
  screenshot_references?: string[];
}

function buildTradesQuery(filters?: TradeFilters): string {
  if (!filters) return '/trades';
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `/trades?${qs}` : '/trades';
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
  });
}

export interface SettingsUpdateInput {
  currency?: string;
  starting_balance?: number | null;
  theme?: 'light' | 'dark';
  custom_symbols?: string[];
  custom_mistakes?: string[];
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SettingsUpdateInput) =>
      api.patch<Settings>('/settings', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export interface ImportPreviewResponse {
  preview: {
    version: number;
    exported_at: string | null;
    trades: { total: number; new: number; duplicate: number };
    journal: { total: number; new: number; duplicate: number };
    settings: {
      included: boolean;
      currency: string | null;
      customSymbolsCount: number;
      customMistakesCount: number;
    };
  };
  message: string;
}

export interface ImportApplyResponse {
  success: boolean;
  mode: 'merge_skip' | 'merge_overwrite';
  summary: {
    trades: { inserted: number; updated: number; skipped: number };
    journal: { inserted: number; updated: number; skipped: number };
    settingsUpdated: boolean;
  };
}

export function usePreviewImport() {
  return useMutation({
    mutationFn: (data: unknown) =>
      api.post<ImportPreviewResponse>('/export/import/preview', { data }),
  });
}

export function useApplyImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      mode,
    }: {
      data: unknown;
      mode: 'merge_skip' | 'merge_overwrite';
    }) =>
      api.post<ImportApplyResponse>('/export/import/apply', {
        data,
        mode,
        confirmed: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['journal'] });
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useTrades(filters?: TradeFilters) {
  return useQuery({
    queryKey: ['trades', filters ?? {}],
    queryFn: () => api.get<Trade[]>(buildTradesQuery(filters)),
  });
}

export function useTrade(id: string | undefined) {
  return useQuery({
    queryKey: ['trade', id],
    queryFn: () => api.get<Trade>(`/trades/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TradeInput) => api.post<Trade>('/trades', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] });
    },
  });
}

export function useUpdateTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TradeInput> }) =>
      api.patch<Trade>(`/trades/${id}`, payload),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['trade', updated.id] });
    },
  });
}

export function useDeleteTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: boolean }>(`/trades/${id}`),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.removeQueries({ queryKey: ['trade', id] });
    },
  });
}

export function useUploadScreenshots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, files }: { tradeId: string; files: File[] }) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('screenshots', f));
      return api.upload<Trade>(`/trades/${tradeId}/screenshots`, fd);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['trade', updated.id] });
    },
  });
}

export function useDeleteScreenshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, path }: { tradeId: string; path: string }) =>
      api.delete<Trade>(`/trades/${tradeId}/screenshots`, { path }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      qc.invalidateQueries({ queryKey: ['trade', updated.id] });
    },
  });
}
