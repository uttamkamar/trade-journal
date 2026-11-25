'use strict';

// End-to-end Phase 3 verification against a temporary SQLite DB and live Express API.
// Tests persistence + calculations across positive/negative/zero P/L, same-day trades,
// open trades, previous-day/month trades, edits, deletes, starting balance, and journal reminder.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-p3-'));
const port = 3098;
const baseUrl = `http://127.0.0.1:${port}`;

function localToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

async function waitForHealth() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${baseUrl}/api/health`);
      if (r.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Server failed to start within timeout');
}

async function run() {
  const proc = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(tmpDir, 'test.db'),
      UPLOADS_DIR: path.join(tmpDir, 'uploads'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForHealth();

    const {
      computeDashboardMetrics,
      buildMonthlyDailyPnlSeries,
      buildMonthlyPnlSeries,
    } = await import('../client/src/lib/utils.ts');

    const today = localToday();
    const yesterday = shiftDays(today, -1);
    const lastMonth = shiftDays(today, -35);

    const postTrade = async (body) => {
      const r = await fetch(`${baseUrl}/api/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 201);
      return r.json();
    };

    const getSnapshot = async () => {
      const [trades, settings, journal] = await Promise.all([
        fetch(`${baseUrl}/api/trades?sort=newest`).then((r) => r.json()),
        fetch(`${baseUrl}/api/settings`).then((r) => r.json()),
        fetch(`${baseUrl}/api/journal`).then((r) => r.json()),
      ]);
      return { trades, settings, journal };
    };

    // Initial state: no starting balance, no trades, no journal today
    let snap = await getSnapshot();
    let m = computeDashboardMetrics(snap.trades, snap.settings, today);
    assert.equal(m.todayPnl, 0);
    assert.equal(m.todayTrades.length, 0);
    assert.equal(m.recordedBalance, null);
    assert.equal(snap.journal.some((j) => j.journal_date === today), false);

    // 1. Add multiple trades today: positive, negative, zero (breakeven), and open
    const tWin = await postTrade({
      trade_date: today,
      symbol: 'XAUUSD',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 2650,
      exit_price: 2660,
      realized_pnl: 250.5,
      currency: 'USD',
    });
    const tLoss = await postTrade({
      trade_date: today,
      symbol: 'EURUSD',
      direction: 'Sell',
      status: 'Closed',
      entry_price: 1.09,
      exit_price: 1.095,
      realized_pnl: -75.25,
      currency: 'USD',
    });
    const tBe = await postTrade({
      trade_date: today,
      symbol: 'USDJPY',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 152.0,
      exit_price: 152.0,
      realized_pnl: 0,
      currency: 'USD',
    });
    const tOpen = await postTrade({
      trade_date: today,
      symbol: 'GBPUSD',
      direction: 'Buy',
      status: 'Open',
      entry_price: 1.27,
      realized_pnl: 500, // Server must force null
      currency: 'USD',
    });

    // 2. Add previous day + previous month closed trades
    const tPrevDay = await postTrade({
      trade_date: yesterday,
      symbol: 'GBPJPY',
      direction: 'Sell',
      status: 'Closed',
      entry_price: 194.0,
      exit_price: 193.0,
      realized_pnl: 300,
      currency: 'USD',
    });
    const tPrevMonth = await postTrade({
      trade_date: lastMonth,
      symbol: 'BTCUSD',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 85000,
      exit_price: 84000,
      realized_pnl: -100,
      currency: 'USD',
    });

    // Configure starting balance
    await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starting_balance: 5000, currency: 'USD' }),
    });

    snap = await getSnapshot();
    m = computeDashboardMetrics(snap.trades, snap.settings, today);

    // Today's P/L = 250.5 - 75.25 + 0 = 175.25 (open excluded)
    assert.equal(m.todayTrades.length, 4);
    assert.equal(m.todayClosedCount, 3);
    assert.equal(m.todayOpenCount, 1);
    assert.equal(m.todayWins, 1);
    assert.equal(m.todayLosses, 1);
    assert.equal(m.todayPnl, 175.25);

    // Overall net P/L = 175.25 + 300 - 100 = 375.25
    assert.equal(m.overallClosedCount, 5);
    assert.equal(m.overallNetPnl, 375.25);
    assert.equal(m.recordedBalance, 5375.25);
    assert.equal(m.recentTrades.length, 5);

    // Charts match persisted records
    const dailySeries = buildMonthlyDailyPnlSeries(snap.trades, today.slice(0, 7));
    const todayPoint = dailySeries.find((p) => p.key === today);
    assert.ok(todayPoint, 'Today should appear in daily chart');
    assert.equal(todayPoint.pnl, 175.25);

    const monthlySeries = buildMonthlyPnlSeries(snap.trades);
    assert.ok(monthlySeries.length >= 1);
    assert.equal(
      monthlySeries.reduce((s, p) => s + p.pnl, 0),
      375.25,
    );

    // 3. Edit a trade and verify metrics update
    const editRes = await fetch(`${baseUrl}/api/trades/${tLoss.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ realized_pnl: -25.25 }),
    });
    assert.equal(editRes.status, 200);

    snap = await getSnapshot();
    m = computeDashboardMetrics(snap.trades, snap.settings, today);
    assert.equal(m.todayPnl, 225.25);
    assert.equal(m.overallNetPnl, 425.25);
    assert.equal(m.recordedBalance, 5425.25);

    // 4. Delete a trade and verify metrics update
    const delRes = await fetch(`${baseUrl}/api/trades/${tPrevDay.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);

    snap = await getSnapshot();
    m = computeDashboardMetrics(snap.trades, snap.settings, today);
    assert.equal(m.overallClosedCount, 4);
    assert.equal(m.overallNetPnl, 125.25);
    assert.equal(m.recordedBalance, 5125.25);

    // Unused ids referenced so test stays clean
    assert.ok(tWin.id && tBe.id && tOpen.id && tPrevMonth.id);

    // 5. Journal completion check
    await fetch(`${baseUrl}/api/journal/${today}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trading_summary: 'Followed rules on gold setup.' }),
    });
    snap = await getSnapshot();
    const todayEntry = snap.journal.find((j) => j.journal_date === today);
    assert.ok(todayEntry && todayEntry.trading_summary.includes('Followed rules'));

    console.log('ALL PHASE 3 INTEGRATION CHECKS PASSED');
  } finally {
    proc.kill();
    await new Promise((resolve) => proc.once('exit', resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
