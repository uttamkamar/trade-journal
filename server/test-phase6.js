'use strict';

// End-to-end Phase 6 verification against temporary SQLite DB and live Express API.
// Tests Settings persistence across restart, currency & starting balance compatibility,
// CSV export & escaping, JSON backup completeness, import preview, safe merge vs overwrite,
// and full SQLite transaction rollback on failure.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-p6-'));
const dbPath = path.join(tmpDir, 'test.db');
const uploadsDir = path.join(tmpDir, 'uploads');
const port = 3095;
const baseUrl = `http://127.0.0.1:${port}`;

function startServer() {
  return spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      UPLOADS_DIR: uploadsDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopServer(proc) {
  if (!proc) return;
  proc.kill();
  await new Promise((resolve) => proc.once('exit', resolve));
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
  let proc = startServer();

  try {
    await waitForHealth();

    const { computeDashboardMetrics } = await import('../client/src/lib/utils.ts');

    // 1. Settings validation & persistence across restart
    const badCurrency = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: 'INVALID' }),
    });
    assert.equal(badCurrency.status, 400);

    const badTheme = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'neon' }),
    });
    assert.equal(badTheme.status, 400);

    const patchRes = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currency: 'INR',
        starting_balance: 100000,
        theme: 'dark',
        custom_symbols: ['nifty50', 'SOLUSD', 'NIFTY50'],
        custom_mistakes: ['News spike', 'news spike'],
      }),
    });
    assert.equal(patchRes.status, 200);
    const updatedSettings = await patchRes.json();
    assert.equal(updatedSettings.currency, 'INR');
    assert.equal(updatedSettings.starting_balance, 100000);
    assert.equal(updatedSettings.theme, 'dark');
    assert.deepEqual(updatedSettings.custom_symbols, ['NIFTY50', 'SOLUSD']);
    assert.deepEqual(updatedSettings.custom_mistakes, ['News spike']);

    // Restart server & verify settings persisted
    await stopServer(proc);
    proc = startServer();
    await waitForHealth();

    const persistedSettings = await fetch(`${baseUrl}/api/settings`).then((r) => r.json());
    assert.equal(persistedSettings.currency, 'INR');
    assert.equal(persistedSettings.starting_balance, 100000);
    assert.equal(persistedSettings.theme, 'dark');
    assert.deepEqual(persistedSettings.custom_symbols, ['NIFTY50', 'SOLUSD']);

    // 2. Seed trades (including CSV special characters) + journal entry
    const createTrade = async (body) => {
      const r = await fetch(`${baseUrl}/api/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 201);
      return r.json();
    };

    const t1 = await createTrade({
      trade_date: '2026-11-25',
      symbol: 'NIFTY50',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 24100,
      exit_price: 24250,
      realized_pnl: 2500,
      currency: 'INR',
      setup: 'ORB, "Clean" Break',
      entry_reason: 'Breakout\nSecond line',
      mistakes: ['Exited too early'],
      screenshot_references: ['/uploads/sample/chart.png'],
    });
    const t2 = await createTrade({
      trade_date: '2026-11-24',
      symbol: 'XAUUSD',
      direction: 'Sell',
      status: 'Closed',
      entry_price: 2660,
      exit_price: 2670,
      realized_pnl: -150,
      currency: 'USD', // Different from INR -> triggers mixed-currency guard
    });

    await fetch(`${baseUrl}/api/journal/2026-11-25`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trading_summary: 'Original today note', plan_followed: 'Yes' }),
    });

    // Verify compatible vs incompatible recorded balance calculation
    const compatibleMetrics = computeDashboardMetrics([t1], persistedSettings, '2026-11-25');
    assert.equal(compatibleMetrics.recordedBalance, 102500);
    assert.equal(compatibleMetrics.balanceIncompatible, false);

    const incompatibleMetrics = computeDashboardMetrics([t1, t2], persistedSettings, '2026-11-25');
    assert.equal(incompatibleMetrics.hasMixedCurrencies, true);
    assert.equal(incompatibleMetrics.balanceIncompatible, true);
    assert.equal(incompatibleMetrics.recordedBalance, null, 'Must not sum INR starting balance with USD P/L');

    // 3. Verify CSV export completeness & RFC-4180 escaping
    const csvRes = await fetch(`${baseUrl}/api/export/trades.csv`);
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert.ok(csvText.includes('screenshot_references'), 'CSV header must include screenshot_references');
    assert.ok(csvText.includes('"ORB, ""Clean"" Break"'), 'Commas and quotes must be CSV-escaped');
    assert.ok(csvText.includes('"Breakout\nSecond line"'), 'Newlines must be CSV-escaped');
    assert.ok(csvText.includes('2026-11-25'), 'Dates must be ISO YYYY-MM-DD');
    assert.ok(csvText.includes('2500') && csvText.includes('-150'), 'Signed P/L values must be present');

    // 4. Verify JSON backup completeness
    const backup = await fetch(`${baseUrl}/api/export/backup.json`).then((r) => r.json());
    assert.equal(backup.version, 1);
    assert.equal(backup.app, 'TradeLog');
    assert.equal(backup.date_format, 'YYYY-MM-DD');
    assert.equal(backup.trades.length, 2);
    assert.equal(backup.journal.length, 1);
    assert.equal(backup.settings.currency, 'INR');

    // 5. Invalid backup rejection & unconfirmed apply rejection
    const badBackupPreview = await fetch(`${baseUrl}/api/export/import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { version: 99, trades: [] } }),
    });
    assert.equal(badBackupPreview.status, 400);

    const unconfirmedApply = await fetch(`${baseUrl}/api/export/import/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: backup, mode: 'merge_skip', confirmed: false }),
    });
    assert.equal(unconfirmedApply.status, 400);

    // 6. Preview accuracy + Safe Merge vs Update Duplicates
    const newTradeId = '11111111-1111-4111-8111-111111111111';
    const incomingBackup = {
      version: 1,
      exported_at: '2026-11-25T10:00:00.000Z',
      trades: [
        { ...t1, setup: 'Modified Setup In Backup', realized_pnl: 9999 }, // duplicate id
        {
          id: newTradeId,
          trade_date: '2026-11-20',
          symbol: 'BTCUSD',
          direction: 'Buy',
          status: 'Closed',
          entry_price: 90000,
          exit_price: 91000,
          realized_pnl: 400,
          currency: 'USD',
          mistakes: [],
          screenshot_references: [],
        },
      ],
      journal: [
        { journal_date: '2026-11-25', trading_summary: 'Overwritten Note', plan_followed: 'No' }, // duplicate date
        { journal_date: '2026-11-20', trading_summary: 'New imported journal', plan_followed: 'Yes' },
      ],
      settings: {
        currency: 'USD',
        starting_balance: 5000,
        theme: 'light',
        custom_symbols: ['ETHUSD'],
        custom_mistakes: ['Late exit'],
      },
    };

    const previewRes = await fetch(`${baseUrl}/api/export/import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: incomingBackup }),
    }).then((r) => r.json());

    assert.equal(previewRes.preview.trades.total, 2);
    assert.equal(previewRes.preview.trades.new, 1);
    assert.equal(previewRes.preview.trades.duplicate, 1);
    assert.equal(previewRes.preview.journal.total, 2);
    assert.equal(previewRes.preview.journal.new, 1);
    assert.equal(previewRes.preview.journal.duplicate, 1);

    // 7. Transaction rollback test before applying
    const failApply = await fetch(`${baseUrl}/api/export/import/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: incomingBackup,
        mode: 'merge_skip',
        confirmed: true,
        _simulateFailure: true,
      }),
    });
    assert.equal(failApply.status, 500);
    const tradesAfterRollback = await fetch(`${baseUrl}/api/trades`).then((r) => r.json());
    assert.equal(tradesAfterRollback.length, 2, 'Rollback must undo inserted trade');
    const journalAfterRollback = await fetch(`${baseUrl}/api/journal`).then((r) => r.json());
    assert.equal(journalAfterRollback.length, 1, 'Rollback must undo inserted journal');

    // 8. Safe Merge (merge_skip): adds new, skips duplicates, preserves existing, merges custom lists
    const mergeRes = await fetch(`${baseUrl}/api/export/import/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: incomingBackup,
        mode: 'merge_skip',
        confirmed: true,
      }),
    }).then((r) => r.json());
    assert.equal(mergeRes.summary.trades.inserted, 1);
    assert.equal(mergeRes.summary.trades.skipped, 1);
    assert.equal(mergeRes.summary.journal.inserted, 1);
    assert.equal(mergeRes.summary.journal.skipped, 1);

    const existingT1AfterSkip = await fetch(`${baseUrl}/api/trades/${t1.id}`).then((r) => r.json());
    assert.equal(existingT1AfterSkip.realized_pnl, 2500, 'Safe merge must not overwrite existing trade');
    const existingJAfterSkip = await fetch(`${baseUrl}/api/journal/2026-11-25`).then((r) => r.json());
    assert.equal(existingJAfterSkip.trading_summary, 'Original today note', 'Safe merge must not overwrite existing journal');
    const settingsAfterSkip = await fetch(`${baseUrl}/api/settings`).then((r) => r.json());
    assert.equal(settingsAfterSkip.currency, 'INR', 'Safe merge preserves active currency');
    assert.ok(settingsAfterSkip.custom_symbols.includes('ETHUSD') && settingsAfterSkip.custom_symbols.includes('NIFTY50'));
    assert.ok(settingsAfterSkip.custom_mistakes.includes('Late exit') && settingsAfterSkip.custom_mistakes.includes('News spike'));

    // 9. Merge & Update Duplicates (merge_overwrite): updates both matching records while preserving t2
    const overwriteRes = await fetch(`${baseUrl}/api/export/import/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: incomingBackup,
        mode: 'merge_overwrite',
        confirmed: true,
      }),
    }).then((r) => r.json());
    assert.equal(overwriteRes.summary.trades.updated, 2);
    assert.equal(overwriteRes.summary.journal.updated, 2);

    const t1Updated = await fetch(`${baseUrl}/api/trades/${t1.id}`).then((r) => r.json());
    assert.equal(t1Updated.realized_pnl, 9999);
    const t2Preserved = await fetch(`${baseUrl}/api/trades/${t2.id}`).then((r) => r.json());
    assert.equal(t2Preserved.symbol, 'XAUUSD', 'Unrelated existing trades must remain intact');

    console.log('ALL PHASE 6 SETTINGS, EXPORT & IMPORT CHECKS PASSED');
  } finally {
    await stopServer(proc);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
