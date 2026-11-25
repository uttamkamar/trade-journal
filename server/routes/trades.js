'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4, validate: isValidUuid } = require('uuid');
const { getDb } = require('../db/database');
const { upload, UPLOADS_DIR } = require('../middleware/upload');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PLAN_VALUES = new Set(['Yes', 'No', 'Partially']);

/** Deserialize JSON arrays stored in the DB */
function parseTrade(t) {
  return {
    ...t,
    mistakes: JSON.parse(t.mistakes || '[]'),
    screenshot_references: JSON.parse(t.screenshot_references || '[]'),
  };
}

/** Parse optional finite number; returns null for empty, NaN if invalid. */
function parseOptionalNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : NaN;
}

/** Validate trade payload for POST (full) or PATCH (partial merged with existing). */
function validateTradePayload(payload) {
  const errors = [];

  if (!payload.trade_date || !DATE_RE.test(payload.trade_date)) {
    errors.push('Trade date must be in YYYY-MM-DD format');
  }
  const symbol = typeof payload.symbol === 'string' ? payload.symbol.trim().toUpperCase() : '';
  if (!symbol) {
    errors.push('Instrument / symbol is required');
  }
  if (!['Buy', 'Sell'].includes(payload.direction)) {
    errors.push('Direction must be Buy or Sell');
  }
  if (!['Open', 'Closed'].includes(payload.status)) {
    errors.push('Status must be Open or Closed');
  }

  const entryPrice = parseOptionalNumber(payload.entry_price);
  if (entryPrice === null || Number.isNaN(entryPrice) || entryPrice <= 0) {
    errors.push('Entry price must be a positive number');
  }

  const exitPrice = parseOptionalNumber(payload.exit_price);
  if (Number.isNaN(exitPrice) || (exitPrice !== null && exitPrice <= 0)) {
    errors.push('Exit price must be a positive number');
  }
  if (payload.status === 'Closed' && exitPrice === null) {
    errors.push('Exit price is required for a closed trade');
  }

  const lotSize = parseOptionalNumber(payload.quantity_or_lot_size);
  if (Number.isNaN(lotSize) || (lotSize !== null && lotSize <= 0)) {
    errors.push('Lot size / quantity must be a positive number');
  }

  let realizedPnl = parseOptionalNumber(payload.realized_pnl);
  if (Number.isNaN(realizedPnl)) {
    errors.push('Profit or loss must be a valid number');
  }
  if (payload.status === 'Closed' && realizedPnl === null) {
    errors.push('Profit or loss is required for a closed trade (use 0 for breakeven)');
  }
  // Open trades must never contribute to realized P/L totals
  if (payload.status === 'Open') {
    realizedPnl = null;
  }

  if (payload.plan_followed !== null && payload.plan_followed !== undefined && payload.plan_followed !== '' && !PLAN_VALUES.has(payload.plan_followed)) {
    errors.push('Plan followed must be Yes, No, or Partially');
  }

  return {
    errors,
    cleaned: {
      trade_date: payload.trade_date,
      symbol,
      direction: payload.direction,
      status: payload.status,
      entry_price: entryPrice,
      exit_price: exitPrice,
      quantity_or_lot_size: lotSize,
      realized_pnl: realizedPnl,
      currency: (typeof payload.currency === 'string' && payload.currency.trim())
        ? payload.currency.trim().toUpperCase()
        : null,
      setup: typeof payload.setup === 'string' ? (payload.setup.trim() || null) : null,
      entry_reason: typeof payload.entry_reason === 'string' ? (payload.entry_reason.trim() || null) : null,
      exit_reason: typeof payload.exit_reason === 'string' ? (payload.exit_reason.trim() || null) : null,
      mistakes: Array.isArray(payload.mistakes)
        ? payload.mistakes.map(m => String(m).trim()).filter(Boolean)
        : [],
      custom_mistake: typeof payload.custom_mistake === 'string' ? (payload.custom_mistake.trim() || null) : null,
      emotion: typeof payload.emotion === 'string' ? (payload.emotion.trim() || null) : null,
      plan_followed: payload.plan_followed || null,
      lesson: typeof payload.lesson === 'string' ? (payload.lesson.trim() || null) : null,
      screenshot_references: Array.isArray(payload.screenshot_references)
        ? payload.screenshot_references.map(String)
        : [],
    },
  };
}

// ── GET /api/trades ─────────────────────────────────────────────────────────
// Query params: symbol, direction, status, pnl (profit|loss|breakeven),
//               mistake, date_from (YYYY-MM-DD), date_to (YYYY-MM-DD),
//               sort (newest|oldest|pnl_asc|pnl_desc), search (symbol/notes)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    let sql = 'SELECT * FROM trades WHERE 1=1';
    const params = [];

    const { symbol, direction, status, pnl, mistake, date_from, date_to, sort, search } = req.query;

    if (symbol) { sql += ' AND symbol = ?'; params.push(String(symbol).toUpperCase()); }
    if (direction) { sql += ' AND direction = ?'; params.push(direction); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (date_from) { sql += ' AND trade_date >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND trade_date <= ?'; params.push(date_to); }
    if (search) {
      sql += ' AND (symbol LIKE ? OR entry_reason LIKE ? OR exit_reason LIKE ? OR lesson LIKE ? OR setup LIKE ? OR custom_mistake LIKE ? OR mistakes LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like, like);
    }
    if (pnl === 'profit') { sql += " AND realized_pnl > 0 AND status = 'Closed'"; }
    else if (pnl === 'loss') { sql += " AND realized_pnl < 0 AND status = 'Closed'"; }
    else if (pnl === 'breakeven') { sql += " AND realized_pnl = 0 AND status = 'Closed'"; }

    const sortMap = {
      newest: 'trade_date DESC, created_at DESC',
      oldest: 'trade_date ASC, created_at ASC',
      pnl_asc: "CASE WHEN status = 'Closed' THEN 0 ELSE 1 END ASC, realized_pnl ASC, trade_date DESC",
      pnl_desc: "CASE WHEN status = 'Closed' THEN 0 ELSE 1 END ASC, realized_pnl DESC, trade_date DESC",
    };
    sql += ` ORDER BY ${sortMap[sort] || 'trade_date DESC, created_at DESC'}`;

    let trades = db.prepare(sql).all(...params);

    if (mistake) {
      trades = trades.filter(t => {
        const m = JSON.parse(t.mistakes || '[]');
        if (mistake === 'Other') {
          return m.includes('Other') || Boolean(t.custom_mistake);
        }
        return m.includes(mistake) || t.custom_mistake === mistake;
      });
    }

    res.json(trades.map(parseTrade));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/trades/:id ─────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const trade = getDb().prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });
    res.json(parseTrade(trade));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/trades ────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { errors, cleaned } = validateTradePayload(req.body || {});
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const settings = db.prepare('SELECT currency FROM settings WHERE id = 1').get();
    const currency = cleaned.currency || settings?.currency || 'USD';
    const id = uuidv4();

    db.prepare(`
      INSERT INTO trades (
        id, trade_date, symbol, direction, status,
        entry_price, exit_price, quantity_or_lot_size, realized_pnl, currency,
        setup, entry_reason, exit_reason, mistakes, custom_mistake,
        emotion, plan_followed, lesson, screenshot_references
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      id, cleaned.trade_date, cleaned.symbol, cleaned.direction, cleaned.status,
      cleaned.entry_price, cleaned.exit_price,
      cleaned.quantity_or_lot_size, cleaned.realized_pnl, currency,
      cleaned.setup, cleaned.entry_reason, cleaned.exit_reason,
      JSON.stringify(cleaned.mistakes), cleaned.custom_mistake,
      cleaned.emotion, cleaned.plan_followed, cleaned.lesson,
      JSON.stringify(cleaned.screenshot_references),
    );

    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(id);
    res.status(201).json(parseTrade(trade));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/trades/:id ───────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  try {
    const db = getDb();
    const existingRow = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
    if (!existingRow) return res.status(404).json({ message: 'Trade not found' });

    const existing = parseTrade(existingRow);
    const merged = { ...existing, ...req.body };
    const { errors, cleaned } = validateTradePayload(merged);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    db.prepare(`
      UPDATE trades SET
        trade_date = ?, symbol = ?, direction = ?, status = ?,
        entry_price = ?, exit_price = ?, quantity_or_lot_size = ?,
        realized_pnl = ?, currency = ?, setup = ?,
        entry_reason = ?, exit_reason = ?, mistakes = ?,
        custom_mistake = ?, emotion = ?, plan_followed = ?,
        lesson = ?, screenshot_references = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      cleaned.trade_date, cleaned.symbol, cleaned.direction, cleaned.status,
      cleaned.entry_price, cleaned.exit_price, cleaned.quantity_or_lot_size,
      cleaned.realized_pnl, cleaned.currency || existing.currency, cleaned.setup,
      cleaned.entry_reason, cleaned.exit_reason, JSON.stringify(cleaned.mistakes),
      cleaned.custom_mistake, cleaned.emotion, cleaned.plan_followed,
      cleaned.lesson, JSON.stringify(cleaned.screenshot_references), req.params.id,
    );

    const trade = db.prepare('SELECT * FROM trades WHERE id = ?').get(req.params.id);
    res.json(parseTrade(trade));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/trades/:tradeId/screenshots ───────────────────────────────────
router.post('/:tradeId/screenshots', (req, res, next) => {
  const { tradeId } = req.params;
  if (!isValidUuid(tradeId)) {
    return res.status(400).json({ message: 'Invalid trade ID' });
  }
  const existing = getDb().prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
  if (!existing) {
    return res.status(404).json({ message: 'Trade not found' });
  }

  upload.array('screenshots', 10)(req, res, (err) => {
    if (err) return next(err);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No image files uploaded' });
    }

    const currentRefs = JSON.parse(existing.screenshot_references || '[]');
    const newRefs = req.files.map(f => `/uploads/${tradeId}/${f.filename}`);
    const updatedRefs = [...currentRefs, ...newRefs];

    getDb().prepare(
      "UPDATE trades SET screenshot_references = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(updatedRefs), tradeId);

    const updated = getDb().prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
    res.status(201).json(parseTrade(updated));
  });
});

// ── DELETE /api/trades/:tradeId/screenshots ─────────────────────────────────
router.delete('/:tradeId/screenshots', (req, res) => {
  try {
    const { tradeId } = req.params;
    const { path: refPath } = req.body || {};
    if (!isValidUuid(tradeId)) {
      return res.status(400).json({ message: 'Invalid trade ID' });
    }
    if (!refPath || typeof refPath !== 'string') {
      return res.status(400).json({ message: 'Screenshot path is required' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
    if (!existing) return res.status(404).json({ message: 'Trade not found' });

    const currentRefs = JSON.parse(existing.screenshot_references || '[]');
    const updatedRefs = currentRefs.filter(r => r !== refPath);

    // Delete file only if it resolves safely inside uploads/<tradeId>/
    const expectedPrefix = `/uploads/${tradeId}/`;
    if (refPath.startsWith(expectedPrefix)) {
      const filename = path.basename(refPath);
      const tradeDir = path.resolve(UPLOADS_DIR, tradeId);
      const filePath = path.resolve(tradeDir, filename);
      if (filePath.startsWith(tradeDir + path.sep) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.prepare(
      "UPDATE trades SET screenshot_references = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(updatedRefs), tradeId);

    const updated = db.prepare('SELECT * FROM trades WHERE id = ?').get(tradeId);
    res.json(parseTrade(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/trades/:id ──────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const trade = db.prepare('SELECT id FROM trades WHERE id = ?').get(req.params.id);
    if (!trade) return res.status(404).json({ message: 'Trade not found' });

    db.prepare('DELETE FROM trades WHERE id = ?').run(req.params.id);

    if (isValidUuid(req.params.id)) {
      const tradeDir = path.resolve(UPLOADS_DIR, req.params.id);
      const uploadsRoot = path.resolve(UPLOADS_DIR);
      if (tradeDir.startsWith(uploadsRoot + path.sep) && fs.existsSync(tradeDir)) {
        fs.rmSync(tradeDir, { recursive: true, force: true });
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
