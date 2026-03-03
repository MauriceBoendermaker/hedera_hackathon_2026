# Project Research Summary

**Project:** DURL — Decentralized URL Shortener (Hedera Migration)
**Domain:** EVM dApp migration — Gnosis Chain to Hedera testnet, with HCS audit trail
**Researched:** 2026-03-02
**Confidence:** MEDIUM (Hedera-specific claims from training data; verify against live docs before implementation)

## Executive Summary

DURL is a working decentralized URL shortener built on Gnosis Chain that must be migrated to Hedera testnet for a hackathon submission. The migration is more than a chain swap: adding Hedera Consensus Service (HCS) as an audit trail is what transforms a routine EVM migration into a genuinely Hedera-native submission that can score well on the Integration criterion (15%). Without HCS, the project uses only Hedera's EVM layer — functionally identical to any EVM chain migration and unlikely to score differentially. The recommended approach is to treat the EVM migration and Circles SDK removal as Phase 1, HCS integration as Phase 2, and scoring polish (dual proof UI, business documents, demo hardening) as Phase 3.

The key technical insight is that Hedera uses two parallel SDK paths that must coexist: `ethers.js` via the Hashio JSON-RPC relay for all EVM contract interactions (unchanged from existing code), and `@hashgraph/sdk` for HCS message submission (new addition). These do not overlap — ethers.js cannot touch HCS, and the Hedera SDK is not needed for contract calls. The architecture is clean: the React SPA keeps its existing structure, two new service classes are added (`HederaHCSService.ts`, `MirrorNodeService.ts`), and the smart contract gains a `payable` modifier to accept HBAR instead of CRC token payments.

The critical risks are operational rather than conceptual: Hedera's gas model differs from EIP-1559 (hardcode `gasLimit: 400000` to avoid estimation failures), `receipt.logs` can be empty on the Hashio relay (add a fallback to `provider.getLogs()`), and the HCS operator private key cannot safely live in browser-visible `REACT_APP_*` environment variables (acceptable for hackathon testnet, not for production). A secondary risk is schedule: HCS topic creation must happen before any HCS code is written because it requires a funded Hedera account and produces a `topicId` that everything else depends on. Create the topic on Day 1 of the HCS milestone.

## Key Findings

### Recommended Stack

The existing React + ethers.js v6 + TypeScript stack requires minimal changes. The frontend framework, routing, styling, and build tooling are all chain-agnostic and carry over unchanged. The only dependency removals are the five `@circles-sdk/*` packages (Gnosis-only). The only addition is `@hashgraph/sdk` v2.x for HCS. The Hashio JSON-RPC relay (`https://testnet.hashio.io/api`, chain ID 296) makes Hedera's EVM layer fully compatible with the existing ethers.js integration — no API changes needed in contract call code.

For deployment, standard Hardhat with Hedera network config is the recommended path. Solidity `^0.8.x` is supported on Hedera EVM with the same compilation toolchain. Smart contract deployment should happen before frontend work begins, since the deployed contract address is required to wire up the frontend.

**Core technologies:**
- `ethers.js` v6.14.0: EVM contract interaction via JSON-RPC relay — unchanged, fully compatible with Hedera
- `@hashgraph/sdk` ^2.x: HCS topic creation and message submission — new addition, required for audit trail
- Hashio JSON-RPC relay (`testnet.hashio.io/api`): bridges MetaMask and standard ethers.js to Hedera EVM — no API key required
- Mirror Node REST API (`testnet.mirrornode.hedera.com`): read-only access to HCS messages without a wallet — used for live feed and dashboard enrichment
- Hedera testnet chain ID 296 (`0x128`): replaces Gnosis chain ID 100 (`0x64`) everywhere

**Items to remove:** All `@circles-sdk/*` packages and associated config files (`CirclesConfig.ts`, `CRCPaymentProvider.ts`, `abi_ETH.json`).

**Items to verify against live docs before implementation:** `@hashgraph/sdk` exact latest version, Hashio testnet RPC URL, testnet faucet daily HBAR limits, Mirror Node testnet rate limits, and `ethers.parseEther("1")` equivalence to 1 HBAR via the relay.

### Expected Features

DURL's existing feature set (URL creation, custom slugs, on-chain resolution, dashboard, QR codes, analytics) carries over intact. The migration adds Hedera-native payment and an HCS audit layer. The judging criteria explicitly rewards projects that use multiple Hedera services — EVM alone is not enough.

**Must have (table stakes for hackathon scoring):**
- Full Hedera testnet migration (chain ID 296, Hashio RPC, remove Circles SDK) — disqualifying gap if missing
- HBAR native payment for custom links via `msg.value` — replaces CRC entirely; `payable` modifier in Solidity
- HashScan transaction links throughout UI — judges click these; all `gnosisscan.io` URLs must become `hashscan.io/testnet`
- Network auto-switch to Hedera testnet (chain ID 296) — MetaMask must prompt correctly
- HCS logging for every URL creation — the feature that makes this Hedera-native, not just EVM-compatible
- Remove Circles SDK completely — dead code confuses judges

**Should have (meaningful scoring uplift, low effort):**
- Dual proof confirmation UI — show EVM tx hash AND HCS sequence number after URL creation; the "hasn't been seen before" angle
- HashScan HCS deep-link per dashboard entry — "Verify on HashScan" button for each link
- HBAR faucet callout + Hedera account onboarding flow — directly targets the Success (20%) criterion for new account creation
- Lean Canvas + GTM strategy + Design Decisions documents — explicit checklist items in Feasibility (10%) and Execution (20%) criteria

**Nice to have (ship if time allows):**
- Live HCS feed on homepage polling Mirror Node — strong demo moment, no wallet needed, shows network activity

**Defer entirely:**
- HTS token, link deletion, social features, multi-chain, HashPack wallet, phishing detection, mainnet deployment

### Architecture Approach

The target architecture uses three coordinated Hedera services without adding backend infrastructure: the EVM smart contract layer (via JSON-RPC relay) holds authoritative URL storage, HCS holds the ordered audit trail, and the Mirror Node REST API provides read access to HCS history. The React SPA structure is unchanged — two new service classes are introduced to isolate the new Hedera integrations, and existing components are minimally modified to call them.

**Major components:**
1. `HederaContractService.ts` (new) — wraps all ethers.js contract calls; isolates JSON-RPC relay interactions from components
2. `HederaHCSService.ts` (new) — submits HCS messages via `@hashgraph/sdk` after EVM transaction confirmation; fire-and-forget, non-blocking
3. `MirrorNodeService.ts` (new) — fetches and decodes HCS topic messages from Mirror Node REST API; used for dashboard enrichment and optional live feed
4. `NetworkSwitcher.ts` (changed) — `switchToGnosis()` becomes `switchToHedera()` with chain ID `0x128`
5. `UrlForms.tsx` (changed) — removes CRC payment logic, adds HBAR `{ value: parseEther("1") }`, calls HCS service after EVM confirmation
6. EVM Smart Contract (changed) — adds `payable` modifier and HBAR fee check; removes CRC dependency
7. HCS Topic (new, one-time) — created once at deploy time via SDK script; `topicId` stored in `.env`

The canonical data flow for URL creation is: EVM contract write → receipt confirmed → HCS message submitted (non-blocking) → UI shows success with dual HashScan links. HCS failure does not block the user; the EVM contract is the source of truth.

### Critical Pitfalls

1. **Gas estimation failures on Hedera EVM** — Hedera uses a fixed USD-pegged gas model, not EIP-1559. `estimateGas()` produces wrong values; MetaMask shows "transaction may fail" warnings. Prevention: hardcode `gasLimit: 400000` on all contract writes; never rely on automatic estimation.

2. **`receipt.logs` empty on Hashio relay** — The existing `UrlForms.tsx` code extracts the short URL slug from `receipt.logs`. On Hedera's relay, this array can be empty even after a confirmed transaction. Prevention: add null/length guard and fallback to `provider.getLogs()` with the confirmed block range.

3. **HCS operator private key exposed in browser** — `@hashgraph/sdk` HCS submission requires a funded Hedera account's private key. Storing this in `REACT_APP_OPERATOR_PRIVATE_KEY` makes it visible in the browser JS bundle. This is acceptable for a testnet hackathon demo but is a hard security violation for any production deployment. Prevention: acknowledge the tradeoff explicitly; plan backend relay for post-hackathon.

4. **HCS topic must be created before any HCS code is written** — Topic creation is a Hedera-native operation unavailable via JSON-RPC. Without a `topicId`, all HCS integration is blocked. Prevention: create the topic on Day 1 of the HCS milestone using a Node.js SDK script; save `topicId` to `.env` immediately.

5. **CirclesConfig.ts removal breaks the build** — `CirclesConfig.ts` is imported across multiple components and likely re-exports reusable config. Deleting it without mapping all imports first causes TypeScript compilation errors. Prevention: run `grep -r "CirclesConfig" src/` first; create `HederaConfig.ts` as a replacement; migrate imports; verify build; then delete.

6. **HCS message size limit (1024 bytes)** — Long original URLs plus metadata can exceed the HCS per-message limit. Prevention: compact message schema (`{ slug, urlHash, creator, txHash, timestamp }` — under 150 bytes); add size assertion before submission.

7. **Testnet HBAR depletion on demo day** — Contract deployment, testing, and HCS transactions all consume HBAR. A single depleted account fails the demo. Prevention: maintain three separate accounts (operator, demo wallet, test wallet); top up demo wallet the night before.

## Implications for Roadmap

Based on the research, a three-phase structure with a documentation deliverable milestone is recommended. The phase order is driven by hard technical dependencies identified in the architecture research.

### Phase 1: Foundation — Hedera Migration and Circles Removal

**Rationale:** Every subsequent feature depends on a working Hedera EVM integration. HCS cannot be added until the contract is deployed and the frontend can talk to Hedera. The Circles removal must precede all other work because `CirclesConfig.ts` imports are tangled with non-Circles code — touching it last risks build failures mid-milestone.

**Delivers:** A fully working DURL on Hedera testnet with HBAR payments and clean codebase. The prototype's full feature set works on Hedera. All table-stakes EVM features are complete.

**Addresses (from FEATURES.md):**
- Full Hedera testnet migration (chain ID 296, Hashio RPC)
- HBAR native payment for custom links
- HashScan transaction links throughout UI
- Network auto-switch to Hedera testnet
- Remove Circles SDK completely

**Avoids (from PITFALLS.md):**
- CirclesConfig.ts build break (map imports first, create HederaConfig.ts, then delete)
- Gas estimation failures (hardcode `gasLimit: 400000` from day one)
- `receipt.logs` empty on relay (add fallback immediately in contract service layer)
- Hardcoded Gnosis addresses left behind (grep all `0x` addresses, move to env vars)
- `ethereum.js` not updated for Hedera (convert to TypeScript, audit all chain references)

**Research flag:** Standard patterns — well-documented EVM migration steps. Skip `research-phase` for this phase.

---

### Phase 2: HCS Integration — Audit Trail and Dual Proof

**Rationale:** HCS is the feature that earns the Integration (15%) score and makes the project demonstrably Hedera-native. It depends entirely on Phase 1 (deployed contract, working Hedera frontend). HCS topic creation is the first task because everything else in this phase requires a valid `topicId`.

**Delivers:** Every URL creation produces two on-chain records: an EVM event log and an HCS consensus message. The UI shows both proofs. The Mirror Node integration makes HCS messages readable in the dashboard.

**Addresses (from FEATURES.md):**
- HCS logging for every URL creation (core differentiator / table stakes for Integration score)
- Dual proof confirmation UI (EVM tx hash + HCS sequence number)
- HashScan HCS deep-link per dashboard entry ("Verify" button)
- Live HCS feed on homepage polling Mirror Node (nice-to-have, include if time permits)

**Avoids (from PITFALLS.md):**
- HCS topic must be created first (Day 1 of this phase, before writing HCS code)
- HCS operator key exposure (document the tradeoff; use `REACT_APP_OPERATOR_*` only on testnet)
- HCS message over 1024 bytes (compact schema: `{ slug, urlHash, creator, txHash, timestamp }`)
- Blocking URL creation on HCS (fire-and-forget pattern; EVM confirmation shows success immediately)
- Using ethers.js for HCS (must use `@hashgraph/sdk`; these are separate SDK paths)

**Research flag:** Moderate complexity — HCS SDK patterns are documented but the browser-side operator key strategy and Mirror Node rate limits need live validation. Consider a brief targeted research step when starting HCS implementation.

---

### Phase 3: Scoring Polish — Onboarding, Demo Hardening, Business Documents

**Rationale:** These deliverables directly target the Success (20%), Feasibility (10%), and Execution (20%) scoring criteria. They are parallel to technical work and can be written alongside Phase 2, but must be finalized before submission. Demo hardening (pre-seeded links, fallback video, account management) must happen last.

**Delivers:** Complete hackathon submission — working demo with Hedera onboarding UX, business documents for judges, and a demo-proof setup that survives testnet outages and HBAR depletion.

**Addresses (from FEATURES.md):**
- HBAR faucet callout + Hedera account onboarding flow (Success 20% criterion)
- Lean Canvas + GTM strategy + Design Decisions documents (Feasibility 10% + Execution 20%)
- Demo preparation (pre-seeded links, HashScan URLs on hand, fallback recording)

**Avoids (from PITFALLS.md):**
- Missing business documentation (25% of score at risk without Lean Canvas and GTM)
- Testnet HBAR depletion on demo day (separate accounts, top up night before)
- Testnet outage during demo (pre-record 2-minute fallback video, pre-seeded dashboard)
- MetaMask gas warning causing user abandonment (add user-facing note; test full MetaMask flow)
- Vanta background causing GPU spikes during demo (add `?noVanta=1` escape hatch)
- Analytics server race condition under demo load (switch to `fs.appendFile` pattern)

**Research flag:** Standard patterns — business document formats are well-known. No research-phase needed.

---

### Phase Ordering Rationale

- Phase 1 before Phase 2: Hard dependency — HCS integration requires a deployed contract and working Hedera frontend. There is nothing to log until URLs can be created on Hedera.
- Circles removal first within Phase 1: `CirclesConfig.ts` is imported by non-Circles code. Attempting to migrate other components before cleaning up Circles risks cascading build errors.
- HCS topic creation first within Phase 2: All HCS code requires a `topicId`. Writing the service before creating the topic means no end-to-end testing is possible.
- Phase 3 as final: Business documents and demo hardening are highest-value when the technical features are stable. Writing the Lean Canvas before Phase 2 is complete risks describing features that change.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (HCS Integration):** Mirror Node testnet rate limits are unverified; exact `@hashgraph/sdk` v2.x API for browser-side usage needs validation against live docs; `ethers.parseEther("1")` === 1 HBAR in `msg.value` needs a live test transaction to confirm before the payable contract goes live.

Phases with standard patterns (skip `research-phase`):
- **Phase 1 (Hedera Migration):** EVM migration is well-documented. ethers.js + MetaMask + JSON-RPC relay patterns are standard and the existing code already uses the correct SDK. The changes are configuration-level.
- **Phase 3 (Scoring Polish):** Business document formats (Lean Canvas, GTM) are established. Demo hardening is common sense operational prep.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core technologies (React, ethers.js, TypeScript) are HIGH confidence unchanged. Hedera-specific additions (`@hashgraph/sdk` version, Hashio URL, chain ID 296) are MEDIUM — training data, not live-verified |
| Features | HIGH | Judging criteria read directly from CRITERIA.md; existing prototype codebase read directly. Scoring impact estimates are MEDIUM (judge behavior may vary) |
| Architecture | MEDIUM | EVM-compatible patterns (ethers.js, MetaMask, Solidity) are HIGH confidence. HCS SDK browser patterns and `ethers.parseEther("1")` == 1 HBAR via relay are MEDIUM — needs live verification |
| Pitfalls | MEDIUM | HCS-related pitfalls (message size, topic pre-creation, operator key) are HIGH based on fundamental Hedera architecture. Gas model differences and `receipt.logs` behavior on Hashio are MEDIUM — community-reported, unverified on current testnet |

**Overall confidence:** MEDIUM — The plan is sound and the approach is correct. The uncertainty is operational detail (exact API behaviors on the current testnet version) rather than fundamental architecture. A single day of exploratory testing on Hedera testnet at the start of Phase 1 will resolve most MEDIUM-confidence items.

### Gaps to Address

- **HBAR wei equivalence via relay:** `ethers.parseEther("1")` should equal 1 HBAR through Hashio, but this needs a live test transaction to confirm before writing the payable contract. Verify on Day 1 of Phase 1 with a simple test deployment.
- **Hashio `receipt.logs` behavior:** Community reports suggest logs can be empty on some relay versions. Implement the fallback pattern preemptively (`provider.getLogs()`) rather than discovering this during integration testing.
- **Mirror Node rate limits:** Testnet rate limits for `api.testnet.mirrornode.hedera.com` are undocumented in training data. The live HCS feed feature (polling Mirror Node) may need backoff logic. Verify during Phase 2.
- **`@hashgraph/sdk` exact browser compatibility:** The SDK is primarily designed for Node.js. Browser-side usage with `TopicMessageSubmitTransaction` should be validated with a minimal test before building `HederaHCSService.ts`.
- **HashScan HCS message deep-link URL format:** `hashscan.io/testnet/topic/{topicId}` shows topic-level view, but individual message URLs need live verification against HashScan before building the "Verify" button.

## Sources

### Primary (HIGH confidence)
- `/c/xampp/htdocs/hedera_hackathon_2026/CRITERIA.md` — hackathon judging criteria; scoring weights
- `/c/xampp/htdocs/hedera_hackathon_2026/.planning/PROJECT.md` — project context, constraints, out-of-scope decisions
- `/c/xampp/htdocs/hedera_hackathon_2026/prototype/src/` — existing codebase (UrlForms.tsx, Dashboard.tsx, ShortenPage.tsx, RedirectPage.tsx, analytics/server.cjs, abi_xDAI.json)

### Secondary (MEDIUM confidence)
- Training data (cutoff August 2025): Hedera EVM and HCS architecture, Hashio relay behavior, Mirror Node REST API, HCS message size limits, `@hashgraph/sdk` SDK patterns
- Hedera developer documentation patterns: https://docs.hedera.com/hedera/ (not fetched live — verify before implementation)
- Hedera Mirror Node testnet: https://testnet.mirrornode.hedera.com/api/v1/docs/

### Tertiary (LOW confidence — verify before use)
- Hedera testnet gas ceiling (15M gas per transaction) — training data only, may have changed
- Hashio testnet rate limits — not documented in training data
- Mirror Node testnet rate limits — not documented in training data

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
