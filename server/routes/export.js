'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const PLAN_VALUES = new Set(['Yes', 'No', 'Partially']);
const DIRECTIONS = new Set(['Buy', 'Sell']);
const STATUSES = new Set(['Open', 'Closed']);

function isValidCalendarDate(dateStr) {
  if (typeof dateStr !== 'string' || !DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function parseOptionalNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : NaN;
}

function validateAndNormalizeBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'Invalid backup format: expected a JSON object' };
  }
  if (data.version !== 1) {
    return { error: `Unsupported backup version: ${String(data.version ?? 'missing')}` };
  }
  if (data.trades !== undefined && !Array.isArray(data.trades)) {
    return { error: 'Invalid backup: "trades" must be an array' };
  }
  if (data.journal !== undefined && !Array.isArray(data.journal)) {
    return { error: 'Invalid backup: "journal" must be an array' };
  }
  if (data.settings !== undefined && data.settings !== null && (typeof data.settings !== 'object' || Array.isArray(data.settings))) {
    return { error: 'Invalid backup: "settings" must be an object or null' };
  }

  const trades = [];
  for (let i = 0; i < (data.trades || []).length; i++) {
    const t = data.trades[i];
    if (!t || typeof t !== 'object') {
      return { error: `Invalid trade at index ${i}` };
    }
    const id = typeof t.id === 'string' && t.id.trim() ? t.id.trim() : null;
    if (!id) return { error: `Trade at index ${i} is missing a valid id` };
    if (!isValidCalendarDate(t.trade_date)) {
      return { error: `Trade at index ${i} has invalid trade_date` };
    }
    const symbol = typeof t.symbol === 'string' ? t.symbol.trim().toUpperCase() : '';
    if (!symbol) return { error: `Trade at index ${i} is missing symbol` };
    if (!DIRECTIONS.has(t.direction)) {
      return { error: `Trade at index ${i} has invalid direction` };
    }
    if (!STATUSES.has(t.status)) {
      return { error: `Trade at index ${i} has invalid status` };
    }

    const entryPrice = parseOptionalNumber(t.entry_price);
    const exitPrice = parseOptionalNumber(t.exit_price);
    const lotSize = parseOptionalNumber(t.quantity_or_lot_size);
    let realizedPnl = parseOptionalNumber(t.realized_pnl);
    if (
      Number.isNaN(entryPrice) ||
      Number.isNaN(exitPrice) ||
      Number.isNaN(lotSize) ||
      Number.isNaN(realizedPnl)
    ) {
      return { error: `Trade at index ${i} has invalid numeric values` };
    }
    if (t.status === 'Open') realizedPnl = null;

    const currency = typeof t.currency === 'string' && CURRENCY_RE.test(t.currency.trim().toUpperCase())
      ? t.currency.trim().toUpperCase()
      : 'USD';

    const plan = t.plan_followed || null;
    if (plan !== null && !PLAN_VALUES.has(plan)) {
      return { error: `Trade at index ${i} has invalid plan_followed` };
    }

    const mistakes = Array.isArray(t.mistakes)
      ? t.mistakes.map((m) => String(m).trim()).filter(Boolean)
      : [];
    const screenshotRefs = Array.isArray(t.screenshot_references)
      ? t.screenshot_references.map(String)
      : [];

    trades.push({
      id,
      trade_date: t.trade_date,
      symbol,
      direction: t.direction,
      status: t.status,
      entry_price: entryPrice,
      exit_price: exitPrice,
      quantity_or_lot_size: lotSize,
      realized_pnl: realizedPnl,
      currency,
      setup: typeof t.setup === 'string' ? (t.setup.trim() || null) : null,
      entry_reason: typeof t.entry_reason === 'string' ? (t.entry_reason.trim() || null) : null,
      exit_reason: typeof t.exit_reason === 'string' ? (t.exit_reason.trim() || null) : null,
      mistakes,
      custom_mistake: typeof t.custom_mistake === 'string' ? (t.custom_mistake.trim() || null) : null,
      emotion: typeof t.emotion === 'string' ? (t.emotion.trim() || null) : null,
      plan_followed: plan,
      lesson: typeof t.lesson === 'string' ? (t.lesson.trim() || null) : null,
      screenshot_references: screenshotRefs,
    });
  }

  const journal = [];
  const seenJournalDates = new Set();
  for (let i = 0; i < (data.journal || []).length; i++) {
    const j = data.journal[i];
    if (!j || typeof j !== 'object') {
      return { error: `Invalid journal entry at index ${i}` };
    }
    if (!isValidCalendarDate(j.journal_date)) {
      return { error: `Journal entry at index ${i} has invalid journal_date` };
    }
    if (seenJournalDates.has(j.journal_date)) {
      return { error: `Backup contains duplicate journal entries for ${j.journal_date}` };
    }
    seenJournalDates.add(j.journal_date);

    const plan = j.plan_followed || null;
    if (plan !== null && !PLAN_VALUES.has(plan)) {
      return { error: `Journal entry at index ${i} has invalid plan_followed` };
    }

    const cleanTxt = (v) => (typeof v === 'string' && v.trim() ? v : null);
    journal.push({
      id: typeof j.id === 'string' && j.id.trim() ? j.id.trim() : uuidv4(),
      journal_date: j.journal_date,
      trading_summary: cleanTxt(j.trading_summary),
      what_went_well: cleanTxt(j.what_went_well),
      mistakes_today: cleanTxt(j.mistakes_today),
      lessons_learned: cleanTxt(j.lessons_learned),
      plan_followed: plan,
      improvement_for_tomorrow: cleanTxt(j.improvement_for_tomorrow),
      general_notes: cleanTxt(j.general_notes),
    });
  }

  let settings = null;
  if (data.settings) {
    const s = data.settings;
    const currency = typeof s.currency === 'string' && CURRENCY_RE.test(s.currency.trim().toUpperCase())
      ? s.currency.trim().toUpperCase()
      : null;
    const sb = parseOptionalNumber(s.starting_balance);
    if (Number.isNaN(sb)) {
      return { error: 'Backup settings contain invalid starting_balance' };
    }
    const theme = s.theme === 'light' || s.theme === 'dark' ? s.theme : null;
    const custom_symbols = Array.isArray(s.custom_symbols)
      ? Array.from(new Set(s.custom_symbols.map((x) => String(x).trim().toUpperCase()).filter(Boolean)))
      : [];
    const custom_mistakes = Array.isArray(s.custom_mistakes)
      ? Array.from(new Set(s.custom_mistakes.map((x) => String(x).trim()).filter(Boolean)))
      : [];
    settings = {
      currency,
      starting_balance: sb,
      has_starting_balance: Object.prototype.hasOwnProperty.call(s, 'starting_balance'),
      theme,
      custom_symbols,
      custom_mistakes,
    };
  }

  return {
    error: null,
    normalized: {
      version: data.version,
      exported_at: typeof data.exported_at === 'string' ? data.exported_at : null,
      trades,
      journal,
      settings,
    },
  };
}

// ── GET /api/export/trades.csv ───────────────────────────────────────────────
// Dates are exported in ISO YYYY-MM-DD format; realized_pnl is signed numeric.
router.get('/trades.csv', (req, res) => {
  try {
    const trades = getDb().prepare(
      'SELECT * FROM trades ORDER BY trade_date DESC, created_at DESC'
    ).all();

    const headers = [
      'id', 'trade_date', 'symbol', 'direction', 'status',
      'entry_price', 'exit_price', 'quantity_or_lot_size', 'realized_pnl', 'currency',
      'setup', 'entry_reason', 'exit_reason', 'mistakes', 'custom_mistake',
      'emotion', 'plan_followed', 'lesson', 'screenshot_references',
      'created_at', 'updated_at',
    ];

    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')
        ? `"${str}"`
        : str;
    };

    const rows = trades.map((t) =>
      headers.map((h) => escape(t[h])).join(','),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="trades.csv"');
    res.send([headers.join(','), ...rows].join('\n'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/export/backup.json ──────────────────────────────────────────────
router.get('/backup.json', (req, res) => {
  try {
    const db = getDb();
    const trades = db.prepare('SELECT * FROM trades ORDER BY trade_date DESC, created_at DESC').all().map((t) => ({
      ...t,
      mistakes: JSON.parse(t.mistakes || '[]'),
      screenshot_references: JSON.parse(t.screenshot_references || '[]'),
    }));
    const journal = db.prepare('SELECT * FROM daily_journal ORDER BY journal_date DESC').all();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

    const backup = {
      app: 'TradeLog',
      version: 1,
      date_format: 'YYYY-MM-DD',
      exported_at: new Date().toISOString(),
      counts: {
        trades: trades.length,
        journal: journal.length,
      },
      trades,
      journal,
      settings: settings
        ? {
            ...settings,
            custom_symbols: JSON.parse(settings.custom_symbols || '[]'),
            custom_mistakes: JSON.parse(settings.custom_mistakes || '[]'),
          }
        : null,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tradelog-backup.json"');
    res.json(backup);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/export/import/preview ──────────────────────────────────────────
router.post('/import/preview', (req, res) => {
  try {
    const { data } = req.body || {};
    const { error, normalized } = validateAndNormalizeBackup(data);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const db = getDb();
    const existingTradeIds = new Set(
      db.prepare('SELECT id FROM trades').all().map((t) => t.id),
    );
    const existingJournalDates = new Set(
      db.prepare('SELECT journal_date FROM daily_journal').all().map((j) => j.journal_date),
    );

    const tradeDupCount = normalized.trades.filter((t) => existingTradeIds.has(t.id)).length;
    const journalDupCount = normalized.journal.filter((j) => existingJournalDates.has(j.journal_date)).length;

    const preview = {
      version: normalized.version,
      exported_at: normalized.exported_at,
      trades: {
        total: normalized.trades.length,
        new: normalized.trades.length - tradeDupCount,
        duplicate: tradeDupCount,
      },
      journal: {
        total: normalized.journal.length,
        new: normalized.journal.length - journalDupCount,
        duplicate: journalDupCount,
      },
      settings: {
        included: Boolean(normalized.settings),
        currency: normalized.settings?.currency ?? null,
        customSymbolsCount: normalized.settings?.custom_symbols.length ?? 0,
        customMistakesCount: normalized.settings?.custom_mistakes.length ?? 0,
      },
    };

    res.json({
      preview,
      message: 'Preview validated — confirm restore via /import/apply',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/export/import/apply ────────────────────────────────────────────
// mode: 'merge_skip' (default, keeps existing duplicates untouched) | 'merge_overwrite'
router.post('/import/apply', (req, res) => {
  const { data, mode = 'merge_skip', confirmed, _simulateFailure } = req.body || {};
  if (confirmed !== true) {
    return res.status(400).json({ message: 'Explicit confirmation (confirmed: true) is required to apply restore' });
  }
  if (!['merge_skip', 'merge_overwrite'].includes(mode)) {
    return res.status(400).json({ message: 'mode must be merge_skip or merge_overwrite' });
  }

  const { error, normalized } = validateAndNormalizeBackup(data);
  if (error) {
    return res.status(400).json({ message: error });
  }

  const db = getDb();
  let tradesInserted = 0;
  let tradesUpdated = 0;
  let tradesSkipped = 0;
  let journalInserted = 0;
  let journalUpdated = 0;
  let journalSkipped = 0;
  let settingsUpdated = false;

  db.exec('BEGIN IMMEDIATE');
  try {
    const insertTradeStmt = db.prepare(`
      INSERT INTO trades (
        id, trade_date, symbol, direction, status,
        entry_price, exit_price, quantity_or_lot_size, realized_pnl, currency,
        setup, entry_reason, exit_reason, mistakes, custom_mistake,
        emotion, plan_followed, lesson, screenshot_references
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateTradeStmt = db.prepare(`
      UPDATE trades SET
        trade_date = ?, symbol = ?, direction = ?, status = ?,
        entry_price = ?, exit_price = ?, quantity_or_lot_size = ?, realized_pnl = ?, currency = ?,
        setup = ?, entry_reason = ?, exit_reason = ?, mistakes = ?, custom_mistake = ?,
        emotion = ?, plan_followed = ?, lesson = ?, screenshot_references = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    const findTradeStmt = db.prepare('SELECT id FROM trades WHERE id = ?');

    for (const t of normalized.trades) {
      const exists = findTradeStmt.get(t.id);
      if (exists) {
        if (mode === 'merge_overwrite') {
          updateTradeStmt.run(
            t.trade_date, t.symbol, t.direction, t.status,
            t.entry_price, t.exit_price, t.quantity_or_lot_size, t.realized_pnl, t.currency,
            t.setup, t.entry_reason, t.exit_reason, JSON.stringify(t.mistakes), t.custom_mistake,
            t.emotion, t.plan_followed, t.lesson, JSON.stringify(t.screenshot_references),
            t.id,
          );
          tradesUpdated++;
        } else {
          tradesSkipped++;
        }
      } else {
        insertTradeStmt.run(
          t.id, t.trade_date, t.symbol, t.direction, t.status,
          t.entry_price, t.exit_price, t.quantity_or_lot_size, t.realized_pnl, t.currency,
          t.setup, t.entry_reason, t.exit_reason, JSON.stringify(t.mistakes), t.custom_mistake,
          t.emotion, t.plan_followed, t.lesson, JSON.stringify(t.screenshot_references),
        );
        tradesInserted++;
      }
    }

    const insertJournalStmt = db.prepare(`
      INSERT INTO daily_journal (
        id, journal_date, trading_summary, what_went_well, mistakes_today,
        lessons_learned, plan_followed, improvement_for_tomorrow, general_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateJournalStmt = db.prepare(`
      UPDATE daily_journal SET
        trading_summary = ?, what_went_well = ?, mistakes_today = ?,
        lessons_learned = ?, plan_followed = ?, improvement_for_tomorrow = ?,
        general_notes = ?, updated_at = datetime('now')
      WHERE journal_date = ?
    `);

    const findJournalStmt = db.prepare('SELECT id FROM daily_journal WHERE journal_date = ?');

    for (const j of normalized.journal) {
      const exists = findJournalStmt.get(j.journal_date);
      if (exists) {
        if (mode === 'merge_overwrite') {
          updateJournalStmt.run(
            j.trading_summary, j.what_went_well, j.mistakes_today,
            j.lessons_learned, j.plan_followed, j.improvement_for_tomorrow,
            j.general_notes, j.journal_date,
          );
          journalUpdated++;
        } else {
          journalSkipped++;
        }
      } else {
        insertJournalStmt.run(
          j.id, j.journal_date, j.trading_summary, j.what_went_well, j.mistakes_today,
          j.lessons_learned, j.plan_followed, j.improvement_for_tomorrow, j.general_notes,
        );
        journalInserted++;
      }
    }

    // Hook for transaction rollback testing (never active in production payloads unless explicitly requested in test)
    if (_simulateFailure === true && process.env.NODE_ENV !== 'production') {
      throw new Error('Simulated restore failure for rollback verification');
    }

    if (normalized.settings) {
      const existingSettings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
      const existingSymbols = JSON.parse(existingSettings?.custom_symbols || '[]');
      const existingMistakes = JSON.parse(existingSettings?.custom_mistakes || '[]');

      const mergedSymbols = Array.from(new Set([...existingSymbols, ...normalized.settings.custom_symbols]));
      const mergedMistakes = Array.from(new Set([...existingMistakes, ...normalized.settings.custom_mistakes]));

      if (mode === 'merge_overwrite') {
        db.prepare(`
          UPDATE settings SET
            currency = ?,
            starting_balance = ?,
            theme = ?,
            custom_symbols = ?,
            custom_mistakes = ?,
            updated_at = datetime('now')
          WHERE id = 1
        `).run(
          normalized.settings.currency || existingSettings.currency,
          normalized.settings.has_starting_balance
            ? normalized.settings.starting_balance
            : existingSettings.starting_balance,
          normalized.settings.theme || existingSettings.theme,
          JSON.stringify(mergedSymbols),
          JSON.stringify(mergedMistakes),
        );
      } else {
        db.prepare(`
          UPDATE settings SET
            custom_symbols = ?,
            custom_mistakes = ?,
            updated_at = datetime('now')
          WHERE id = 1
        `).run(JSON.stringify(mergedSymbols), JSON.stringify(mergedMistakes));
      }
      settingsUpdated = true;
    }

    db.exec('COMMIT');

    res.json({
      success: true,
      mode,
      summary: {
        trades: { inserted: tradesInserted, updated: tradesUpdated, skipped: tradesSkipped },
        journal: { inserted: journalInserted, updated: journalUpdated, skipped: journalSkipped },
        settingsUpdated,
      },
    });
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore if already rolled back
    }
    res.status(500).json({ message: `Restore failed and was rolled back: ${err.message}` });
  }
});

module.exports = router;
