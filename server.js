// ═══════════════════════════════════════════
//  AshaJolies UGC HQ — Sync API Server
//  Run: node server.js
//  Deploy to Railway / Render / Fly.io for free
// ═══════════════════════════════════════════

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'store.json');
const PASSCODE = process.env.PASSCODE || 'ashajolies2024'; // Change this!

// ── MIDDLEWARE ──
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// ── ENSURE DATA DIR ──
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// ── HELPER: read/write store ──
function readStore() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Read error:', e);
  }
  return { data: null, updatedAt: null, version: 0 };
}

function writeStore(payload) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2));
}

// ── AUTH MIDDLEWARE ──
function auth(req, res, next) {
  const token = req.headers['x-passcode'] || req.query.passcode;
  if (token !== PASSCODE) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── ROUTES ──

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// GET — pull latest data
app.get('/api/sync', auth, (req, res) => {
  const store = readStore();
  res.json({
    ok: true,
    data: store.data,
    updatedAt: store.updatedAt,
    version: store.version || 0,
  });
});

// POST — push new data
app.post('/api/sync', auth, (req, res) => {
  const { data, clientVersion } = req.body;
  if (!data) return res.status(400).json({ error: 'No data provided' });

  const store = readStore();

  // Conflict: client version older than server — return server data instead
  if (clientVersion !== undefined && store.version > clientVersion) {
    return res.status(409).json({
      conflict: true,
      serverData: store.data,
      serverVersion: store.version,
      updatedAt: store.updatedAt,
    });
  }

  const newStore = {
    data,
    updatedAt: new Date().toISOString(),
    version: (store.version || 0) + 1,
  };

  writeStore(newStore);
  res.json({ ok: true, version: newStore.version, updatedAt: newStore.updatedAt });
});

// Force-push (overwrite server, use when resolving conflicts on client)
app.post('/api/sync/force', auth, (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'No data provided' });

  const store = readStore();
  const newStore = {
    data,
    updatedAt: new Date().toISOString(),
    version: (store.version || 0) + 1,
  };

  writeStore(newStore);
  res.json({ ok: true, version: newStore.version });
});

// Backup endpoint — download full JSON
app.get('/api/backup', auth, (req, res) => {
  const store = readStore();
  res.setHeader('Content-Disposition', `attachment; filename="ajhq-backup-${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(store.data, null, 2));
});

// ── START ──
app.listen(PORT, () => {
  console.log(`\n✨ AshaJolies HQ Sync Server running on port ${PORT}`);
  console.log(`   Passcode: ${PASSCODE}`);
  console.log(`   Health:   http://localhost:${PORT}/api/health\n`);
});
