'use strict';

// Runnable Phase 2 verification script (uses isolated temp DB & uploads dir).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-p2-'));
const port = 3099;
const baseUrl = `http://127.0.0.1:${port}`;

// Minimal valid 1x1 PNG bytes
const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
  '0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex',
);

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

    // 1. Validation check: missing entry_price / closed without exit_price
    const badRes = await fetch(`${baseUrl}/api/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trade_date: '2026-11-25',
        symbol: 'XAUUSD',
        direction: 'Buy',
        status: 'Closed',
      }),
    });
    assert.equal(badRes.status, 400, 'Should reject incomplete closed trade');

    // 2. Create Closed Profit, Closed Loss, Breakeven, and Open trade
    const create = async (body) => {
      const r = await fetch(`${baseUrl}/api/trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      assert.equal(r.status, 201, `Create failed: ${await r.clone().text()}`);
      return r.json();
    };

    const winTrade = await create({
      trade_date: '2026-11-25',
      symbol: 'xauusd',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 2650.5,
      exit_price: 2665.0,
      quantity_or_lot_size: 0.2,
      realized_pnl: 290,
      currency: 'USD',
      setup: 'London Breakout',
      entry_reason: 'Clean break above Asian high',
      mistakes: ['Exited too early'],
      emotion: 'Calm',
      plan_followed: 'Yes',
    });
    assert.equal(winTrade.symbol, 'XAUUSD');
    assert.equal(winTrade.realized_pnl, 290);

    const lossTrade = await create({
      trade_date: '2026-11-24',
      symbol: 'EURUSD',
      direction: 'Sell',
      status: 'Closed',
      entry_price: 1.085,
      exit_price: 1.089,
      realized_pnl: -120.5,
      currency: 'USD',
      mistakes: ['FOMO entry', 'Other'],
      custom_mistake: 'Chased candle',
      emotion: 'FOMO',
      plan_followed: 'No',
    });
    assert.equal(lossTrade.realized_pnl, -120.5);

    const beTrade = await create({
      trade_date: '2026-11-23',
      symbol: 'BTCUSD',
      direction: 'Buy',
      status: 'Closed',
      entry_price: 92000,
      exit_price: 92000,
      realized_pnl: 0,
      currency: 'USD',
    });
    assert.equal(beTrade.realized_pnl, 0);

    const openTrade = await create({
      trade_date: '2026-11-25',
      symbol: 'GBPUSD',
      direction: 'Buy',
      status: 'Open',
      entry_price: 1.27,
      realized_pnl: 999, // Must be nullified when status === Open
      currency: 'USD',
    });
    assert.equal(openTrade.realized_pnl, null, 'Open trade must have null realized_pnl');

    // 3. Edit existing trade (verify update in place, no duplicate)
    const patchRes = await fetch(`${baseUrl}/api/trades/${winTrade.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        realized_pnl: 310,
        lesson: 'Hold partial runner to HTF target',
      }),
    });
    assert.equal(patchRes.status, 200);
    const updatedWin = await patchRes.json();
    assert.equal(updatedWin.id, winTrade.id);
    assert.equal(updatedWin.realized_pnl, 310);

    const allTrades = await (await fetch(`${baseUrl}/api/trades`)).json();
    assert.equal(allTrades.length, 4, 'Editing must not create a duplicate record');

    // 4. Filters & Search
    const profits = await (await fetch(`${baseUrl}/api/trades?pnl=profit`)).json();
    assert.equal(profits.length, 1);
    assert.equal(profits[0].id, winTrade.id);

    const losses = await (await fetch(`${baseUrl}/api/trades?pnl=loss`)).json();
    assert.equal(losses.length, 1);
    assert.equal(losses[0].id, lossTrade.id);

    const bes = await (await fetch(`${baseUrl}/api/trades?pnl=breakeven`)).json();
    assert.equal(bes.length, 1);
    assert.equal(bes[0].id, beTrade.id);

    const openOnly = await (await fetch(`${baseUrl}/api/trades?status=Open`)).json();
    assert.equal(openOnly.length, 1);
    assert.equal(openOnly[0].id, openTrade.id);

    const customMistakeMatch = await (await fetch(`${baseUrl}/api/trades?mistake=${encodeURIComponent('Chased candle')}`)).json();
    assert.equal(customMistakeMatch.length, 1);
    assert.equal(customMistakeMatch[0].id, lossTrade.id);

    const searchMatch = await (await fetch(`${baseUrl}/api/trades?search=Asian`)).json();
    assert.equal(searchMatch.length, 1);
    assert.equal(searchMatch[0].id, winTrade.id);

    const sortedDesc = await (await fetch(`${baseUrl}/api/trades?sort=pnl_desc`)).json();
    assert.equal(sortedDesc[0].id, winTrade.id);
    assert.equal(sortedDesc[3].id, openTrade.id, 'Open trade sorts after closed trades');

    // 5. Multiple screenshot upload + static serving + reject invalid type + single delete
    const fd = new FormData();
    fd.append('screenshots', new Blob([PNG_BYTES], { type: 'image/png' }), 'chart1.png');
    fd.append('screenshots', new Blob([PNG_BYTES], { type: 'image/png' }), 'chart2.png');

    const upRes = await fetch(`${baseUrl}/api/trades/${winTrade.id}/screenshots`, {
      method: 'POST',
      body: fd,
    });
    assert.equal(upRes.status, 201);
    const withShots = await upRes.json();
    assert.equal(withShots.screenshot_references.length, 2);

    const staticRes = await fetch(`${baseUrl}${withShots.screenshot_references[0]}`);
    assert.equal(staticRes.status, 200);

    const badFd = new FormData();
    badFd.append('screenshots', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
    const badUp = await fetch(`${baseUrl}/api/trades/${winTrade.id}/screenshots`, {
      method: 'POST',
      body: badFd,
    });
    assert.equal(badUp.status, 400, 'Should reject non-image upload');

    const delShotRes = await fetch(`${baseUrl}/api/trades/${winTrade.id}/screenshots`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: withShots.screenshot_references[0] }),
    });
    assert.equal(delShotRes.status, 200);
    const afterShotDel = await delShotRes.json();
    assert.equal(afterShotDel.screenshot_references.length, 1);

    // 6. Delete trade & verify screenshot directory cleanup
    const delRes = await fetch(`${baseUrl}/api/trades/${winTrade.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    assert.equal(
      fs.existsSync(path.join(tmpDir, 'uploads', winTrade.id)),
      false,
      'Trade upload folder should be removed on trade deletion',
    );

    const remaining = await (await fetch(`${baseUrl}/api/trades`)).json();
    assert.equal(remaining.length, 3);

    console.log('ALL PHASE 2 CHECKS PASSED');
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
