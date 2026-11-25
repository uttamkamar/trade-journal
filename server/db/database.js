'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, '../../journal.db');

/** @type {import('node:sqlite').DatabaseSync | null} */
let _db = null;

/**
 * Returns the singleton database connection using Node's built-in SQLite module.
 * Opens and configures WAL mode and foreign keys on first call.
 * @returns {import('node:sqlite').DatabaseSync}
 */
function getDb() {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
  }
  return _db;
}

module.exports = { getDb };
