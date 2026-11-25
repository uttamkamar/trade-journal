-- Trade Journal Database Schema
-- SQLite with WAL mode for better performance

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Settings (singleton row, id always = 1)
CREATE TABLE IF NOT EXISTS settings (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  currency        TEXT    NOT NULL DEFAULT 'USD',
  starting_balance REAL,
  theme           TEXT    NOT NULL DEFAULT 'light',
  custom_symbols  TEXT    NOT NULL DEFAULT '[]',   -- JSON array of strings
  custom_mistakes TEXT    NOT NULL DEFAULT '[]',   -- JSON array of strings
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed default settings on first run
INSERT OR IGNORE INTO settings (id, currency, theme) VALUES (1, 'USD', 'light');

-- Trades
CREATE TABLE IF NOT EXISTS trades (
  id                    TEXT PRIMARY KEY,           -- UUID
  trade_date            TEXT NOT NULL,              -- YYYY-MM-DD
  symbol                TEXT NOT NULL,
  direction             TEXT NOT NULL CHECK (direction IN ('Buy', 'Sell')),
  status                TEXT NOT NULL CHECK (status IN ('Open', 'Closed')),
  entry_price           REAL,
  exit_price            REAL,
  quantity_or_lot_size  REAL,
  realized_pnl          REAL,                       -- NULL = open/not recorded
  currency              TEXT NOT NULL DEFAULT 'USD',
  setup                 TEXT,
  entry_reason          TEXT,
  exit_reason           TEXT,
  mistakes              TEXT NOT NULL DEFAULT '[]', -- JSON array
  custom_mistake        TEXT,
  emotion               TEXT,
  plan_followed         TEXT CHECK (plan_followed IN ('Yes', 'No', 'Partially') OR plan_followed IS NULL),
  lesson                TEXT,
  screenshot_references TEXT NOT NULL DEFAULT '[]', -- JSON array of relative paths
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trades_date   ON trades (trade_date);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades (symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status);

-- Daily Journal (one entry per date)
CREATE TABLE IF NOT EXISTS daily_journal (
  id                      TEXT PRIMARY KEY,         -- UUID
  journal_date            TEXT NOT NULL UNIQUE,     -- YYYY-MM-DD
  trading_summary         TEXT,
  what_went_well          TEXT,
  mistakes_today          TEXT,
  lessons_learned         TEXT,
  plan_followed           TEXT CHECK (plan_followed IN ('Yes', 'No', 'Partially') OR plan_followed IS NULL),
  improvement_for_tomorrow TEXT,
  general_notes           TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_date ON daily_journal (journal_date);
