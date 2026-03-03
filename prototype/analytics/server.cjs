const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const Database = require('better-sqlite3');
const {
  Client,
  TopicMessageSubmitTransaction,
  PrivateKey,
  AccountId,
} = require('@hashgraph/sdk');

const app = express();
const PORT = process.env.PORT || 5001;

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

const insertVisit = db.prepare(
  'INSERT INTO visits (shortId, timestamp, referrer, userAgent, ip) VALUES (?, ?, ?, ?, ?)'
);
const countByShortId = db.prepare(
  'SELECT shortId, COUNT(*) AS count FROM visits GROUP BY shortId'
);

// ── Rate-limiting helpers ──────────────────────────────────────────────
const rateBuckets = {};          // key → { count, resetAt }
const CLEANUP_INTERVAL = 60000;  // purge stale entries every 60 s

setInterval(() => {
  const now = Date.now();
  for (const key in rateBuckets) {
    if (rateBuckets[key].resetAt <= now) delete rateBuckets[key];
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
  const bucket = rateBuckets[key];
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets[key] = { count: 1, resetAt: now + windowMs };
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
  console.log('Hedera client initialized for HCS');
} else {
  console.warn('WARNING: OPERATOR_ID/OPERATOR_KEY not set — /hcs/submit will be disabled');
}

app.use(bodyParser.json({ limit: '10kb' }));

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
    });
});

// ── /track input validation ────────────────────────────────────────────
const VALID_SHORT_ID = /^[a-zA-Z0-9_-]{1,32}$/;
const MAX_REFERRER_LEN = 2048;
const MAX_UA_LEN = 512;
// Accept timestamps within ±5 minutes of server time
const TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

function sanitizeString(val, maxLen) {
    if (typeof val !== 'string') return '';
    // Strip control characters (keep printable ASCII + common UTF-8)
    return val.replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLen);
}

// ── Bot detection ──────────────────────────────────────────────────────
const BOT_UA_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|linkedinbot|embedly|quora link|showyoubot|outbrain|pinterest|applebot|googlebot|bingbot|yandexbot|duckduckbot|baiduspider|sogou|exabot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|chatgpt|claudebot/i;

function isBot(ua) {
    return BOT_UA_PATTERN.test(ua);
}

// ── Visit deduplication (IP + shortId, 10-min window) ──────────────────
const recentVisits = {};          // key → expireAt
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Piggy-back on the existing cleanup interval for stale dedup entries
setInterval(() => {
    const now = Date.now();
    for (const key in recentVisits) {
        if (recentVisits[key] <= now) delete recentVisits[key];
    }
}, CLEANUP_INTERVAL);

/**
 * Returns true if this IP+shortId combo was already seen within the window.
 * Marks it as seen if not.
 */
function isDuplicateVisit(ip, shortId) {
    const key = `dedup:${ip}:${shortId}`;
    const now = Date.now();
    if (recentVisits[key] && recentVisits[key] > now) return true;
    recentVisits[key] = now + DEDUP_WINDOW_MS;
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
        return res.sendStatus(200);
    }

    const ip = getClientIp(req);

    // ── Deduplicate (same IP + shortId within 10 min → skip logging) ──
    if (isDuplicateVisit(ip, shortId)) {
        return res.sendStatus(200);
    }

    // 1 track per shortId per IP per minute
    if (isRateLimited(`track:${ip}:${shortId}`, 1, 60000)) {
        return res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
    }

    try {
        insertVisit.run(shortId, ts, cleanReferrer, cleanUA, ip);
        res.sendStatus(200);
    } catch (err) {
        console.error('Failed to insert visit:', err);
        res.sendStatus(500);
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
        console.error('Failed to query stats:', err);
        res.status(500).json({ error: 'Failed to read stats' });
    }
});

app.post('/hcs/submit', async (req, res) => {
  if (!hederaClient || !HCS_TOPIC_ID) {
    return res.status(503).json({ error: 'HCS not configured' });
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
    const submitTx = await new TopicMessageSubmitTransaction()
      .setTopicId(HCS_TOPIC_ID)
      .setMessage(payload)
      .execute(hederaClient);

    const receipt = await submitTx.getReceipt(hederaClient);
    const sequenceNumber = receipt.topicSequenceNumber.toString();

    console.log(`HCS message submitted: seq=${sequenceNumber}, slug=${slug}`);

    return res.json({ sequenceNumber, topicId: HCS_TOPIC_ID });
  } catch (err) {
    console.error('HCS submit failed:', err.message);
    return res.status(500).json({ error: 'HCS submission failed' });
  }
});

const server = app.listen(PORT, () => console.log(`Analytics server running on port ${PORT}`));

function gracefulShutdown(signal) {
    console.log(`${signal} received, shutting down gracefully...`);

    // Stop accepting new connections; let in-flight requests finish
    server.close(() => {
        console.log('HTTP server closed, closing database...');
        db.close();
        process.exit(0);
    });

    // Force exit after 30 s if connections refuse to drain
    setTimeout(() => {
        console.error('Forced shutdown after 30s timeout');
        db.close();
        process.exit(1);
    }, 30000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
