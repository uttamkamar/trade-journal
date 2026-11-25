'use strict';

const fs = require('fs');
const path = require('path');
const { getDb } = require('./database');

function migrate() {
  const db = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  console.log('[db] Migration complete');
}

module.exports = { migrate };
