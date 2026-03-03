# Architecture Patterns

**Domain:** Decentralized URL Shortener on Hedera (EVM + HCS)
**Researched:** 2026-03-02
**Confidence:** MEDIUM — Hedera EVM architecture based on training data (cutoff Aug 2025) and official documentation patterns. HCS-specific integration patterns flagged where verification recommended.

---

## Recommended Architecture

The target architecture uses **three Hedera services in a coordinated layer**: the EVM smart contract layer (via JSON-RPC relay) handles authoritative URL storage, the Hedera Consensus Service (HCS) layer handles audit trail logging, and the Mirror Node API enables read access to both HCS messages and transaction history. The frontend remains a pure React SPA — no new backend required.

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │UrlForms  │  │Dashboard │  │Redirect  │  │  Nav   │  │
│  │(creates) │  │(lists)   │  │(resolves)│  │(wallet)│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┘  │
│       │             │             │                      │
│  ┌────▼─────────────▼─────────────▼──────────────────┐  │
│  │            Service Layer (new)                     │  │
│  │  HederaContractService   HederaHCSService          │  │
│  │  NetworkSwitcher         MirrorNodeService (new)   │  │
│  └───────┬──────────────────────┬────────────────────┘  │
└──────────┼──────────────────────┼────────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────────────────┐
│  JSON-RPC Relay  │   │       Hedera Network              │
│  (Hashio)        │   │                                   │
│  testnet.hashio  │   │  ┌─────────────┐  ┌───────────┐  │
│  .io/api         │   │  │ EVM Contract│  │ HCS Topic │  │
│  Chain ID: 296   │   │  │ (URL store) │  │ (audit log│  │
└────────┬─────────┘   │  └─────────────┘  └───────────┘  │
         │             └──────────────────────────────────┘
         ▼
┌──────────────────┐
│  MetaMask        │   ┌──────────────────────────────────┐
│  (wallet/signer) │   │  Mirror Node API                 │
└──────────────────┘   │  testnet.mirrornode.hedera.com   │
                       │  /api/v1/topics/{topicId}/       │
                       │  messages                        │
                       └──────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | New/Changed |
|-----------|---------------|-------------------|-------------|
| `UrlForms.tsx` | URL submission form, HBAR payment trigger, transaction feedback | `HederaContractService`, `HederaHCSService`, `NetworkSwitcher` | Changed (remove CRC payment, add HCS call) |
| `Dashboard.tsx` | List user's shortened URLs, show stats | `HederaContractService` (contract reads), `MirrorNodeService` (HCS history) | Changed (remove CRC, update explorer links) |
| `RedirectPage.tsx` | Resolve short ID to original URL, track visit | `HederaContractService` (read-only), analytics | Minimal change (update RPC provider URL) |
| `Nav.tsx` | Wallet connect/disconnect, network detection | `window.ethereum`, `NetworkSwitcher` | Changed (Hedera network name/logo) |
| `NetworkSwitcher.ts` | Switch MetaMask to Hedera testnet (chain ID 296) | `window.ethereum` | Replaced (was switchToGnosis → switchToHedera) |
| `HederaContractService.ts` | Wrap EVM contract calls (create, resolve, list) | ethers.js + JSON-RPC relay | New (replaces scattered contract instantiation) |
| `HederaHCSService.ts` | Submit HCS messages via Hedera JS SDK | `@hashgraph/sdk`, `REACT_APP_OPERATOR_*` env vars | New |
| `MirrorNodeService.ts` | Fetch HCS topic messages from Mirror Node REST API | Mirror Node REST API (`testnet.mirrornode.hedera.com`) | New |
| `EVM Smart Contract` | Authoritative URL storage, HBAR payment acceptance, event emission | Hedera EVM (via JSON-RPC relay) | Changed (add `payable`, accept HBAR) |
| `HCS Topic` | Immutable ordered log of URL creation events | Hedera Consensus Service | New (created once at deploy time) |
| `Analytics server` | Track link visits (localhost:3001) | Filesystem (`logs.json`) | Unchanged (localhost only) |

---

## Data Flow

### URL Creation Flow (Custom, with HBAR payment)

```
User fills form
    → UrlForms.handleSubmit()
    → NetworkSwitcher.switchToHedera()        [wallet_switchEthereumChain, chainId 0x128]
    → ethers.BrowserProvider(window.ethereum).getSigner()
    → HederaContractService.shortIdExists()   [contract view call via JSON-RPC relay]
    → HederaContractService.createCustomShortUrl(customId, url, { value: 1 HBAR in tinybar })
        [EVM tx → JSON-RPC relay → Hedera network → contract storage]
        [contract emits ShortUrlCreated event]
        [returns receipt with txHash and blockNumber]
    → HederaHCSService.submitMessage({        [parallel, non-blocking]
          type: "URL_CREATED",
          shortId, originalUrl,
          creator: signerAddress,
          txHash, timestamp
        })
        [@hashgraph/sdk TopicMessageSubmitTransaction → Hedera HCS topic]
    → UI: show success toast + HashScan link + short URL
```

### URL Creation Flow (Random, free)

```
User fills form (Random tab)
    → UrlForms.handleSubmit()
    → NetworkSwitcher.switchToHedera()
    → HederaContractService.generateShortUrl(originalUrl)
        [EVM tx → JSON-RPC relay → contract → keccak256 ID stored]
        [contract emits ShortUrlCreated(user, shortId, originalUrl, timestamp)]
    → HederaHCSService.submitMessage({ type: "URL_CREATED", ... })  [parallel]
    → UI: show generated short ID + txHash
```

### URL Resolution Flow (RedirectPage)

```
User visits /#/shortId
    → RedirectPage mounts, useEffect fires
    → HederaContractService.getOriginalUrl(shortId)   [read-only via JsonRpcProvider]
        [ethers.JsonRpcProvider("https://testnet.hashio.io/api") — no wallet needed]
    → Analytics POST to localhost:3001/track           [fire-and-forget]
    → window.location.href = destination
```

### Dashboard Data Fetch Flow

```
User opens Dashboard
    → eth_requestAccounts (get wallet address)
    → HederaContractService.getUserLinks(address)     [contract view call]
    → For each shortId: HederaContractService.getOriginalUrl(shortId)
    → MirrorNodeService.getTopicMessages(topicId)     [optional: enrich with HCS audit data]
    → analytics GET localhost:3001/stats
    → Render link table
```

### HCS Message Submission Detail

```
After successful EVM transaction:
    → HederaHCSService.submitMessage()
    → @hashgraph/sdk: new TopicMessageSubmitTransaction()
          .setTopicId(TopicId.fromString(REACT_APP_HCS_TOPIC_ID))
          .setMessage(JSON.stringify(payload))
          .execute(client)
    → Hedera network: message written to topic with consensus timestamp
    → No on-chain link between EVM tx and HCS message (they are separate Hedera services)
    → Correlation via: txHash field in HCS message payload
```

---

## Hedera EVM Architecture: Differences from Standard EVM

### What Stays the Same (HIGH confidence)
- Solidity smart contracts compile and deploy identically
- ethers.js v6 API is fully compatible (same calls, same ABI encoding)
- MetaMask integration unchanged (`window.ethereum`, `eth_requestAccounts`, etc.)
- Transaction receipt structure is EVM-standard
- `ShortUrlCreated` event parsing via `ethers.Interface` is unchanged
- `getOriginalUrl()` as a view call works without modification

### What Changes for Hedera EVM (MEDIUM confidence)

| Concern | Gnosis Chain | Hedera EVM |
|---------|-------------|------------|
| Chain ID | 0x64 (100) | 0x128 (296) for testnet |
| Native currency | xDAI | HBAR (18 decimals via JSON-RPC relay) |
| RPC endpoint | rpc.gnosischain.com | testnet.hashio.io/api (Hashio) |
| Block explorer | gnosisscan.io | hashscan.io |
| Gas fees | xDAI | HBAR (very cheap, ~$0.0001 per tx) |
| Contract address format | 0x hex | Same hex format via JSON-RPC relay |
| HBAR in msg.value | N/A | Hedera converts: 1 HBAR = 100,000,000 tinybars; via JSON-RPC, pass wei-equivalent |

### HBAR Payable Contract Consideration (MEDIUM confidence)

The current `createCustomShortUrl` function is `nonpayable`. For Hedera HBAR payment:

```solidity
// Before (Gnosis): nonpayable — CRC transferred separately
function createCustomShortUrl(string memory customId, string memory originalUrl) external

// After (Hedera): payable — accept HBAR directly
function createCustomShortUrl(string memory customId, string memory originalUrl)
    external
    payable
{
    require(msg.value >= CUSTOM_URL_FEE, "Insufficient HBAR payment");
    // ... store URL ...
    emit ShortUrlCreated(msg.sender, customId, originalUrl, block.timestamp);
}
```

From ethers.js frontend, the call becomes:
```typescript
const feeInWei = ethers.parseEther("1"); // 1 HBAR = 1e18 wei via JSON-RPC relay
await contract.createCustomShortUrl(customId, originalUrl, { value: feeInWei });
```

**Note on HBAR wei equivalence:** Hedera JSON-RPC relay represents HBAR using 18 decimal places (1 HBAR = 1e18 "tinybar-wei"). `ethers.parseEther("1")` gives the correct value. LOW confidence — verify against Hashio documentation before deploying.

---

## HCS Architecture: Topic Creation and Message Submission

### HCS Requires Hedera Native SDK (MEDIUM confidence)

HCS is NOT accessible via the JSON-RPC relay. It requires `@hashgraph/sdk` (the native Hedera JavaScript SDK). This means:

- The frontend needs two SDKs:
  - `ethers.js` — for EVM contract interactions (existing, unchanged)
  - `@hashgraph/sdk` — for HCS message submission (new)
- The HCS client needs an **operator account** (Hedera account ID + private key) to sign and pay for HCS message fees

### Operator Account Strategy

HCS message submission requires a funded account. Two options:

**Option A: Frontend operator (simpler, for hackathon)** — Store a dedicated operator account's credentials in environment variables. The frontend submits HCS messages from this shared account after each EVM transaction.

```
REACT_APP_OPERATOR_ACCOUNT_ID=0.0.XXXXXXX
REACT_APP_OPERATOR_PRIVATE_KEY=302e0201...
```

Risk: Private key in browser environment. Acceptable for hackathon demo (testnet only, small faucet funds).

**Option B: Backend proxy (production pattern)** — A small Node.js server accepts HCS submission requests, holds the operator key server-side. Not needed for hackathon scope.

Recommendation: Use Option A for hackathon (testnet only, minimal risk, zero new infrastructure).

### HCS Topic Lifecycle

```
Phase 1 (Deploy): Create HCS topic once
    → @hashgraph/sdk: new TopicCreateTransaction()
          .setTopicMemo("DURL URL creation audit log")
          .execute(client)
    → Returns topicId (e.g., 0.0.XXXXXXX)
    → Save topicId to REACT_APP_HCS_TOPIC_ID env var
    → This is a one-time setup step, not repeated per URL

Phase 2 (Runtime): Submit message per URL creation
    → new TopicMessageSubmitTransaction()
          .setTopicId(topicId)
          .setMessage(JSON.stringify({
              type: "URL_CREATED",
              shortId: "...",
              originalUrl: "...",
              creator: "0x...",
              txHash: "0x...",
              timestamp: Date.now()
          }))
          .execute(client)

Phase 3 (Read): Mirror node reads topic messages
    → GET https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.XXXXX/messages
    → Returns paginated list of messages with consensus timestamps
```

### HCS vs EVM Events: Relationship

| Aspect | EVM ShortUrlCreated Event | HCS Message |
|--------|--------------------------|-------------|
| Storage | EVM contract logs (on Hedera EVM) | Hedera Consensus Service topic |
| Purpose | Machine-readable, queryable by address | Human-readable audit trail |
| Access | Via JSON-RPC relay / Mirror Node EVM APIs | Via Mirror Node `/api/v1/topics/{id}/messages` |
| Ordering | Block order | Consensus timestamp (more precise) |
| Immutability | Yes (same as EVM logs) | Yes (consensus-ordered) |
| Correlation | N/A | txHash field in message payload |
| Cost | Included in contract tx gas | Separate HCS tx fee (very small) |

They are parallel records, not linked at the protocol level. The HCS message serves as a public, human-readable, independently-verifiable audit log that happens alongside the EVM event.

---

## JSON-RPC Relay Architecture

### How MetaMask Talks to Hedera (MEDIUM confidence)

```
MetaMask
    ↓ JSON-RPC methods (eth_sendTransaction, eth_call, etc.)
Hashio JSON-RPC Relay (testnet.hashio.io/api)
    ↓ Translates EVM JSON-RPC → Hedera native API calls
Hedera Consensus Nodes
    ↓ Executes via Hedera EVM (EVM-compatible)
Hedera Network State
```

Hashio is a publicly-available, free-to-use JSON-RPC relay operated by Hedera/Swirlds for testnet and mainnet. No API key required for testnet.

### NetworkSwitcher Change

The `switchToGnosis()` function becomes `switchToHedera()`:

```typescript
export async function switchToHedera() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x128' }], // 296 decimal
        });
    } catch (err: any) {
        if (err.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x128',
                    chainName: 'Hedera Testnet',
                    nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
                    rpcUrls: ['https://testnet.hashio.io/api'],
                    blockExplorerUrls: ['https://hashscan.io/testnet'],
                }],
            });
        } else {
            throw err;
        }
    }
}
```

### Read-Only Provider Change

`RedirectPage` uses a `JsonRpcProvider` for read-only calls. The Infura URL (Gnosis/Ethereum) is replaced with Hashio:

```typescript
// Before
const provider = new ethers.JsonRpcProvider(process.env.REACT_APP_INFURA_URL);

// After
const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
// Or: process.env.REACT_APP_HEDERA_RPC_URL for configurability
```

---

## Mirror Node API Architecture

### Mirror Node for Reading HCS Data (MEDIUM confidence)

The Mirror Node provides REST APIs for reading Hedera state without a wallet:

```
Base URL (testnet): https://testnet.mirrornode.hedera.com/api/v1/

HCS topic messages:
GET /topics/{topicId}/messages
GET /topics/{topicId}/messages?limit=25&order=desc

Single message:
GET /topics/{topicId}/messages/{sequenceNumber}

Transaction history:
GET /transactions/{transactionId}
GET /contracts/{contractId}/results  (EVM contract call results)
```

Message response structure:
```json
{
  "messages": [
    {
      "consensus_timestamp": "1234567890.000000000",
      "message": "base64-encoded-JSON-payload",
      "running_hash": "...",
      "running_hash_version": 3,
      "sequence_number": 1,
      "topic_id": "0.0.XXXXX"
    }
  ]
}
```

The `message` field is Base64-encoded. Decode in frontend:
```typescript
const decoded = atob(msg.message);
const payload = JSON.parse(decoded);
// payload = { type: "URL_CREATED", shortId: "...", originalUrl: "...", ... }
```

### MirrorNodeService Component

New `src/utils/MirrorNodeService.ts`:
```typescript
const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";
const TOPIC_ID = process.env.REACT_APP_HCS_TOPIC_ID;

export async function fetchTopicMessages(limit = 25) {
    const res = await fetch(`${MIRROR_BASE}/topics/${TOPIC_ID}/messages?limit=${limit}&order=desc`);
    const data = await res.json();
    return data.messages.map((m: any) => ({
        ...JSON.parse(atob(m.message)),
        consensusTimestamp: m.consensus_timestamp,
        sequenceNumber: m.sequence_number,
    }));
}
```

---

## Patterns to Follow

### Pattern 1: Fire-and-Forget HCS After EVM Confirmation

**What:** Submit HCS message only after the EVM transaction is confirmed (receipt received). Do not await HCS success before showing the user a success state.

**When:** Every URL creation (both custom and random).

**Rationale:** HCS failure should not block the user. The EVM contract is the source of truth. HCS is supplementary audit trail.

```typescript
// In UrlForms.handleSubmit():
const receipt = await GasTx.wait();
setGeneratedShortId(shortId);
setTxHash(receipt.hash);
setStatus('Confirmed in block ' + receipt.blockNumber); // Show success immediately

// HCS: non-blocking, best-effort
HederaHCSService.submitMessage({
    type: "URL_CREATED",
    shortId,
    originalUrl,
    creator: await signer.getAddress(),
    txHash: receipt.hash,
    timestamp: Date.now()
}).catch(err => console.warn("HCS submission failed:", err));
// No await — user already sees success
```

### Pattern 2: Single Contract Instance Per Session

**What:** Instantiate the ethers.js contract once per component mount (or extract to `HederaContractService`), not inside each handler function.

**When:** `UrlForms`, `Dashboard`, `RedirectPage`.

**Why:** Avoids repeated BrowserProvider/JsonRpcProvider construction. On Hedera, provider initialization has no special overhead beyond standard ethers.js.

### Pattern 3: Separate Read Provider from Wallet Provider

**What:** Use `ethers.JsonRpcProvider(HEDERA_RPC_URL)` for read-only calls (RedirectPage URL resolution). Use `ethers.BrowserProvider(window.ethereum)` only when a signer is needed (URL creation, payment).

**When:** Always.

**Why:** RedirectPage must work without MetaMask installed. Mirror Node or JsonRpcProvider for Hedera reads require no wallet.

### Pattern 4: Environment-Driven Hedera Config

All Hedera-specific values in `.env`:
```
REACT_APP_CONTRACT_ADDRESS=0x...           # Deployed EVM contract
REACT_APP_HEDERA_RPC_URL=https://testnet.hashio.io/api
REACT_APP_HCS_TOPIC_ID=0.0.XXXXX
REACT_APP_OPERATOR_ACCOUNT_ID=0.0.XXXXX   # HCS submission account
REACT_APP_OPERATOR_PRIVATE_KEY=302e...    # HCS submission key (testnet only)
REACT_APP_PROJECT_URL=https://durl.dev
REACT_APP_HASHSCAN_BASE=https://hashscan.io/testnet
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using JSON-RPC Relay for HCS

**What:** Trying to submit HCS messages via `window.ethereum` or ethers.js.

**Why bad:** The JSON-RPC relay only exposes EVM-compatible methods. HCS is a native Hedera service not accessible via the EVM layer.

**Instead:** Use `@hashgraph/sdk` `TopicMessageSubmitTransaction` with a native Hedera client.

### Anti-Pattern 2: Blocking URL Creation on HCS

**What:** `await HederaHCSService.submitMessage()` before showing the user success.

**Why bad:** HCS submission is a second transaction with its own latency. If it fails, the URL was already stored on-chain — blocking creates a confusing UX where the contract write succeeded but the UI shows failure.

**Instead:** Fire-and-forget HCS after EVM confirmation (Pattern 1 above).

### Anti-Pattern 3: Hardcoding RPC URLs in Components

**What:** Scattering `"https://testnet.hashio.io/api"` across multiple component files.

**Why bad:** Switching to mainnet or a different relay requires finding/replacing in many places.

**Instead:** Single `REACT_APP_HEDERA_RPC_URL` env var, accessed only through a central config or service layer.

### Anti-Pattern 4: Treating HBAR Amount as xDAI Amount

**What:** Passing `5` (CRC) or a small decimal as `msg.value` for HBAR payment.

**Why bad:** `msg.value` in Hedera EVM uses tinybars (1 HBAR = 100,000,000 tinybars), but the JSON-RPC relay maps this to 18-decimal wei equivalence. `ethers.parseEther("1")` gives 1 HBAR correctly.

**Instead:** Use `ethers.parseEther("1")` for 1 HBAR.

### Anti-Pattern 5: Storing Raw Private Keys Outside .env

**What:** Hardcoding the HCS operator private key in source files.

**Why bad:** Keys get committed to version control.

**Instead:** Always `REACT_APP_OPERATOR_PRIVATE_KEY` in `.env` (gitignored). Note this still exposes the key in browser JS bundles — acceptable for testnet/hackathon, not acceptable for mainnet.

---

## What Changes vs Stays the Same

### Stays the Same

| Component | Why Unchanged |
|-----------|--------------|
| `ethers.js` v6 API | JSON-RPC relay is EVM-compatible |
| React component structure | No UI framework migration |
| `BrowserProvider` / `getSigner()` pattern | Identical MetaMask integration |
| Contract ABI structure | Same Solidity function signatures |
| Event parsing via `ethers.Interface` | Identical log format |
| `ShortUrlCreated` event | Same event structure |
| `getOriginalUrl()` read call | Same view function pattern |
| `getUserLinks()` read call | Same view function pattern |
| Analytics server (`localhost:3001`) | Backend unchanged |
| Bootstrap 5 + SCSS | No UI migration |
| React Router HashRouter | Same routing approach |

### Changes

| Component | What Changes | Migration Complexity |
|-----------|-------------|---------------------|
| `NetworkSwitcher.ts` | `switchToGnosis()` → `switchToHedera()`, chainId `0x64` → `0x128` | Trivial |
| `UrlForms.tsx` | Remove CRC payment logic, add HBAR `{ value: fee }`, add HCS call | Low |
| `RedirectPage.tsx` | Replace `REACT_APP_INFURA_URL` with `REACT_APP_HEDERA_RPC_URL` | Trivial |
| `Dashboard.tsx` | Update explorer links (gnosisscan → hashscan), remove CRC references | Low |
| `Nav.tsx` | Update network name/logo display | Trivial |
| `.env` | Replace Gnosis/Infura/CRC vars with Hedera vars | Trivial |
| Smart Contract | Add `payable`, HBAR fee check, remove CRC dependency | Low |
| All tx links | `gnosisscan.io/tx/` → `hashscan.io/testnet/tx/` | Trivial |

### New Components

| Component | Purpose | Complexity |
|-----------|---------|------------|
| `HederaHCSService.ts` | Submit HCS messages after URL creation | Low-Medium |
| `MirrorNodeService.ts` | Read HCS topic messages (optional dashboard feature) | Low |
| HCS Topic (one-time) | Create topic at deploy time, save topic ID to .env | Low |

---

## Suggested Build Order (Phase Dependencies)

This order reflects hard technical dependencies:

```
1. Smart Contract Update (payable HBAR)
   └── Required before: any frontend HBAR payment can be tested

2. Hedera Network Config (NetworkSwitcher, .env, RPC URL)
   └── Required before: MetaMask can switch to Hedera, any EVM calls work

3. Core EVM Migration (UrlForms remove CRC, RedirectPage RPC update)
   └── Depends on: #1 and #2
   └── Required before: basic URL create/resolve works on Hedera

4. Explorer Links Update (hashscan.io everywhere)
   └── Depends on: #3 (need txHash from real Hedera tx to verify links work)

5. HCS Topic Creation (one-time deploy script)
   └── Depends on: Hedera SDK installed, operator account funded
   └── Required before: any HCS message submission

6. HCS Integration (HederaHCSService, integration in UrlForms)
   └── Depends on: #3 and #5

7. Mirror Node Integration (MirrorNodeService, Dashboard HCS display)
   └── Depends on: #6 (need real HCS messages to display)
   └── Optional for hackathon MVP
```

---

## Scalability Considerations

| Concern | For Hackathon Demo | Production Notes |
|---------|-------------------|-----------------|
| HCS operator key in browser | Acceptable (testnet, small funds) | Move to backend proxy |
| Mirror Node pagination | Not needed for demo | Implement cursor-based pagination for large logs |
| Contract storage (string arrays) | Fine for demo scale | `getUserLinks()` returns unbounded array — add pagination for 100+ links |
| JSON-RPC relay rate limits | Hashio is free but rate-limited | Use own relay or Arkhia/HashPack for production |
| HCS message size | Limit: ~4KB per message | Current JSON payload is ~200 bytes — fine |

---

## Sources

**Confidence Note:** WebSearch and WebFetch tools were unavailable during this research session. All Hedera-specific claims are based on training data (cutoff August 2025). The following official sources should be consulted to verify claims before implementation:

- Hedera JSON-RPC relay (Hashio): https://docs.hedera.com/hedera/tutorials/smart-contracts/deploy-a-smart-contract-using-hardhat-and-hashio-json-rpc-relay
- Hedera testnet chain ID (296): https://docs.hedera.com/hedera/networks/testnet
- HCS topic creation and message submission: https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service/create-a-topic
- Mirror Node API reference: https://testnet.mirrornode.hedera.com/api/v1/docs/
- Hedera JS SDK: https://github.com/hashgraph/hedera-sdk-js
- HBAR wei equivalence via JSON-RPC: https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay

**HIGH confidence (standard EVM patterns):**
- ethers.js v6 API compatibility — well-documented, widely verified
- Solidity `payable` modifier and `msg.value` — standard EVM
- MetaMask `wallet_addEthereumChain` — EIP-3085 standard

**MEDIUM confidence (Hedera-specific):**
- Hashio endpoint URL and chain ID 296
- HBAR 18-decimal representation via JSON-RPC relay
- Mirror Node REST API structure
- HCS requiring native SDK (not JSON-RPC relay)

**LOW confidence (needs verification):**
- `ethers.parseEther("1")` === 1 HBAR in contract `msg.value` — verify against Hashio docs
- Exact Hashio rate limits for testnet
- Whether MetaMask natively recognizes Hedera testnet or always needs `wallet_addEthereumChain`
