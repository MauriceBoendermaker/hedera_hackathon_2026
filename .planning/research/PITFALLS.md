# Domain Pitfalls

**Domain:** Hedera EVM migration — Gnosis Chain dApp to Hedera testnet
**Project:** DURL — Decentralized URL Shortener
**Researched:** 2026-03-02
**Confidence:** MEDIUM — core Hedera EVM facts from training data (Aug 2025 cutoff); Hedera docs not directly fetched due to environment restrictions. Flag for live verification before implementation.

---

## Critical Pitfalls

Mistakes that cause rewrites, demo failures, or hours of debugging.

---

### Pitfall 1: Assuming Hedera EVM Gas Model Matches Ethereum

**What goes wrong:** Smart contracts that work on Gnosis Chain silently fail or revert on Hedera EVM because Hedera uses a fixed USD-pegged gas pricing model, not a fee market (EIP-1559). Gas limits that work on Ethereum/Gnosis may be rejected or hit Hedera's per-transaction gas ceiling.

**Why it happens:** Hedera's gas is priced in tinybars and has a network-enforced maximum gas-per-transaction limit (15,000,000 gas per transaction as of 2024 docs). The HBAR cost of gas is set by the Hedera Fee Schedule, not a dynamic baseFee. MetaMask and ethers.js compute gasPrice and gasLimit using standard EIP-1559 logic, which can produce estimates incompatible with Hedera's relay.

**Consequences:**
- Transactions silently drop or return unhelpful errors ("INSUFFICIENT_GAS", "CONTRACT_REVERT_EXECUTED")
- ethers.js `estimateGas()` may return inflated estimates that exceed Hedera's per-transaction cap
- Custom links requiring HBAR payment fail because gas + value math is off
- "Transaction underpriced" errors from MetaMask when network enforces minimum gas price

**Prevention:**
- Hardcode a known-safe gasLimit (e.g., 300,000–500,000) for contract writes rather than relying on `estimateGas()` during initial migration
- Set `maxFeePerGas` and `maxPriorityFeePerGas` explicitly to Hedera testnet values (query via `eth_gasPrice` on the relay)
- Verify actual gas used via HashScan after each test deploy
- Read Hedera's current gas schedule before writing contract interaction code: https://docs.hedera.com/hedera/core-concepts/smart-contracts/gas-and-fees

**Warning signs:**
- `estimateGas` returns numbers over 10,000,000 for a simple storage write
- MetaMask shows "Transaction may fail" without a clear reason
- Transaction appears in HashScan as "CONTRACT_REVERT_EXECUTED" with no revert reason string

**Phase:** Milestone 1 (Contract migration + deployment). Fix before writing any frontend transaction calls.

---

### Pitfall 2: JSON-RPC Relay (Hashio) Is Not 1:1 With Ethereum JSON-RPC

**What goes wrong:** Hashio (`testnet.hashio.io/api`) wraps Hedera's native API in an Ethereum-compatible JSON-RPC interface, but it does not support every method and has different behavior for `eth_getLogs`, `eth_getTransactionReceipt`, block numbers, and filter subscriptions.

**Why it happens:** Hedera has no native concept of Ethereum blocks — it uses consensus timestamps and round numbers. The relay maps Hedera consensus rounds to synthetic Ethereum blocks, but the mapping is not 1:1. Block numbers increment much faster than Ethereum, and block timestamps can be surprising.

**Consequences:**
- `eth_getLogs` with block range filters may miss events or return empty results
- Event log parsing in the existing `UrlForms.tsx` (lines 107–146) that reads `receipt.logs` may get null/empty results, breaking short URL extraction from transaction receipt
- `eth_blockNumber` returns Hedera's synthetic block, not what you'd expect
- WebSocket subscriptions (`eth_subscribe`) may not work reliably via Hashio — polling is safer
- `eth_getTransactionReceipt` can return `null` immediately after broadcast; retry logic is required

**Consequences for DURL specifically:**
- The existing code at `UrlForms.tsx` lines 108–116 and 138–146 reads `receipt.logs` to extract the created short URL from an event. If `receipt.logs` is empty on Hedera (known relay behavior on some versions), the UI will crash or show blank slug.
- CONCERNS.md already flags "Missing null/undefined Checks" on `receipt.logs` — this becomes a hard failure on Hedera, not just a theoretical concern.

**Prevention:**
- Add null/empty check on `receipt.logs` with a fallback to re-fetch logs via `provider.getLogs()`
- Use polling (`waitForTransaction` with explicit timeout and retry) instead of assuming receipt is immediately populated
- After a transaction confirms, query the contract directly for the created slug rather than parsing log data from receipt
- Test every `eth_*` method you use against Hashio before assuming it works

**Warning signs:**
- `receipt.logs` is an empty array `[]` even after confirmed transaction
- Short URL slug shows as `undefined` or empty string after submission
- `eth_getLogs` returns `[]` for a range that definitely contains events

**Phase:** Milestone 1 (Contract integration). Must be fixed in the contract interaction layer before any frontend work.

---

### Pitfall 3: MetaMask Gas Estimation Produces Wrong Values for Hedera

**What goes wrong:** MetaMask uses `eth_estimateGas` to pre-populate gas in the transaction modal. On Hedera's relay, this estimate is frequently incorrect — either too low (causing failure) or the relay returns an error that MetaMask surfaces as "transaction may fail," causing users to abandon the flow.

**Why it happens:** Hedera's gas estimation endpoint has known behavioral differences from Ethereum geth. The relay may return conservative or incorrect estimates for payable functions (like `createCustomLink` with 1 HBAR value). MetaMask's UI then shows warnings.

**Consequences for DURL:**
- Users see "this transaction may fail" in MetaMask for the custom link purchase — abandonment
- Users manually increase gas, hit Hedera's per-tx max, transaction still fails
- Demo day: presenter tries to create a custom link, MetaMask shows red warning — looks broken

**Prevention:**
- Override gas estimation in the ethers.js call: explicitly pass `{ gasLimit: 400000, value: parseEther("1") }` for payable functions
- Never rely on MetaMask's automatic gas estimate for Hedera payable transactions
- Test the exact MetaMask flow (not just ethers.js script) before demo
- Add a user-facing note: "Confirm even if MetaMask shows a warning — this is expected on Hedera testnet"

**Warning signs:**
- MetaMask shows yellow/red warning on gas for any transaction
- `eth_estimateGas` call in browser console returns error or unexpected value

**Phase:** Milestone 1 (Transaction layer). Also relevant for demo prep.

---

### Pitfall 4: HBAR Payable Functions Require Explicit Value Passing via ethers.js

**What goes wrong:** The existing Gnosis contract uses CRC token payments (ERC-20 transfer). The new contract uses `payable` with native HBAR. When calling a `payable` function through ethers.js + Hedera relay, the `value` field must be expressed in **weibars** (1 HBAR = 10^18 weibars), the same as ETH's wei. Many developers accidentally pass tinybars (10^8 per HBAR) or raw HBAR integer.

**Why it happens:** Hedera's native unit is tinybars (10^8 per HBAR), but the JSON-RPC relay uses the Ethereum wei convention (10^18 per HBAR). ethers.js `parseEther("1")` produces the correct value for 1 HBAR through the relay.

**Consequences:**
- Transaction reverts with "INSUFFICIENT_ACCOUNT_BALANCE" or "INVALID_TRANSFER_AMOUNT"
- Payment of 0.000000001 HBAR instead of 1 HBAR goes through silently — contract accepts zero/dust value if not validated in Solidity
- If Solidity uses `require(msg.value == 1 ether, ...)` the constant `1 ether` = 1×10^18 weibars = 1 HBAR — this is correct; but if using `1e8` it's wrong

**Prevention:**
- In Solidity: use `1 ether` constant or `10**18` for 1 HBAR, not `100000000` (tinybars)
- In ethers.js: always use `ethers.parseEther("1")` for 1 HBAR value
- In contract: add explicit `require(msg.value == 1 ether, "Must send exactly 1 HBAR")` guard
- Verify with HashScan: check the "value" field on the transaction matches expected HBAR amount

**Warning signs:**
- Transaction succeeds but custom link wasn't created (contract accepted dust payment)
- `require(msg.value >= X)` revert with correct-looking call

**Phase:** Milestone 1 (Smart contract rewrite). Day-one concern in Solidity changes.

---

### Pitfall 5: HCS Message Size Limit Causes Silent Drop or Error

**What goes wrong:** Hedera Consensus Service has a hard message size limit of **1024 bytes** per message. If the HCS audit log message for URL creation includes full URL, short slug, timestamp, and sender address concatenated without size checking, messages over 1024 bytes will be rejected by the network.

**Why it happens:** URLs can be long (256+ chars). Adding metadata (address, timestamp, slug, JSON structure) can easily push a message over 1024 bytes. The Hedera SDK will throw if you attempt to submit oversized messages, but ethers.js-based HCS submission (via `TopicMessageSubmitTransaction`) requires size awareness.

**Consequences for DURL:**
- Long original URLs (e.g., a 300-char URL + metadata) exceed 1024 bytes
- HCS submission fails, but if errors are swallowed (existing pattern in codebase), the URL creation appears to succeed but has no audit log
- Demo with a long URL breaks HCS logging while short URLs work — intermittent demo failure

**Prevention:**
- Truncate or hash the original URL in HCS messages — store only `{ slug, urlHash, sender, timestamp }` (under 150 bytes)
- Add explicit `message.length <= 1024` assertion before HCS submit
- Design HCS message schema to be compact: use hex-encoded address (20 bytes → 42 chars), unix timestamp (10 digits), short slug (≤32 chars)
- Test with a 300+ character URL before demo

**Warning signs:**
- HCS submit throws "TRANSACTION_OVERSIZE" error
- Some URLs appear in the smart contract but not in the HCS topic on HashScan

**Phase:** Milestone 2 (HCS integration). Include message size budget in the HCS design doc.

---

### Pitfall 6: HCS Topic Requires Pre-existing Topic ID — Cannot Be Created On-the-Fly

**What goes wrong:** HCS requires a `TopicId` to submit messages to. Topic creation is a Hedera-native operation (`TopicCreateTransaction`), not available via JSON-RPC. You cannot create a topic from ethers.js or MetaMask. The topic must be created in advance using the Hedera SDK (Node.js) or via the Hedera developer portal.

**Why it happens:** HCS is not part of the EVM layer. It requires a Hedera account (not just an EVM address) and the Hedera SDK. Developers focused on the EVM migration path forget that HCS integration requires a parallel SDK setup.

**Consequences for DURL:**
- No TOPIC_ID means HCS integration is blocked at the last moment
- If TOPIC_ID is created with wrong submit key permissions, all message submissions fail
- Topic creation costs HBAR — if testnet account is empty, creation fails

**Prevention:**
- Create the HCS topic manually (Hedera SDK script or portal) **before** any HCS integration code is written
- Store the TOPIC_ID in `.env` as `REACT_APP_HCS_TOPIC_ID`
- Set the submit key to allow unsigned submissions (open topic) for simplicity, or use operator key signing
- Keep the topic creation script in `/scripts/create-hcs-topic.js` in the repo for reproducibility

**Warning signs:**
- No `REACT_APP_HCS_TOPIC_ID` in environment before HCS work starts
- HCS code written without a topic to test against

**Phase:** Milestone 2 (HCS integration). Create topic on Day 1 of HCS work.

---

### Pitfall 7: Hedera Testnet Faucet Limits Block Demo Preparation

**What goes wrong:** The Hedera testnet faucet (`faucet.hedera.com`) dispenses a limited amount of test HBAR per account per day. During intensive testing (deploying contracts, creating links, testing HCS messages), an account can be depleted. On demo day, the account has no HBAR and transactions fail.

**Why it happens:** Contract deployment costs HBAR. Each test transaction costs HBAR. HCS topic creation costs HBAR. If using a single account for all testing, depletion is fast.

**Consequences for DURL:**
- Demo account has 0 HBAR at presentation time
- Contract can't be redeployed to fix a bug because account is empty
- Faucet daily limits mean you cannot immediately refill

**Prevention:**
- Maintain **3 separate testnet accounts**: operator (deploys contract, funds HCS), demo wallet (MetaMask, used for demo), test wallet (automated testing)
- Check testnet account balance before every testing session
- Never use the demo wallet for contract deployment or automated testing
- Top up the demo wallet the night before demo, verify balance morning of
- Keep the operator account private key in `.env` and never use it in MetaMask

**Warning signs:**
- HBAR balance below 10 HBAR on demo account
- "INSUFFICIENT_PAYER_BALANCE" errors in HashScan
- Contract deployment failing with balance error

**Phase:** All phases. Set up accounts before any testnet work begins.

---

### Pitfall 8: Existing `ethereum.js` Utility Not Updated for Hedera Network

**What goes wrong:** The existing `src/utils/ethereum.js` (plain JS, not TypeScript) contains Gnosis-chain-specific network configuration. If `NetworkSwitcher.ts` is updated but `ethereum.js` is not, some code paths will still attempt to switch to Gnosis or use incorrect chain parameters.

**Why it happens:** CONCERNS.md flags this file as mixed JS/TS and as a fragile area. During migration, developers update the obvious TypeScript files but miss the plain-JS utility that also handles network switching.

**Consequences for DURL:**
- MetaMask prompts to add Gnosis Chain instead of Hedera testnet
- `eth_chainId` check passes for Hedera but `ethereum.js` adds wrong network params
- Silent failure: wallet "switches" but connects to wrong network

**Prevention:**
- Convert `ethereum.js` to `ethereum.ts` during migration (already flagged in CONCERNS.md)
- Audit ALL files for `Gnosis`, `100` (Gnosis chain ID), `xdai`, `circles`, before marking migration complete
- Add chain ID constant `HEDERA_TESTNET_CHAIN_ID = 296` and import it everywhere chain ID is used
- Test network switching from scratch (no Hedera network pre-added in MetaMask) as part of migration QA

**Warning signs:**
- MetaMask shows "Add Gnosis Chain" prompt after migration
- `window.ethereum.chainId` returns `0x64` (100, Gnosis) after MetaMask "switches"

**Phase:** Milestone 1 (Network migration). Include in the migration checklist.

---

### Pitfall 9: CirclesConfig.ts Removal Leaves Dead Imports That Crash Build

**What goes wrong:** `CirclesConfig.ts` is imported across multiple components. Removing it as part of the Circles SDK removal will cause TypeScript compilation errors across `src/utils/ethereum.js`, `UrlForms.tsx`, and wherever `CirclesConfig` exports are consumed.

**Why it happens:** CONCERNS.md identifies this as a fragile area. The Circles removal is listed as a requirement (`Remove all Circles SDK dependencies`), but the dependency graph is tangled — `CirclesConfig` likely re-exports network config used by non-Circles code.

**Consequences:**
- Build breaks immediately when CirclesConfig.ts is deleted
- Developer patches each import individually, missing some — resulting in a build that works locally (with old node_modules) but fails in CI or on a fresh install

**Prevention:**
- Before deleting CirclesConfig.ts, run `grep -r "CirclesConfig" src/` to map all imports
- Separate the Circles-specific config from the reusable network config — extract what's needed into a new `HederaConfig.ts` before deleting `CirclesConfig.ts`
- Delete in phases: (1) add HederaConfig.ts, (2) migrate imports, (3) verify build, (4) delete CirclesConfig.ts

**Warning signs:**
- TypeScript error "Cannot find module CirclesConfig" after deletion
- Build succeeds locally but fails after `npm install` in a clean environment

**Phase:** Milestone 1 (Circles removal). First task before any other migration work.

---

## Moderate Pitfalls

---

### Pitfall 10: `receipt.logs` Log Parsing Breaks on Hedera Without Null Guard

**What goes wrong:** The existing code at `UrlForms.tsx` lines 108–116 and 138–146 reads `receipt.logs[0]` (or similar) to extract the short URL from an emitted event. On Hedera's relay, `receipt.logs` can be an empty array even for successful transactions, because log hydration is sometimes delayed or incomplete in the relay response.

**Prevention:**
- After getting receipt, always re-fetch logs: `provider.getLogs({ address: CONTRACT_ADDRESS, fromBlock: receipt.blockNumber, toBlock: receipt.blockNumber })`
- If logs are still empty, fall back to querying the contract directly for the latest link by the sender
- Add explicit null/length check: `if (!receipt.logs || receipt.logs.length === 0) { /* fallback */ }`

**Phase:** Milestone 1 (Contract interaction layer).

---

### Pitfall 11: Hardcoded Receiver Addresses Still Point to Gnosis Contracts

**What goes wrong:** CONCERNS.md flags hardcoded addresses in `UrlForms.tsx` (lines 10, 71, 97) and `CRCPaymentProvider.ts` (line 62). After migration, if any hardcoded address is missed, payment or contract calls will silently fail or send HBAR to a wrong/nonexistent address on Hedera.

**Prevention:**
- Before any other migration work, replace ALL hardcoded addresses with environment variables
- Add a startup assertion: `if (!process.env.REACT_APP_CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS not set")`
- Run `grep -r "0x[0-9a-fA-F]\{40\}" src/` to find all hardcoded addresses

**Phase:** Milestone 1 (Pre-migration cleanup).

---

### Pitfall 12: Transaction Confirmation UI Gap Causes User Retry Loops

**What goes wrong:** CONCERNS.md already flags "No Transaction Confirmation UI." On Hedera testnet, transaction finality is fast (~3–5 seconds), but the JSON-RPC relay adds latency. Users who see no feedback after clicking submit will retry, creating duplicate transactions.

**Why it matters for Hedera specifically:** Hedera charges HBAR for every transaction attempt. Duplicate transactions drain the demo account. With custom links (1 HBAR fee), a confused user retrying 3× loses 3 HBAR from the demo wallet.

**Prevention:**
- Add a `isSubmitting` state that disables the submit button immediately on click
- Show a spinner with "Waiting for Hedera confirmation..." after MetaMask signs
- Use `provider.waitForTransaction(txHash, 1, 15000)` with a 15-second timeout

**Phase:** Milestone 1 (Frontend transaction flow).

---

### Pitfall 13: HashScan Explorer Links Use Wrong URL Pattern

**What goes wrong:** The existing codebase has explorer links pointing to Gnosis block explorer. PROJECT.md correctly identifies updating these to HashScan, but the URL format is different: HashScan uses `hashscan.io/testnet/transaction/{txHash}` not the Etherscan-style `explorer.com/tx/{txHash}`.

**Prevention:**
- Build a single `getExplorerUrl(txHash: string)` utility function
- Use `https://hashscan.io/testnet/transaction/${txHash}` for transactions
- Use `https://hashscan.io/testnet/contract/${contractAddress}` for contracts
- Grep for all existing explorer URL patterns and replace in one pass

**Phase:** Milestone 1 (Network configuration).

---

### Pitfall 14: Hedera Testnet Reliability — Outages During Demo

**What goes wrong:** Hedera testnet occasionally experiences downtime for maintenance or increased load during hackathons. If the demo depends 100% on live testnet, an outage means demo failure.

**Prevention:**
- Pre-record a 2-minute demo video as fallback ("live demo not possible, here's the recording")
- Pre-seed the demo account with 5 already-created links to show the dashboard without creating new ones
- Know the HashScan URLs for pre-created transactions to show as evidence

**Phase:** Demo preparation (final milestone).

---

### Pitfall 15: HCS Requires Hedera SDK — Cannot Use ethers.js

**What goes wrong:** Developers assume that because Hedera EVM works with ethers.js, HCS integration also works with ethers.js. It does not. HCS is a native Hedera service, not an EVM service. It requires `@hashgraph/sdk` and a Hedera account (account ID + private key), not just an EVM wallet.

**Consequences for DURL:**
- HCS integration requires a **server-side signing step** (or a custom HCS relay) because private keys cannot be exposed to the browser
- Browser-side HCS submission using the Hedera SDK exposes the operator private key — a security vulnerability
- This means HCS logging needs a backend endpoint (or a serverless function) that receives the URL data and submits to HCS

**Prevention:**
- Plan HCS as a backend-mediated call from day one: frontend → API endpoint → HCS submit
- Use a simple Express or serverless function with the operator account credentials
- Never embed the Hedera operator private key in `REACT_APP_*` env vars (those are client-side visible)
- Use server-side `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` only in the analytics/backend server

**Phase:** Milestone 2 (HCS integration). Architecture decision that affects both backend and frontend.

---

## Minor Pitfalls

---

### Pitfall 16: MetaMask "Add Network" RPC URL Mismatch

**What goes wrong:** Users who have already added Hedera testnet to MetaMask with a different RPC URL (e.g., a community relay) will not automatically switch to Hashio. MetaMask caches the network configuration by chain ID.

**Prevention:**
- In `NetworkSwitcher.ts`, use `wallet_addEthereumChain` with the canonical Hashio URL: `https://testnet.hashio.io/api`
- If MetaMask already has chain ID 296 with a different RPC, it will not replace it — document this in user-facing instructions
- For the demo, use a fresh MetaMask profile or browser profile with no pre-added Hedera network

**Phase:** Milestone 1 (Network switching).

---

### Pitfall 17: Vanta Background Library May Conflict With React 19

**What goes wrong:** CONCERNS.md flags Vanta (v0.5.24) as a low-maintenance library. Under heavy load (demo with screen recording), Vanta's WebGL animation causes CPU/GPU spikes that can make the entire UI unresponsive during demo.

**Prevention:**
- Test with Vanta disabled: add a `?noVanta=1` query param escape hatch
- If performance issues appear, replace with a static gradient background before demo day

**Phase:** Final cleanup before demo.

---

### Pitfall 18: Missing Business Documentation Is a Scoring Risk

**What goes wrong:** PROJECT.md identifies Lean Canvas, GTM strategy, and design decisions as required deliverables. Hackathon judges score "Pitch" (10%) and "Validation" (15%). Projects that skip business docs lose 25% of scoring weight even if the technical demo is flawless.

**Prevention:**
- Treat business docs as parallel deliverables, not afterthoughts
- Lean Canvas: 1 page, fill it in during the planning phase
- GTM: 1 page, draft during feature stabilization
- Design decisions: document each significant decision in a `DECISIONS.md` as they're made (not retrospectively)

**Phase:** Deliverables milestone (final). Start Lean Canvas during roadmap finalization.

---

### Pitfall 19: Analytics Server Race Condition Worsens Under Demo Load

**What goes wrong:** CONCERNS.md flags the analytics server's callback-based `fs.readFile/writeFile` as a race condition source. During demo, if multiple people click short links simultaneously (e.g., the judge scans a QR code while the presenter navigates), analytics writes can collide and corrupt the log.

**Prevention:**
- Replace `fs.readFile/writeFile` with an append-only write pattern (`fs.appendFile`) or switch to SQLite before demo
- The fix is low-effort: `fs.appendFileSync` for each event, aggregate on read

**Phase:** Milestone 1 (Backend hardening) or just before demo.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Circles removal & cleanup | CirclesConfig.ts tangled imports cause build break | Map all imports first, create HederaConfig.ts before deleting |
| Solidity contract migration | HBAR value unit confusion (tinybars vs weibars) | Use `1 ether` in Solidity, `parseEther("1")` in ethers.js |
| Contract deployment to testnet | Gas limit incompatibility with Hedera relay | Hardcode safe gasLimit (400k), verify on HashScan |
| Frontend transaction flow | `receipt.logs` empty on Hedera relay | Add null check + fallback `provider.getLogs()` |
| MetaMask network switching | ethereum.js still references Gnosis | Convert to TypeScript, grep all chain references |
| HCS integration | Topic creation blocked, browser key exposure | Create topic offline first, use backend relay for signing |
| HCS message submission | Message over 1024-byte limit | Compact message schema, size assertion before submit |
| HBAR payment for custom links | MetaMask gas warning causes user abandonment | Hardcode gasLimit in ethers.js call, add user guidance |
| Demo preparation | Testnet HBAR depletion | Separate demo/test accounts, top up night before |
| Demo preparation | Testnet outage | Pre-record video fallback, pre-seeded dashboard links |
| Hackathon submission | Missing business documents | Lean Canvas + GTM as explicit deliverables in roadmap |

---

## Sources and Confidence Notes

| Claim | Confidence | Source |
|-------|------------|--------|
| Hedera gas model (fixed USD-pegged, not EIP-1559 fee market) | MEDIUM | Training data from Hedera docs (pre-Aug 2025); verify at docs.hedera.com/hedera/core-concepts/smart-contracts/gas-and-fees |
| Max gas per transaction (15M) | LOW | Training data only; verify current limit in Hedera docs before relying on this number |
| `receipt.logs` empty on Hedera relay | MEDIUM | Known community-reported behavior; verify with a test transaction on Hashio testnet |
| HCS message size limit (1024 bytes) | HIGH | Consistent across multiple Hedera docs versions |
| HCS requires Hedera SDK (not ethers.js) | HIGH | Fundamental Hedera architecture; HCS is not an EVM service |
| Hedera testnet faucet daily limits | MEDIUM | Well-documented community knowledge; limits may have changed |
| HBAR value in Solidity (1 ether = 1 HBAR via relay) | HIGH | Hedera JSON-RPC relay convention; verified across multiple developer guides |
| Hashio `testnet.hashio.io/api` as canonical relay | HIGH | Official Hedera-maintained relay endpoint |
| HashScan URL format (`hashscan.io/testnet/...`) | HIGH | Official Hedera block explorer |
| HCS topic creation requires pre-creation via SDK | HIGH | Fundamental Hedera architecture |

**Recommended verification before implementation:**
- Fetch https://docs.hedera.com/hedera/core-concepts/smart-contracts/gas-and-fees (current gas limit)
- Fetch https://docs.hedera.com/hedera/core-concepts/smart-contracts/json-rpc-relay (relay limitations)
- Fetch https://docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service (HCS message limits)

---

*Pitfalls audit: 2026-03-02*
