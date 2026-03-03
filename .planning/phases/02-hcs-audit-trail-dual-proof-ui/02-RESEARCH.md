# Phase 2: HCS Audit Trail + Dual Proof UI - Research

**Researched:** 2026-03-03
**Domain:** Hedera Consensus Service (HCS), Mirror Node REST API, Node.js backend relay, React UI integration
**Confidence:** HIGH (HCS SDK API verified via official Hedera docs; Mirror Node endpoints verified via live API; browser/backend architecture decision grounded in confirmed gRPC-Web proxy retirement)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HCS-01 | HCS topic created on Hedera testnet for URL creation audit log | Topic creation uses `TopicCreateTransaction` via `@hashgraph/sdk` in Node.js backend. One-time setup step requiring funded operator account from portal.hedera.com. Result is a permanent topic ID (format: `0.0.XXXXX`) stored in `.env`. |
| HCS-02 | HCS message submitted on every URL creation (random and custom) | Backend relay endpoint (`POST /hcs/submit`) added to `analytics/server.cjs`. `UrlForms.tsx` calls it after EVM confirmation succeeds. Backend uses `TopicMessageSubmitTransaction`. |
| HCS-03 | HCS message contains compact JSON: slug, URL hash, sender address, timestamp | JSON payload: `{"slug":"abc123","urlHash":"0x...","sender":"0x...","ts":1234567890}`. keccak256 hash of original URL computed in backend using ethers.js (already available). |
| HCS-04 | HCS message stays within 1024-byte limit | Compact JSON with 8-char slug + 66-char hash + 42-char address + 10-digit timestamp totals ~160 bytes. Well within 1024-byte HCS limit. Verified against HCS message size constraint from official docs. |
| HCS-05 | HCS submission is fire-and-forget (failure does not block URL creation) | Frontend `UrlForms.tsx`: after EVM tx confirmed, fire POST to `/hcs/submit` with `try/catch` that swallows errors. EVM confirmation displayed regardless of HCS outcome. Backend processes HCS async. |
| PROOF-01 | UI displays both EVM transaction hash and HCS sequence number after URL creation | `UrlForms.tsx` already shows `txHash`. Extend inline confirmation block to also show `hcsSeqNum` state variable, populated by the backend response to `/hcs/submit`. |
| PROOF-02 | "Verify on HashScan" button links to HCS topic on hashscan.io/testnet | HashScan URL format for topics: `https://hashscan.io/testnet/topic/{topicId}`. Add `getHashScanTopicUrl()` helper to `HederaConfig.ts`. Button opens this URL. |
| PROOF-03 | Dashboard shows HCS message history via Mirror Node REST API | New `AuditLog.tsx` component or section in `Dashboard.tsx`. Fetches `https://testnet.mirrornode.hedera.com/api/v1/topics/{topicId}/messages`. Decode base64 `message` field to JSON. |
| PROOF-04 | Mirror Node messages decoded from base64 and displayed as readable audit entries | `atob(message)` → parse JSON → display slug, URL hash (truncated), sender (truncated), ISO timestamp. Standard browser `atob()` works for base64 decode. |
</phase_requirements>

---

## Summary

Phase 2 adds Hedera Consensus Service (HCS) as an audit layer: every URL creation produces both an EVM event (already working) and an HCS consensus message, and the UI surfaces both proofs. The core insight is that HCS submission must run in the Node.js backend — not the browser — because the gRPC-Web proxy that allowed browser-side `@hashgraph/sdk` usage was retired on June 2, 2025. The existing `analytics/server.cjs` (Express, already running on port 5001) is the correct and lowest-risk host for the new HCS relay endpoint.

The architecture is: (1) user creates URL → EVM tx confirms → `UrlForms.tsx` already shows EVM tx hash confirmation; (2) `UrlForms.tsx` fires a non-blocking `POST /hcs/submit` to the analytics backend with the slug, URL, and sender; (3) backend submits to HCS via `@hashgraph/sdk` Node.js, waits for receipt, returns `{sequenceNumber, topicId}`; (4) `UrlForms.tsx` receives the response and adds HCS sequence number to the confirmation block; (5) "Verify on HashScan" button links to `https://hashscan.io/testnet/topic/{topicId}`. For the dashboard audit log, `Dashboard.tsx` calls the Mirror Node REST API directly from the browser (no SDK needed — standard `fetch()`), decodes base64 messages, and renders them.

The key complexity is the one-time topic creation step (requires funded Hedera operator account from portal.hedera.com, topic ID must be created before any code is written) and the `@hashgraph/sdk` webpack/polyfill issues in the React browser build (avoided entirely by using the backend relay pattern).

**Primary recommendation:** Add an `/hcs/submit` endpoint to `analytics/server.cjs`, install `@hashgraph/sdk` as a server dependency, create the topic once via a setup script, add the topic ID and operator credentials to `.env`, then wire `UrlForms.tsx` to call the endpoint fire-and-forget after EVM confirmation.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@hashgraph/sdk` | ^2.69.0 (or `@hiero-ledger/sdk` ^2.70.0) | HCS topic creation + message submission in Node.js | Official Hedera SDK; `TopicCreateTransaction` + `TopicMessageSubmitTransaction` are the canonical APIs |
| `express` | already installed (analytics/server.cjs) | HTTP server for `/hcs/submit` relay endpoint | Already running; no new server needed |
| `ethers` | ^6.14.0 (already installed in prototype) | `ethers.keccak256(ethers.toUtf8Bytes(url))` for URL hash in HCS payload | Already in project; avoids adding a new hashing dependency |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | already in analytics server via Node | Load `OPERATOR_ID`, `OPERATOR_KEY`, `HCS_TOPIC_ID` from `.env` | Server-side only; already handled by Node env loading |
| `node-fetch` or built-in `fetch` | Node 18+ built-in | Mirror Node REST API calls from backend (optional) | Only if backend needs to verify HCS; dashboard fetches Mirror Node directly from browser |

### Package to Install (backend only)

```bash
# From prototype/ directory:
npm install @hashgraph/sdk
```

This installs to `prototype/node_modules` but is used only by `analytics/server.cjs` (Node.js). The React browser build does NOT import from `@hashgraph/sdk` — avoiding all webpack/polyfill issues.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Backend relay (analytics/server.cjs) | Browser-side `@hashgraph/sdk` with react-app-rewired polyfills | Browser approach: broken since June 2025 gRPC-Web proxy retirement; polyfill config is fragile and adds 100KB+ bundle weight. Backend relay is clean, fast, already has a running server. |
| `@hashgraph/sdk` in Node.js | Direct Hedera REST/gRPC HTTP calls | SDK handles retry logic, receipt polling, key signing internally. Rolling custom HTTP calls is significantly more complex. |
| `@hiero-ledger/sdk` (v2.70+) | `@hashgraph/sdk` (v2.69+) | `@hiero-ledger/sdk` is the new namespace after Hedera→Hiero rebrand. Either package name works in 2026; `@hashgraph/sdk` is more commonly seen in tutorials and documentation as of research date. Functionally identical. |
| Dedicated HCS microservice | Extending existing analytics/server.cjs | Adding a new server requires new port, new start script, more moving parts. Extending existing server is simpler for a hackathon. |

---

## Architecture Patterns

### Recommended File Structure Changes

```
prototype/
├── analytics/
│   └── server.cjs               ← ADD /hcs/submit endpoint + topic creation script
├── src/
│   ├── utils/
│   │   └── HederaConfig.ts      ← ADD getHashScanTopicUrl() helper
│   ├── components/
│   │   ├── UrlForms.tsx         ← ADD HCS fire-and-forget call + hcsSeqNum state + dual proof UI
│   │   └── Dashboard.tsx        ← ADD HCS audit log section (Mirror Node fetch + decode)
├── .env                          ← ADD HCS_TOPIC_ID, OPERATOR_ID, OPERATOR_KEY
└── package.json                  ← ADD @hashgraph/sdk dependency
```

### Pattern 1: HCS Relay Endpoint (Backend)

**What:** Add a `POST /hcs/submit` route to the existing `analytics/server.cjs`. This route receives `{slug, urlHash, sender}`, constructs the JSON payload, submits to HCS, and returns `{sequenceNumber, topicId}`.

**Source:** Official Hedera docs + STATE.md architectural decision (HCS operator key in REACT_APP_* acceptable for testnet hackathon)

```javascript
// analytics/server.cjs additions

const {
  Client,
  TopicMessageSubmitTransaction,
  PrivateKey,
  AccountId,
} = require('@hashgraph/sdk');

const OPERATOR_ID = process.env.OPERATOR_ID;   // e.g. "0.0.1234567"
const OPERATOR_KEY = process.env.OPERATOR_KEY; // DER-encoded or raw private key string
const HCS_TOPIC_ID = process.env.HCS_TOPIC_ID; // e.g. "0.0.9876543"

// Build Hedera client — Node.js only, no gRPC-Web proxy needed
const hederaClient = Client.forTestnet().setOperator(
  AccountId.fromString(OPERATOR_ID),
  PrivateKey.fromString(OPERATOR_KEY)
);

app.post('/hcs/submit', async (req, res) => {
  const { slug, urlHash, sender } = req.body;

  if (!slug || !urlHash || !sender) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const payload = JSON.stringify({
    slug,
    urlHash,
    sender,
    ts: Math.floor(Date.now() / 1000),
  });

  // Guard: check payload size stays within 1024-byte limit
  if (Buffer.byteLength(payload, 'utf8') > 1024) {
    return res.status(400).json({ error: 'Payload exceeds 1024 bytes' });
  }

  try {
    const submitTx = await new TopicMessageSubmitTransaction()
      .setTopicId(HCS_TOPIC_ID)
      .setMessage(payload)
      .execute(hederaClient);

    const receipt = await submitTx.getReceipt(hederaClient);
    const sequenceNumber = receipt.topicSequenceNumber.toString();

    return res.json({ sequenceNumber, topicId: HCS_TOPIC_ID });
  } catch (err) {
    console.error('HCS submit failed:', err.message);
    return res.status(500).json({ error: 'HCS submission failed' });
  }
});
```

### Pattern 2: Fire-and-Forget in UrlForms.tsx

**What:** After EVM confirmation succeeds and `setTxHash(receipt.hash)` is called, fire `POST /hcs/submit` in a non-blocking try/catch. Update `hcsSeqNum` state if successful; leave it null if HCS fails. The inline confirmation shows both proofs when available.

**Source:** HCS-05 requirement (HCS failure must not block URL creation)

```typescript
// UrlForms.tsx additions

const [hcsSeqNum, setHcsSeqNum] = useState<string | null>(null);
const [hcsTopicId, setHcsTopicId] = useState<string | null>(null);

// After EVM confirmation — runs AFTER setTxHash(), does not block
async function submitToHCS(slug: string, originalUrl: string, sender: string) {
  try {
    const urlHash = ethers.keccak256(ethers.toUtf8Bytes(originalUrl));
    const response = await fetch('http://localhost:5001/hcs/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, urlHash, sender }),
    });
    if (response.ok) {
      const data = await response.json();
      setHcsSeqNum(data.sequenceNumber);
      setHcsTopicId(data.topicId);
    }
  } catch {
    // Fire-and-forget: HCS failure silently ignored
  }
}

// In handleSubmit, after setTxHash(receipt.hash):
//   submitToHCS(shortId, originalUrl, await signer.getAddress());
//   (no await — fire and forget)
```

### Pattern 3: Dual Proof Confirmation Block

**What:** Extend the existing `{txHash && (...)}` block in `UrlForms.tsx` to show HCS sequence number and a "Verify on HashScan" button when `hcsSeqNum` is available.

```tsx
{txHash && (
  <div className="alert alert-success mt-3">
    <strong>Link created!</strong><br />
    Short URL:{' '}
    <a href={`${PROJECT_URL}/#/${generatedShortId}`} target="_blank" rel="noopener noreferrer">
      {`${PROJECT_URL}/#/${generatedShortId}`}
    </a>
    <br />
    <strong>EVM Tx:</strong>{' '}
    <a href={getHashScanTxUrl(txHash)} target="_blank" rel="noopener noreferrer">
      {txHash.slice(0, 10)}...
    </a>
    {hcsSeqNum && hcsTopicId && (
      <>
        <br />
        <strong>HCS Sequence #:</strong> {hcsSeqNum}
        <br />
        <a
          href={getHashScanTopicUrl(hcsTopicId)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm btn-outline-light mt-1"
        >
          Verify on HashScan (HCS)
        </a>
      </>
    )}
  </div>
)}
```

### Pattern 4: Mirror Node Fetch in Dashboard

**What:** Add an HCS audit log section to `Dashboard.tsx`. Use plain `fetch()` (no SDK needed) to query the Mirror Node REST API. Decode base64 messages using browser-native `atob()`. Display as a table.

**Source:** Mirror Node API docs — `https://testnet.mirrornode.hedera.com/api/v1/topics/{topicId}/messages`

```typescript
// Dashboard.tsx — new HCS audit section

const HCS_TOPIC_ID = process.env.REACT_APP_HCS_TOPIC_ID as string;
const MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';

interface HcsEntry {
  sequenceNumber: number;
  consensusTimestamp: string;
  slug: string;
  urlHash: string;
  sender: string;
}

const [hcsEntries, setHcsEntries] = useState<HcsEntry[]>([]);

async function loadHcsAuditLog() {
  try {
    const res = await fetch(
      `${MIRROR_NODE_URL}/api/v1/topics/${HCS_TOPIC_ID}/messages?limit=25&order=desc`
    );
    const data = await res.json();

    const entries: HcsEntry[] = data.messages
      .map((msg: any) => {
        try {
          const decoded = JSON.parse(atob(msg.message));
          return {
            sequenceNumber: msg.sequence_number,
            consensusTimestamp: msg.consensus_timestamp,
            slug: decoded.slug,
            urlHash: decoded.urlHash,
            sender: decoded.sender,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    setHcsEntries(entries);
  } catch (e) {
    console.warn('Could not load HCS audit log');
  }
}

// Call in useEffect alongside loadLinks()
```

### Pattern 5: HashScan Topic URL Helper

**What:** Add `getHashScanTopicUrl()` to `HederaConfig.ts` following the established pattern for `getHashScanTxUrl()`.

```typescript
// utils/HederaConfig.ts addition
export function getHashScanTopicUrl(topicId: string): string {
  return `${HEDERA_EXPLORER_URL}/topic/${topicId}`;
}
// Results in: https://hashscan.io/testnet/topic/0.0.XXXXX
```

**Note (LOW confidence):** The exact HashScan URL path for topics (`/topic/` vs `/topics/`) was not directly confirmed via a live 200 response — attempts returned 404. Based on the established HashScan URL pattern for transactions (`/transaction/{hash}`) and contracts (`/contract/{address}`), the topic URL is almost certainly `https://hashscan.io/testnet/topic/{topicId}`. The developer should verify this manually when the topic ID is known.

### Pattern 6: Topic Creation Script (one-time setup)

**What:** A standalone Node.js script run once to create the HCS topic. Output is the topic ID to store in `.env`.

```javascript
// scripts/create-topic.cjs (run once, then delete or keep)
const { Client, TopicCreateTransaction, PrivateKey, AccountId } = require('@hashgraph/sdk');
require('dotenv').config({ path: '../.env' });

async function main() {
  const client = Client.forTestnet().setOperator(
    AccountId.fromString(process.env.OPERATOR_ID),
    PrivateKey.fromString(process.env.OPERATOR_KEY)
  );

  const txResponse = await new TopicCreateTransaction()
    .setTopicMemo('DURL URL shortener audit log')
    .execute(client);

  const receipt = await txResponse.getReceipt(client);
  console.log('Topic ID:', receipt.topicId.toString());
  // Copy this value → set HCS_TOPIC_ID=0.0.XXXXX in .env

  client.close();
}

main().catch(console.error);
```

**Run with:** `node scripts/create-topic.cjs` from the `prototype/` directory.

### Anti-Patterns to Avoid

- **Importing `@hashgraph/sdk` in React browser code:** Causes webpack 5 polyfill errors (missing `buffer`, `stream`, `crypto`, `process` etc.) that require `react-app-rewired` config. The gRPC-Web proxy was also retired June 2025. Use the backend relay exclusively.
- **Using `await` on the HCS submit call in handleSubmit:** This would block the confirmation UX. Always fire-and-forget: call `submitToHCS(...)` without `await` after `setTxHash()`.
- **Storing `urlHash` computed on the frontend with `ethers.keccak256`:** The frontend can compute it, but the backend must independently hash it for integrity. For simplicity in this phase, have the frontend pass the original URL and let the backend hash it.
- **Polling Mirror Node in a tight loop:** Rate limit is 50 RPS. Use a single `fetch()` on component mount and a reasonable interval (≥5s) if refreshing. A one-time fetch is sufficient for the dashboard audit view.
- **Making HCS topic ID a hardcoded constant:** Must come from `.env` so it's easy to rotate if needed. Use `REACT_APP_HCS_TOPIC_ID` for the React client and `HCS_TOPIC_ID` for the backend server.
- **Blocking topic setup on coding:** HCS topic must be created (Step 0 of Phase 2) before writing any HCS code. The topic ID is needed in `.env` before the backend can submit messages.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HCS message signing + submission | Manual gRPC or HTTP calls to Hedera consensus nodes | `TopicMessageSubmitTransaction` from `@hashgraph/sdk` | SDK handles key signing, transaction IDs, receipt polling, retry logic |
| Base64 decoding of Mirror Node messages | Custom base64 decoder | `atob(msg.message)` — browser built-in | Standard JS API; no library needed |
| URL content hashing for HCS payload | Custom hash function | `ethers.keccak256(ethers.toUtf8Bytes(url))` — ethers.js already in project | Consistent with EVM patterns; ethers is already installed |
| Mirror Node API calls | SDK subscription to mirror node | Plain `fetch()` against REST API | REST API is simpler, no WebSocket, no subscription management needed for a batch display |
| Operator account creation | Any custom key generation | portal.hedera.com — free testnet account with 1000 HBAR | Official portal provides funded account and key export |

**Key insight:** The Mirror Node REST API is intentionally designed for browser consumption — it's HTTP/REST with no gRPC, no SDK, no polyfills. The SDK is only needed for state-changing operations (submitting messages), which belong in the Node.js backend.

---

## Common Pitfalls

### Pitfall 1: Topic Not Created Before Coding Starts

**What goes wrong:** Developer writes all HCS code, runs it, gets `INVALID_TOPIC_ID` or `HCS_TOPIC_ID is undefined` errors. Nothing works until the topic exists.

**Why it happens:** Topic creation requires a funded Hedera operator account and a one-time transaction. It's easy to treat it as a detail to handle later.

**How to avoid:** Create the topic as the FIRST task in Phase 2. The topic ID is a build dependency — all subsequent work references it via `.env`. Keep a record of the topic ID in `.env` and anywhere else needed.

**Warning signs:** `HCS_TOPIC_ID` is empty string or undefined in server environment.

### Pitfall 2: @hashgraph/sdk Imported in React Bundle

**What goes wrong:** `import { Client, TopicMessageSubmitTransaction } from '@hashgraph/sdk'` in any `.ts`/`.tsx` file causes webpack 5 build errors: `BREAKING CHANGE: webpack < 5 used to include polyfills for node.js core modules by default`. Build fails immediately.

**Why it happens:** `@hashgraph/sdk` uses Node.js core modules (`buffer`, `stream`, `crypto`, `os`, `path`) that webpack 5 no longer polyfills automatically in create-react-app builds.

**How to avoid:** Never import from `@hashgraph/sdk` in any file under `prototype/src/`. The SDK is exclusively used in `analytics/server.cjs` (CommonJS, Node.js). The React app communicates via `fetch()` to the local backend.

**Warning signs:** `BREAKING CHANGE: webpack < 5 used to include polyfills` in build output.

### Pitfall 3: HCS Failure Blocks URL Confirmation

**What goes wrong:** `handleSubmit` in `UrlForms.tsx` uses `await submitToHCS(...)` or places HCS call before `setTxHash()`. If backend is unavailable, the EVM confirmation never shows.

**Why it happens:** Developer treats HCS as a required step in the transaction flow.

**How to avoid:** HCS-05 requires fire-and-forget. Pattern is: (1) EVM tx confirms → (2) `setTxHash(receipt.hash)` immediately → (3) call `submitToHCS(...)` without `await` in a separate `.catch(() => {})` chain. The EVM confirmation renders immediately regardless of HCS outcome.

**Warning signs:** `hcsSeqNum` and EVM tx hash appear at the same time (they should be slightly staggered if HCS is truly async).

### Pitfall 4: Mirror Node base64 Decode Fails Silently

**What goes wrong:** `JSON.parse(atob(msg.message))` throws if the message is malformed (wrong padding, non-JSON content). Dashboard shows no entries with no error indication.

**Why it happens:** `atob()` can throw on invalid base64. `JSON.parse()` can throw on non-JSON strings. Both exceptions need to be caught.

**How to avoid:** Always wrap decode in a try/catch and filter out nulls (see Pattern 4 above). Add a console.warn for failed decodes during development.

### Pitfall 5: HCS Message Payload Exceeds 1024 Bytes

**What goes wrong:** `TopicMessageSubmitTransaction` fails with payload too large error if the original URL is very long.

**Why it happens:** HCS has a hard 1024-byte limit per message. The original URL could be very long; storing the full URL (not just the hash) in the HCS payload would risk exceeding this.

**How to avoid:** Store only the keccak256 hash of the URL (66 chars), not the full URL. Computed payload for typical entries: slug (8 chars) + urlHash (66 chars) + sender (42 chars) + ts (10 chars) + JSON overhead (~30 chars) ≈ 156 bytes. Well under 1024. Add a server-side guard: `if (Buffer.byteLength(payload, 'utf8') > 1024) return 400`.

### Pitfall 6: Operator Key Exposed in REACT_APP_ Variables

**What goes wrong:** Developer adds `REACT_APP_OPERATOR_KEY=...` to `.env` so the browser can access it. The private key is bundled into the JavaScript and visible in browser devtools.

**Why it happens:** React's `REACT_APP_*` convention auto-bundles vars into the client build.

**How to avoid:** Operator credentials must NOT use the `REACT_APP_` prefix. Use `OPERATOR_ID` and `OPERATOR_KEY` (no `REACT_APP_` prefix) — these are only read by Node.js (`analytics/server.cjs`) and never reach the browser bundle. `REACT_APP_HCS_TOPIC_ID` is safe to expose (it's just a topic ID, not a secret).

### Pitfall 7: Mirror Node Rate Limit Triggered by Polling

**What goes wrong:** Dashboard polls Mirror Node every second (following the analytics stats pattern), hitting the 50 RPS limit. Returns 429 errors.

**Why it happens:** The analytics stats polling (`setInterval` every 5 seconds) is a natural pattern to copy for HCS audit data.

**How to avoid:** For Phase 2 (hackathon scope), a single fetch on dashboard load + a manual refresh button is sufficient. The HCS audit log does not need real-time updates. If polling is added, use ≥10 second intervals.

---

## Code Examples

Verified patterns from official sources:

### Topic Creation (Node.js script, run once)

```javascript
// Source: docs.hedera.com/hedera/getting-started-hedera-native-developers/create-a-topic
const { Client, TopicCreateTransaction, PrivateKey, AccountId } = require('@hashgraph/sdk');

const client = Client.forTestnet().setOperator(
  AccountId.fromString(process.env.OPERATOR_ID),    // "0.0.1234567"
  PrivateKey.fromString(process.env.OPERATOR_KEY)    // DER-encoded key string
);

const txResponse = await new TopicCreateTransaction()
  .setTopicMemo('DURL audit log')
  .execute(client);

const receipt = await txResponse.getReceipt(client);
console.log('Topic ID:', receipt.topicId.toString()); // → "0.0.XXXXX"
client.close();
```

### Message Submission (Node.js backend)

```javascript
// Source: docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service/submit-a-message
// receipt.topicSequenceNumber confirmed from: hedera SDK reference (TransactionReceipt.topicSequenceNumber)
const submitTx = await new TopicMessageSubmitTransaction()
  .setTopicId(HCS_TOPIC_ID)   // "0.0.XXXXX"
  .setMessage(payloadString)  // JSON string, ≤1024 bytes
  .execute(hederaClient);

const receipt = await submitTx.getReceipt(hederaClient);
const sequenceNumber = receipt.topicSequenceNumber.toString(); // Long → string
```

### Mirror Node Query (browser fetch)

```typescript
// Source: docs.hedera.com/hedera/tutorials/consensus/query-messages-with-mirror-node
const res = await fetch(
  `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=25&order=desc`
);
const data = await res.json();

// Response shape:
// {
//   messages: [
//     {
//       sequence_number: 2,
//       message: "eyJzbHVnIjoiYWJjMTIzIiwi...",  // base64
//       consensus_timestamp: "1683553060.092158003",
//       payer_account_id: "0.0.2617920",
//       topic_id: "0.0.4603900"
//     }
//   ],
//   links: { next: null }
// }

const decoded = JSON.parse(atob(data.messages[0].message));
// → { slug: "abc123", urlHash: "0x...", sender: "0x...", ts: 1234567890 }
```

### HCS Payload Size Budget

```
Compact JSON payload breakdown for typical DURL entry:
  {"slug":"abc12345","urlHash":"0x1234567890abcdef...64chars","sender":"0xAbcDef...40chars","ts":1741008000}

Sizes:
  slug:    8 chars (fixed by contract)
  urlHash: 66 chars (0x + 64 hex chars from keccak256)
  sender:  42 chars (0x + 40 hex chars of Ethereum address)
  ts:      10 chars (Unix timestamp seconds, e.g. 1741008000)
  keys/punctuation: ~30 chars
  Total:   ~156 bytes — well under 1024-byte HCS limit
```

### .env Additions Required

```bash
# Server-side only (Node.js backend) — do NOT use REACT_APP_ prefix
OPERATOR_ID=0.0.XXXXXXX          # Hedera testnet account ID from portal.hedera.com
OPERATOR_KEY=302e020100300...    # Private key (DER or raw) from portal.hedera.com

# Safe to expose to browser — just a topic ID, not a secret
REACT_APP_HCS_TOPIC_ID=0.0.XXXXXXX   # Created by running scripts/create-topic.cjs
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Browser-side `@hashgraph/sdk` via gRPC-Web proxy (myhbarwallet) | Node.js backend only; browser reads Mirror Node REST API | June 2, 2025 (proxy retired) | Browser SDK usage broken; backend relay required for any state-changing HCS operations |
| `@hashgraph/sdk` npm package name | `@hiero-ledger/sdk` (Hiero rebrand, v2.70+) | Late 2024 / early 2025 | Both package names work; `@hashgraph/sdk` still installable and functionally equivalent |
| HCS message subscription via SDK | Mirror Node REST API for reads | Ongoing | REST API is simpler for batch dashboard display; SDK subscription needed only for real-time streaming (not required here) |

**Deprecated/outdated:**
- Browser-side `@hashgraph/sdk` via gRPC-Web: broken since June 2025 proxy retirement
- `Client.forTestnet()` with default gRPC proxy in browser context: no longer works without HIP-1046-compatible SDK and node address book support

---

## Open Questions

1. **Exact HashScan URL for HCS topics**
   - What we know: Transaction URL is `https://hashscan.io/testnet/transaction/{txHash}`. Contract URL is `https://hashscan.io/testnet/contract/{address}`. Likely topic URL follows same pattern.
   - What's unclear: Is it `/topic/` or `/topics/`? A 404 was returned when testing the URL pattern during research (page may require JavaScript to render).
   - Recommendation: When topic ID is known, manually navigate to `https://hashscan.io/testnet` and search for the topic ID. Use that URL as the definitive format. For now, implement with `https://hashscan.io/testnet/topic/{topicId}` and verify during topic creation step.

2. **`receipt.topicSequenceNumber` type and serialization**
   - What we know: Confirmed to be a `Long` value from TransactionReceipt. `.toString()` converts to string for JSON.
   - What's unclear: Whether `Long` (protobuf) serializes correctly via `.toString()` in all SDK versions or requires `.toNumber()` for small values.
   - Recommendation: Use `receipt.topicSequenceNumber.toString()` for safety (avoids integer overflow for large sequence numbers). Both `.toString()` and `.toNumber()` should work for typical sequence numbers (< 2^53).

3. **HCS_TOPIC_ID env var — REACT_APP_ prefix or not?**
   - What we know: `REACT_APP_*` vars are bundled into the browser build. The topic ID (e.g. `0.0.1234567`) is not sensitive — it's a public identifier.
   - Decision: Use `REACT_APP_HCS_TOPIC_ID` for the client (needed in `Dashboard.tsx` for Mirror Node fetch and `HederaConfig.ts` for the HashScan link). Use `HCS_TOPIC_ID` (no prefix) for the server. Both point to the same value.

4. **Mirror Node message ordering and filtering**
   - What we know: `order=desc` returns newest first. `limit=25` is a reasonable default for the dashboard audit view.
   - What's unclear: Whether to filter by sender address (to show only messages from the current wallet) or show all messages from the topic.
   - Recommendation: Show all topic messages (unfiltered) for the dashboard audit log — this makes the on-chain nature of HCS visible (anyone can see all entries). This aligns with the "immutable public log" narrative.

5. **Backend port stability (port 5001)**
   - What we know: The existing `analytics/server.cjs` runs on `PORT || 5001`. `Dashboard.tsx` already calls `http://localhost:5001/stats`.
   - What's unclear: Whether port 5001 conflicts with any other local service.
   - Recommendation: Keep port 5001. All existing calls already target 5001. Add `/hcs/submit` to the same server.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set to `true` in `.planning/config.json` — this section is skipped per instructions.

---

## Sources

### Primary (HIGH confidence)
- https://docs.hedera.com/hedera/tutorials/consensus/query-messages-with-mirror-node — Mirror Node REST API endpoint, response format, base64 message field, sequence_number field
- https://docs.hedera.com/hedera/tutorials/consensus/submit-your-first-message — `TopicMessageSubmitTransaction` code pattern, `getReceipt()`, `Client.forTestnet().setOperator()`
- https://docs.hedera.com/hedera/getting-started-hedera-native-developers/create-a-topic — `TopicCreateTransaction`, `receipt.topicId`
- https://hol.org/docs/tutorials/getting-started/submit-your-first-hcs-message/ — `receipt.topicSequenceNumber` confirmed as the sequence number property
- https://docs.hedera.com/hedera/networks/testnet/testnet-access — portal.hedera.com for account creation, 1000 HBAR on testnet
- Direct codebase inspection: `prototype/analytics/server.cjs`, `prototype/src/components/UrlForms.tsx`, `prototype/src/components/Dashboard.tsx`, `prototype/.env`, `prototype/package.json`
- STATE.md accumulated decisions: HCS operator key in REACT_APP_* acceptable for testnet; @hashgraph/sdk browser compatibility needs validation

### Secondary (MEDIUM confidence)
- https://x.com/hedera_devs/status/1920929258081280440 — MyHbarWallet gRPC-Web Proxies retired June 2, 2025 (source: Hedera developers Twitter/X)
- https://github.com/hiero-ledger/hiero-sdk-js — `@hiero-ledger/sdk` v2.70.0 is the latest package; browser UMD build available; React Native support confirmed; HIP-1046 adds address-book-based gRPC-Web discovery
- Search result synthesis: Mirror Node rate limit 50-100 RPS confirmed from multiple sources (hashpack docs, hedera blog)
- https://github.com/hashgraph/hedera-sdk-reference/blob/main/reference/core/TransactionReceipt.md — `topicSequenceNumber` field in TransactionReceipt (inferred from search result; direct URL returned 404)

### Tertiary (LOW confidence)
- HashScan topic URL format (`/testnet/topic/{id}`) — inferred from HashScan URL pattern convention; not directly verified via a live 200 response. The developer must confirm this during topic creation.
- Mirror Node `order=desc` query parameter behavior — referenced in Mirror Node Swagger docs but not directly tested against a populated topic

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@hashgraph/sdk` API patterns verified via official Hedera docs; backend relay pattern confirmed by gRPC-Web proxy retirement
- Architecture (backend relay): HIGH — gRPC-Web proxy retirement is confirmed from Hedera developer Twitter and search results; backend relay is the only viable browser-safe approach
- HCS API patterns: HIGH — `TopicMessageSubmitTransaction`, `receipt.topicSequenceNumber`, `Client.forTestnet().setOperator()` all verified in official docs and tutorials
- Mirror Node API: HIGH — endpoint format, response JSON structure, base64 encoding all confirmed from official Hedera tutorial
- Pitfalls: HIGH — most derived from confirmed architectural facts (gRPC-Web retirement, webpack 5 polyfill behavior, fire-and-forget requirement)
- HashScan topic URL: LOW — pattern inferred, must be verified manually

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (HCS API and Mirror Node stable; SDK versions stable; gRPC-Web retirement already confirmed)
