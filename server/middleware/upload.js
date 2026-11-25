'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4, validate: isValidUuid } = require('uuid');

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '../../uploads');

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const tradeId = req.params.tradeId;
    if (!tradeId || !isValidUuid(tradeId)) {
      return cb(new Error('Invalid trade ID for upload'));
    }
    const tradeDir = path.join(UPLOADS_DIR, tradeId);
    fs.mkdirSync(tradeDir, { recursive: true });
    cb(null, tradeDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTS.has(ext) && ALLOWED_MIMES.has(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error('Only image files are allowed (jpg, jpeg, png, gif, webp)');
    err.status = 400;
    cb(err);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

module.exports = { upload, UPLOADS_DIR };
