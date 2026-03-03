---
phase: 01-hedera-evm-migration
plan: 01
subsystem: infra
tags: [hedera, ethers, metamask, evm, react, typescript]

# Dependency graph
requires: []
provides:
  - HederaConfig.ts with HEDERA_CHAIN_ID (296), HEDERA_CHAIN_ID_HEX (0x128), HEDERA_RPC_URL, HEDERA_EXPLORER_URL, getHashScanTxUrl, getHashScanContractUrl
  - NetworkSwitcher.ts with switchToHedera() targeting Hedera Testnet via wallet_switchEthereumChain / wallet_addEthereumChain
  - abi_hedera.json (renamed from abi_xDAI.json, same content — Plan 02 will update after redeploy)
  - Zero Circles SDK dependencies (all @circles-sdk/* packages uninstalled)
  - Clean npm run build with zero errors
  - .env configured for Hedera testnet (REACT_APP_HEDERA_RPC_URL, REACT_APP_CHAIN_ID=296, REACT_APP_EXPLORER_URL)
affects: [01-02, 01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HederaConfig.ts as single source of truth for chain constants (no magic strings)"
    - "wallet_addEthereumChain fallback when chainId 0x128 not in MetaMask (error code 4902)"
    - "HBAR native currency with 18 EVM decimals via Hashio relay"

key-files:
  created:
    - prototype/src/utils/HederaConfig.ts
    - prototype/src/abi_hedera.json
  modified:
    - prototype/src/utils/NetworkSwitcher.ts
    - prototype/src/components/UrlForms.tsx
    - prototype/src/components/Dashboard.tsx
    - prototype/src/components/utils/RedirectPage.tsx
    - prototype/.env
    - prototype/package.json
    - prototype/package-lock.json
  deleted:
    - prototype/src/utils/CirclesConfig.ts
    - prototype/src/contractMethods/CRCPaymentProvider.ts
    - prototype/src/abi_xDAI.json
    - prototype/src/abi_ETH.json

key-decisions:
  - "abi_hedera.json keeps xDAI ABI content unchanged — Plan 02 will update after Hedera contract redeploy"
  - "UrlForms.tsx handleSubmit stubbed with TODO comment — Plan 02 rewrites full Hedera submission logic"
  - "REACT_APP_CONTRACT_ADDRESS kept as old xDAI address temporarily — Plan 02 updates after redeploy"
  - "UI copy referencing Circles/CRC not changed (About.tsx, ShortenPage.tsx) — out of scope for infra plan"

patterns-established:
  - "Import chain constants exclusively from HederaConfig.ts, never hardcode chain IDs"
  - "NetworkSwitcher pattern: try switchEthereumChain, catch 4902 → addEthereumChain"

requirements-completed: [MIGR-01, MIGR-02, MIGR-04, MIGR-05, CIRC-01, CIRC-02, CIRC-03, CIRC-05]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 1 Plan 1: Circles Removal and Hedera Foundation Summary

**Circles SDK fully removed and Hedera testnet configured: HederaConfig.ts, switchToHedera() with chain ID 0x128, Hashio RPC, .env updated, ABI renamed — clean npm build with zero errors**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-03T11:11:20Z
- **Completed:** 2026-03-03T11:15:22Z
- **Tasks:** 2
- **Files modified:** 9 (7 modified, 2 created, 4 deleted)

## Accomplishments
- Deleted all Circles SDK source files (CirclesConfig.ts, CRCPaymentProvider.ts) and uninstalled all 5 @circles-sdk/* npm packages
- Created HederaConfig.ts exporting HEDERA_CHAIN_ID (296), HEDERA_CHAIN_ID_HEX (0x128), HEDERA_RPC_URL, HEDERA_EXPLORER_URL, getHashScanTxUrl, getHashScanContractUrl
- Rewrote NetworkSwitcher.ts with switchToHedera() targeting Hedera Testnet via Hashio RPC (testnet.hashio.io/api)
- Renamed abi_xDAI.json to abi_hedera.json and updated all 3 import sites (Dashboard.tsx, UrlForms.tsx, RedirectPage.tsx)
- Updated .env with REACT_APP_HEDERA_RPC_URL, REACT_APP_CHAIN_ID=296, REACT_APP_EXPLORER_URL
- Updated RedirectPage.tsx to use REACT_APP_HEDERA_RPC_URL for its JsonRpcProvider
- Stubbed UrlForms.tsx handleSubmit for Plan 02 rewrite (Circles import lines removed)
- npm run build passes with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete Circles files, uninstall npm packages, create HederaConfig.ts, rename ABI** - `4a3bc4c` (feat)
2. **Task 2: Rewrite NetworkSwitcher.ts, update .env, update RedirectPage.tsx** - `696baca` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `prototype/src/utils/HederaConfig.ts` - Hedera chain constants and HashScan URL helpers (CREATED)
- `prototype/src/abi_hedera.json` - Smart contract ABI renamed from abi_xDAI.json (CREATED)
- `prototype/src/utils/NetworkSwitcher.ts` - Replaced switchToGnosis() with switchToHedera() targeting chain 0x128
- `prototype/src/components/UrlForms.tsx` - Removed all Circles imports, stubbed handleSubmit for Plan 02
- `prototype/src/components/Dashboard.tsx` - Updated ABI import to abi_hedera.json
- `prototype/src/components/utils/RedirectPage.tsx` - Updated ABI import and switched to REACT_APP_HEDERA_RPC_URL
- `prototype/.env` - Added REACT_APP_HEDERA_RPC_URL, REACT_APP_CHAIN_ID, REACT_APP_EXPLORER_URL; removed REACT_APP_INFURA_URL
- `prototype/package.json` - All @circles-sdk/* packages removed
- `prototype/package-lock.json` - Updated after uninstall

## Decisions Made
- ABI content unchanged for now (Plan 02 will update after redeploying contract to Hedera testnet)
- UrlForms.tsx handleSubmit stubbed rather than partially rewritten — cleaner break point for Plan 02
- CONTRACT_ADDRESS kept at old xDAI address temporarily — Plan 02 deploys and updates

## Deviations from Plan

None - plan executed exactly as written.

The UrlForms.tsx UI copy ("Cost: 5 CRC + xDAI gas fee") and ShortenPage.tsx subtitle ("Powered by Circles.") contain text references to Circles but these are UI strings, not SDK imports. The verification criteria targeted code imports; these are intentionally left for a UI cleanup plan. Discovered and logged but not fixed (out of scope per deviation scope boundary rules).

## Issues Encountered
None — build passed cleanly after all changes. The pre-existing ESLint warnings in ShortenPage.tsx, Footer.tsx, and Nav.tsx are unrelated to this plan's changes and not fixed (out of scope).

## User Setup Required
None - all configuration changes are in `.env` which is managed by the project. No external service credentials required.

## Next Phase Readiness
- HederaConfig.ts and NetworkSwitcher.ts ready for consumption by Plan 02 (contract deployment and submission logic) and Plan 03 (HCS integration)
- UrlForms.tsx stub ready for Plan 02 to write full Hedera submission flow
- REACT_APP_CONTRACT_ADDRESS needs update after Plan 02 deploys contract to Hedera testnet
- UI copy (Circles/CRC references in About.tsx and ShortenPage.tsx) needs update in a later UI plan

---
*Phase: 01-hedera-evm-migration*
*Completed: 2026-03-03*
