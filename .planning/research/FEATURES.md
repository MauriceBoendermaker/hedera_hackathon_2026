# Feature Landscape

**Domain:** Decentralized URL Shortener on Hedera (dApp — EVM + HCS)
**Researched:** 2026-03-02
**Milestone context:** Migration from Gnosis Chain to Hedera + HCS audit trail addition

---

## What Already Exists (Prototype Baseline)

The prototype on Gnosis Chain has the following working features. These carry over to the Hedera migration — the question is what to add, what to replace, and what to deliberately skip.

| Existing Feature | Status | Notes |
|------------------|--------|-------|
| Random short URL generation (keccak256 hash) | Working | `generateShortUrl()` on-chain |
| Custom short URL reservation | Working | `createCustomShortUrl()` — currently paid in CRC |
| On-chain URL resolution (`getOriginalUrl`) | Working | Read-only, no wallet needed |
| User dashboard (links per wallet) | Working | `getUserLinks()` call |
| MetaMask wallet integration | Working | ethers.js BrowserProvider |
| Visit analytics (localhost server) | Working | Express.js + JSON file — fragile |
| QR code generation + download | Working | `qrcode.react` library |
| Redirect page (`/:shortId`) | Working | Resolves via read-only JSON-RPC |
| Block explorer link (GnosisScan) | Working | Must become HashScan |

---

## Table Stakes

Features judges expect to see. Missing any of these risks a failing mark on Execution (20%) or Integration (15%).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Full migration to Hedera testnet (chain ID 296) | Zero Hedera integration without this — disqualifying | Low | Replace chain ID, RPC URL, explorer URL. Existing ethers.js flow is EVM-compatible via Hashio |
| HBAR native payment for custom links | Replaces CRC/Circles entirely. Must be on-chain. 1 HBAR = ~$0.18, low friction | Low-Med | Change `createCustomShortUrl` to `payable`, check `msg.value >= 1 HBAR`. Remove all Circles SDK code |
| HashScan transaction links | Every tx hash in the UI must link to `hashscan.io/testnet/tx/[hash]`. Judges click these | Low | Find-and-replace all etherscan/gnosisscan URLs. Two locations: ShortenPage.tsx and UrlForms.tsx |
| Network auto-switch to Hedera testnet | MetaMask must prompt switch to chain ID 296 when wrong network detected | Low | Replace `switchToGnosis()` with `switchToHedera()`. Chain ID 0x128 (decimal 296) |
| Hedera JSON-RPC relay endpoint (Hashio) | Required for read-only resolution (RedirectPage) and write operations | Low | Replace INFURA_URL env var with `https://testnet.hashio.io/api` |
| Remove Circles SDK completely | CRCPaymentProvider.ts, CirclesConfig.ts, abi_ETH.json, Gnosis references | Low | Dead code now. Risk of confusing judges |
| HCS topic creation for URL audit trail | **Core differentiator that's also table stakes for Integration score**. Without it, the project uses only Hedera EVM — same as any chain migration | Med | `@hashgraph/sdk` TopicCreateTransaction + TopicMessageSubmitTransaction. One topic per deployment, messages contain shortId + creator address + timestamp |

**Rationale for HCS being table stakes:** The judging criteria for Integration (15%) explicitly asks "What services are used?" and "Is a Hedera service being integrated in a way it hasn't been seen before?" Using only the EVM layer scores the same as deploying on Polygon. HCS is what makes this demonstrably Hedera-native.

---

## Differentiators

Features that elevate the score above baseline. Judges reward creativity and depth, not breadth.

| Feature | Value Proposition | Addresses Criterion | Complexity | Notes |
|---------|-------------------|---------------------|------------|-------|
| HashScan deep-link for HCS topic messages | After creating a short link, show TWO links: the EVM transaction AND the HCS message on HashScan. Judges see both Hedera services in one action | Integration (15%) | Low | HashScan supports `hashscan.io/testnet/topic/[topicId]` views. Embed link in confirmation UI |
| "Verify on HashScan" button per link | Dashboard row gets a button linking directly to the HCS message for that link's creation event. Makes audit trail tangible and demoable | Integration (15%), Execution (20%) | Low-Med | Requires storing HCS sequence number or consensus timestamp alongside each link |
| HBAR faucet callout in UI | Non-Hedera users need testnet HBAR to create links. A prominent link to `https://portal.hedera.com/register` or the faucet reduces friction and drives new account creation | Success (20%) — drives account creation | Low | Static link. High scoring return for minimal effort. Success criterion explicitly rewards new Hedera accounts |
| Hedera wallet onboarding flow | Display a "Don't have a Hedera account?" notice with steps: create account on Hedera Portal, add MetaMask via Hashio, get testnet HBAR | Success (20%), Validation (15%) | Low | Addresses the "drives account creation" success metric directly. Can be a modal or about section |
| Live HCS feed on homepage | Show a real-time scrolling list of recent URL creations from the HCS topic (poll Mirror Node API). Every visitor sees network activity without a wallet | Innovation (10%), Success (20%) — demonstrates TPS | Med | Mirror Node REST API: `api.testnet.mirrornode.hedera.com/api/v1/topics/{topicId}/messages`. Requires no wallet. Great demo moment |
| Link creation confirmation with dual proof | After shortening a URL, show: (1) EVM tx hash + HashScan link, (2) HCS sequence number + HashScan topic link. Two on-chain proofs of one action | Innovation (10%), Integration (15%) | Low-Med | This is the "hasn't been seen before" angle — EVM write triggering HCS message is an uncommon pattern |
| Lean Canvas + GTM strategy document | Required for Feasibility (10%) criterion. Without business docs, automatic deduction | Feasibility (10%), Execution (20%) | Low | Non-code deliverable. Judges explicitly check for Lean/Business Model Canvas and GTM strategy |
| Design decisions document | Execution (20%) explicitly asks "did the team identify important design decisions?" | Execution (20%) | Low | Document: why HBAR not HTS token, why HCS not just EVM events, why testnet, why MetaMask over Hedera native wallet |

---

## Anti-Features

Things to deliberately NOT build. Each of these wastes hackathon time with no scoring upside.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| HTS (Hedera Token Service) custom token | Already marked out-of-scope. High complexity, UX friction (users must associate token), no scoring advantage over HBAR payment | Use HBAR directly. `msg.value` in Solidity is HBAR on Hedera EVM |
| Mainnet deployment | Out-of-scope. Testnet is sufficient and judges expect it. Mainnet HBAR has real cost | Deploy testnet only, label clearly in UI |
| Link deletion / expiry | Adds smart contract complexity with no hackathon scoring benefit. Undermines the "immutable, censorship-resistant" value proposition | Keep links permanent — it's the differentiator |
| Social features (sharing, profiles, comments) | No scoring uplift, significant scope creep | The dashboard IS the social layer — your links, your wallet |
| OAuth / social login | Already out-of-scope. Adds auth complexity that fights the wallet-native UX story | Wallet-only is the right choice and a talking point |
| Mobile-responsive redesign | Risky UI work mid-hackathon. Bootstrap 5 already handles basics | Test on mobile but don't redesign |
| Custom Hedera native wallet (HashPack) | Adds a second wallet integration path with high complexity. MetaMask via JSON-RPC relay is the clean path | Keep MetaMask only. Note HashPack as future work in design decisions |
| Real-time WebSocket link analytics | Replacing the Express.js analytics server with something robust is scope creep. Analytics are a nice-to-have, not judged | Keep or drop the analytics server. If kept, acknowledge it's centralized and contrast with the HCS audit trail being decentralized |
| URL validation / phishing detection | High complexity, requires oracle or external API. False signals of safety could be a liability | Add a disclaimer: "DURL does not validate link destinations. Links are immutable once created." |
| Multi-chain support | The entire Hedera migration pitch depends on being Hedera-only. Multi-chain dilutes the integration score | Hedera only. Reference the Gnosis origin as "migrated from" in the pitch narrative |

---

## Feature Dependencies

```
Hedera testnet migration (chain ID 296 + Hashio RPC)
  └── HBAR payment for custom links (requires EVM on Hedera)
  └── HashScan transaction links (requires Hedera tx hash format)
  └── Network auto-switch to Hedera (requires chain ID 296)

HCS topic creation (one-time setup, deploy-time)
  └── HCS message on URL creation (requires topic ID)
      └── HashScan HCS deep-link in UI (requires topic ID + sequence number)
      └── "Verify on HashScan" button in dashboard (requires storing HCS ref per link)
      └── Live HCS feed on homepage (requires Mirror Node polling)

HBAR faucet callout (standalone — no dependencies)
Hedera wallet onboarding flow (standalone — no dependencies)
Lean Canvas + GTM docs (standalone — no dependencies)
Design decisions document (standalone — no dependencies)
```

**Critical path:** The migration must land before any HCS work begins. HCS topic creation is a one-time operation — it can be done in a migration script or manually via the Hedera portal/SDK before the app deploys. Everything else flows from the topic ID being available.

---

## MVP Recommendation

**Must ship (judges mark down without these):**

1. Full Hedera testnet migration — chain ID 296, Hashio RPC, remove Circles SDK
2. HBAR payable custom link creation — `msg.value` payment in updated smart contract
3. HashScan links for all transactions — replace etherscan/gnosisscan throughout
4. HCS logging for every URL creation — one topic, one message per shortening event
5. HBAR faucet callout + Hedera onboarding notice — drives the Success (20%) metric

**Should ship (meaningful scoring uplift, low effort):**

6. Dual proof confirmation UI — show EVM tx + HCS sequence number after creation
7. HashScan HCS deep-link in dashboard — "Verify" button per link
8. Lean Canvas + GTM + Design Decisions documents — required for Feasibility + Execution

**Nice to have (ship if time allows):**

9. Live HCS feed on homepage — polls Mirror Node, no wallet needed, strong demo moment

**Defer entirely:**

- HTS token, link deletion, social features, multi-chain, HashPack wallet, phishing detection

---

## Scoring Impact Summary

| Feature | Judging Criterion | Weight | Impact |
|---------|-------------------|--------|--------|
| HCS audit trail | Integration | 15% | Very High — adds second Hedera service |
| HBAR payment | Integration, Execution | 15% + 20% | High — core Hedera-native mechanic |
| Hedera account onboarding UI | Success | 20% | High — directly drives new accounts |
| HBAR faucet link | Success | 20% | High — low effort, high yield |
| HashScan links throughout | Integration, Execution | 15% + 20% | High — makes Hedera visible to judges |
| Dual proof confirmation | Innovation | 10% | Medium — creative use of EVM + HCS |
| Live HCS feed | Innovation, Success | 10% + 20% | Medium — good demo, requires Mirror Node |
| Business documents | Feasibility, Execution | 10% + 20% | High — explicit checklist items |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| What already exists | HIGH | Read prototype source directly |
| HCS feasibility | HIGH | Well-established Hedera service, @hashgraph/sdk is stable; JSON-RPC + HCS SDK coexist cleanly |
| HBAR payment via `msg.value` | HIGH | Hedera EVM documentation confirms HBAR is the native currency on the EVM layer, `msg.value` = tinybars |
| Mirror Node API for live feed | MEDIUM | Mirror Node REST API is public and documented but rate limits on testnet are unverified; needs validation |
| HashScan deep-links for HCS messages | MEDIUM | HashScan supports topic views; exact URL format for individual messages needs verification against live HashScan |
| Scoring impact estimates | MEDIUM | Based on reading judging criteria literally; actual judge behavior may vary |

---

## Sources

- `/c/xampp/htdocs/hedera_hackathon_2026/CRITERIA.md` — Hackathon judging criteria (primary source for scoring weights)
- `/c/xampp/htdocs/hedera_hackathon_2026/.planning/PROJECT.md` — Project context, constraints, out-of-scope decisions
- `/c/xampp/htdocs/hedera_hackathon_2026/prototype/src/` — Existing codebase: UrlForms.tsx, Dashboard.tsx, ShortenPage.tsx, RedirectPage.tsx, analytics/server.cjs, abi_xDAI.json
- Training data: Hedera HCS SDK patterns, Mirror Node REST API, Hedera EVM `msg.value` behavior (MEDIUM confidence — web search was unavailable; verify HCS SDK integration patterns against `docs.hedera.com` before implementation)
