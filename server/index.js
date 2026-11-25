'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { migrate } = require('./db/migrate');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '../uploads');

// Ensure uploads directory exists
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Run DB migrations on startup (idempotent — safe to run every time)
migrate();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '10mb' }));

// Serve uploaded screenshots with safe headers
app.use('/uploads', express.static(UPLOADS_DIR, {
  dotfiles: 'deny',
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

// ── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/trades',   require('./routes/trades'));
app.use('/api/journal',  require('./routes/journal'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/export',   require('./routes/export'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Serve built frontend when dist/client exists (for `pnpm start` production server)
const CLIENT_DIST_DIR = path.join(__dirname, '../dist/client');
if (fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'))) {
  app.use(express.static(CLIENT_DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  });
}

// Clean JSON error handling (including Multer upload errors)
app.use((err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Screenshot exceeds the 10 MB per-file limit' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(err.status || 400).json({ message: err.message || 'Request failed' });
  }
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] TradeLog API running at http://localhost:${PORT}`);
  console.log(`[server] Uploads dir: ${UPLOADS_DIR}`);
});
