import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Trade, PerformanceSummary, Settings, DailyJournal } from '../types';

/** Merge Tailwind class strings, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a numeric value as currency using Intl. */
export function formatCurrency(
  amount: number | null | undefined,
  currency = 'USD',
): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format a signed currency amount with explicit + or − prefix for non-color clarity. */
export function formatSignedCurrency(amount: number, currency = 'USD'): string {
  if (amount > 0) return `+${formatCurrency(amount, currency)}`;
  if (amount < 0) return `−${formatCurrency(Math.abs(amount), currency)}`;
  return formatCurrency(0, currency);
}

/** Format a YYYY-MM-DD string using the system locale (defaulting to DD/MM/YYYY when Chrome uses en-US). */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const locale =
    typeof navigator !== 'undefined' && navigator.language && navigator.language !== 'en-US'
      ? navigator.language
      : 'en-GB';
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Returns today as YYYY-MM-DD in local time. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns signed P/L prefix string (+, −, or empty for zero). */
export function pnlSign(pnl: number | null): string {
  if (pnl === null) return '';
  if (pnl > 0) return '+';
  return '';
}

/** Returns Tailwind text color class for a P/L value. Color is never the only indicator. */
export function pnlColorClass(pnl: number | null): string {
  if (pnl === null) return 'text-muted-fg';
  if (pnl > 0) return 'text-profit';
  if (pnl < 0) return 'text-loss';
  return 'text-muted-fg';
}

/** Compute performance summary from an array of closed trades only. */
export function computeSummary(trades: Trade[]): PerformanceSummary {
  const closed = trades.filter(t => t.status === 'Closed' && t.realized_pnl !== null);
  const wins   = closed.filter(t => (t.realized_pnl ?? 0) > 0);
  const losses = closed.filter(t => (t.realized_pnl ?? 0) < 0);
  const be     = closed.filter(t => (t.realized_pnl ?? 0) === 0);

  const grossProfit = wins.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
  const grossLoss   = Math.abs(losses.reduce((s, t) => s + (t.realized_pnl ?? 0), 0));
  const pnlValues   = closed.map(t => t.realized_pnl ?? 0);

  return {
    total:      closed.length,
    wins:       wins.length,
    losses:     losses.length,
    breakeven:  be.length,
    winRate:    closed.length > 0 ? (wins.length / closed.length) * 100 : null,
    grossProfit,
    grossLoss,
    netPnl:     grossProfit - grossLoss,
    avgWin:     wins.length > 0 ? grossProfit / wins.length : null,
    avgLoss:    losses.length > 0 ? grossLoss / losses.length : null,
    bestTrade:  pnlValues.length > 0 ? Math.max(...pnlValues) : null,
    worstTrade: pnlValues.length > 0 ? Math.min(...pnlValues) : null,
  };
}

/** Today's P/L — sum of closed trades dated today. */
export function todayPnl(trades: Trade[], today = todayISO()): number {
  return trades
    .filter(t => t.trade_date === today && t.status === 'Closed' && t.realized_pnl !== null)
    .reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
}

export interface DashboardMetrics {
  todayTrades: Trade[];
  todayClosedCount: number;
  todayOpenCount: number;
  todayWins: number;
  todayLosses: number;
  todayPnl: number;
  overallClosedCount: number;
  overallNetPnl: number;
  recordedBalance: number | null;
  balanceIncompatible: boolean;
  recentTrades: Trade[];
  hasMixedCurrencies: boolean;
}

/** Computes all Dashboard card metrics consistently from saved trade records. */
export function computeDashboardMetrics(
  trades: Trade[],
  settings?: Settings | null,
  today = todayISO(),
): DashboardMetrics {
  const sorted = [...trades].sort((a, b) => {
    const dateCmp = b.trade_date.localeCompare(a.trade_date);
    if (dateCmp !== 0) return dateCmp;
    return b.created_at.localeCompare(a.created_at);
  });

  const todayTrades = sorted.filter(t => t.trade_date === today);
  const todayClosed = todayTrades.filter(t => t.status === 'Closed' && t.realized_pnl !== null);
  const todayOpenCount = todayTrades.filter(t => t.status === 'Open').length;

  const todayWins = todayClosed.filter(t => (t.realized_pnl ?? 0) > 0).length;
  const todayLosses = todayClosed.filter(t => (t.realized_pnl ?? 0) < 0).length;

  const allClosed = sorted.filter(t => t.status === 'Closed' && t.realized_pnl !== null);
  const overallNetPnl = allClosed.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);

  const targetCurrency = settings?.currency || 'USD';
  const hasMixedCurrencies = allClosed.some(t => t.currency !== targetCurrency);

  const startingBalance = settings?.starting_balance ?? null;
  const hasStartingBalance = startingBalance !== null && Number.isFinite(startingBalance);
  const balanceIncompatible = hasStartingBalance && hasMixedCurrencies;
  const recordedBalance =
    hasStartingBalance && !hasMixedCurrencies
      ? startingBalance + overallNetPnl
      : null;

  return {
    todayTrades,
    todayClosedCount: todayClosed.length,
    todayOpenCount,
    todayWins,
    todayLosses,
    todayPnl: todayPnl(todayTrades, today),
    overallClosedCount: allClosed.length,
    overallNetPnl,
    recordedBalance,
    balanceIncompatible,
    recentTrades: sorted.slice(0, 5),
    hasMixedCurrencies,
  };
}

export interface PnlChartPoint {
  key: string;    // YYYY-MM-DD or YYYY-MM
  label: string;  // day number or short month label
  pnl: number;
}

/** Aggregates closed trades by day for the given YYYY-MM month. */
export function buildMonthlyDailyPnlSeries(
  trades: Trade[],
  yearMonth = todayISO().slice(0, 7),
): PnlChartPoint[] {
  const byDate = new Map<string, number>();

  for (const t of trades) {
    if (t.status !== 'Closed' || t.realized_pnl === null) continue;
    if (!t.trade_date.startsWith(yearMonth)) continue;
    byDate.set(t.trade_date, (byDate.get(t.trade_date) ?? 0) + t.realized_pnl);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({
      key: date,
      label: String(Number(date.slice(8, 10))),
      pnl,
    }));
}

/** Returns true if a journal entry contains at least one non-empty reflection field. */
export function hasJournalContent(entry: Partial<DailyJournal> | null | undefined): boolean {
  if (!entry) return false;
  return Boolean(
    entry.trading_summary?.trim() ||
    entry.what_went_well?.trim() ||
    entry.mistakes_today?.trim() ||
    entry.lessons_learned?.trim() ||
    entry.plan_followed ||
    entry.improvement_for_tomorrow?.trim() ||
    entry.general_notes?.trim(),
  );
}

export interface DayTradeSummary {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  netPnl: number;
  dayTrades: Trade[];
}

/** Computes a single date's P/L and trade counts (open trades excluded from realized P/L). */
export function computeDayTradeSummary(trades: Trade[], date: string): DayTradeSummary {
  const dayTrades = trades.filter(t => t.trade_date === date);
  const closed = dayTrades.filter(t => t.status === 'Closed' && t.realized_pnl !== null);
  return {
    totalTrades: dayTrades.length,
    closedTrades: closed.length,
    openTrades: dayTrades.filter(t => t.status === 'Open').length,
    wins: closed.filter(t => (t.realized_pnl ?? 0) > 0).length,
    losses: closed.filter(t => (t.realized_pnl ?? 0) < 0).length,
    netPnl: closed.reduce((s, t) => s + (t.realized_pnl ?? 0), 0),
    dayTrades,
  };
}

/** Aggregates closed trades by month (YYYY-MM) across all recorded history. */
export function buildMonthlyPnlSeries(trades: Trade[]): PnlChartPoint[] {
  const byMonth = new Map<string, number>();

  for (const t of trades) {
    if (t.status !== 'Closed' || t.realized_pnl === null) continue;
    const ym = t.trade_date.slice(0, 7);
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + t.realized_pnl);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, pnl]) => {
      const [y, m] = ym.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit',
      });
      return { key: ym, label, pnl };
    });
}

export type TimeFilterPreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'all_time'
  | 'custom';

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Resolves inclusive local YYYY-MM-DD bounds for a time filter preset. */
export function getDateRangeForPreset(
  preset: Exclude<TimeFilterPreset, 'custom'>,
  today = todayISO(),
): { from: string | null; to: string | null } {
  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(y, m - 1, d);

  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'this_week': {
      // Monday-start trading week
      const offsetToMon = (base.getDay() + 6) % 7;
      const mon = new Date(y, m - 1, d - offsetToMon);
      const sun = new Date(y, m - 1, d - offsetToMon + 6);
      return { from: toLocalISO(mon), to: toLocalISO(sun) };
    }
    case 'this_month': {
      const first = new Date(y, m - 1, 1);
      const last = new Date(y, m, 0);
      return { from: toLocalISO(first), to: toLocalISO(last) };
    }
    case 'last_month': {
      const first = new Date(y, m - 2, 1);
      const last = new Date(y, m - 1, 0);
      return { from: toLocalISO(first), to: toLocalISO(last) };
    }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'all_time':
      return { from: null, to: null };
  }
}

/** Filters trades by inclusive YYYY-MM-DD range. */
export function filterTradesByDateRange(
  trades: Trade[],
  from: string | null,
  to: string | null,
): Trade[] {
  return trades.filter((t) => {
    if (from && t.trade_date < from) return false;
    if (to && t.trade_date > to) return false;
    return true;
  });
}

/** Checks whether closed trades use currencies different from the primary currency. */
export function getMixedCurrencies(trades: Trade[], primaryCurrency: string): string[] {
  const closed = trades.filter((t) => t.status === 'Closed' && t.realized_pnl !== null);
  const distinct = new Set(closed.map((t) => t.currency));
  if (distinct.size === 0) return [];
  if (distinct.size === 1 && distinct.has(primaryCurrency)) return [];
  return Array.from(distinct).sort();
}

/** Aggregates closed trades by date ascending across the filtered range. */
export function buildDailyPnlSeries(trades: Trade[]): PnlChartPoint[] {
  const byDate = new Map<string, number>();
  for (const t of trades) {
    if (t.status !== 'Closed' || t.realized_pnl === null) continue;
    byDate.set(t.trade_date, (byDate.get(t.trade_date) ?? 0) + t.realized_pnl);
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({
      key: date,
      label: formatDate(date),
      pnl,
    }));
}

export interface CumulativeChartPoint {
  date: string;
  label: string;
  dailyPnl: number;
  cumulativePnl: number;
}

/** Builds chronological cumulative P/L series from closed trades only. */
export function buildCumulativePnlSeries(trades: Trade[]): CumulativeChartPoint[] {
  const daily = buildDailyPnlSeries(trades);
  let running = 0;
  return daily.map((pt) => {
    running += pt.pnl;
    return {
      date: pt.key,
      label: pt.label,
      dailyPnl: pt.pnl,
      cumulativePnl: running,
    };
  });
}

/** Extracts normalized, deduplicated mistake tags for a single trade. */
export function getTradeMistakeTags(trade: Trade): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  const custom = trade.custom_mistake?.trim() || '';

  for (const m of trade.mistakes) {
    const trimmed = m.trim();
    if (!trimmed) continue;
    if (trimmed === 'Other' && custom) {
      if (!seen.has(custom)) {
        seen.add(custom);
        tags.push(custom);
      }
      continue;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      tags.push(trimmed);
    }
  }

  if (custom && !seen.has(custom)) {
    seen.add(custom);
    tags.push(custom);
  }

  return tags;
}

export interface MistakeStat {
  mistake: string;
  count: number;
  closedCount: number;
  openCount: number;
  associatedNetPnl: number;
  currencies: string[];
  trades: Trade[];
}

export interface MonthlyMistakeBreakdown {
  month: string; // YYYY-MM
  label: string;
  totalOccurrences: number;
  breakdown: Array<{ mistake: string; count: number }>;
}

/** Computes mistake frequency ranking, associated closed-trade P/L, and monthly breakdown. */
export function analyzeMistakes(trades: Trade[]): {
  items: MistakeStat[];
  byMonth: MonthlyMistakeBreakdown[];
} {
  const sorted = [...trades].sort((a, b) => {
    const d = b.trade_date.localeCompare(a.trade_date);
    return d !== 0 ? d : b.created_at.localeCompare(a.created_at);
  });

  const byMistake = new Map<string, Trade[]>();
  const monthCounts = new Map<string, Map<string, number>>();

  for (const trade of sorted) {
    const tags = getTradeMistakeTags(trade);
    if (tags.length === 0) continue;

    const ym = trade.trade_date.slice(0, 7);
    if (!monthCounts.has(ym)) monthCounts.set(ym, new Map());
    const mMap = monthCounts.get(ym)!;

    for (const tag of tags) {
      if (!byMistake.has(tag)) byMistake.set(tag, []);
      byMistake.get(tag)!.push(trade);
      mMap.set(tag, (mMap.get(tag) ?? 0) + 1);
    }
  }

  const items: MistakeStat[] = Array.from(byMistake.entries())
    .map(([mistake, taggedTrades]) => {
      const closed = taggedTrades.filter(
        (t) => t.status === 'Closed' && t.realized_pnl !== null,
      );
      const openCount = taggedTrades.filter((t) => t.status === 'Open').length;
      const associatedNetPnl = closed.reduce((s, t) => s + (t.realized_pnl ?? 0), 0);
      const currencies = Array.from(new Set(closed.map((t) => t.currency))).sort();
      return {
        mistake,
        count: taggedTrades.length,
        closedCount: closed.length,
        openCount,
        associatedNetPnl,
        currencies,
        trades: taggedTrades,
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.mistake.localeCompare(b.mistake);
    });

  const byMonth: MonthlyMistakeBreakdown[] = Array.from(monthCounts.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, mMap]) => {
      const [y, m] = month.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
      const breakdown = Array.from(mMap.entries())
        .map(([mistake, count]) => ({ mistake, count }))
        .sort((a, b) => b.count - a.count || a.mistake.localeCompare(b.mistake));
      const totalOccurrences = breakdown.reduce((s, b) => s + b.count, 0);
      return { month, label, totalOccurrences, breakdown };
    });

  return { items, byMonth };
}
