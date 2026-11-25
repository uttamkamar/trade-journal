# Roadmap: Personal Trading Journal

> Status: All 7 phases complete and verified (v1.0 Milestone Complete).

---

## Phase 1 — Project Setup & Foundation
**Goal:** Working project skeleton with database, API structure, and design system wired up.

### Tasks
- [x] Initialize React + Vite + TypeScript project
- [x] Configure Tailwind CSS v3 + CSS custom properties (light & dark themes)
- [x] Install Plus Jakarta Sans font + Phosphor Icons + Recharts
- [x] Create design token CSS variables from approved UI UX Pro Max design system
- [x] Set up Express.js backend (minimal)
- [x] Create SQLite database with Node.js built-in `node:sqlite`
- [x] Write database schema migrations (`settings`, `trades`, `daily_journal` tables)
- [x] Wire React Query for API calls
- [x] Configure file upload directory for screenshots (`uploads/`)
- [x] Scaffold 5-section navigation shell + Settings (desktop sidebar & mobile bottom nav)
- [x] Create environment example file (`.env.example`)
- [x] Verify client build (`tsc && vite build`), DB migration, and API endpoints (`/api/health`, `/api/settings`, `/api/trades`, `/api/journal`)

**Verifiable:** App builds cleanly, nav shell covers all 5 sections + Settings with light/dark theme toggle, DB schema exists and migrates cleanly, and API routes return HTTP 200.

---

## Phase 2 — Add Trade & Trade List
**Goal:** Complete CRUD for trades — the core of the app.

### Tasks
- [x] Build Add Trade form (all fields: primary + journaling)
- [x] Implement mistake tag multi-select component (including custom mistakes)
- [x] Implement emotion single-select
- [x] Implement screenshot upload (single/multi image, stored to filesystem)
- [x] Wire form to POST /api/trades endpoint + screenshot upload/delete endpoints
- [x] Implement GET /api/trades endpoint with filters (date, symbol, direction, status, P/L sign, mistake)
- [x] Build Trade History list (desktop table + mobile card view)
- [x] Search by symbol/notes
- [x] Filter and sort controls
- [x] Trade detail view (all fields + screenshots + lightbox)
- [x] Edit trade (pre-filled form, PATCH endpoint)
- [x] Delete trade (confirmation dialog, DELETE endpoint)
- [x] Form validation with clear error messages
- [x] Success/error feedback states
- [x] Empty state for trade list

**Verifiable:** Add, view, edit, delete trades. Filters and search work. Open trades excluded from P/L. Verified via `server/test-phase2.js` and `tsc && vite build`.

---

## Phase 3 — Dashboard
**Goal:** Live summary dashboard pulling from real trade data.

### Tasks
- [x] Dashboard summary cards (Today's P/L, trades taken today, wins today, losses today, Overall Net P/L, optional Recorded Balance)
- [x] Today's trades compact list (keyboard-accessible links + mobile card rows)
- [x] Recent trades list (last 5, explicitly sorted newest-first)
- [x] Daily / Monthly P/L bar chart (Recharts, signed bar rounding & axis formatting)
- [x] Journal completion reminder logic (gated on loading state to avoid flash)
- [x] Quick Add Trade button
- [x] Currency display everywhere + mixed-currency notice

**Verifiable:** Dashboard shows correct calculated values. Open trades excluded. Zero-state is clear. Verified via `tsc && vite build` and `server/test-phase3.js` (live Express + SQLite API integration test).

---

## Phase 4 — Daily Journal
**Goal:** Complete daily journal CRUD with per-date uniqueness.

### Tasks
- [x] Daily Journal form (all 7 reflection fields + plan-followed select)
- [x] Auto-show calculated day P/L and trade count at top (open trades excluded from realized P/L)
- [x] One entry per date enforcement (DB `UNIQUE` + atomic `PUT` upsert + `409` on duplicate `POST`)
- [x] Draft saving behavior (incomplete entries saved to SQLite + local unsaved draft recovery)
- [x] Date browsing — interactive month calendar + saved entries date list UI
- [x] GET/POST/PUT/DELETE `/api/journal` endpoints with calendar date & `plan_followed` validation
- [x] Dashboard reminder & sidebar incomplete-journal indicator connected via shared `hasJournalContent`

**Verifiable:** Create/edit/delete journal entry per date, prevent duplicate dates, auto-populate day P/L & trade count, browse past entries, and survive server restarts. Verified via `tsc && vite build` and `server/test-phase4.js`.

---

## Phase 5 — Performance & Mistake Analysis
**Goal:** Accurate analytics for both Performance and Mistake Analysis sections.

### Tasks
- [x] Performance summary stats (all 12 metrics from R5, closed trades only)
- [x] Time filter controls (Today / This week / This month / Last month / This year / All time / Custom)
- [x] Daily P/L bar chart
- [x] Monthly P/L bar chart
- [x] Cumulative P/L line chart
- [x] Win rate calculation with correct denominator label (breakeven included)
- [x] Division-by-zero protection (show "---") & mixed-currency safeguard
- [x] Mistake Analysis — frequency ranking & count per mistake
- [x] Mistake → trade drill-down ("Trades tagged with ...")
- [x] Mistakes by month view
- [x] P/L associated with mistake tags (neutral framing, closed tagged trades only)

**Verifiable:** All stats match raw trade data. Filters apply consistently. Zero states shown correctly. Verified via `tsc && vite build` and `server/test-phase5.js`.

---

## Phase 6 — Settings, Export & Import
**Goal:** Settings, data export, full backup/restore.

### Tasks
- [x] Settings page (currency, starting balance, theme, custom instruments, custom mistakes)
- [x] Currency cascades to displays; per-trade currency preserved; mixed-currency safeguard on Recorded Balance
- [x] Recorded balance calculation (`starting_balance + cumulative net P/L` only when currencies match)
- [x] Export trades to CSV (all fields incl. `screenshot_references`, signed P/L, ISO `YYYY-MM-DD`, RFC-4180 escaping)
- [x] Export full backup to JSON (`app`, `version`, `date_format`, `exported_at`, `counts`, `trades`, `journal`, `settings`)
- [x] Import/restore JSON — schema validation, preview counts before applying, explicit confirmation dialog, Safe Merge & Update Duplicates modes, SQLite transaction rollback
- [x] Manage custom mistakes (add/remove)
- [x] Manage custom symbols (add/remove)
- [x] Theme toggle (light/dark) persisted in SQLite settings & Zustand `localStorage`

**Verifiable:** Export produces valid CSV and JSON. Import previews, confirms, merges safely, and rolls back on failure without data loss. Verified via `tsc && vite build` and `server/test-phase6.js`.

---

## Phase 7 — Polish, Responsive, & Verification
**Goal:** Production-quality application across all screen sizes.

### Tasks
- [x] Responsive audit: 375px, 768px, 1024px, 1440px across all 7 routes & both themes (`56` automated headless Chrome checks, 0 overflows, 0 console errors)
- [x] Mobile trade card layout (compact cards on `< md`, table on desktop)
- [x] Accessibility audit: keyboard nav, focus restoration on dialogs/lightbox, sticky-bar `scroll-padding`, linked error summaries, `prefers-reduced-motion`, WCAG contrast (`text-on-primary`, `color-scheme: light/dark`), non-color P/L cues
- [x] Error states for all API failures (including trade deletion failure banner)
- [x] Loading states for all async operations
- [x] Empty states for all list/chart sections
- [x] Positive/negative P/L distinguishable by sign/label (not color only)
- [x] All navigation, filters, buttons functional (including catch-all route)
- [x] Cross-viewport visual screenshot verification (desktop light/dark, mobile 375px light/dark)
- [x] Final review against master prompt acceptance criteria
- [x] Completion report

**Verifiable:** All 15 final acceptance criteria from master prompt pass. Verified via `tsc && vite build`, `server/test-phase2.js` through `server/test-phase6.js`, and headless Chrome visual audit.

---

## Milestone: v1.0 Complete
All 7 phases verified. App is usable on desktop and mobile. Data is persistent and exportable.
