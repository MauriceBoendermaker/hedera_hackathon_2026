---
phase: 01-hedera-evm-migration
plan: 03
subsystem: ui-branding
tags: [hedera, dashboard, hashscan, ui, branding, rebranding]
dependency_graph:
  requires: ["01-01"]
  provides: ["ui-hedera-branding", "dashboard-hashscan-column"]
  affects: ["prototype/src/components/Dashboard.tsx", "prototype/src/components/ShortenPage.tsx", "prototype/src/components/About.tsx", "prototype/src/components/How-it-works.tsx", "prototype/src/components/misc/Nav.tsx", "prototype/src/components/misc/Footer.tsx", "prototype/public/index.html"]
tech_stack:
  added: []
  patterns: ["localStorage per-link txHash", "HashScan explorer links via getHashScanTxUrl helper", "navigator.clipboard for tx hash copy"]
key_files:
  created: []
  modified:
    - prototype/src/components/Dashboard.tsx
    - prototype/src/components/ShortenPage.tsx
    - prototype/src/components/About.tsx
    - prototype/src/components/How-it-works.tsx
    - prototype/src/components/misc/Nav.tsx
    - prototype/src/components/misc/Footer.tsx
    - prototype/public/index.html
decisions:
  - "[UI]: HashScan column placed after Visits column for clear on-chain verification UX"
  - "[UI]: Built on Hedera badge placed in both Nav (brand area) and Footer for maximum visibility"
  - "[UI]: Footer unused useState/useRef imports removed during rebrand"
metrics:
  duration: "3 min"
  completed: "2026-03-03"
  tasks_completed: 2
  files_modified: 7
---

# Phase 1 Plan 03: Dashboard HashScan Column and Hedera UI Rebrand Summary

**One-liner:** Dashboard HashScan column with per-link verification and copy-tx-hash button; all UI surfaces rebranded from Gnosis/CRC/xDAI to Hedera/HBAR/HashScan.

## What Was Built

### Task 1: Dashboard HashScan Column (commit: e836bbf)

Updated `Dashboard.tsx` to add on-chain verification capabilities:

- Imported `getHashScanTxUrl` from `utils/HederaConfig`
- Added `HashScan` column to table header (5th column after Visits)
- Per-link HashScan icon (`fa-external-link-alt`) linking to `hashscan.io/testnet/transaction/{txHash}` via localStorage lookup (`txHash_{shortId}`)
- Copy-tx-hash button (`fa-hashtag`) writing txHash to clipboard with toast confirmation ("Tx hash copied!")
- Graceful fallback: links without stored txHash show `--` (muted dash)

### Task 2: Hedera Branding Across All UI Surfaces (commit: 68c62d6)

**ShortenPage.tsx:**
- Subtitle changed from "Powered by Circles" to "Powered by Hedera"
- Imported `getHashScanTxUrl` from `utils/HederaConfig`
- Explorer link changed from `sepolia.etherscan.io` to `hashscan.io/testnet/transaction/{txHash}` via helper
- Link text changed from "View on Etherscan" to "View on HashScan"

**About.tsx:**
- Paragraph 1: Describes dURL as built on Hedera with permanent, censorship-resistant links
- Paragraph 2: References Hedera network, Hedera EVM, HashScan for on-chain verification
- Paragraph 3: References 1 HBAR cost for custom links; removed CRC token fee, Circles system, and NFT analogy

**How-it-works.tsx:**
- Replaced "deployed on Gnosis Chain" with "deployed on Hedera's EVM-compatible network"
- Updated custom link cost to explicitly say "1 HBAR"
- Added "through Hedera's JSON-RPC relay" to the ethers.js interaction description

**Nav.tsx:**
- Added "Built on Hedera" badge (`badge bg-secondary`) next to the navbar brand

**Footer.tsx:**
- Added "Built on Hedera" paragraph with link to hedera.com
- Removed unused `useState` and `useRef` imports

**index.html:**
- `description`: Updated to reference Hedera explicitly
- `keywords`: Added Hedera, HBAR, HashScan; removed generic Web3-only terms
- `og:description`: Updated to reference Hedera
- `twitter:description`: Updated to reference Hedera

## Verification Results

All verification checks passed:

- `npm run build` succeeds (warnings pre-existing, no new errors)
- Zero occurrences of Gnosis, GnosisScan, Etherscan, Sepolia, xDAI, Circles, CRC in any modified file
- `hashscan` references confirmed in Dashboard.tsx (import + column header + href + title)
- `Hedera` confirmed in About.tsx (3 occurrences), Nav.tsx (badge), Footer.tsx (link), index.html (4 meta tags)
- `getHashScanTxUrl` confirmed imported and used in Dashboard.tsx

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- prototype/src/components/Dashboard.tsx: modified
- prototype/src/components/ShortenPage.tsx: modified
- prototype/src/components/About.tsx: modified
- prototype/src/components/How-it-works.tsx: modified
- prototype/src/components/misc/Nav.tsx: modified
- prototype/src/components/misc/Footer.tsx: modified
- prototype/public/index.html: modified

### Commits Exist
- e836bbf: feat(01-03): add HashScan column and copy-tx-hash button to Dashboard
- 68c62d6: feat(01-03): rebrand all UI surfaces from Gnosis/CRC to Hedera

## Self-Check: PASSED
