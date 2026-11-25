'use strict';

const express = require('express');
const { getDb } = require('../db/database');

const router = express.Router();

const CURRENCY_RE = /^[A-Z]{3}$/;
const VALID_THEMES = new Set(['light', 'dark']);

function parseSettings(s) {
  return {
    ...s,
    custom_symbols: JSON.parse(s.custom_symbols || '[]'),
    custom_mistakes: JSON.parse(s.custom_mistakes || '[]'),
  };
}

function cleanStringList(list, uppercase = false) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const trimmed = uppercase ? item.trim().toUpperCase() : item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

// ── GET /api/settings ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const s = getDb().prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(
      s
        ? parseSettings(s)
        : { id: 1, currency: 'USD', starting_balance: null, theme: 'light', custom_symbols: [], custom_mistakes: [] },
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/settings ──────────────────────────────────────────────────────
router.patch('/', (req, res) => {
  try {
    const db = getDb();
    const { currency, starting_balance, theme, custom_symbols, custom_mistakes } = req.body || {};

    const sets = [];
    const params = [];

    if (currency !== undefined) {
      const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
      if (!CURRENCY_RE.test(code)) {
        return res.status(400).json({ message: 'Preferred currency must be a 3-letter code (e.g. USD, EUR, INR)' });
      }
      sets.push('currency = ?');
      params.push(code);
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'starting_balance')) {
      if (starting_balance === '' || starting_balance === null || starting_balance === undefined) {
        sets.push('starting_balance = ?');
        params.push(null);
      } else {
        const num = Number(starting_balance);
        if (!Number.isFinite(num)) {
          return res.status(400).json({ message: 'Starting balance must be a valid number' });
        }
        sets.push('starting_balance = ?');
        params.push(num);
      }
    }

    if (theme !== undefined) {
      if (!VALID_THEMES.has(theme)) {
        return res.status(400).json({ message: 'Theme must be light or dark' });
      }
      sets.push('theme = ?');
      params.push(theme);
    }

    if (custom_symbols !== undefined) {
      const cleaned = cleanStringList(custom_symbols, true);
      if (!cleaned) {
        return res.status(400).json({ message: 'custom_symbols must be an array' });
      }
      sets.push('custom_symbols = ?');
      params.push(JSON.stringify(cleaned));
    }

    if (custom_mistakes !== undefined) {
      const cleaned = cleanStringList(custom_mistakes, false);
      if (!cleaned) {
        return res.status(400).json({ message: 'custom_mistakes must be an array' });
      }
      sets.push('custom_mistakes = ?');
      params.push(JSON.stringify(cleaned));
    }

    if (sets.length) {
      sets.push("updated_at = datetime('now')");
      db.prepare(`UPDATE settings SET ${sets.join(', ')} WHERE id = 1`).run(...params);
    }

    const s = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(parseSettings(s));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
