'use strict';

// End-to-end Phase 5 verification against a temporary SQLite DB and live Express API.
// Covers Performance summary metrics, zero-denominator/empty handling, all 7 time filters,
// daily/monthly/cumulative charts, mixed-currency detection, Mistake frequency, monthly
// breakdown, multi-mistake drill-down, associated P/L, and live updates on edit/delete.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-p5-'));
const port = 3096;
const baseUrl = `http://127.0.0.1:${port}`;

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
      computeSummary,
      getDateRangeForPreset,
      filterTradesByDateRange,
      buildDailyPnlSeries,
      buildMonthlyPnlSeries,
      buildCumulativePnlSeries,
      analyzeMistakes,
      getMixedCurrencies,
    } = await import('../client/src/lib/utils.ts');

    // Reference date chosen cleanly mid-week/mid-year: Wednesday 2026-11-25
    const refToday = '2026-11-25';

    // 1. Empty data & division-by-zero handling
    const emptySummary = computeSummary([]);
    assert.equal(emptySummary.total, 0);
    assert.equal(emptySummary.winRate, null);
    assert.equal(emptySummary.avgWin, null);
    assert.equal(emptySummary.avgLoss, null);
    assert.equal(emptySummary.bestTrade, null);
    assert.equal(emptySummary.worstTrade, null);
    assert.deepEqual(analyzeMistakes([]), { items: [], byMonth: [] });

    // Seed trades via live API
    const createTrade = async (body) => {
      const r = await fetch(`${baseUrl}/api/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 201);
      return r.json();
    };

    // Today (2026-11-25): 1 win, 1 breakeven, 1 open
    const tTodayWin = await createTrade({
      trade_date: '2026-11-25',
      symbol: 'XAUUSD',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 2650,
      exit_price: 2665,
      realized_pnl: 300,
      currency: 'USD',
      mistakes: ['Exited too early', 'Moved stop loss unnecessarily'],
    });
    const tTodayBe = await createTrade({
      trade_date: '2026-11-25',
      symbol: 'USDJPY',
      direction: 'Sell',
      status: 'Closed',
      entry_price: 152,
      exit_price: 152,
      realized_pnl: 0,
      currency: 'USD',
      mistakes: ['FOMO entry'],
    });
    const tTodayOpen = await createTrade({
      trade_date: '2026-11-25',
      symbol: 'GBPUSD',
      direction: 'Buy',
      status: 'Open',
      entry_price: 1.27,
      realized_pnl: 999, // Excluded from realized P/L
      currency: 'USD',
      mistakes: ['FOMO entry'],
    });

    // Earlier this week (Monday 2026-11-23): 1 loss
    const tWeekLoss = await createTrade({
      trade_date: '2026-11-23',
      symbol: 'EURUSD',
      direction: 'Sell',
      status: 'Closed',
      entry_price: 1.09,
      exit_price: 1.095,
      realized_pnl: -100,
      currency: 'USD',
      mistakes: ['FOMO entry', 'Other'],
      custom_mistake: 'Chased candle',
    });

    // Earlier this month (2026-11-05): 1 win
    const tMonthWin = await createTrade({
      trade_date: '2026-11-05',
      symbol: 'GBPJPY',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 193,
      exit_price: 194,
      realized_pnl: 500,
      currency: 'USD',
      mistakes: ['Entered too early'],
    });

    // Last month (2026-10-14): 1 loss
    const tLastMonthLoss = await createTrade({
      trade_date: '2026-10-14',
      symbol: 'BTCUSD',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 85000,
      exit_price: 84000,
      realized_pnl: -200,
      currency: 'USD',
      mistakes: ['FOMO entry'],
    });

    // Earlier this year (2026-03-10): 1 win
    const tYearWin = await createTrade({
      trade_date: '2026-03-10',
      symbol: 'XAUUSD',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 2400,
      exit_price: 2410,
      realized_pnl: 100,
      currency: 'USD',
    });

    // Previous year (2025-12-15): 1 loss in EUR (tests year filter + mixed currency check)
    const tPrevYearEur = await createTrade({
      trade_date: '2025-12-15',
      symbol: 'EURUSD',
      direction: 'Sell',
      status: 'Closed',
      entry_price: 1.05,
      exit_price: 1.06,
      realized_pnl: -50,
      currency: 'EUR',
      mistakes: ['Chased candle'],
    });

    let allTrades = await fetch(`${baseUrl}/api/trades?sort=oldest`).then((r) => r.json());
    assert.equal(allTrades.length, 8);

    // 2. Summary metrics for All Time (7 closed trades, 1 open excluded)
    // Closed P/Ls: 300, 0, -100, 500, -200, 100, -50
    // Wins: 300, 500, 100 (count=3, grossProfit=900, avgWin=300)
    // Losses: -100, -200, -50 (count=3, grossLoss=350, avgLoss=116.666...)
    // Breakeven: 0 (count=1) -> total closed = 7
    // Win rate = 3 / 7 * 100 = 42.85714... (breakeven stays in denominator)
    const allSum = computeSummary(allTrades);
    assert.equal(allSum.total, 7);
    assert.equal(allSum.wins, 3);
    assert.equal(allSum.losses, 3);
    assert.equal(allSum.breakeven, 1);
    assert.ok(Math.abs(allSum.winRate - (3 / 7) * 100) < 1e-6);
    assert.equal(allSum.grossProfit, 900);
    assert.equal(allSum.grossLoss, 350);
    assert.equal(allSum.netPnl, 550);
    assert.equal(allSum.avgWin, 300);
    assert.ok(Math.abs(allSum.avgLoss - 350 / 3) < 1e-6);
    assert.equal(allSum.bestTrade, 500);
    assert.equal(allSum.worstTrade, -200);

    // Mixed-currency safeguard
    assert.deepEqual(getMixedCurrencies(allTrades, 'USD'), ['EUR', 'USD']);

    // 3. Time filters: Today, This week, This month, Last month, This year, All time, Custom
    const expectPreset = (preset, expectedClosedCount, expectedNet) => {
      const { from, to } = getDateRangeForPreset(preset, refToday);
      const sub = filterTradesByDateRange(allTrades, from, to);
      const s = computeSummary(sub);
      assert.equal(s.total, expectedClosedCount, `Preset ${preset} closed count`);
      assert.equal(s.netPnl, expectedNet, `Preset ${preset} net P/L`);
    };

    expectPreset('today', 2, 300);        // 300 + 0 (open excluded)
    expectPreset('this_week', 3, 200);    // 2026-11-23 (-100) + 2026-11-25 (300, 0)
    expectPreset('this_month', 4, 700);   // + 2026-11-05 (500)
    expectPreset('last_month', 1, -200);  // 2026-10-14 (-200)
    expectPreset('this_year', 6, 600);    // excludes 2025-12-15 (-50)
    expectPreset('all_time', 7, 550);

    // Custom date range: 2026-10-01 to 2026-11-24
    const customSub = filterTradesByDateRange(allTrades, '2026-10-01', '2026-11-24');
    const customSum = computeSummary(customSub);
    assert.equal(customSum.total, 3);
    assert.equal(customSum.netPnl, 200); // -200 + 500 - 100

    // Division by zero when range has only wins (no losses -> avgLoss === null)
    const todaySum = computeSummary(
      filterTradesByDateRange(allTrades, refToday, refToday),
    );
    assert.equal(todaySum.avgLoss, null);

    // 4. Charts (Daily, Monthly, Cumulative) match closed trades
    const novTrades = filterTradesByDateRange(
      allTrades,
      ...Object.values(getDateRangeForPreset('this_month', refToday)),
    );
    const daily = buildDailyPnlSeries(novTrades);
    assert.deepEqual(
      daily.map((d) => [d.key, d.pnl]),
      [
        ['2026-11-05', 500],
        ['2026-11-23', -100],
        ['2026-11-25', 300],
      ],
    );
    const cumulative = buildCumulativePnlSeries(novTrades);
    assert.deepEqual(
      cumulative.map((c) => c.cumulativePnl),
      [500, 400, 700],
    );
    const monthly = buildMonthlyPnlSeries(allTrades);
    assert.equal(monthly.length, 4); // 2025-12, 2026-03, 2026-10, 2026-11
    assert.equal(monthly.reduce((s, m) => s + m.pnl, 0), 550);

    // 5. Mistake Analysis: ranking, multiple mistakes per trade, custom mistakes, drill-down, P/L
    let mistakes = analyzeMistakes(allTrades);
    // Counts:
    // FOMO entry: 4 trades (tTodayBe=0, tTodayOpen=OPEN, tWeekLoss=-100, tLastMonthLoss=-200)
    //   -> count=4, closedCount=3, openCount=1, associatedNetPnl = -300
    // Chased candle: 2 trades (tWeekLoss=-100 USD, tPrevYearEur=-50 EUR) -> count=2, associatedNetPnl=-150
    const fomo = mistakes.items.find((i) => i.mistake === 'FOMO entry');
    assert.equal(mistakes.items[0].mistake, 'FOMO entry');
    assert.equal(fomo.count, 4);
    assert.equal(fomo.closedCount, 3);
    assert.equal(fomo.openCount, 1);
    assert.equal(fomo.associatedNetPnl, -300, 'Open trade must be excluded from mistake P/L');
    assert.equal(fomo.trades.length, 4, 'Drill-down shows all 4 tagged trades');

    const chased = mistakes.items.find((i) => i.mistake === 'Chased candle');
    assert.equal(chased.count, 2);
    assert.deepEqual(chased.currencies, ['EUR', 'USD']);

    // Monthly mistake breakdown (2026-11 should have FOMO entry x3, Exited too early x1, etc.)
    const novMistakes = mistakes.byMonth.find((m) => m.month === '2026-11');
    assert.ok(novMistakes);
    assert.equal(novMistakes.breakdown.find((b) => b.mistake === 'FOMO entry').count, 3);

    // 6. Editing and deleting trades updates Performance & Mistake Analysis accurately
    await fetch(`${baseUrl}/api/trades/${tTodayWin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realized_pnl: 400,
        mistakes: ['Exited too early'], // removed 'Moved stop loss unnecessarily'
      }),
    });
    await fetch(`${baseUrl}/api/trades/${tPrevYearEur.id}`, { method: 'DELETE' });

    allTrades = await fetch(`${baseUrl}/api/trades?sort=oldest`).then((r) => r.json());
    const afterEditSum = computeSummary(allTrades);
    // Was 550, +100 on tTodayWin, deleted -50 on tPrevYearEur -> 550 + 100 + 50 = 700
    assert.equal(afterEditSum.total, 6);
    assert.equal(afterEditSum.netPnl, 700);
    assert.deepEqual(getMixedCurrencies(allTrades, 'USD'), []); // EUR trade deleted

    mistakes = analyzeMistakes(allTrades);
    assert.equal(
      mistakes.items.some((i) => i.mistake === 'Moved stop loss unnecessarily'),
      false,
    );
    assert.equal(mistakes.items.find((i) => i.mistake === 'Chased candle').count, 1);

    // Reference unused ids
    assert.ok(tTodayBe.id && tTodayOpen.id && tWeekLoss.id && tMonthWin.id && tLastMonthLoss.id && tYearWin.id);

    console.log('ALL PHASE 5 ANALYTICS CHECKS PASSED');
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
