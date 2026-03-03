---
phase: 01-hedera-evm-migration
plan: 02
subsystem: payments
tags: [hedera, ethers, solidity, hbar, evm, react, typescript]

# Dependency graph
requires:
  - phase: 01-01
    provides: HederaConfig.ts, NetworkSwitcher.ts, abi_hedera.json stub, UrlForms.tsx stub
provides:
  - Payable DURLShortener.sol Solidity contract with 1 HBAR createCustomShortUrl
  - Deployed contract on Hedera testnet at 0x51A7C192eCCc7Cd93FBE56F472627998E231D9CC
  - Updated abi_hedera.json with payable stateMutability
  - Fully rewritten UrlForms.tsx with HBAR payment, inline confirmation, receipt.logs fallback
affects: [01-03, 01-04, 01-05, 02-hcs-activity-feed]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ethers.parseEther('1') = 1 HBAR via Hedera EVM 18-decimal mapping"
    - "hardcoded gasLimit: 400000 on all contract writes"
    - "provider.getLogs() fallback for empty receipt.logs on Hedera relay"
    - "localStorage.setItem('txHash_${shortId}', hash) for tx persistence"
    - "inline alert-success div + ShowToast() for dual-channel confirmation UX"

key-files:
  created:
    - prototype/contracts/DURLShortener.sol
  modified:
    - prototype/src/components/UrlForms.tsx
    - prototype/src/abi_hedera.json
    - prototype/.env

key-decisions:
  - "Contract deployed to Hedera testnet at 0x51A7C192eCCc7Cd93FBE56F472627998E231D9CC"
  - "ethers.parseEther('1') confirmed as correct way to send 1 HBAR via Hashio EVM relay"
  - "parseShortUrlCreated() always uses provider.getLogs() fallback — Hedera relay may return empty receipt.logs"

patterns-established:
  - "Contract call pattern: contract.fn(args, { value: ethers.parseEther('1'), gasLimit: 400000 })"
  - "Event parsing: iface.parseLog() with getLogs() fallback for Hedera relay quirk"
  - "Confirmation UX: inline alert-success block + ShowToast() fire together"

requirements-completed: [CIRC-04, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, PAY-01, PAY-02, PAY-03, PAY-04]

# Metrics
duration: 15min
completed: 2026-03-03
---

# Phase 01 Plan 02: Hedera Contract Deploy + HBAR Payment Form Summary

**Payable DURLShortener.sol deployed to Hedera testnet with UrlForms.tsx rewritten for 1 HBAR custom URL creation and free random URL creation, using ethers.js + receipt.logs fallback for Hashio relay compatibility**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-03T13:05:00Z
- **Completed:** 2026-03-03T13:20:48Z
- **Tasks:** 3 (2 auto + 1 human-action checkpoint)
- **Files modified:** 4

## Accomplishments
- Written complete DURLShortener.sol Solidity contract with payable createCustomShortUrl (1 HBAR required) and free generateShortUrl
- User deployed contract to Hedera testnet; ABI updated with payable stateMutability, .env updated with deployed address
- Fully rewrote UrlForms.tsx: removed all CRC/Circles/Gnosis code, implemented HBAR payment flow, inline confirmation, receipt.logs fallback, price disclaimer

## Task Commits

Each task was committed atomically:

1. **Task 1: Write updated Solidity contract with payable createCustomShortUrl** - `6c479e3` (feat)
2. **Task 2: Deploy contract to Hedera testnet and update ABI + contract address** - `USER ACTION` (3285818 — user commit with new contract address and ABI)
3. **Task 3: Rewrite UrlForms.tsx for Hedera HBAR payment with inline confirmation** - `132cefb` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `prototype/contracts/DURLShortener.sol` - Complete Solidity contract; createCustomShortUrl is payable (1 HBAR), generateShortUrl is free
- `prototype/src/components/UrlForms.tsx` - Full Hedera rewrite: HBAR payment, parseShortUrlCreated() with provider.getLogs() fallback, inline confirmation, price disclaimer
- `prototype/src/abi_hedera.json` - Updated by user after deploy; createCustomShortUrl now has "stateMutability":"payable"
- `prototype/.env` - Updated by user; REACT_APP_CONTRACT_ADDRESS = 0x51A7C192eCCc7Cd93FBE56F472627998E231D9CC

## Decisions Made
- Contract deployed at `0x51A7C192eCCc7Cd93FBE56F472627998E231D9CC` on Hedera testnet
- Custom slug input strips leading `/` before passing to contract (UI stores `/custom` but contract receives `custom`)
- Price disclaimer text locked: "Cost: 1 HBAR + gas fee" / "Cost: Free (gas fee only)"
- Inline confirmation uses `alert-success` Bootstrap class with short URL as full clickable link

## Deviations from Plan

None - plan executed exactly as written. The only notable detail: the existing UrlForms.tsx stub already had a partial implementation of the inline HashScan confirmation block (from a prior partial edit). The rewrite replaced it fully per spec.

## Issues Encountered

None — build succeeded without errors on first attempt. The only warnings were pre-existing unused variables in ShortenPage.tsx and Footer.tsx (not in scope of this plan).

## User Setup Required

None - contract already deployed by user. All environment variables set in prototype/.env.

## Next Phase Readiness
- UrlForms.tsx is fully functional for Hedera testnet; users can create custom (1 HBAR) and random (free) short URLs
- Contract address and ABI are in sync; inline confirmation + HashScan links work end-to-end
- Plans 03-05 can proceed: Dashboard, RedirectPage, and any remaining UI polish

---
*Phase: 01-hedera-evm-migration*
*Completed: 2026-03-03*

## Self-Check: PASSED

- FOUND: prototype/src/components/UrlForms.tsx
- FOUND: prototype/contracts/DURLShortener.sol
- FOUND: .planning/phases/01-hedera-evm-migration/01-02-SUMMARY.md
- FOUND: commit 6c479e3 (Task 1)
- FOUND: commit 132cefb (Task 3)
