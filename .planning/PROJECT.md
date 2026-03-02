# DURL — Decentralized URL Shortener on Hedera

## What This Is

DURL is a decentralized URL shortener that stores short link mappings on-chain for immutable, censorship-resistant links. Users connect their wallet, create short URLs (random or custom), and resolve them via the smart contract. The platform is being migrated from Gnosis Chain to Hedera for the Hedera 2026 Hackathon (General/Open track).

## Core Value

Immutable, decentralized URL shortening — once a link is created on-chain, it cannot be censored, modified, or taken down by any central authority.

## Requirements

### Validated

- ✓ Random short URL generation via keccak256(sender, url, timestamp) — existing
- ✓ Custom short URL reservation with payment — existing
- ✓ On-chain URL resolution (getOriginalUrl) — existing
- ✓ User dashboard showing created links — existing
- ✓ MetaMask wallet integration — existing
- ✓ Analytics tracking for link visits — existing
- ✓ QR code generation for short links — existing

### Active

- [ ] Full migration from Gnosis Chain to Hedera testnet (chain ID 296)
- [ ] Replace CRC/Circles token payments with 1 HBAR native payment
- [ ] Remove all Circles SDK dependencies and logic
- [ ] Update smart contract for Hedera EVM compatibility with payable HBAR
- [ ] Add HCS (Hedera Consensus Service) logging for URL creation audit trail
- [ ] Update all explorer links to HashScan (hashscan.io)
- [ ] Update network switching to Hedera testnet via JSON-RPC relay
- [ ] Update environment configuration for Hedera endpoints
- [ ] Create Lean/Business Model Canvas document
- [ ] Create Go-To-Market (GTM) strategy document
- [ ] Document key design decisions

### Out of Scope

- Mainnet deployment — testnet only for hackathon
- HTS (Hedera Token Service) custom token — using native HBAR instead
- Mobile app — web-first
- OAuth / social login — wallet-only auth
- Real-time chat or social features — not core to URL shortening
- Circles SDK / CRC token support — being fully removed
- UI framework migration — keeping Bootstrap 5 + SCSS

## Context

- Existing codebase built with React 19 + TypeScript + ethers.js 6 on Gnosis Chain
- Hedera EVM is compatible with Solidity contracts via JSON-RPC relay (Hashio)
- Hedera testnet RPC: https://testnet.hashio.io/api (chain ID 296)
- MetaMask works with Hedera via the JSON-RPC relay (same ethers.js flow)
- HCS provides a public, timestamped, ordered log — ideal for audit trail of URL creations
- Hackathon judging weights: Execution 20%, Success 20%, Integration 15%, Validation 15%, Innovation 10%, Feasibility 10%, Pitch 10%
- Integration scoring rewards deep use of multiple Hedera services (EVM + HCS = stronger score)
- Success scoring rewards driving Hedera account creation and network activity

## Constraints

- **Tech stack**: Keep ethers.js, React, Bootstrap 5, SCSS — no framework migrations
- **Wallet**: MetaMask compatibility must be maintained
- **Network**: Hedera testnet only (chain ID 296)
- **Payment**: 1 HBAR for custom links, free for random
- **Hackathon**: Must include business docs (Lean Canvas, GTM, design decisions) for judging

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Migrate fully to Hedera (not hybrid) | Hackathon judges score Hedera integration depth | — Pending |
| Use HBAR native payment (not HTS token) | Simpler, lower barrier, no token approval UX | — Pending |
| Add HCS logging for URL creations | Boosts Integration score with second Hedera service | — Pending |
| Keep ethers.js (not Hedera SDK) | Hedera JSON-RPC relay is EVM-compatible, less refactoring | — Pending |
| Testnet only | Sufficient for hackathon demo, free HBAR from faucet | — Pending |
| 1 HBAR custom link fee | Low barrier (~$0.18), encourages usage for demo | — Pending |

---
*Last updated: 2026-03-02 after initialization*
