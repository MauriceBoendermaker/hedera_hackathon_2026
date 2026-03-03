# Phase 1: Hedera EVM Migration - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate DURL from Gnosis Chain to Hedera testnet. Replace all chain config, remove Circles SDK entirely, update smart contract to accept HBAR payments, update all explorer links to HashScan. The app must work end-to-end on Hedera testnet with MetaMask.

</domain>

<decisions>
## Implementation Decisions

### Payment Confirmation UX
- After paying 1 HBAR for a custom link: show inline confirmation on page (tx hash, short link, HashScan link) AND a toast notification
- Both mechanisms fire — inline for detail, toast for quick feedback
- Free random links also show inline confirmation + toast (without payment info)

### Explorer Integration (HashScan)
- HashScan links appear in creation success toasts
- HashScan links appear inline on page after link creation
- Dashboard shows a small HashScan icon per link, linking to its creation transaction
- Copy-to-clipboard button for tx hash in dashboard
- All explorer links use `https://hashscan.io/testnet/transaction/{txHash}` format

### Network Switching UX
- Auto-prompt wallet_switchEthereumChain when user is on wrong network (same pattern as current Gnosis switching)
- If Hedera testnet not in wallet, auto-trigger wallet_addEthereumChain with full config
- Keep current auto-prompt pattern — no blocking UI or manual banners

### Hedera Branding
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

</decisions>

<specifics>
## Specific Ideas

- Payment flow should feel seamless — user pays 1 HBAR directly with the transaction, no separate approval step (unlike current CRC flow which had token approval)
- Dashboard should feel like a link management tool — each row has the short link, original URL, visit count, HashScan link, and copy button
- Keep the existing UI aesthetic (Bootstrap 5, dark theme, animated background) — this is a migration, not a redesign

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ShowToast(message, type)`: Toast utility — reuse for all notifications, update messages for Hedera context
- `NetworkSwitcher.ts`: Network switching logic — replace Gnosis config with Hedera testnet config
- `QRModal.tsx`: QR code modal — reuse unchanged
- `Dashboard.tsx`: Link management — add HashScan column and copy button
- `UrlForms.tsx`: Form + submit logic — remove CRC payment, add HBAR msg.value
- `RedirectPage.tsx`: URL resolution — update provider RPC only

### Established Patterns
- ethers.js v6 `BrowserProvider` + `getSigner()` for wallet interaction — works on Hedera via JSON-RPC relay
- Contract instantiation via `new ethers.Contract(address, abi, signer)` — reuse pattern
- `receipt.logs` parsing for ShortUrlCreated event — ADD null guard + `provider.getLogs()` fallback (Hedera relay may return empty logs)
- `useState` + `useEffect` for component state — no change needed
- SCSS component files in `assets/scss/components/` — follow same pattern for any new styles

### Integration Points
- `App.tsx` routing: No route changes needed for Phase 1
- `Nav.tsx`: Update any Gnosis/CRC references in navigation
- `public/index.html`: Update meta tags, page title if needed
- `.env`: New variables for Hedera RPC, chain ID, explorer URL
- `abi_xDAI.json`: Replace with Hedera-deployed contract ABI (may be identical if contract unchanged)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-hedera-evm-migration*
*Context gathered: 2026-03-02*
