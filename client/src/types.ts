// Shared TypeScript types for the trade journal.
// Kept flat — no abstraction layers, just the shapes the API returns.

export type Direction    = 'Buy' | 'Sell';
export type TradeStatus  = 'Open' | 'Closed';
export type PlanFollowed = 'Yes' | 'No' | 'Partially';

export interface Trade {
  id: string;
  trade_date: string;              // YYYY-MM-DD
  symbol: string;
  direction: Direction;
  status: TradeStatus;
  entry_price: number | null;
  exit_price: number | null;
  quantity_or_lot_size: number | null;
  realized_pnl: number | null;    // null = open or not entered
  currency: string;
  setup: string | null;
  entry_reason: string | null;
  exit_reason: string | null;
  mistakes: string[];
  custom_mistake: string | null;
  emotion: string | null;
  plan_followed: PlanFollowed | null;
  lesson: string | null;
  screenshot_references: string[];
  created_at: string;
  updated_at: string;
}

export interface DailyJournal {
  id: string;
  journal_date: string;            // YYYY-MM-DD
  trading_summary: string | null;
  what_went_well: string | null;
  mistakes_today: string | null;
  lessons_learned: string | null;
  plan_followed: PlanFollowed | null;
  improvement_for_tomorrow: string | null;
  general_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: number;
  currency: string;
  starting_balance: number | null;
  theme: string;
  custom_symbols: string[];
  custom_mistakes: string[];
}

// Summary types used in Performance section
export interface PerformanceSummary {
  total: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  grossProfit: number;
  grossLoss: number;
  netPnl: number;
  avgWin: number | null;
  avgLoss: number | null;
  bestTrade: number | null;
  worstTrade: number | null;
}
