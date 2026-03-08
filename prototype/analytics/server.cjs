const crypto = require('crypto');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const pino = require('pino');
const geoip = require('geoip-lite');

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino/file', options: { destination: 1 } },
    formatters: { level: (label) => ({ level: label }) },
  }),
});
const {
  Client,
  TopicMessageSubmitTransaction,
  PrivateKey,
  AccountId,
} = require('@hashgraph/sdk');

const app = express();
const PORT = process.env.PORT || 5001;

// ── Tuning constants (all overridable via env) ────────────────────────
const DEDUP_WINDOW_MS    = parseInt(process.env.DEDUP_WINDOW_MS, 10)    || 10 * 60 * 1000; // 10 min
const TIMESTAMP_DRIFT_MS = parseInt(process.env.TIMESTAMP_DRIFT_MS, 10) || 5 * 60 * 1000;  // 5 min
const HCS_TIMEOUT_MS     = parseInt(process.env.HCS_TIMEOUT_MS, 10)     || 10_000;          // 10 s
const MAX_MAP_ENTRIES    = parseInt(process.env.MAX_MAP_ENTRIES, 10)     || 100_000;         // 100 k
const BODY_SIZE_LIMIT    = process.env.BODY_SIZE_LIMIT                   || '10kb';

// ── SQLite setup ─────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'analytics.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    shortId   TEXT    NOT NULL,
    timestamp INTEGER NOT NULL,
    referrer  TEXT    NOT NULL DEFAULT '',
    userAgent TEXT    NOT NULL DEFAULT '',
    ip        TEXT    NOT NULL DEFAULT ''
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_visits_shortId ON visits (shortId)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits (timestamp)`);

db.exec(`
  CREATE TABLE IF NOT EXISTS url_destinations (
    shortId        TEXT PRIMARY KEY,
    destinationUrl TEXT NOT NULL,
    fetchedAt      INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS url_metadata (
    url         TEXT PRIMARY KEY,
    title       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    image       TEXT NOT NULL DEFAULT '',
    favicon     TEXT NOT NULL DEFAULT '',
    siteName    TEXT NOT NULL DEFAULT '',
    fetchedAt   INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS feedback (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    rating    INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment   TEXT    NOT NULL DEFAULT '',
    context   TEXT    NOT NULL DEFAULT '',
    timestamp INTEGER NOT NULL,
    ip        TEXT    NOT NULL DEFAULT '',
    wallet    TEXT    NOT NULL DEFAULT '',
    survey    TEXT    NOT NULL DEFAULT ''
  )
`);

// Migrations: add columns to existing databases
try { db.exec(`ALTER TABLE visits ADD COLUMN country TEXT NOT NULL DEFAULT ''`); } catch { /* already exists */ }
try { db.exec(`ALTER TABLE feedback ADD COLUMN wallet TEXT NOT NULL DEFAULT ''`); } catch { /* already exists */ }
try { db.exec(`ALTER TABLE feedback ADD COLUMN survey TEXT NOT NULL DEFAULT ''`); } catch { /* already exists */ }
db.exec(`CREATE INDEX IF NOT EXISTS idx_visits_shortId_timestamp ON visits (shortId, timestamp)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON feedback (timestamp)`);

const insertVisit = db.prepare(
  'INSERT INTO visits (shortId, timestamp, referrer, userAgent, ip, country) VALUES (?, ?, ?, ?, ?, ?)'
);
const countByShortId = db.prepare(
  'SELECT shortId, COUNT(*) AS count FROM visits GROUP BY shortId'
);

const insertFeedback = db.prepare(
  'INSERT INTO feedback (rating, comment, context, timestamp, ip, wallet, survey) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const countFeedbackByWalletToday = db.prepare(
  'SELECT COUNT(*) AS count FROM feedback WHERE wallet = ? AND timestamp > ?'
);
const countFeedbackByIpToday = db.prepare(
  'SELECT COUNT(*) AS count FROM feedback WHERE ip = ? AND wallet = \'\' AND timestamp > ?'
);
const feedbackAggregateStats = db.prepare(`
  SELECT
    COUNT(*)       AS total,
    AVG(rating)    AS avg,
    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS r1,
    SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS r2,
    SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS r3,
    SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS r4,
    SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS r5
  FROM feedback
`);
const feedbackByContext = db.prepare(`
  SELECT context, COUNT(*) AS total, AVG(rating) AS avg
  FROM feedback GROUP BY context
`);

// ── Social preview: prepared statements ──────────────────────────────
const getDestination = db.prepare('SELECT destinationUrl, fetchedAt FROM url_destinations WHERE shortId = ?');
const upsertDestination = db.prepare(
  'INSERT OR REPLACE INTO url_destinations (shortId, destinationUrl, fetchedAt) VALUES (?, ?, ?)'
);
const getMetadata = db.prepare('SELECT * FROM url_metadata WHERE url = ?');
const upsertMetadata = db.prepare(
  `INSERT OR REPLACE INTO url_metadata (url, title, description, image, favicon, siteName, fetchedAt)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const DEST_TTL_MS = 24 * 60 * 60 * 1000;  // 24h — destinations are immutable on-chain
const META_TTL_MS = 60 * 60 * 1000;        // 1h — sites may update OG tags

// Contract config for server-side resolution
const CONTRACT_ADDR = process.env.CONTRACT_ADDRESS || process.env.REACT_APP_CONTRACT_ADDRESS || '';
const RPC_URL = process.env.HEDERA_RPC_URL || process.env.REACT_APP_HEDERA_RPC_URL || '';
const FRONTEND_URL = process.env.REACT_APP_PROJECT_URL || 'http://localhost:5000';

/**
 * ABI-encode a call to getOriginalUrl(string).
 * Selector: keccak256("getOriginalUrl(string)") first 4 bytes.
 * We pre-compute the selector to avoid pulling in a crypto lib.
 */
const GET_ORIGINAL_URL_SELECTOR = '0xb58753fd'; // keccak256("getOriginalUrl(string)")[0:4]

function abiEncodeString(str) {
  // ABI encoding: offset (32 bytes) + length (32 bytes) + data (padded to 32 bytes)
  const hex = Buffer.from(str, 'utf8').toString('hex');
  const dataLen = Math.ceil(hex.length / 64) * 64 || 64;
  const offset = '0000000000000000000000000000000000000000000000000000000000000020'; // 32
  const length = str.length.toString(16).padStart(64, '0');
  const data = hex.padEnd(dataLen, '0');
  return offset + length + data;
}

function abiDecodeString(hexData) {
  // Strip 0x prefix
  const raw = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
  if (raw.length < 128) return '';
  // First 32 bytes = offset, next 32 bytes = length
  const strLen = parseInt(raw.slice(64, 128), 16);
  if (strLen === 0 || strLen > 10000) return '';
  const strHex = raw.slice(128, 128 + strLen * 2);
  return Buffer.from(strHex, 'hex').toString('utf8');
}

async function resolveDestination(shortId) {
  // Check cache first
  const cached = getDestination.get(shortId);
  if (cached && (Date.now() - cached.fetchedAt) < DEST_TTL_MS) {
    return cached.destinationUrl;
  }

  if (!CONTRACT_ADDR || !RPC_URL) {
    log.warn('CONTRACT_ADDRESS or HEDERA_RPC_URL not set — cannot resolve destination');
    return null;
  }

  try {
    const callData = GET_ORIGINAL_URL_SELECTOR + abiEncodeString(shortId);
    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: CONTRACT_ADDR, data: callData }, 'latest'],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const json = await resp.json();
    if (json.error || !json.result || json.result === '0x') return null;

    const url = abiDecodeString(json.result);
    if (!url) return null;

    upsertDestination.run(shortId, url, Date.now());
    return url;
  } catch (err) {
    log.error({ err, shortId }, 'Failed to resolve destination from contract');
    // Return stale cache if available
    return cached ? cached.destinationUrl : null;
  }
}

function extractMeta(html, property) {
  // Match both <meta property="og:..." content="..."> and <meta content="..." property="og:...">
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']{0,2048})["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']{0,2048})["'][^>]+(?:property|name)=["']${property}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? m[1] : '';
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]{0,500})<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractFavicon(html, baseUrl) {
  const m = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']{0,500})["']/i)
           || html.match(/<link[^>]+href=["']([^"']{0,500})["'][^>]+rel=["'](?:icon|shortcut icon)["']/i);
  if (!m) return '';
  const href = m[1];
  if (href.startsWith('http')) return href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return '';
  }
}

async function fetchMetadata(url) {
  // Check cache first
  const cached = getMetadata.get(url);
  if (cached && (Date.now() - cached.fetchedAt) < META_TTL_MS) {
    return cached;
  }

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'dURL-Preview/1.0 (+https://durl.dev)',
        'Accept': 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    // Read up to 512KB
    const reader = resp.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    const MAX_BYTES = 512 * 1024;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.length;
      if (totalBytes >= MAX_BYTES) break;
    }
    reader.cancel().catch(() => {});

    const html = Buffer.concat(chunks).toString('utf8');
    const title = extractMeta(html, 'og:title') || extractTitle(html);
    const description = extractMeta(html, 'og:description') || extractMeta(html, 'description');
    const image = extractMeta(html, 'og:image');
    const siteName = extractMeta(html, 'og:site_name');
    const favicon = extractFavicon(html, url);

    const meta = { url, title, description, image, favicon, siteName, fetchedAt: Date.now() };
    upsertMetadata.run(url, title, description, image, favicon, siteName, meta.fetchedAt);
    return meta;
  } catch (err) {
    log.error({ err, url }, 'Failed to fetch metadata');
    // Return stale cache or defaults
    if (cached) return cached;
    return { url, title: '', description: '', image: '', favicon: '', siteName: '', fetchedAt: 0 };
  }
}

// ── Data retention / cleanup ──────────────────────────────────────────
const RETENTION_DAYS = Math.max(1, parseInt(process.env.RETENTION_DAYS, 10) || 90);
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = 60 * 60 * 1000; // run every hour
const PURGE_BATCH_SIZE = 5000; // delete in batches to avoid long locks

const purgeOldVisits = db.prepare(
  'DELETE FROM visits WHERE id IN (SELECT id FROM visits WHERE timestamp < ? LIMIT ?)'
);

let lastPurgeInfo = { at: null, deleted: 0 };

function runRetentionPurge() {
  const cutoff = Date.now() - RETENTION_MS;
  let totalDeleted = 0;
  try {
    // Delete in batches to keep WAL churn and lock time small
    let deleted;
    do {
      deleted = purgeOldVisits.run(cutoff, PURGE_BATCH_SIZE).changes;
      totalDeleted += deleted;
    } while (deleted === PURGE_BATCH_SIZE);

    lastPurgeInfo = { at: new Date().toISOString(), deleted: totalDeleted };
    if (totalDeleted > 0) {
      log.info({ deleted: totalDeleted, retentionDays: RETENTION_DAYS }, 'Retention purge completed');
    }
  } catch (err) {
    log.error({ err }, 'Retention purge failed');
  }
}

// Run once at startup (deferred so server starts quickly), then hourly
setTimeout(runRetentionPurge, 30_000);
const purgeTimer = setInterval(runRetentionPurge, PURGE_INTERVAL_MS);
purgeTimer.unref(); // don't prevent graceful shutdown

log.info({ retentionDays: RETENTION_DAYS }, 'Data retention policy active');

// ── Rate-limiting helpers ──────────────────────────────────────────────
const rateBuckets = new Map();   // key → { count, resetAt }
const CLEANUP_INTERVAL = 60000;  // purge stale entries every 60 s

/** Evict oldest entries when a Map exceeds MAX_MAP_ENTRIES. */
function enforceCap(map) {
  if (map.size <= MAX_MAP_ENTRIES) return;
  const excess = map.size - MAX_MAP_ENTRIES;
  const iter = map.keys();
  for (let i = 0; i < excess; i++) {
    map.delete(iter.next().value);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}, CLEANUP_INTERVAL);

/**
 * Returns true if the request should be blocked.
 * @param {string} key   – unique bucket identifier (e.g. "track:<ip>:<shortId>" or "stats:<ip>")
 * @param {number} max   – max requests allowed in the window
 * @param {number} windowMs – window length in milliseconds
 */
function isRateLimited(key, max, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    enforceCap(rateBuckets);
    return false;
  }
  bucket.count++;
  return bucket.count > max;
}

// HCS configuration — server-side only, no REACT_APP_ prefix for secrets
const OPERATOR_ID = process.env.OPERATOR_ID;
const OPERATOR_KEY = process.env.OPERATOR_KEY;
const HCS_TOPIC_ID = process.env.HCS_TOPIC_ID;

let hederaClient = null;
if (OPERATOR_ID && OPERATOR_KEY) {
  hederaClient = Client.forTestnet().setOperator(
    AccountId.fromString(OPERATOR_ID),
    PrivateKey.fromString(OPERATOR_KEY)
  );
  log.info('Hedera client initialized for HCS');
} else {
  log.warn('OPERATOR_ID/OPERATOR_KEY not set — /hcs/submit will be disabled');
}

// ── Request ID ───────────────────────────────────────────────────────
app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
});

app.use(bodyParser.json({ limit: BODY_SIZE_LIMIT }));

// ── Security headers ────────────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
});

// ── Trusted-proxy IP resolution ─────────────────────────────────────
// Only trust X-Forwarded-For when the direct connection is from a known
// reverse proxy.  Set TRUSTED_PROXIES env var to a comma-separated list
// of proxy IPs (e.g. "127.0.0.1,::1,10.0.0.1").
const TRUSTED_PROXIES = new Set(
    (process.env.TRUSTED_PROXIES || '127.0.0.1,::1,::ffff:127.0.0.1')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
);

function getClientIp(req) {
    const directIp = req.socket.remoteAddress || '';
    if (TRUSTED_PROXIES.has(directIp)) {
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            // Take the left-most IP — that's the original client
            return forwarded.split(',')[0].trim();
        }
    }
    return directIp;
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5000,http://localhost:3000')
    .split(',')
    .map(o => o.trim());

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
    next();
});

// ── Health check ───────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    let dbStatus = 'ok';
    let healthy = true;

    try {
        db.prepare('SELECT 1').get();
    } catch {
        dbStatus = 'inaccessible';
        healthy = false;
    }

    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        uptime: Math.floor(process.uptime()),
        db: dbStatus,
        hcs: hederaClient ? 'configured' : 'disabled',
        retention: {
            days: RETENTION_DAYS,
            lastPurge: lastPurgeInfo,
        },
    });
});

// ── Input validation & bot detection (hoisted for /s/ route) ─────────
const VALID_SHORT_ID = /^[a-zA-Z0-9_-]{1,32}$/;
const MAX_REFERRER_LEN = 2048;
const MAX_UA_LEN = 512;

function sanitizeString(val, maxLen) {
    if (typeof val !== 'string') return '';
    return val
        .replace(/[\x00-\x1F\x7F]/g, '')  // strip control characters
        .replace(/[<>"'&]/g, '')            // strip HTML-sensitive characters
        .slice(0, maxLen);
}

const BOT_UA_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|Twitterbot|Slackbot|Discordbot|bingpreview|linkedinbot|embedly|quora link|showyoubot|outbrain|pinterest|applebot|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|sogou|exabot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|chatgpt|claudebot/i;

function isBot(ua) {
    return BOT_UA_PATTERN.test(ua);
}

// ── Social preview route ──────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

app.get('/s/:shortId', async (req, res) => {
  const { shortId } = req.params;

  if (!VALID_SHORT_ID.test(shortId)) {
    return res.status(400).send('Invalid short ID');
  }

  const ip = getClientIp(req);
  if (isRateLimited(`preview:${ip}`, 30, 60000)) {
    return res.status(429).send('Too many requests');
  }

  // Regular users: redirect to frontend for countdown/analytics UX
  const ua = req.headers['user-agent'] || '';
  if (!isBot(ua)) {
    return res.redirect(302, `${FRONTEND_URL}/#/${shortId}`);
  }

  // Bot path: serve dynamic OG meta tags
  try {
    const destinationUrl = await resolveDestination(shortId);
    if (!destinationUrl) {
      return res.redirect(302, `${FRONTEND_URL}/#/${shortId}`);
    }

    const meta = await fetchMetadata(destinationUrl);
    const title = escapeHtml(meta.title || destinationUrl);
    const desc = escapeHtml(
      (meta.description ? meta.description + ' · ' : '') + 'Verified on Hedera · dURL'
    );
    const image = meta.image || '';
    const favicon = meta.favicon || '';
    const siteName = 'dURL — Decentralized URL Shortener';
    const previewUrl = `${req.protocol}://${req.get('host')}/s/${shortId}`;

    // Relax CSP for this route to allow meta refresh redirect
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src *; style-src 'unsafe-inline'");
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ''}
  <meta property="og:url" content="${escapeHtml(previewUrl)}">
  <meta property="og:site_name" content="${escapeHtml(siteName)}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ''}
  ${favicon ? `<link rel="icon" href="${escapeHtml(favicon)}">` : ''}
  <meta http-equiv="refresh" content="0;url=${escapeHtml(destinationUrl)}">
  <title>${title}</title>
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(destinationUrl)}">${escapeHtml(destinationUrl)}</a></p>
</body>
</html>`);
  } catch (err) {
    log.error({ err, shortId, reqId: req.id }, 'Social preview failed');
    res.redirect(302, `${FRONTEND_URL}/#/${shortId}`);
  }
});

// ── Visit deduplication (IP + shortId) ──────────────────────────────────
const recentVisits = new Map();   // key → expireAt

// Piggy-back on the existing cleanup interval for stale dedup entries
setInterval(() => {
    const now = Date.now();
    for (const [key, expireAt] of recentVisits) {
        if (expireAt <= now) recentVisits.delete(key);
    }
}, CLEANUP_INTERVAL);

/**
 * Returns true if this IP+shortId combo was already seen within the window.
 * Marks it as seen if not.
 */
function isDuplicateVisit(ip, shortId) {
    const key = `dedup:${ip}:${shortId}`;
    const now = Date.now();
    const expireAt = recentVisits.get(key);
    if (expireAt && expireAt > now) return true;
    recentVisits.set(key, now + DEDUP_WINDOW_MS);
    enforceCap(recentVisits);
    return false;
}

app.post('/track', (req, res) => {
    const { shortId, timestamp, referrer, userAgent } = req.body;

    // ── Validate shortId (required, must match slug format) ──
    if (!shortId || typeof shortId !== 'string' || !VALID_SHORT_ID.test(shortId)) {
        return res.status(400).json({ error: 'Invalid or missing shortId.' });
    }

    // ── Validate & clamp timestamp ──
    const now = Date.now();
    let ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(ts - now) > TIMESTAMP_DRIFT_MS) {
        ts = now; // Replace out-of-range or garbage values with server time
    }

    // ── Sanitize optional strings ──
    const cleanReferrer = sanitizeString(referrer, MAX_REFERRER_LEN);
    const cleanUA = sanitizeString(userAgent, MAX_UA_LEN);

    // ── Filter bots (silent 200 — don't break redirects, just skip logging) ──
    if (isBot(cleanUA)) {
        return res.status(200).json({ ok: true });
    }

    const ip = getClientIp(req);

    // ── Deduplicate (same IP + shortId within 10 min → skip logging) ──
    if (isDuplicateVisit(ip, shortId)) {
        return res.status(200).json({ ok: true });
    }

    // 1 track per shortId per IP per minute
    if (isRateLimited(`track:${ip}:${shortId}`, 1, 60000)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
    }

    try {
        const geo = geoip.lookup(ip);
        const country = (geo && geo.country) || '';
        insertVisit.run(shortId, ts, cleanReferrer, cleanUA, ip, country);
        res.status(200).json({ ok: true });
    } catch (err) {
        log.error({ err, shortId, reqId: req.id }, 'Failed to insert visit');
        res.status(500).json({ error: 'Failed to record visit' });
    }
});

const MAX_STATS_SLUGS = 100;

app.get('/stats', (req, res) => {
    const ip = getClientIp(req);

    // 30 stats requests per IP per minute
    if (isRateLimited(`stats:${ip}`, 30, 60000)) {
        return res.status(429).json({ error: 'Too many requests. Please wait before refreshing stats.' });
    }

    // Require a "slugs" query param to scope results — prevents full enumeration
    const slugsParam = req.query.slugs;
    if (!slugsParam || typeof slugsParam !== 'string') {
        return res.status(400).json({ error: 'Missing required "slugs" query parameter.' });
    }

    const requested = slugsParam.split(',')
        .map(s => s.trim())
        .filter(s => VALID_SHORT_ID.test(s))
        .slice(0, MAX_STATS_SLUGS);

    if (requested.length === 0) {
        return res.json({});
    }

    try {
        const placeholders = requested.map(() => '?').join(',');
        const stmt = db.prepare(
            `SELECT shortId, COUNT(*) AS count FROM visits WHERE shortId IN (${placeholders}) GROUP BY shortId`
        );
        const rows = stmt.all(...requested);
        const counts = {};
        for (const row of rows) {
            counts[row.shortId] = row.count;
        }
        res.json(counts);
    } catch (err) {
        log.error({ err, reqId: req.id }, 'Failed to query stats');
        res.status(500).json({ error: 'Failed to read stats' });
    }
});

app.post('/hcs/submit', async (req, res) => {
  if (!hederaClient || !HCS_TOPIC_ID) {
    return res.status(503).json({ error: 'HCS not configured' });
  }

  const ip = getClientIp(req);

  // 5 HCS submissions per IP per minute
  if (isRateLimited(`hcs:${ip}`, 5, 60000)) {
    return res.status(429).json({ error: 'Too many HCS submissions. Please wait before trying again.' });
  }

  const { slug, urlHash, sender } = req.body;

  if (!slug || !urlHash || !sender) {
    return res.status(400).json({ error: 'Missing required fields: slug, urlHash, sender' });
  }

  if (typeof slug !== 'string' || !VALID_SHORT_ID.test(slug)) {
    return res.status(400).json({ error: 'Invalid slug format. Must be 1-32 alphanumeric, hyphen, or underscore characters.' });
  }
  if (typeof urlHash !== 'string' || !/^[a-fA-F0-9]{64}$/.test(urlHash)) {
    return res.status(400).json({ error: 'Invalid urlHash. Must be a 64-character hex string.' });
  }
  if (typeof sender !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(sender)) {
    return res.status(400).json({ error: 'Invalid sender. Must be a valid Ethereum address.' });
  }

  // 10 HCS submissions per sender address per hour
  if (isRateLimited(`hcs:${sender.toLowerCase()}`, 10, 3600000)) {
    return res.status(429).json({ error: 'Too many HCS submissions from this wallet. Please wait before trying again.' });
  }

  const payload = JSON.stringify({
    slug,
    urlHash,
    sender,
    ts: Math.floor(Date.now() / 1000),
  });

  // Guard: 1024-byte HCS message limit
  if (Buffer.byteLength(payload, 'utf8') > 1024) {
    return res.status(400).json({ error: 'Payload exceeds 1024-byte HCS limit' });
  }

  try {
    const submitTx = await Promise.race([
      new TopicMessageSubmitTransaction()
        .setTopicId(HCS_TOPIC_ID)
        .setMessage(payload)
        .execute(hederaClient),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('HCS_TIMEOUT')), HCS_TIMEOUT_MS)
      ),
    ]);

    const receipt = await Promise.race([
      submitTx.getReceipt(hederaClient),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('HCS_TIMEOUT')), HCS_TIMEOUT_MS)
      ),
    ]);

    const sequenceNumber = receipt.topicSequenceNumber.toString();

    log.info({ sequenceNumber, slug, reqId: req.id }, 'HCS message submitted');

    return res.json({ sequenceNumber, topicId: HCS_TOPIC_ID });
  } catch (err) {
    log.error({ err, reqId: req.id }, 'HCS submit failed');
    if (err.message === 'HCS_TIMEOUT') {
      return res.status(504).json({ error: 'HCS submission timed out' });
    }
    return res.status(500).json({ error: 'HCS submission failed' });
  }
});

// ── Feedback endpoints ────────────────────────────────────────────────
const VALID_FEEDBACK_CONTEXTS = new Set(['creation', 'redirect', 'footer']);
const MAX_COMMENT_LEN = 500;

const VALID_WALLET = /^0x[a-fA-F0-9]{40}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const MAX_SURVEY_KEYS = 10;
const MAX_SURVEY_VALUE_LEN = 100;

function sanitizeSurvey(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
  const clean = {};
  let count = 0;
  for (const [key, val] of Object.entries(raw)) {
    if (count >= MAX_SURVEY_KEYS) break;
    if (typeof key !== 'string' || typeof val !== 'string') continue;
    const k = sanitizeString(key, MAX_SURVEY_VALUE_LEN);
    const v = sanitizeString(val, MAX_SURVEY_VALUE_LEN);
    if (k && v) { clean[k] = v; count++; }
  }
  return count > 0 ? JSON.stringify(clean) : '';
}

app.post('/feedback', (req, res) => {
  const ip = getClientIp(req);
  const { rating, comment, context, wallet, survey } = req.body;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }
  if (!context || !VALID_FEEDBACK_CONTEXTS.has(context)) {
    return res.status(400).json({ error: 'Context must be one of: creation, redirect, footer.' });
  }

  const cleanWallet = (typeof wallet === 'string' && VALID_WALLET.test(wallet))
    ? wallet.toLowerCase()
    : '';

  const dayAgo = Date.now() - DAY_MS;

  if (cleanWallet) {
    // Wallet users: 1 feedback per wallet per day
    const { count } = countFeedbackByWalletToday.get(cleanWallet, dayAgo);
    if (count >= 1) {
      return res.status(429).json({ error: 'You have already submitted feedback today. Please try again tomorrow.' });
    }
  } else {
    // Non-wallet users: 3 feedback per IP per day
    const { count } = countFeedbackByIpToday.get(ip, dayAgo);
    if (count >= 3) {
      return res.status(429).json({ error: 'Feedback limit reached for today. Please try again tomorrow.' });
    }
  }

  const cleanComment = sanitizeString(comment || '', MAX_COMMENT_LEN);
  const cleanSurvey = sanitizeSurvey(survey);

  try {
    insertFeedback.run(rating, cleanComment, context, Date.now(), ip, cleanWallet, cleanSurvey);
    res.status(200).json({ ok: true });
  } catch (err) {
    log.error({ err, reqId: req.id }, 'Failed to insert feedback');
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

const feedbackSurveyRows = db.prepare(
  `SELECT survey FROM feedback WHERE survey != ''`
);

app.get('/feedback/stats', (req, res) => {
  const ip = getClientIp(req);

  // 30 requests per IP per minute (same as /stats)
  if (isRateLimited(`fbstats:${ip}`, 30, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait before refreshing.' });
  }

  try {
    const agg = feedbackAggregateStats.get();
    const byCtx = feedbackByContext.all();

    const total = agg.total || 0;
    const averageRating = total > 0 ? Math.round(agg.avg * 100) / 100 : 0;
    const distribution = {
      1: agg.r1 || 0,
      2: agg.r2 || 0,
      3: agg.r3 || 0,
      4: agg.r4 || 0,
      5: agg.r5 || 0,
    };

    const byContext = {};
    for (const row of byCtx) {
      byContext[row.context] = { total: row.total, averageRating: Math.round(row.avg * 100) / 100 };
    }

    // Survey breakdown: count per answer per question key
    const surveyBreakdown = {};
    const surveyRows = feedbackSurveyRows.all();
    for (const row of surveyRows) {
      try {
        const parsed = JSON.parse(row.survey);
        for (const [question, answer] of Object.entries(parsed)) {
          if (!surveyBreakdown[question]) surveyBreakdown[question] = {};
          surveyBreakdown[question][answer] = (surveyBreakdown[question][answer] || 0) + 1;
        }
      } catch { /* skip malformed JSON */ }
    }

    res.json({ total, averageRating, distribution, byContext, surveyBreakdown });
  } catch (err) {
    log.error({ err, reqId: req.id }, 'Failed to query feedback stats');
    res.status(500).json({ error: 'Failed to read feedback stats' });
  }
});

// ── Analytics endpoints ────────────────────────────────────────────────
const VALID_RANGES = new Set(['7d', '30d', '90d']);
const VALID_GRANULARITIES = new Set(['hour', 'day']);
const RANGE_MS = { '7d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000 };

function parseAnalyticsParams(query) {
  const { shortId, range, granularity } = query;
  if (!shortId || typeof shortId !== 'string' || !VALID_SHORT_ID.test(shortId)) {
    return { error: 'Invalid or missing shortId.' };
  }
  const r = range || '7d';
  if (!VALID_RANGES.has(r)) {
    return { error: 'Invalid range. Must be one of: 7d, 30d, 90d.' };
  }
  const g = granularity || 'day';
  if (!VALID_GRANULARITIES.has(g)) {
    return { error: 'Invalid granularity. Must be one of: hour, day.' };
  }
  return { shortId, range: r, granularity: g, since: Date.now() - RANGE_MS[r] };
}

const REFERRER_CATEGORIES = [
  { pattern: /twitter\.com|x\.com|t\.co/i, label: 'Twitter/X' },
  { pattern: /whatsapp\.com|wa\.me/i, label: 'WhatsApp' },
  { pattern: /reddit\.com/i, label: 'Reddit' },
  { pattern: /facebook\.com|fb\.me|fbclid/i, label: 'Facebook' },
  { pattern: /linkedin\.com|lnkd\.in/i, label: 'LinkedIn' },
  { pattern: /google\./i, label: 'Google' },
  { pattern: /telegram\.org|t\.me/i, label: 'Telegram' },
  { pattern: /discord\.com|discord\.gg/i, label: 'Discord' },
];

function categorizeReferrer(ref) {
  if (!ref) return 'Direct';
  for (const { pattern, label } of REFERRER_CATEGORIES) {
    if (pattern.test(ref)) return label;
  }
  return 'Other';
}

app.get('/analytics/timeseries', (req, res) => {
  const ip = getClientIp(req);
  if (isRateLimited(`analytics:${ip}`, 30, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait before refreshing.' });
  }

  const params = parseAnalyticsParams(req.query);
  if (params.error) return res.status(400).json({ error: params.error });

  const { shortId, granularity, since } = params;
  const bucketMs = granularity === 'hour' ? 3600000 : 86400000;

  try {
    const rows = db.prepare(
      `SELECT (timestamp / ? * ?) AS bucket, COUNT(*) AS count
       FROM visits
       WHERE shortId = ? AND timestamp >= ?
       GROUP BY bucket
       ORDER BY bucket`
    ).all(bucketMs, bucketMs, shortId, since);

    res.json({ shortId, granularity, data: rows });
  } catch (err) {
    log.error({ err, reqId: req.id }, 'Failed to query timeseries');
    res.status(500).json({ error: 'Failed to read timeseries data' });
  }
});

app.get('/analytics/referrers', (req, res) => {
  const ip = getClientIp(req);
  if (isRateLimited(`analytics:${ip}`, 30, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait before refreshing.' });
  }

  const params = parseAnalyticsParams(req.query);
  if (params.error) return res.status(400).json({ error: params.error });

  const { shortId, since } = params;

  try {
    const rows = db.prepare(
      `SELECT referrer FROM visits WHERE shortId = ? AND timestamp >= ?`
    ).all(shortId, since);

    const counts = {};
    for (const row of rows) {
      const cat = categorizeReferrer(row.referrer);
      counts[cat] = (counts[cat] || 0) + 1;
    }

    res.json({ shortId, data: counts });
  } catch (err) {
    log.error({ err, reqId: req.id }, 'Failed to query referrers');
    res.status(500).json({ error: 'Failed to read referrer data' });
  }
});

app.get('/analytics/geo', (req, res) => {
  const ip = getClientIp(req);
  if (isRateLimited(`analytics:${ip}`, 30, 60000)) {
    return res.status(429).json({ error: 'Too many requests. Please wait before refreshing.' });
  }

  const params = parseAnalyticsParams(req.query);
  if (params.error) return res.status(400).json({ error: params.error });

  const { shortId, since } = params;

  try {
    const rows = db.prepare(
      `SELECT country, COUNT(*) AS count
       FROM visits
       WHERE shortId = ? AND timestamp >= ? AND country != ''
       GROUP BY country
       ORDER BY count DESC
       LIMIT 50`
    ).all(shortId, since);

    res.json({ shortId, data: rows });
  } catch (err) {
    log.error({ err, reqId: req.id }, 'Failed to query geo data');
    res.status(500).json({ error: 'Failed to read geo data' });
  }
});

// ── Backfill countries for existing visits ────────────────────────────
app.post('/admin/backfill-countries', (req, res) => {
  const ip = req.socket.remoteAddress || '';
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) {
    return res.status(403).json({ error: 'Localhost only.' });
  }

  try {
    const BATCH = 1000;
    const select = db.prepare(
      `SELECT id, ip FROM visits WHERE country = '' LIMIT ?`
    );
    const update = db.prepare(`UPDATE visits SET country = ? WHERE id = ?`);

    let totalUpdated = 0;
    let batch;
    do {
      batch = select.all(BATCH);
      if (batch.length === 0) break;

      const tx = db.transaction(() => {
        for (const row of batch) {
          const geo = geoip.lookup(row.ip);
          const country = (geo && geo.country) || '';
          update.run(country, row.id);
        }
      });
      tx();
      totalUpdated += batch.length;
    } while (batch.length === BATCH);

    log.info({ totalUpdated }, 'Country backfill completed');
    res.json({ ok: true, totalUpdated });
  } catch (err) {
    log.error({ err, reqId: req.id }, 'Country backfill failed');
    res.status(500).json({ error: 'Backfill failed' });
  }
});

const server = app.listen(PORT, () => log.info({ port: PORT }, 'Analytics server running'));

function gracefulShutdown(signal) {
    log.info({ signal }, 'Shutting down gracefully');

    // Stop accepting new connections; let in-flight requests finish
    server.close(() => {
        log.info('HTTP server closed, closing database');
        db.close();
        process.exit(0);
    });

    // Force exit after 30 s if connections refuse to drain
    setTimeout(() => {
        log.fatal('Forced shutdown after 30s timeout');
        db.close();
        process.exit(1);
    }, 30000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
