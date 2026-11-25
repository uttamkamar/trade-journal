# Requirements: Personal Trading Journal

> Source of truth: master prompt v2. All requirements are fixed. UI UX Pro Max owns visual decisions only.

---

## Navigation (5 sections only)
1. Dashboard
2. Trades (list + add/edit)
3. Daily Journal
4. Performance
5. Mistake Analysis
6. Settings (accessible from nav)

---

## R1 — Dashboard

### Summary Cards
- Today's P/L (sum of net P/L of all trades with trade date = today, closed only)
- Trades taken today (count, any status)
- Winning trades today (net P/L > 0, closed)
- Losing trades today (net P/L < 0, closed)
- Overall net P/L (sum of net P/L of all closed trades)
- Current recorded balance (starting balance + cumulative net P/L, only shown if starting balance configured)

### Additional
- Compact list of today's trades
- Recent trades list (last ~5)
- Simple daily or monthly P/L chart (clean, no clutter)
- Quick "Add Trade" CTA
- Reminder if today's journal has not been completed

### Calculation Rules
- Open trades excluded from all realized P/L totals
- Currency shown clearly wherever money is displayed
- Currency is user-configured (settings); no assumed default

---

## R2 — Add Trade / Edit Trade

### Primary Fields (required unless noted)
| Field | Notes |
|-------|-------|
| Trade date | Defaults to today |
| Instrument / symbol | Allow custom symbols |
| Direction | Buy or Sell |
| Result status | Closed or Open |
| Entry price | Required |
| Exit price | Required for Closed only |
| Lot size / quantity | Optional |
| Profit or loss (amount) | Signed numeric; user-entered |
| Currency | Inherits from settings, overridable |

### Journaling Fields (all optional)
- Setup / strategy (text or selectable)
- Why did I enter this trade?
- Why did I exit this trade?
- Mistakes made (multi-select tags + custom)
- Emotion (single select)
- Did I follow my trading plan? (Yes / No / Partially)
- What did I learn from this trade?
- Screenshot attachment (one or more images)

### Mistake Tags (predefined)
Entered too early, Entered too late, Entered without a setup, FOMO entry, Revenge trading, Overtrading, Ignored stop loss, Moved stop loss unnecessarily, Exited too early, Exited too late, Took profit too quickly, Increased lot size unnecessarily, Traded against the trend, Didn't follow my trading plan, Poor risk management, Other (custom text)

### Emotion Options
Calm, Confident, Fearful, Greedy, Impatient, Frustrated, FOMO, Revenge, Unsure, Other

### P/L Rules
- User enters realized P/L amount manually (signed numeric)
- No automatic calculation from prices/lots in v1
- Open trades must NOT be included in realized P/L totals
- Net P/L shown clearly; never mix gross and net silently

### Form Behavior
- Validate required fields with clear messages
- Preserve values on validation failure
- Confirm before delete
- Edit updates all affected summaries
- Save without optional fields is allowed
- Clear success message after save

---

## R3 — Trades List / History

### Desktop Columns
Date | Symbol | Buy/Sell | Setup | P/L | Mistakes | Status | Actions

### Features
- Search: symbol or notes
- Filter: date range, symbol, Buy/Sell, profit/loss/breakeven, mistake, open/closed
- Sort: newest/oldest, highest/lowest P/L
- Click trade → full detail view with notes and screenshots
- Edit + Delete actions
- Mobile: compact trade cards (not wide table)

---

## R4 — Daily Journal (one entry per date)

### Fields
- Date
- How was my trading today?
- What did I do well?
- What mistakes did I make?
- What did I learn today?
- Did I follow my trading plan? (Yes / No / Partially)
- What will I improve tomorrow?
- General notes

### Rules
- Auto-calculated day P/L and trade count shown at top
- Browse by calendar or date list
- Save drafts; editing allowed later
- No field is mandatory

---

## R5 — Performance

### Summary Stats (closed trades only)
Total trades | Winning | Losing | Breakeven | Win rate | Gross profit | Gross loss | Net P/L | Avg profit | Avg loss | Best trade | Worst trade

### Time Filters
Today | This week | This month | Last month | This year | All time | Custom date range

### Definitions (must be accurate)
- Win rate = winning closed trades / all closed trades × 100 (breakeven in denominator, labeled)
- Gross profit = sum of positive closed P/L
- Gross loss = |sum of negative closed P/L|
- Net P/L = gross profit − gross loss
- Avg win = gross profit / winning count
- Avg loss = gross loss / losing count
- Division by zero → show "---"

### Charts (simple, no clutter)
- Daily P/L over time
- Monthly P/L
- Cumulative P/L line (optional)

---

## R6 — Mistake Analysis

- Most repeated mistakes (frequency ranking)
- Count per mistake
- Mistakes by month
- Click mistake → related trades list
- P/L associated with tagged trades (neutral framing: "Trades tagged with X")
- Do NOT label mistakes as causes of losses

---

## R7 — Settings

- Preferred currency
- Starting balance (optional)
- Theme preference (UI UX Pro Max default)
- Manage custom instruments
- Manage custom mistakes
- Export: CSV (trades), JSON (full backup)
- Import / restore with preview and confirmation

---

## R8 — Data Model

### Trade
id, tradeDate, symbol, direction, status, entryPrice, exitPrice, quantityOrLotSize, realizedPnl, currency, setup, entryReason, exitReason, mistakes (array), customMistake, emotion, planFollowed, lesson, screenshotReferences (array), createdAt, updatedAt

### DailyJournal
id, journalDate (unique per date), tradingSummary, whatWentWell, mistakesToday, lessonsLearned, planFollowed, improvementForTomorrow, generalNotes, createdAt, updatedAt

### Settings
currency, startingBalance (optional), theme, customSymbols, customMistakes

---

## Explicit Exclusions
- No live market data
- No broker integration or MT5 sync
- No automated trading
- No AI predictions or signals
- No social features
- No subscription/payments
- No complex portfolio management
- No gamification
