const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const {
  Client,
  TopicMessageSubmitTransaction,
  PrivateKey,
  AccountId,
} = require('@hashgraph/sdk');

const app = express();
const PORT = process.env.PORT || 5001;
const LOG_FILE = path.join(__dirname, 'logs.json');

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

app.use(bodyParser.json());

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

app.post('/track', (req, res) => {
    const { shortId, timestamp, referrer, userAgent } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const entry = {
        shortId,
        timestamp: timestamp || Date.now(),
        referrer,
        userAgent,
        ip
    };

    fs.readFile(LOG_FILE, 'utf8', (err, data) => {
        let logs = [];
        if (!err && data) {
            try {
                logs = JSON.parse(data);
            } catch { }
        }

        logs.push(entry);

        fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2), (err) => {
            if (err) {
                console.error('Failed to write to log:', err);
                return res.sendStatus(500);
            }
            res.sendStatus(200);
        });
    });
});

app.get('/stats', (req, res) => {
    fs.readFile(LOG_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).send('Failed to read logs');

        let logs = [];
        try {
            logs = JSON.parse(data);
        } catch (e) {
            return res.status(500).send('Invalid log data');
        }

        const counts = logs.reduce((acc, entry) => {
            acc[entry.shortId] = (acc[entry.shortId] || 0) + 1;
            return acc;
        }, {});

        res.json(counts);
    });
});

app.post('/hcs/submit', async (req, res) => {
  if (!hederaClient || !HCS_TOPIC_ID) {
    return res.status(503).json({ error: 'HCS not configured' });
  }

  const { slug, urlHash, sender } = req.body;

  if (!slug || !urlHash || !sender) {
    return res.status(400).json({ error: 'Missing required fields: slug, urlHash, sender' });
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

app.listen(PORT, () => console.log(`Analytics server running on port ${PORT}`));
