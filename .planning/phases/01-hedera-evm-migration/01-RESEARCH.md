# Phase 1: Hedera EVM Migration - Research

**Researched:** 2026-03-02
**Domain:** Hedera EVM / ethers.js v6 / Solidity payable contracts / React config migration
**Confidence:** HIGH (core Hedera config, ethers.js patterns verified via official docs and direct codebase inspection)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Payment Confirmation UX**
- After paying 1 HBAR for a custom link: show inline confirmation on page (tx hash, short link, HashScan link) AND a toast notification
- Both mechanisms fire — inline for detail, toast for quick feedback
- Free random links also show inline confirmation + toast (without payment info)

**Explorer Integration (HashScan)**
- HashScan links appear in creation success toasts
- HashScan links appear inline on page after link creation
- Dashboard shows a small HashScan icon per link, linking to its creation transaction
- Copy-to-clipboard button for tx hash in dashboard
- All explorer links use `https://hashscan.io/testnet/transaction/{txHash}` format

**Network Switching UX**
- Auto-prompt wallet_switchEthereumChain when user is on wrong network (same pattern as current Gnosis switching)
- If Hedera testnet not in wallet, auto-trigger wallet_addEthereumChain with full config
- Keep current auto-prompt pattern — no blocking UI or manual banners

**Hedera Branding**
- Full content update: rewrite About and How-it-works pages for Hedera context
- Add "Built on Hedera" badge in footer or nav
- Replace ALL references to Gnosis/xDai/CRC with Hedera/HBAR throughout UI copy
- Update page descriptions and meta tags

### Claude's Discretion
- Exact toast message wording
- HashScan icon choice and placement in dashboard table
- Copy button styling and feedback animation
- About/How-it-works page content structure (as long as it covers Hedera accurately)
- Error message wording for failed transactions
- Loading state design during transaction confirmation

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MIGR-01 | All chain configuration references updated to Hedera testnet (chain ID 296, Hashio RPC) | Chain ID 296 / 0x128, RPC `https://testnet.hashio.io/api` confirmed via official Hedera docs |
| MIGR-02 | MetaMask network switching prompts use Hedera testnet chain config (name, RPC, currency, explorer) | Full wallet_addEthereumChain config documented in Architecture Patterns section |
| MIGR-03 | All explorer links point to HashScan (hashscan.io/testnet) instead of GnosisScan/Etherscan | URL format `https://hashscan.io/testnet/transaction/{txHash}` confirmed; grep found all 3 locations to replace |
| MIGR-04 | Environment variables updated for Hedera (RPC URL, chain ID, explorer URL, HCS topic ID) | Existing .env has 3 vars; need to rename REACT_APP_INFURA_URL and add REACT_APP_CHAIN_ID, REACT_APP_EXPLORER_URL |
| MIGR-05 | Read-only provider uses Hedera testnet RPC instead of Infura/Gnosis RPC | RedirectPage.tsx uses `REACT_APP_INFURA_URL`; swap to `REACT_APP_HEDERA_RPC_URL` pointing to Hashio |
| CIRC-01 | All Circles SDK imports and code removed from codebase | Two files: `utils/CirclesConfig.ts` (full deletion) and `contractMethods/CRCPaymentProvider.ts` (full deletion); imports found in UrlForms.tsx |
| CIRC-02 | All 5 @circles-sdk npm packages uninstalled | package.json has: @circles-sdk/adapter-ethers, @circles-sdk/data, @circles-sdk/profiles, @circles-sdk/sdk, @circles-sdk/utils — all 5 confirmed |
| CIRC-03 | CirclesConfig.ts replaced with HederaConfig.ts (or equivalent) | Replace `utils/CirclesConfig.ts` with `utils/HederaConfig.ts` containing Hedera chain constants |
| CIRC-04 | CRC token balance display and approval UI removed | UrlForms.tsx currently shows "Cost: 5 CRC + xDAI gas fee" and calls sendV2GroupCRC — both must be removed |
| CIRC-05 | CRCPaymentProvider.ts deleted or fully replaced | `contractMethods/CRCPaymentProvider.ts` — full deletion; no replacement needed (payment is now msg.value) |
| CONT-01 | Custom link function is `payable` and checks `msg.value >= 1 HBAR` | ABI shows `createCustomShortUrl` as `nonpayable` — Solidity contract must be updated and redeployed; 1 HBAR = 1e18 wei in EVM context |
| CONT-02 | Random link generation (keccak256) works unchanged on Hedera EVM | Hedera runs standard EVM/Besu — keccak256 is natively supported; no contract changes needed for random URL logic |
| CONT-03 | Contract compiles and deploys on Hedera testnet via Hardhat or Remix | Remix + MetaMask Injected Provider is easiest path; Hardhat also supported via Hashio RPC |
| CONT-04 | All contract calls use hardcoded gasLimit (not estimateGas) | STATE.md decision: gasLimit: 400000; pattern: `contract.method(args, { gasLimit: 400000 })` |
| CONT-05 | Transaction receipt parsing has fallback for empty `receipt.logs` on Hedera relay | Hedera relay known to return empty logs array; fallback via `provider.getLogs()` documented in patterns section |
| PAY-01 | Custom link creation sends 1 HBAR as `msg.value` with the transaction | `contract.createCustomShortUrl(customId, url, { value: ethers.parseEther("1"), gasLimit: 400000 })` |
| PAY-02 | No token approval step needed (native currency payment) | Removing entire CRC flow eliminates approval; HBAR is native currency, no ERC-20 approval needed |
| PAY-03 | Random link creation remains free (no payment required) | `generateShortUrl` stays `nonpayable`; no value override needed |
| PAY-04 | Payment amount displayed clearly in UI before transaction | Update price-disclaimer text in UrlForms.tsx from "5 CRC + xDAI gas fee" to "1 HBAR" |
</phase_requirements>

---

## Summary

This phase is a focused migration from Gnosis Chain + Circles SDK to Hedera EVM testnet. The codebase is a React + TypeScript app using ethers.js v6, Bootstrap 5, and SCSS. All existing ethers.js patterns (`BrowserProvider`, `getSigner()`, `new ethers.Contract()`) work as-is on Hedera via the Hashio JSON-RPC relay — Hedera runs standard EVM (Besu engine), so no library changes are needed.

The work falls into five clear buckets: (1) delete the two Circles files and uninstall 5 npm packages, (2) rewrite the Solidity contract to make `createCustomShortUrl` payable with a 1 HBAR minimum check and redeploy on Hedera testnet, (3) swap all chain config (NetworkSwitcher.ts → HederaConfig.ts, .env vars, abi file), (4) rewrite UrlForms.tsx to send `msg.value` instead of calling CRCPaymentProvider and add inline confirmation with HashScan link, and (5) update UI copy and add HashScan column to Dashboard.

The most important Hedera-specific technicalities to get right: (a) HBAR uses 8 decimals natively but the EVM/JSON-RPC layer exposes 18 decimals, so `ethers.parseEther("1")` correctly represents 1 HBAR in Solidity `msg.value`; (b) the Hashio relay may return empty `receipt.logs`, so ShortUrlCreated event parsing needs a `provider.getLogs()` fallback; (c) all write calls must use hardcoded `gasLimit: 400000` because Hedera's gas model differs from EIP-1559.

**Primary recommendation:** Start by deleting Circles code and uninstalling packages to achieve a clean build baseline, then update contract + config, then update UI — in that order.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ethers.js | ^6.14.0 (already installed) | Wallet interaction, contract calls, log parsing | Already in project; works unchanged on Hedera via JSON-RPC relay |
| react-scripts | 5.0.1 (already installed) | Build tooling | Already in project; no changes needed |
| Bootstrap 5 | 5.3.2 CDN (index.html) | UI components | Already in project; keep unchanged |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Hardhat | ^2.x (devDep, not installed) | Deploy updated contract to Hedera testnet | Only needed if deploying via code; Remix IDE is a simpler option for a single contract |
| Remix IDE | browser-based | Deploy & verify contract via MetaMask injection | Simplest for one-off contract deploy to Hedera testnet |

### Packages to REMOVE

```
@circles-sdk/adapter-ethers  ^0.24.0
@circles-sdk/data            ^0.24.0
@circles-sdk/profiles        ^0.24.0
@circles-sdk/sdk             ^0.24.0
@circles-sdk/utils           ^0.24.0
```

**Uninstall command:**
```bash
npm uninstall @circles-sdk/adapter-ethers @circles-sdk/data @circles-sdk/profiles @circles-sdk/sdk @circles-sdk/utils
```
Run from: `C:/xampp/htdocs/hedera_hackathon_2026/prototype/`

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hashio RPC (testnet.hashio.io/api) | QuickNode / Validation Cloud Hedera endpoints | Hashio is free and official but marked beta/testing-only; commercial relays are more stable for production — fine for testnet hackathon use |
| Remix IDE for deploy | Hardhat | Remix requires no config files; Hardhat gives scripted/repeatable deploys but needs hardhat.config.ts setup |

---

## Architecture Patterns

### Current File Structure (what exists)

```
prototype/src/
├── utils/
│   ├── CirclesConfig.ts       <- DELETE, replace with HederaConfig.ts
│   ├── NetworkSwitcher.ts     <- REWRITE (Gnosis → Hedera)
│   └── ethereum.js            <- LEAVE (unused but harmless)
├── contractMethods/
│   └── CRCPaymentProvider.ts  <- DELETE entirely
├── components/
│   ├── UrlForms.tsx            <- MAJOR REWRITE (remove CRC, add HBAR msg.value + inline confirm)
│   ├── Dashboard.tsx           <- UPDATE (add HashScan column, copy-tx-hash button)
│   ├── About.tsx               <- REWRITE content (Gnosis → Hedera)
│   ├── How-it-works.tsx        <- REWRITE content (Gnosis → Hedera)
│   ├── ShortenPage.tsx         <- UPDATE (fix Etherscan link → HashScan)
│   └── misc/
│       ├── Nav.tsx             <- UPDATE (add "Built on Hedera" badge; no Circles refs)
│       └── Footer.tsx          <- UPDATE (add Hedera badge per decision)
│   └── utils/
│       ├── ShowToast.ts        <- REUSE unchanged
│       ├── RedirectPage.tsx    <- UPDATE (swap REACT_APP_INFURA_URL)
│       └── QRModal.tsx         <- REUSE unchanged
├── abi_xDAI.json               <- REPLACE with new Hedera ABI (after redeploying payable contract)
├── App.tsx                     <- LEAVE (routes unchanged)
└── assets/scss/                <- LEAVE (design unchanged)
```

### Pattern 1: Hedera Network Switch

**What:** Replace `switchToGnosis()` in `utils/NetworkSwitcher.ts` with `switchToHedera()` using Hedera testnet parameters.

**Chain config constants (HIGH confidence — verified via official Hedera docs):**
```typescript
// Source: https://docs.hedera.com/hedera/tutorials/smart-contracts/how-to-connect-metamask-to-hedera
export const HEDERA_TESTNET = {
  chainId: '0x128',           // 296 decimal
  chainName: 'Hedera Testnet',
  nativeCurrency: {
    name: 'HBAR',
    symbol: 'HBAR',
    decimals: 18,             // EVM layer uses 18 decimals for tooling compatibility
  },
  rpcUrls: ['https://testnet.hashio.io/api'],
  blockExplorerUrls: ['https://hashscan.io/testnet/'],
};

export async function switchToHedera() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HEDERA_TESTNET.chainId }],
    });
  } catch (err: any) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [HEDERA_TESTNET],
      });
    } else {
      throw err;
    }
  }
}
```

### Pattern 2: HBAR Payment via msg.value

**What:** Custom URL creation sends 1 HBAR as native value — no approval step. The Solidity contract's `createCustomShortUrl` must be `payable` with `require(msg.value >= 1 ether)` (1 ether == 1 HBAR in the EVM layer's 18-decimal context).

**Frontend call (HIGH confidence):**
```typescript
// Source: STATE.md decision + https://docs.hedera.com/hedera/core-concepts/smart-contracts/understanding-hederas-evm-differences-and-compatibility/for-evm-developers-migrating-to-hedera/handling-hbar-transfers-in-contracts
const tx = await contract.createCustomShortUrl(
  customId,
  originalUrl,
  {
    value: ethers.parseEther("1"),  // 1 HBAR = 1e18 wei in Hedera EVM context
    gasLimit: 400000,               // Hardcoded per STATE.md decision
  }
);
```

**Solidity contract change required:**
```solidity
// Before (nonpayable):
function createCustomShortUrl(string memory customId, string memory originalUrl) external { ... }

// After (payable with HBAR check):
function createCustomShortUrl(string memory customId, string memory originalUrl) external payable {
    require(msg.value >= 1 ether, "Payment of 1 HBAR required");
    // existing logic unchanged
}
```

Note: `1 ether` in Solidity on Hedera EVM equals 1e18 weibar, which equals 1 HBAR via the JSON-RPC relay's 18-decimal mapping.

### Pattern 3: receipt.logs Fallback (CRITICAL for Hedera)

**What:** Hedera's JSON-RPC relay has documented cases where `receipt.logs` returns as an empty array even when events were emitted. The fallback is to query logs directly via `provider.getLogs()`.

**Source:** STATE.md decision + known relay behavior documented in Hedera GitHub issues.

```typescript
// Source: STATE.md decision + https://github.com/hiero-ledger/hiero-json-rpc-relay (known issue)
async function parseShortUrlCreated(receipt: ethers.TransactionReceipt, provider: ethers.Provider) {
  const iface = new ethers.Interface(abi);

  // Try receipt.logs first
  let logs = receipt.logs ?? [];

  // Fallback to provider.getLogs if receipt.logs is empty (Hedera relay quirk)
  if (logs.length === 0) {
    logs = await provider.getLogs({
      address: CONTRACT_ADDRESS,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
      topics: [iface.getEvent('ShortUrlCreated')!.topicHash],
    });
  }

  const parsedLog = logs
    .map((log) => {
      try { return iface.parseLog(log); } catch { return null; }
    })
    .find((log) => log?.name === 'ShortUrlCreated');

  return parsedLog?.args?.shortId ?? null;
}
```

### Pattern 4: Inline Confirmation After Link Creation

**What:** After successful transaction, show inline div with tx hash, short link, and HashScan link. Fire a toast in parallel.

```typescript
// After receipt obtained and shortId parsed:
setTxHash(receipt.hash);
setGeneratedShortId(shortId);
ShowToast(`Short link created: ${PROJECT_URL}/#/${shortId}`, 'success');

// In render, inline block:
{txHash && (
  <div className="alert alert-success mt-3">
    <strong>Link created!</strong><br />
    Short URL: <a href={`${PROJECT_URL}/#/${shortId}`}>{`${PROJECT_URL}/#/${shortId}`}</a><br />
    <a href={`https://hashscan.io/testnet/transaction/${txHash}`}
       target="_blank" rel="noopener noreferrer">
      View on HashScan
    </a>
  </div>
)}
```

### Pattern 5: Dashboard HashScan Column

**What:** Add a new table column to Dashboard.tsx for each link's creation transaction. The dashboard currently has no txHash stored per link — links come from `contract.getUserLinks(address)` which only returns shortIds. The Dashboard cannot retrospectively get txHash from the contract alone (no on-chain txHash storage).

**Resolution:** The HashScan link in dashboard should link to the contract address on HashScan (shows all txs for that contract) OR the user can look up via shortId. Alternatively, store txHash in component state during creation in the same session and display it only then. For the dashboard (persistent view), link to HashScan contract view:

```typescript
// HashScan link for a link's transactions — per CONTEXT.md: "small HashScan icon per link, linking to its creation transaction"
// Since we cannot retrieve the creation txHash from contract state, use the filter-by-topic approach:
// https://hashscan.io/testnet/transaction/{txHash} — only available if txHash is stored
// Pragmatic approach: store txHash in localStorage keyed by shortId on creation, read it back in dashboard
```

**Important:** Store creation tx hashes in `localStorage` keyed by shortId so Dashboard can display HashScan links across sessions.

### Pattern 6: HederaConfig.ts Replacement

**What:** `utils/CirclesConfig.ts` (deleted) is replaced by `utils/HederaConfig.ts` containing Hedera constants. `CRCPaymentProvider.ts` is deleted without replacement.

```typescript
// utils/HederaConfig.ts
export const HEDERA_CHAIN_ID = 296;
export const HEDERA_CHAIN_ID_HEX = '0x128';
export const HEDERA_RPC_URL = process.env.REACT_APP_HEDERA_RPC_URL as string;
export const HEDERA_EXPLORER_URL = 'https://hashscan.io/testnet';

export function getHashScanTxUrl(txHash: string): string {
  return `${HEDERA_EXPLORER_URL}/transaction/${txHash}`;
}
```

### Anti-Patterns to Avoid

- **Using `estimateGas` on Hedera write calls:** Hedera gas estimation via JSON-RPC relay can be unreliable for state-changing calls. Use hardcoded `gasLimit: 400000` on all writes.
- **Assuming `receipt.logs` is populated:** Always implement the `provider.getLogs()` fallback (Pattern 3 above).
- **Using `ethers.parseUnits("1", 8)` for 1 HBAR:** Wrong — the EVM relay uses 18 decimals. Use `ethers.parseEther("1")` which gives 1e18, correctly representing 1 HBAR via the relay.
- **Importing from `@circles-sdk/*` in any file:** All 5 packages must be removed from package.json; any stray import will break the build.
- **Keeping `CRC_PAYMENT_RECEIVER` or `sendV2GroupCRC` references:** These are Circles-specific and will be dead code after SDK removal — delete them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MetaMask chain switching | Custom network detection logic | `wallet_switchEthereumChain` + `wallet_addEthereumChain` (already done in NetworkSwitcher.ts) | MetaMask API handles the UX natively |
| Log parsing from receipt | Custom ABI decoder | `ethers.Interface.parseLog()` (already in codebase) | ethers handles ABI encoding edge cases |
| Toast notifications | Custom toast component | Existing `ShowToast()` util | Already exists; just update message wording |
| URL validation | Custom regex | Existing `new URL(string)` try/catch in UrlForms.tsx | Already exists |
| QR code display | Canvas QR lib | Existing `QRCodeCanvas` from `qrcode.react` | Already exists |

**Key insight:** This is a migration, not a new build. The existing ethers.js + React patterns are fully reusable on Hedera.

---

## Common Pitfalls

### Pitfall 1: HBAR Decimal Confusion

**What goes wrong:** Developer uses `ethers.parseUnits("1", 8)` (tinybar-thinking) or `BigInt(100000000)` instead of `ethers.parseEther("1")`. This sends 10^8 weibar instead of 10^18 weibar, which is 0.0000000001 HBAR — the contract's `msg.value >= 1 ether` check fails.

**Why it happens:** HBAR natively has 8 decimals (1 HBAR = 100,000,000 tinybars). Developers familiar with Hedera SDK math apply this to the EVM layer.

**How to avoid:** The Hedera JSON-RPC relay exposes 18 decimals for full EVM tooling compatibility. Use `ethers.parseEther("1")` for 1 HBAR. In Solidity, `1 ether` == 1 HBAR via the relay.

**Source:** https://docs.hedera.com/hedera/core-concepts/smart-contracts/understanding-hederas-evm-differences-and-compatibility/for-evm-developers-migrating-to-hedera/decimal-handling-8-vs.-18-decimals

### Pitfall 2: Empty receipt.logs After Contract Event

**What goes wrong:** `receipt.logs` is an empty array `[]` even though the `ShortUrlCreated` event was emitted. Code that does `receipt.logs.find(...)` returns `undefined`, `shortId` is null, creation confirmation silently fails.

**Why it happens:** The Hashio JSON-RPC relay has a known timing/indexing issue where `eth_getTransactionReceipt` can return before Mirror Node has indexed the logs. Multiple GitHub issues confirm this behavior.

**How to avoid:** Implement the `provider.getLogs()` fallback immediately (Pattern 3). Never access `receipt.logs` without a null/empty guard.

**Warning signs:** `parsedLog` is `undefined` or `null` after successful transaction.

### Pitfall 3: gasLimit Omission on Write Calls

**What goes wrong:** Without an explicit `gasLimit`, ethers.js calls `eth_estimateGas` on the Hedera relay. For payable functions with HBAR, gas estimation can fail or return 0, causing the transaction to fail at the wallet prompt.

**Why it happens:** Hedera gas model differs from EIP-1559 Ethereum; the relay's `estimateGas` implementation has known quirks with payable functions.

**How to avoid:** Pass `gasLimit: 400000` on every state-changing contract call. This is a locked decision in STATE.md.

### Pitfall 4: Stale ABI After Contract Redeployment

**What goes wrong:** After deploying the updated payable contract to Hedera testnet, developer forgets to update `abi_xDAI.json` with the new ABI. The `createCustomShortUrl` entry still shows `stateMutability: "nonpayable"`, causing ethers.js to silently strip the `value` parameter.

**Why it happens:** ABI is separate from deployment — deploying a new contract doesn't auto-update the JSON file.

**How to avoid:** After compiling the updated Solidity contract, copy the compiled ABI JSON. Rename to `abi_hedera.json` and update all imports. Update `CONTRACT_ADDRESS` in `.env` to the new deployed address.

### Pitfall 5: Build Fails Due to Circles SDK Peer Dependencies

**What goes wrong:** After `npm uninstall @circles-sdk/*`, build still fails because another package depends on a circles-sdk package, or because TypeScript is finding an import in a cached file.

**Why it happens:** npm peer dependency resolution or TypeScript incremental compilation cache.

**How to avoid:** After uninstalling, run `npm install` to rebuild lockfile. Delete `node_modules/.cache` if build errors persist. Verify with `npm ls @circles-sdk/sdk` returns empty.

### Pitfall 6: Dashboard Lacks Per-Link txHash

**What goes wrong:** Dashboard is built from `contract.getUserLinks()` which only returns shortIds, not transaction hashes. The per-link HashScan icon has nothing to link to.

**Why it happens:** The contract stores URL mapping but not creation transaction hashes.

**How to avoid:** Store creation txHash in `localStorage` on link creation (keyed by shortId). Dashboard reads `localStorage` to retrieve txHash for HashScan links. Links created before this change show no HashScan icon (graceful fallback).

---

## Code Examples

### Updated .env

```bash
# Source: confirmed config values from official Hedera docs
REACT_APP_PROJECT_URL=http://localhost:3000
REACT_APP_HEDERA_RPC_URL=https://testnet.hashio.io/api
REACT_APP_CONTRACT_ADDRESS=<new_hedera_testnet_contract_address>
REACT_APP_CHAIN_ID=296
REACT_APP_EXPLORER_URL=https://hashscan.io/testnet
```

### Updated Solidity Contract Signature

```solidity
// Source: STATE.md + https://docs.hedera.com/hedera/core-concepts/smart-contracts/understanding-hederas-evm-differences-and-compatibility/for-evm-developers-migrating-to-hedera/handling-hbar-transfers-in-contracts
function createCustomShortUrl(
    string memory customId,
    string memory originalUrl
) external payable {
    require(msg.value >= 1 ether, "Payment of 1 HBAR required");
    require(!_shortIdExists(customId), "Short ID already taken");
    // ... rest of existing logic unchanged
}
```

### UrlForms.tsx: Custom URL Submit (Hedera version)

```typescript
// Custom URL path — replaces entire CRC flow
setStatus('Switching to Hedera...');
await switchToHedera();

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

const customId = shortUrl.slice(1);
const exists = await contract.shortIdExists(customId);
if (exists) { setShortUrlExistsError(true); return; }

setStatus('Confirm transaction in MetaMask (1 HBAR)...');
const tx = await contract.createCustomShortUrl(
  customId,
  originalUrl,
  {
    value: ethers.parseEther("1"),  // 1 HBAR
    gasLimit: 400000,
  }
);
const receipt = await tx.wait();
const shortId = await parseShortUrlCreated(receipt, provider);

// Store txHash for dashboard
localStorage.setItem(`txHash_${shortId}`, receipt.hash);

setTxHash(receipt.hash);
setGeneratedShortId(shortId);
setStatus('Confirmed in block ' + receipt.blockNumber);
ShowToast(`Link created! View on HashScan`, 'success');
```

### UrlForms.tsx: Random URL Submit (Hedera version)

```typescript
// Random URL path — simpler, no payment
setStatus('Switching to Hedera...');
await switchToHedera();

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

setStatus('Sending to blockchain...');
const tx = await contract.generateShortUrl(
  originalUrl,
  { gasLimit: 400000 }
);
const receipt = await tx.wait();
const shortId = await parseShortUrlCreated(receipt, provider);

localStorage.setItem(`txHash_${shortId}`, receipt.hash);
setTxHash(receipt.hash);
setGeneratedShortId(shortId);
setStatus('Confirmed in block ' + receipt.blockNumber);
ShowToast(`Link created!`, 'success');
```

### Dashboard.tsx: HashScan Column Addition

```typescript
// In table header:
<th>HashScan</th>

// In table row:
<td className="text-center">
  {(() => {
    const txHash = localStorage.getItem(`txHash_${link.shortId}`);
    return txHash ? (
      <a
        href={`https://hashscan.io/testnet/transaction/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-sm btn-outline-light"
        title="View on HashScan"
      >
        <i className="fas fa-external-link-alt" />
      </a>
    ) : <span className="text-muted small">—</span>;
  })()}
</td>

// Copy tx hash button (alongside existing copy-link button):
{(() => {
  const txHash = localStorage.getItem(`txHash_${link.shortId}`);
  return txHash ? (
    <button
      className="btn btn-sm btn-outline-light"
      onClick={() => { navigator.clipboard.writeText(txHash); ShowToast('Tx hash copied', 'success'); }}
      title="Copy tx hash"
    >
      <i className="fas fa-hashtag" />
    </button>
  ) : null;
})()}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gnosis Chain (chain ID 100) | Hedera testnet (chain ID 296) | Phase 1 | All chain config, network switching |
| CRC token payment via @circles-sdk | Native HBAR via msg.value | Phase 1 | Simpler UX, no approval step |
| GnosisScan explorer links | HashScan explorer links | Phase 1 | All txHash links in UI |
| Infura/Gnosis RPC for read-only provider | Hashio JSON-RPC relay | Phase 1 | RedirectPage.tsx and .env |
| `createCustomShortUrl` nonpayable | `createCustomShortUrl` payable | Phase 1 | Contract + ABI must be updated |

**Deprecated/outdated:**
- `utils/CirclesConfig.ts`: Gnosis/Circles config — delete entirely
- `contractMethods/CRCPaymentProvider.ts`: CRC payment flow — delete entirely
- `abi_xDAI.json`: Replace with Hedera ABI after contract redeployment
- `REACT_APP_INFURA_URL` env var: Rename to `REACT_APP_HEDERA_RPC_URL`

---

## File-by-File Change Inventory

A complete map of every file that needs to change and what changes are required:

| File | Action | What Changes |
|------|--------|--------------|
| `prototype/src/utils/CirclesConfig.ts` | DELETE | Entire file — no replacement needed (functionality moved to HederaConfig.ts) |
| `prototype/src/contractMethods/CRCPaymentProvider.ts` | DELETE | Entire file — no replacement (payment is now msg.value) |
| `prototype/src/utils/NetworkSwitcher.ts` | REWRITE | Replace `switchToGnosis()` with `switchToHedera()` using Hedera testnet config |
| `prototype/src/utils/HederaConfig.ts` | CREATE NEW | Hedera chain constants and `getHashScanTxUrl()` helper |
| `prototype/src/components/UrlForms.tsx` | MAJOR REWRITE | Remove all CRC/Circles imports and logic; add HBAR msg.value payment; add inline confirmation block with HashScan link; update price text to "1 HBAR"; add receipt.logs fallback |
| `prototype/src/components/Dashboard.tsx` | UPDATE | Add HashScan column (from localStorage txHash); add copy-txhash button; import `getHashScanTxUrl` |
| `prototype/src/components/About.tsx` | REWRITE CONTENT | Replace all Gnosis/CRC/xDAI copy with Hedera/HBAR content |
| `prototype/src/components/How-it-works.tsx` | REWRITE CONTENT | Replace Gnosis Chain references with Hedera; update payment description to "1 HBAR" |
| `prototype/src/components/ShortenPage.tsx` | UPDATE | Fix `https://sepolia.etherscan.io/tx/...` link to HashScan format; update subtitle "Powered by Circles" → "Powered by Hedera" |
| `prototype/src/components/misc/Nav.tsx` | UPDATE | Add "Built on Hedera" badge (text or logo) in nav/footer area; no functional changes |
| `prototype/src/components/misc/Footer.tsx` | UPDATE | Add "Built on Hedera" badge per locked decision |
| `prototype/src/components/utils/RedirectPage.tsx` | UPDATE | Replace `REACT_APP_INFURA_URL` with `REACT_APP_HEDERA_RPC_URL` |
| `prototype/src/abi_xDAI.json` | REPLACE | After redeploying contract with payable createCustomShortUrl; rename file to `abi_hedera.json` and update all imports |
| `prototype/.env` | UPDATE | Rename `REACT_APP_INFURA_URL` → `REACT_APP_HEDERA_RPC_URL`; update `REACT_APP_CONTRACT_ADDRESS` to deployed Hedera address; add `REACT_APP_EXPLORER_URL` |
| `prototype/public/index.html` | UPDATE | Update meta description/keywords to mention Hedera instead of Gnosis/Web3 generic |
| `prototype/package.json` | UPDATE | Remove 5 @circles-sdk packages after npm uninstall |

---

## Open Questions

1. **Where is the existing Solidity contract source code?**
   - What we know: `abi_xDAI.json` exists and shows the ABI. No `.sol` file found in the prototype directory.
   - What's unclear: The original source Solidity file for modification.
   - Recommendation: The planner should include a task to either (a) reconstruct the Solidity from the ABI, or (b) assume the developer has the contract source externally. The contract logic is simple enough to reconstruct from the ABI + keccak256 random URL pattern.

2. **Does `shortIdExists` function exist in the deployed contract?**
   - What we know: `abi_xDAI.json` includes `shortIdExists` function. The new Hedera contract needs to include it too.
   - What's unclear: Whether the developer will reuse the same Solidity source or write fresh.
   - Recommendation: Ensure `shortIdExists` is in the redeployed Hedera contract ABI.

3. **Will Hashio relay empty-logs issue affect every transaction or only sometimes?**
   - What we know: Known relay behavior; recommended to always implement fallback.
   - What's unclear: Frequency — might work 95% of the time and fail 5%.
   - Recommendation: Implement fallback regardless — it's a low-cost guard.

---

## Sources

### Primary (HIGH confidence)

- https://docs.hedera.com/hedera/tutorials/smart-contracts/how-to-connect-metamask-to-hedera — MetaMask Hedera testnet config (chainId 0x128, RPC, HBAR decimals)
- https://docs.hedera.com/hedera/core-concepts/smart-contracts/understanding-hederas-evm-differences-and-compatibility/for-evm-developers-migrating-to-hedera/decimal-handling-8-vs.-18-decimals — HBAR 18-decimal EVM compatibility confirmed
- https://docs.hedera.com/hedera/core-concepts/smart-contracts/understanding-hederas-evm-differences-and-compatibility/for-evm-developers-migrating-to-hedera/handling-hbar-transfers-in-contracts — msg.value HBAR transfer patterns
- https://docs.hedera.com/hedera/core-concepts/smart-contracts/gas-and-fees — Gas model, 15M per-tx cap, time-based throttling
- Direct codebase inspection: all files in `prototype/src/` — imports, component logic, .env vars

### Secondary (MEDIUM confidence)

- https://chainlist.org/chain/296 — Hedera testnet chain ID 296 / 0x128 confirmed
- https://docs.hedera.com/hedera/getting-started-evm-developers/deploy-a-smart-contract-with-hardhat — Hardhat config for Hedera testnet
- STATE.md decisions — gasLimit: 400000, receipt.logs fallback, grep-first migration order
- https://github.com/hiero-ledger/hiero-json-rpc-relay — Relay implementation with known receipt issues

### Tertiary (LOW confidence)

- https://github.com/hashgraph/hedera-json-rpc-relay/issues/371 — `eth_getTransactionByHash` null result issue (historical, may be resolved)
- Community reports of empty receipt.logs — multiple dev forum mentions, no single authoritative source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — ethers.js v6 + React already in project; no new libraries needed
- Hedera chain config: HIGH — chain ID, RPC URL, MetaMask config verified via official Hedera docs
- HBAR decimal handling: HIGH — explicitly documented in official Hedera EVM migration guide
- receipt.logs fallback: MEDIUM — behavior documented in issues but frequency unconfirmed
- Architecture patterns: HIGH — derived from direct codebase analysis + established ethers.js v6 API
- Pitfalls: HIGH (decimal, gasLimit, ABI staleness) / MEDIUM (relay empty logs frequency)

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (Hedera testnet config is stable; Hashio relay behavior may change)
