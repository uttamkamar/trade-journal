'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/database');

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PLAN_VALUES = new Set(['Yes', 'No', 'Partially']);

function isValidCalendarDate(dateStr) {
  if (!DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function cleanText(val) {
  if (typeof val !== 'string') return null;
  return val.trim().length > 0 ? val : null;
}

function validateJournalBody(body) {
  const plan = body.plan_followed || null;
  if (plan !== null && !PLAN_VALUES.has(plan)) {
    return { error: 'plan_followed must be Yes, No, Partially, or empty' };
  }
  return {
    error: null,
    cleaned: {
      trading_summary: cleanText(body.trading_summary),
      what_went_well: cleanText(body.what_went_well),
      mistakes_today: cleanText(body.mistakes_today),
      lessons_learned: cleanText(body.lessons_learned),
      plan_followed: plan,
      improvement_for_tomorrow: cleanText(body.improvement_for_tomorrow),
      general_notes: cleanText(body.general_notes),
    },
  };
}

// ── GET /api/journal ─────────────────────────────────────────────────────────
// Returns all journal entries ordered by date desc
router.get('/', (req, res) => {
  try {
    const entries = getDb().prepare(
      'SELECT * FROM daily_journal ORDER BY journal_date DESC'
    ).all();
    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/journal/:date ───────────────────────────────────────────────────
// date = YYYY-MM-DD
router.get('/:date', (req, res) => {
  try {
    if (!isValidCalendarDate(req.params.date)) {
      return res.status(400).json({ message: 'Invalid journal date (expected YYYY-MM-DD)' });
    }
    const entry = getDb().prepare(
      'SELECT * FROM daily_journal WHERE journal_date = ?'
    ).get(req.params.date);
    if (!entry) return res.status(404).json({ message: 'No journal entry for this date' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/journal ────────────────────────────────────────────────────────
// Creates a new journal entry; rejects duplicate journal_date with 409 Conflict.
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const date = req.body?.journal_date;
    if (!date || !isValidCalendarDate(date)) {
      return res.status(400).json({ message: 'Valid journal_date (YYYY-MM-DD) is required' });
    }

    const { error, cleaned } = validateJournalBody(req.body || {});
    if (error) return res.status(400).json({ message: error });

    const existing = db.prepare('SELECT id FROM daily_journal WHERE journal_date = ?').get(date);
    if (existing) {
      return res.status(409).json({ message: `A journal entry already exists for ${date}` });
    }

    db.prepare(`
      INSERT INTO daily_journal (
        id, journal_date, trading_summary, what_went_well, mistakes_today,
        lessons_learned, plan_followed, improvement_for_tomorrow, general_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), date,
      cleaned.trading_summary, cleaned.what_went_well, cleaned.mistakes_today,
      cleaned.lessons_learned, cleaned.plan_followed, cleaned.improvement_for_tomorrow,
      cleaned.general_notes,
    );

    const entry = db.prepare('SELECT * FROM daily_journal WHERE journal_date = ?').get(date);
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/journal/:date ───────────────────────────────────────────────────
// Atomic upsert: creates if missing, updates in-place if exists (one entry per date)
router.put('/:date', (req, res) => {
  try {
    const db = getDb();
    const date = req.params.date;
    if (!isValidCalendarDate(date)) {
      return res.status(400).json({ message: 'Invalid journal date (expected YYYY-MM-DD)' });
    }

    const { error, cleaned } = validateJournalBody(req.body || {});
    if (error) return res.status(400).json({ message: error });

    db.prepare(`
      INSERT INTO daily_journal (
        id, journal_date, trading_summary, what_went_well, mistakes_today,
        lessons_learned, plan_followed, improvement_for_tomorrow, general_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(journal_date) DO UPDATE SET
        trading_summary = excluded.trading_summary,
        what_went_well = excluded.what_went_well,
        mistakes_today = excluded.mistakes_today,
        lessons_learned = excluded.lessons_learned,
        plan_followed = excluded.plan_followed,
        improvement_for_tomorrow = excluded.improvement_for_tomorrow,
        general_notes = excluded.general_notes,
        updated_at = datetime('now')
    `).run(
      uuidv4(), date,
      cleaned.trading_summary, cleaned.what_went_well, cleaned.mistakes_today,
      cleaned.lessons_learned, cleaned.plan_followed, cleaned.improvement_for_tomorrow,
      cleaned.general_notes,
    );

    const entry = db.prepare('SELECT * FROM daily_journal WHERE journal_date = ?').get(date);
    res.json(entry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/journal/:date ────────────────────────────────────────────────
router.delete('/:date', (req, res) => {
  try {
    if (!isValidCalendarDate(req.params.date)) {
      return res.status(400).json({ message: 'Invalid journal date (expected YYYY-MM-DD)' });
    }
    const db = getDb();
    const entry = db.prepare('SELECT id FROM daily_journal WHERE journal_date = ?').get(req.params.date);
    if (!entry) return res.status(404).json({ message: 'No journal entry for this date' });
    db.prepare('DELETE FROM daily_journal WHERE journal_date = ?').run(req.params.date);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
