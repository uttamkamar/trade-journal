'use strict';

// End-to-end Phase 4 verification for Daily Journal CRUD, duplicate prevention,
// incomplete drafts, daily P/L & trade counts, Dashboard reminder integration,
// trade preservation, and persistence across server restarts.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-p4-'));
const dbPath = path.join(tmpDir, 'test.db');
const uploadsDir = path.join(tmpDir, 'uploads');
const port = 3097;
const baseUrl = `http://127.0.0.1:${port}`;

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

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

    const {
      computeDayTradeSummary,
      hasJournalContent,
    } = await import('../client/src/lib/utils.ts');

    const today = localToday();
    const yesterday = shiftDays(today, -1);

    // Seed trades for today & yesterday (including Open trade)
    const createTrade = async (body) => {
      const r = await fetch(`${baseUrl}/api/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 201);
      return r.json();
    };

    await createTrade({
      trade_date: today,
      symbol: 'XAUUSD',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 2650,
      exit_price: 2660,
      realized_pnl: 210,
      currency: 'USD',
    });
    await createTrade({
      trade_date: today,
      symbol: 'EURUSD',
      direction: 'Sell',
      status: 'Open',
      entry_price: 1.09,
      currency: 'USD',
    });
    await createTrade({
      trade_date: yesterday,
      symbol: 'BTCUSD',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 90000,
      exit_price: 89500,
      realized_pnl: -80,
      currency: 'USD',
    });

    // 1. Validate Dashboard reminder before journal entry
    let entries = await fetch(`${baseUrl}/api/journal`).then((r) => r.json());
    assert.equal(hasJournalContent(entries.find((e) => e.journal_date === today)), false);

    // 2. Reject invalid dates & invalid plan_followed
    const badDateRes = await fetch(`${baseUrl}/api/journal/2026-02-31`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trading_summary: 'Invalid date' }),
    });
    assert.equal(badDateRes.status, 400);

    const badPlanRes = await fetch(`${baseUrl}/api/journal/${today}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_followed: 'Always' }),
    });
    assert.equal(badPlanRes.status, 400);

    // 3. Save incomplete draft for today (only 1 field filled)
    const draftRes = await fetch(`${baseUrl}/api/journal/${today}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trading_summary: 'Patient first half of session.',
      }),
    });
    assert.equal(draftRes.status, 200);
    const createdToday = await draftRes.json();
    assert.equal(createdToday.journal_date, today);
    assert.equal(createdToday.what_went_well, null);
    assert.equal(hasJournalContent(createdToday), true);

    // 4. Duplicate date prevention: POST same date -> 409 Conflict; PUT same date -> updates in place
    const dupPostRes = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        journal_date: today,
        trading_summary: 'Duplicate attempt',
      }),
    });
    assert.equal(dupPostRes.status, 409, 'Duplicate date POST must return 409');

    const editRes = await fetch(`${baseUrl}/api/journal/${today}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trading_summary: 'Patient first half of session.',
        what_went_well: 'Waited for London break confirmation.',
        mistakes_today: 'None on XAUUSD.',
        lessons_learned: 'Patience pays.',
        plan_followed: 'Yes',
        improvement_for_tomorrow: 'Keep same pre-market routine.',
        general_notes: 'Focused.',
      }),
    });
    assert.equal(editRes.status, 200);
    const editedToday = await editRes.json();
    assert.equal(editedToday.id, createdToday.id, 'Upsert must preserve existing row id');
    assert.equal(editedToday.plan_followed, 'Yes');

    // 5. Create previous day entry via POST
    const prevRes = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        journal_date: yesterday,
        trading_summary: 'Choppy BTC session.',
        plan_followed: 'Partially',
      }),
    });
    assert.equal(prevRes.status, 201);

    // 6. Verify browsing ordered newest-first + daily P/L & trade counts
    const allTrades = await fetch(`${baseUrl}/api/trades`).then((r) => r.json());
    const todaySum = computeDayTradeSummary(allTrades, today);
    assert.equal(todaySum.totalTrades, 2);
    assert.equal(todaySum.closedTrades, 1);
    assert.equal(todaySum.openTrades, 1);
    assert.equal(todaySum.netPnl, 210, 'Open trade must be excluded from day P/L');

    const yestSum = computeDayTradeSummary(allTrades, yesterday);
    assert.equal(yestSum.totalTrades, 1);
    assert.equal(yestSum.netPnl, -80);

    // 7. Verify persistence across full server restart
    await stopServer(proc);
    proc = startServer();
    await waitForHealth();

    entries = await fetch(`${baseUrl}/api/journal`).then((r) => r.json());
    assert.equal(entries.length, 2, 'Both journal entries must survive restart');
    assert.equal(entries[0].journal_date, today);
    assert.equal(entries[0].what_went_well, 'Waited for London break confirmation.');
    assert.equal(entries[1].journal_date, yesterday);

    const tradesAfterRestart = await fetch(`${baseUrl}/api/trades`).then((r) => r.json());
    assert.equal(tradesAfterRestart.length, 3, 'Trades must remain preserved after restart');

    // 8. Deleting a journal entry preserves trades and re-activates reminder for today
    const delJournal = await fetch(`${baseUrl}/api/journal/${today}`, { method: 'DELETE' });
    assert.equal(delJournal.status, 200);

    entries = await fetch(`${baseUrl}/api/journal`).then((r) => r.json());
    assert.equal(hasJournalContent(entries.find((e) => e.journal_date === today)), false);

    const tradesAfterDel = await fetch(`${baseUrl}/api/trades`).then((r) => r.json());
    assert.equal(tradesAfterDel.length, 3, 'Deleting journal entry must preserve trades');

    console.log('ALL PHASE 4 JOURNAL CHECKS PASSED');
  } finally {
    await stopServer(proc);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
