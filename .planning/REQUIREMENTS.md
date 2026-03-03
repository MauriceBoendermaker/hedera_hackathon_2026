# Requirements: DURL — Decentralized URL Shortener on Hedera

**Defined:** 2026-03-02
**Core Value:** Immutable, decentralized URL shortening — once a link is created on-chain, it cannot be censored, modified, or taken down by any central authority.

## v1 Requirements

Requirements for hackathon submission. Each maps to roadmap phases.

### Hedera EVM Migration

- [x] **MIGR-01**: All chain configuration references updated to Hedera testnet (chain ID 296, Hashio RPC)
- [x] **MIGR-02**: MetaMask network switching prompts use Hedera testnet chain config (name, RPC, currency, explorer)
- [x] **MIGR-03**: All explorer links point to HashScan (hashscan.io/testnet) instead of GnosisScan/Etherscan
- [x] **MIGR-04**: Environment variables updated for Hedera (RPC URL, chain ID, explorer URL, HCS topic ID)
- [x] **MIGR-05**: Read-only provider uses Hedera testnet RPC instead of Infura/Gnosis RPC

### Circles SDK Removal

- [x] **CIRC-01**: All Circles SDK imports and code removed from codebase
- [x] **CIRC-02**: All 5 @circles-sdk npm packages uninstalled
- [x] **CIRC-03**: CirclesConfig.ts replaced with HederaConfig.ts (or equivalent)
- [x] **CIRC-04**: CRC token balance display and approval UI removed
- [x] **CIRC-05**: CRCPaymentProvider.ts deleted or fully replaced

### Smart Contract

- [x] **CONT-01**: Custom link function is `payable` and checks `msg.value >= 1 HBAR`
- [x] **CONT-02**: Random link generation (keccak256) works unchanged on Hedera EVM
- [x] **CONT-03**: Contract compiles and deploys on Hedera testnet via Hardhat or Remix
- [x] **CONT-04**: All contract calls use hardcoded gasLimit (not estimateGas)
- [x] **CONT-05**: Transaction receipt parsing has fallback for empty `receipt.logs` on Hedera relay

### HBAR Payment

- [x] **PAY-01**: Custom link creation sends 1 HBAR as `msg.value` with the transaction
- [x] **PAY-02**: No token approval step needed (native currency payment)
- [x] **PAY-03**: Random link creation remains free (no payment required)
- [x] **PAY-04**: Payment amount displayed clearly in UI before transaction

### HCS Audit Trail

- [ ] **HCS-01**: HCS topic created on Hedera testnet for URL creation audit log
- [ ] **HCS-02**: HCS message submitted on every URL creation (random and custom)
- [ ] **HCS-03**: HCS message contains compact JSON: slug, URL hash, sender address, timestamp
- [ ] **HCS-04**: HCS message stays within 1024-byte limit
- [ ] **HCS-05**: HCS submission is fire-and-forget (failure does not block URL creation)

### Dual Proof UI

- [ ] **PROOF-01**: UI displays both EVM transaction hash and HCS sequence number after URL creation
- [ ] **PROOF-02**: "Verify on HashScan" button links to HCS topic on hashscan.io/testnet
- [ ] **PROOF-03**: Dashboard shows HCS message history via Mirror Node REST API
- [ ] **PROOF-04**: Mirror Node messages decoded from base64 and displayed as readable audit entries

### Documentation

- [ ] **DOCS-01**: Design decisions document covering key technical choices and rationale

## v2 Requirements

Deferred to post-hackathon. Tracked but not in current roadmap.

### Business Documents

- **BIZ-01**: Lean/Business Model Canvas document
- **BIZ-02**: Go-To-Market strategy document

### UX Enhancements

- **UX-01**: Hedera onboarding callout with faucet link for new users
- **UX-02**: Link expiration or renewal mechanism
- **UX-03**: Batch URL creation

### Infrastructure

- **INFRA-01**: Mainnet deployment (chain ID 295)
- **INFRA-02**: CI/CD pipeline
- **INFRA-03**: Backend HCS relay endpoint (avoid exposing operator key in browser)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mainnet deployment | Testnet sufficient for hackathon demo |
| HTS custom token | Using native HBAR — simpler, lower barrier |
| HashPack wallet support | MetaMask via JSON-RPC relay is sufficient |
| Mobile app | Web-first approach |
| OAuth / social login | Wallet-only authentication |
| Circles SDK hybrid mode | Full removal, not gradual migration |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIGR-01 | Phase 1 | Complete (01-01) |
| MIGR-02 | Phase 1 | Complete (01-01) |
| MIGR-03 | Phase 1 | Complete (01-03) |
| MIGR-04 | Phase 1 | Complete (01-01) |
| MIGR-05 | Phase 1 | Complete (01-01) |
| CIRC-01 | Phase 1 | Complete (01-01) |
| CIRC-02 | Phase 1 | Complete (01-01) |
| CIRC-03 | Phase 1 | Complete (01-01) |
| CIRC-04 | Phase 1 | Complete |
| CIRC-05 | Phase 1 | Complete (01-01) |
| CONT-01 | Phase 1 | Complete |
| CONT-02 | Phase 1 | Complete |
| CONT-03 | Phase 1 | Complete |
| CONT-04 | Phase 1 | Complete (01-03) |
| CONT-05 | Phase 1 | Complete |
| PAY-01 | Phase 1 | Complete |
| PAY-02 | Phase 1 | Complete |
| PAY-03 | Phase 1 | Complete |
| PAY-04 | Phase 1 | Complete |
| HCS-01 | Phase 2 | Pending |
| HCS-02 | Phase 2 | Pending |
| HCS-03 | Phase 2 | Pending |
| HCS-04 | Phase 2 | Pending |
| HCS-05 | Phase 2 | Pending |
| PROOF-01 | Phase 2 | Pending |
| PROOF-02 | Phase 2 | Pending |
| PROOF-03 | Phase 2 | Pending |
| PROOF-04 | Phase 2 | Pending |
| DOCS-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-03 — MIGR-03, CONT-04 completed in plan 01-03 (Dashboard HashScan column + Hedera UI rebrand)*
