# Roadmap: DURL — Decentralized URL Shortener on Hedera

## Overview

DURL is a working decentralized URL shortener on Gnosis Chain being migrated to Hedera testnet for the 2026 hackathon. Phase 1 strips all Gnosis/Circles dependencies and lands a fully working DURL on Hedera EVM with HBAR payments — this is the foundation everything else depends on. Phase 2 adds HCS as an audit trail and surfaces both proofs in the UI, which is the feature that makes the submission genuinely Hedera-native and earns the Integration score. Phase 3 delivers the design decisions document and demo hardening to complete the submission package.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Hedera EVM Migration** - Migrate chain config, remove Circles SDK, deploy payable contract, enable HBAR payments (completed 2026-03-03)
- [ ] **Phase 2: HCS Audit Trail + Dual Proof UI** - Add HCS logging for every URL creation and surface both EVM + HCS proofs in the UI
- [ ] **Phase 3: Docs and Demo Polish** - Write design decisions document and harden the demo setup for hackathon submission

## Phase Details

### Phase 1: Hedera EVM Migration
**Goal**: DURL's full feature set works on Hedera testnet with HBAR payments and no Circles/Gnosis residue
**Depends on**: Nothing (first phase)
**Requirements**: MIGR-01, MIGR-02, MIGR-03, MIGR-04, MIGR-05, CIRC-01, CIRC-02, CIRC-03, CIRC-04, CIRC-05, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, PAY-01, PAY-02, PAY-03, PAY-04
**Success Criteria** (what must be TRUE):
  1. MetaMask prompts to switch to Hedera testnet (chain ID 296) when on the wrong network, and all explorer links open hashscan.io/testnet
  2. A user can create a random short URL for free — the transaction confirms on Hedera EVM and the resulting HashScan link is valid
  3. A user can create a custom short URL by paying 1 HBAR — the payment goes through without a token approval step and the link is confirmed on-chain
  4. The codebase has zero Circles SDK imports, no @circles-sdk npm packages installed, and the build compiles cleanly
  5. Contract reads and writes use hardcoded gasLimit and handle empty receipt.logs without throwing
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Circles removal + Hedera config foundation (Wave 1)
- [ ] 01-02-PLAN.md — Contract deploy + UrlForms rewrite for HBAR payment (Wave 2)
- [x] 01-03-PLAN.md — Dashboard HashScan + UI branding for Hedera (Wave 2)

### Phase 2: HCS Audit Trail + Dual Proof UI
**Goal**: Every URL creation produces two on-chain records (EVM event + HCS consensus message) and the UI surfaces both proofs
**Depends on**: Phase 1
**Requirements**: HCS-01, HCS-02, HCS-03, HCS-04, HCS-05, PROOF-01, PROOF-02, PROOF-03, PROOF-04
**Success Criteria** (what must be TRUE):
  1. After creating any URL (random or custom), the confirmation screen shows both the EVM transaction hash and an HCS sequence number
  2. A "Verify on HashScan" button links to the HCS topic on hashscan.io/testnet and the message is visible there
  3. HCS submission failure does not block URL creation — the EVM confirmation shows success regardless of HCS outcome
  4. The dashboard shows decoded HCS audit entries (slug, URL hash, sender, timestamp) fetched from Mirror Node
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — HCS backend setup: @hashgraph/sdk, topic creation script, /hcs/submit endpoint (Wave 1)
- [ ] 02-02-PLAN.md — UrlForms fire-and-forget HCS submission + dual proof confirmation UI (Wave 2)
- [ ] 02-03-PLAN.md — Dashboard HCS Audit Log via Mirror Node REST API (Wave 2)

### Phase 3: Docs and Demo Polish
**Goal**: Complete hackathon submission package — design decisions documented and demo hardened against testnet failures
**Depends on**: Phase 2
**Requirements**: DOCS-01
**Success Criteria** (what must be TRUE):
  1. A design decisions document exists covering the key technical choices (Hedera EVM via JSON-RPC relay, HCS audit trail, HBAR payment, ethers.js retention, fire-and-forget HCS pattern) with rationale
  2. The demo setup survives a testnet outage or HBAR depletion — pre-seeded links exist, fallback path is ready
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Hedera EVM Migration | 3/3 | Complete   | 2026-03-03 |
| 2. HCS Audit Trail + Dual Proof UI | 1/3 | In Progress|  |
| 3. Docs and Demo Polish | 0/TBD | Not started | - |
