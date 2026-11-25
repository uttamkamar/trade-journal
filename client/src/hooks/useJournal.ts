import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DailyJournal, PlanFollowed } from '../types';

export interface JournalInput {
  trading_summary: string | null;
  what_went_well: string | null;
  mistakes_today: string | null;
  lessons_learned: string | null;
  plan_followed: PlanFollowed | null;
  improvement_for_tomorrow: string | null;
  general_notes: string | null;
}

export function useJournalEntries() {
  return useQuery({
    queryKey: ['journal'],
    queryFn: () => api.get<DailyJournal[]>('/journal'),
  });
}

export function useSaveJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, payload }: { date: string; payload: JournalInput }) =>
      api.put<DailyJournal>(`/journal/${date}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal'] });
    },
  });
}

export function useDeleteJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      api.delete<{ success: boolean }>(`/journal/${date}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal'] });
    },
  });
}
