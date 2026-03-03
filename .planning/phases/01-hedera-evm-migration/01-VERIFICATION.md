---
phase: 01-hedera-evm-migration
verified: 2026-03-03T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Create a custom short URL on Hedera testnet and confirm 1 HBAR is deducted from MetaMask"
    expected: "MetaMask prompts for 1 HBAR + gas, tx confirms, inline alert-success shows short URL and HashScan link"
    why_human: "Cannot programmatically trigger a live MetaMask transaction or verify on-chain state without a funded wallet"
  - test: "Create a random short URL and confirm it is free (no HBAR deducted beyond gas)"
    expected: "MetaMask prompts for gas only, tx confirms, short URL appears in inline confirmation"
    why_human: "Requires live Hedera testnet interaction and funded MetaMask wallet"
  - test: "Load the Dashboard and verify the HashScan column shows per-link icons for links that have stored txHashes in localStorage"
    expected: "HashScan icon opens hashscan.io/testnet/transaction/{txHash}, copy button copies the hash with toast"
    why_human: "Requires browser localStorage state populated from prior URL creation"
  - test: "Navigate to a short URL (e.g. http://localhost:5000/#/custom-link) and verify redirect works via Hedera RPC"
    expected: "Page briefly shows 'Redirecting...' then navigates to the original URL"
    why_human: "Requires live Hedera testnet contract read via Hashio RPC"
---

# Phase 1: Hedera EVM Migration Verification Report

**Phase Goal:** DURL's full feature set works on Hedera testnet with HBAR payments and no Circles/Gnosis residue
**Verified:** 2026-03-03
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MetaMask prompts to switch to Hedera testnet (chain ID 296) when on wrong network; all explorer links open hashscan.io/testnet | VERIFIED | `NetworkSwitcher.ts` uses `wallet_switchEthereumChain` with `HEDERA_CHAIN_ID_HEX = '0x128'` (296 dec); `wallet_addEthereumChain` fallback configures Hashio RPC + HashScan explorer. All UI components use `getHashScanTxUrl()`. Zero GnosisScan/Etherscan references found across entire `prototype/src/`. |
| 2 | A user can create a random short URL for free — transaction confirms on Hedera EVM and resulting HashScan link is valid | VERIFIED | `UrlForms.tsx` line 117–120: `contract.generateShortUrl(originalUrl, { gasLimit: 400000 })` with no `value`. `parseShortUrlCreated()` with `provider.getLogs()` fallback extracts shortId. Inline `alert-success` block renders HashScan link via `getHashScanTxUrl(txHash)`. Price disclaimer shows "Cost: Free (gas fee only)". |
| 3 | A user can create a custom short URL by paying 1 HBAR — payment goes through without a token approval step and link is confirmed on-chain | VERIFIED | `UrlForms.tsx` line 95–99: `contract.createCustomShortUrl(customId, originalUrl, { value: ethers.parseEther('1'), gasLimit: 400000 })`. No `approve()` or `allowance()` calls anywhere in `prototype/src/`. ABI confirms `createCustomShortUrl` has `"stateMutability": "payable"`. |
| 4 | Codebase has zero Circles SDK imports, no @circles-sdk npm packages installed, build compiles cleanly | VERIFIED | `CirclesConfig.ts` DELETED. `CRCPaymentProvider.ts` DELETED. `abi_xDAI.json` DELETED. `contractMethods/` directory DELETED. `grep -ri "circles|@circles-sdk|..."` across all `prototype/src/*.ts|*.tsx` returns zero results. `package.json` has no `@circles-sdk` entries. |
| 5 | Contract reads and writes use hardcoded gasLimit and handle empty receipt.logs without throwing | VERIFIED | All writes: custom URL uses `{ value: ethers.parseEther('1'), gasLimit: 400000 }` (line 98); random URL uses `{ gasLimit: 400000 }` (line 119). `parseShortUrlCreated()` (lines 39–63) implements `provider.getLogs()` fallback when `receipt.logs.length === 0`. |

**Score:** 5/5 truths verified

---

### Required Artifacts

#### Plan 01-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prototype/src/utils/HederaConfig.ts` | Hedera chain constants and HashScan URL helpers | VERIFIED | Exports `HEDERA_CHAIN_ID` (296), `HEDERA_CHAIN_ID_HEX` ('0x128'), `HEDERA_RPC_URL`, `HEDERA_EXPLORER_URL`, `getHashScanTxUrl`, `getHashScanContractUrl`. All 6 exports present. |
| `prototype/src/utils/NetworkSwitcher.ts` | MetaMask network switching for Hedera testnet | VERIFIED | Exports `switchToHedera()`. Uses `wallet_switchEthereumChain` + `wallet_addEthereumChain` (error code 4902) with full Hedera testnet config: chainId `0x128`, HBAR currency, 18 decimals, Hashio RPC, HashScan explorer. |
| `prototype/src/abi_hedera.json` | Smart contract ABI (renamed from abi_xDAI.json) | VERIFIED | File exists. Contains full ABI including `createCustomShortUrl` with `"stateMutability": "payable"`, `generateShortUrl` with `"stateMutability": "nonpayable"`, all read functions, `ShortUrlCreated` event, and `receive()` payable. |

#### Plan 01-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prototype/contracts/DURLShortener.sol` | Updated Solidity contract with payable createCustomShortUrl | VERIFIED | Exists at 74 lines. `createCustomShortUrl` has `external payable` modifier with `require(msg.value >= 1 ether)`. `generateShortUrl` is nonpayable. All ABI functions present. |
| `prototype/src/abi_hedera.json` | Updated ABI with createCustomShortUrl as payable | VERIFIED | `"stateMutability": "payable"` confirmed at line 49. Contract deployed at `0x51A7C192eCCc7Cd93FBE56F472627998E231D9CC` (address in `.env`). |
| `prototype/src/components/UrlForms.tsx` | Hedera URL form with HBAR payment, inline confirmation, receipt.logs fallback | VERIFIED | Full implementation: `parseShortUrlCreated()` with `provider.getLogs()` fallback, 1 HBAR payment, gasLimit 400000, localStorage txHash storage, inline `alert-success` confirmation, price disclaimer, `ShowToast` calls, zero CRC/Circles/Gnosis references. |

#### Plan 01-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prototype/src/components/Dashboard.tsx` | Dashboard with HashScan column and copy-tx-hash button | VERIFIED | 5-column table: Short link, Original URL, Actions, Visits, HashScan. HashScan column uses `localStorage.getItem('txHash_${shortId}')`. Link opens `getHashScanTxUrl(txHash)`. Copy button uses `navigator.clipboard.writeText(txHash)` + toast. Graceful `--` fallback for links without stored txHash. |
| `prototype/src/components/About.tsx` | About page with Hedera content | VERIFIED | References Hedera (3 times), HashScan, Hedera EVM, 1 HBAR cost. Zero Gnosis/CRC/xDAI references. |
| `prototype/src/components/How-it-works.tsx` | How it works page with Hedera content | VERIFIED | References "Hedera's EVM-compatible network", "1 HBAR payment", "Hedera's JSON-RPC relay". Zero Gnosis/CRC references. |
| `prototype/src/components/ShortenPage.tsx` | Shorten page with HashScan link and Hedera subtitle | VERIFIED | Subtitle: "Trustless. On-chain. Powered by Hedera." HashScan link via `getHashScanTxUrl`. Zero legacy chain references. |
| `prototype/src/components/misc/Nav.tsx` | Nav with Hedera badge | VERIFIED | `<span className="badge bg-secondary ms-2 small" style={{ fontSize: '0.65rem' }}>Built on Hedera</span>` at line 45. |
| `prototype/src/components/misc/Footer.tsx` | Footer with Hedera badge | VERIFIED | `<p className="small mt-1">Built on <a ... href="https://hedera.com" ...>Hedera</a></p>` at line 15. |
| `prototype/public/index.html` | Updated meta tags mentioning Hedera | VERIFIED | description, keywords, og:description, twitter:description all reference Hedera. Keywords include HBAR and HashScan. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `NetworkSwitcher.ts` | MetaMask wallet_switchEthereumChain / wallet_addEthereumChain | `window.ethereum.request` with chainId `0x128` | WIRED | Pattern `chainId.*0x128` confirmed at line 7 (switch) and line 15 (add). Imports `HEDERA_CHAIN_ID_HEX` from `HederaConfig`. |
| `RedirectPage.tsx` | REACT_APP_HEDERA_RPC_URL | `ethers.JsonRpcProvider` | WIRED | Line 7: `const HEDERA_RPC_URL = process.env.REACT_APP_HEDERA_RPC_URL as string;` Line 19: `new ethers.JsonRpcProvider(HEDERA_RPC_URL)`. |
| `UrlForms.tsx` | `abi_hedera.json` | `import abi` | WIRED | Line 3: `import abi from '../abi_hedera.json'`. ABI used for `ethers.Contract` and `ethers.Interface` instantiation. |
| `UrlForms.tsx` | Smart contract createCustomShortUrl | `ethers.Contract` call with `{ value: ethers.parseEther('1'), gasLimit: 400000 }` | WIRED | Line 95–99: exact pattern match. |
| `UrlForms.tsx` | `HederaConfig.ts` | `import getHashScanTxUrl` | WIRED | Line 6: `import { getHashScanTxUrl } from 'utils/HederaConfig'`. Used at line 243 in JSX. |
| `UrlForms.tsx` | localStorage | `localStorage.setItem` for txHash persistence | WIRED | Lines 107 and 128: `localStorage.setItem(\`txHash_${shortId}\`, receipt.hash)` in both custom and random branches. |
| `Dashboard.tsx` | localStorage txHash | `localStorage.getItem` for per-link HashScan URL | WIRED | Line 191: `localStorage.getItem(\`txHash_${link.shortId}\`)`. |
| `Dashboard.tsx` | `HederaConfig.ts` | `import getHashScanTxUrl` | WIRED | Line 6: import present. Line 196: used in `href={getHashScanTxUrl(txHash)}`. |
| `ShortenPage.tsx` | hashscan.io | Explorer link in confirmation area | WIRED | Line 99: `<a href={getHashScanTxUrl(txHash)} ...>View on HashScan</a>`. Note: ShortenPage's own `txHash` state is never populated (no callback from UrlForms), so this block is dead code — but UrlForms has its own complete inline confirmation block that is live. This is a warning-level observation, not a blocker. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MIGR-01 | 01-01 | Chain config updated to Hedera testnet (chain ID 296, Hashio RPC) | SATISFIED | `HederaConfig.ts`: `HEDERA_CHAIN_ID = 296`, `HEDERA_RPC_URL` from env. `.env`: `REACT_APP_HEDERA_RPC_URL=https://testnet.hashio.io/api`, `REACT_APP_CHAIN_ID=296`. |
| MIGR-02 | 01-01 | MetaMask network switching uses Hedera testnet config | SATISFIED | `NetworkSwitcher.ts`: `wallet_switchEthereumChain` + `wallet_addEthereumChain` with chainId `0x128`, chainName 'Hedera Testnet', HBAR currency, Hashio RPC, HashScan explorer. |
| MIGR-03 | 01-03 | All explorer links point to HashScan (hashscan.io/testnet) | SATISFIED | `getHashScanTxUrl` used in Dashboard, UrlForms, ShortenPage. Zero GnosisScan/Etherscan references in any UI file. |
| MIGR-04 | 01-01 | Environment variables updated for Hedera | SATISFIED | `.env` has `REACT_APP_HEDERA_RPC_URL`, `REACT_APP_CHAIN_ID=296`, `REACT_APP_EXPLORER_URL=https://hashscan.io/testnet`. `REACT_APP_INFURA_URL` removed. |
| MIGR-05 | 01-01 | Read-only provider uses Hedera testnet RPC | SATISFIED | `RedirectPage.tsx` line 19: `new ethers.JsonRpcProvider(HEDERA_RPC_URL)` where `HEDERA_RPC_URL = process.env.REACT_APP_HEDERA_RPC_URL`. |
| CIRC-01 | 01-01 | All Circles SDK imports and code removed | SATISFIED | `grep -ri "circles|@circles-sdk|CirclesConfig|CRCPayment"` across `prototype/src/` returns zero results. |
| CIRC-02 | 01-01 | All 5 @circles-sdk npm packages uninstalled | SATISFIED | `package.json` has no `@circles-sdk` entries. |
| CIRC-03 | 01-01 | CirclesConfig.ts replaced with HederaConfig.ts | SATISFIED | `CirclesConfig.ts` DELETED. `HederaConfig.ts` EXISTS with Hedera-specific exports. `contractMethods/` directory DELETED. |
| CIRC-04 | 01-02 | CRC token balance display and approval UI removed | SATISFIED | No `approve()`, `allowance()`, or CRC token UI anywhere in `prototype/src/`. UrlForms uses native HBAR payment (`msg.value`). |
| CIRC-05 | 01-01 | CRCPaymentProvider.ts deleted or fully replaced | SATISFIED | `CRCPaymentProvider.ts` DELETED. `contractMethods/` directory DELETED. |
| CONT-01 | 01-02 | Custom link function is payable, checks msg.value >= 1 HBAR | SATISFIED | `DURLShortener.sol` line 37: `external payable`. Line 38: `require(msg.value >= 1 ether, "Payment of 1 HBAR required")`. ABI: `"stateMutability": "payable"`. |
| CONT-02 | 01-02 | Random link generation (keccak256) works unchanged on Hedera EVM | SATISFIED | `DURLShortener.sol` lines 20–32: `generateShortUrl` uses `keccak256(abi.encodePacked(msg.sender, originalUrl, block.timestamp))` — chain-agnostic, works on any EVM including Hedera. |
| CONT-03 | 01-02 | Contract compiles and deploys on Hedera testnet | SATISFIED | Contract deployed at `0x51A7C192eCCc7Cd93FBE56F472627998E231D9CC` (per `.env` and SUMMARY). Human-confirmed deployment step in 01-02. |
| CONT-04 | 01-02, 01-03 | All contract calls use hardcoded gasLimit | SATISFIED | Custom URL: `{ value: ethers.parseEther('1'), gasLimit: 400000 }`. Random URL: `{ gasLimit: 400000 }`. Dashboard performs read-only calls (view functions via eth_call) which do not require gasLimit. |
| CONT-05 | 01-02 | Transaction receipt parsing has fallback for empty receipt.logs | SATISFIED | `parseShortUrlCreated()` in UrlForms.tsx lines 39–63: checks `logs.length === 0` then calls `provider.getLogs()` with block number and ShortUrlCreated topic hash. |
| PAY-01 | 01-02 | Custom link creation sends 1 HBAR as msg.value | SATISFIED | `UrlForms.tsx` line 98: `{ value: ethers.parseEther('1'), gasLimit: 400000 }`. `ethers.parseEther('1')` = 1e18 wei = 1 HBAR on Hedera EVM 18-decimal mapping. |
| PAY-02 | 01-02 | No token approval step needed | SATISFIED | Native HBAR payment via `msg.value`. No ERC-20 approve/allowance anywhere in codebase. |
| PAY-03 | 01-02 | Random link creation remains free | SATISFIED | `UrlForms.tsx` line 117–120: `contract.generateShortUrl(originalUrl, { gasLimit: 400000 })` — no `value` field. `generateShortUrl` is `nonpayable` in ABI. Price disclaimer: "Cost: Free (gas fee only)". |
| PAY-04 | 01-02 | Payment amount displayed clearly in UI before transaction | SATISFIED | `UrlForms.tsx` lines 221–225: `<div className="price-disclaimer small mt-3">` shows "Cost: 1 HBAR + gas fee" for custom mode, "Cost: Free (gas fee only)" for random mode. |

**Requirements Coverage: 19/19 SATISFIED**

No orphaned requirements found. All 19 Phase 1 requirements (MIGR-01 through PAY-04) are claimed in plans and verified in code.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ShortenPage.tsx` | 16–18, 97–123 | `txHash`, `status`, `generatedShortId` state declared but never populated (UrlForms is rendered as `<UrlForms />` with no callback props to pass results back up) | Warning | ShortenPage's own confirmation/QR display block (lines 97–123) is dead code — it will never render. UrlForms has its own complete inline confirmation block that functions correctly. No user-facing impact. |
| `RedirectPage.tsx` | 44 | `fetch('http://localhost:5001/track', ...)` — hardcoded `localhost:5001` for analytics | Info | Analytics call is in a `try/catch` that silently ignores failures. No functional impact on redirect. Will silently fail in production. |

**Blockers:** 0
**Warnings:** 1 (dead code in ShortenPage — no user impact, UrlForms handles confirmation)
**Info:** 1 (localhost analytics URL)

---

### Human Verification Required

### 1. End-to-end Custom URL Creation with 1 HBAR Payment

**Test:** Open app at localhost:5000, connect MetaMask on Hedera Testnet (chain ID 296), enter a URL, switch to Custom URL tab, enter a slug, submit form
**Expected:** MetaMask prompts for transaction with 1 HBAR value + gas; after confirmation, inline alert-success appears with short URL link and "View on HashScan" link pointing to hashscan.io/testnet
**Why human:** Requires funded MetaMask wallet, live Hedera testnet connection, and real transaction execution

### 2. End-to-end Random URL Creation (Free)

**Test:** Use Random tab, enter a URL, submit form
**Expected:** MetaMask prompts for gas only (no HBAR value), tx confirms, short URL shown in inline confirmation with HashScan link
**Why human:** Requires live Hedera testnet interaction

### 3. Dashboard HashScan Column Functionality

**Test:** After creating at least one URL, navigate to Dashboard; verify HashScan column appears with icon for newly created links
**Expected:** HashScan icon links open hashscan.io/testnet/transaction/{txHash}; copy button copies the tx hash with "Tx hash copied!" toast; links without stored txHash show "--"
**Why human:** Requires browser localStorage state from prior URL creation, visual inspection

### 4. Short URL Redirect via Hedera RPC

**Test:** Navigate to http://localhost:5000/#/{shortId} for a known short link
**Expected:** Page shows "Redirecting..." briefly, then navigates to the original URL; resolution reads from Hedera testnet via Hashio RPC
**Why human:** Requires deployed contract with data and live Hedera testnet connectivity

---

### Gaps Summary

No gaps. All 19 Phase 1 requirements are satisfied, all 5 success criteria are verified in code, all artifacts exist with substantive implementations, and all key links are wired. The one warning (dead state in ShortenPage) has no user-facing impact as UrlForms manages its own confirmation display independently.

The only items requiring human verification are live testnet interactions that cannot be verified programmatically.

---

_Verified: 2026-03-03_
_Verifier: Claude (gsd-verifier)_
