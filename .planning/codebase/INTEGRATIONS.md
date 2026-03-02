# External Integrations

**Analysis Date:** 2026-03-02

## APIs & External Services

**Blockchain RPC Providers:**
- Gnosis Chain RPC - `https://rpc.gnosischain.com`
  - SDK: ethers.js
  - Used in: `src/utils/NetworkSwitcher.ts` for network switching
  - Purpose: Primary chain for URL shortener contract and CRC token operations

- Custom Circles RPC - `https://static.94.138.251.148.clients.your-server.de/rpc/`
  - SDK: @circles-sdk/adapter-ethers
  - Used in: `src/utils/CirclesConfig.ts`
  - Purpose: Circles protocol endpoints for SDK initialization

- Infura RPC Provider - (configured via `REACT_APP_INFURA_URL` env var)
  - SDK: ethers.js (JsonRpcProvider)
  - Used in: `src/components/utils/RedirectPage.tsx`
  - Purpose: Read-only contract calls for URL resolution

**Block Explorers:**
- Etherscan - `https://sepolia.etherscan.io`
  - Used in: `src/components/ShortenPage.tsx`
  - Purpose: Display transaction links for Sepolia testnet

- GnosisScan - `https://gnosisscan.io`
  - Used in: `src/components/UrlForms.tsx`
  - Purpose: Display transaction links for Gnosis Chain transactions

**Circles Protocol Services:**
- Pathfinder URL - `https://pathfinder.aboutcircles.com`
  - SDK: @circles-sdk/sdk
  - Used in: `src/utils/CirclesConfig.ts` (GnosisChainConfig)
  - Purpose: Graph/pathfinding service for trust network navigation

- Profile Service - `https://static.94.138.251.148.clients.your-server.de/profiles/`
  - SDK: @circles-sdk/sdk
  - Used in: `src/utils/CirclesConfig.ts`
  - Purpose: Profile data and avatar information

## Data Storage

**Databases:**
- None (Blockchain-based)
  - All URL mappings stored on-chain
  - Contract address: configured via `REACT_APP_CONTRACT_ADDRESS` env var

**File Storage:**
- Local filesystem only
  - Analytics logs: `analytics/logs.json`
  - Generated at runtime by Node.js analytics server

**Caching:**
- None detected
- In-memory state management via React hooks (useState)

## Authentication & Identity

**Auth Provider:**
- MetaMask (Browser wallet)
  - Implementation: `window.ethereum` provider injection
  - Used in: All contract interaction components
  - Key functions:
    - `eth_requestAccounts` - Account connection
    - `eth_accounts` - Get connected accounts
    - `wallet_switchEthereumChain` - Network switching
    - `wallet_addEthereumChain` - Add new network

**Wallet Integration:**
- Files: `src/components/UrlForms.tsx`, `src/components/Dashboard.tsx`, `src/contractMethods/CRCPaymentProvider.ts`
- Signer acquisition: `ethers.BrowserProvider(window.ethereum).getSigner()`
- Address-based access control for viewing user's links

## Monitoring & Observability

**Error Tracking:**
- None detected
- Console logging for errors and debugging

**Logs:**
- Analytics tracking: `/analytics/server.cjs` endpoint `/track`
  - Logs stored in `analytics/logs.json`
  - Tracked data: shortId, timestamp, referrer, userAgent, client IP
  - Endpoint path: `http://localhost:3001/track` (POST)
- Dashboard stats: `/analytics/server.cjs` endpoint `/stats`
  - Provides click counts per shortId
  - Endpoint path: `http://localhost:3001/stats` (GET)

## CI/CD & Deployment

**Hosting:**
- Not specified - appears to be static React app + Node.js backend
- Frontend deployed as SPA (Single Page Application)
- Analytics backend runs as separate Node.js process

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars:**
- `REACT_APP_CONTRACT_ADDRESS` - Smart contract address (xDAI network)
- `REACT_APP_PROJECT_URL` - Base URL for shortened links (e.g., https://durl.dev)
- `REACT_APP_INFURA_URL` - Infura or other RPC provider for read-only calls
- `PORT` - Analytics server port (default: 3001)

**Secrets location:**
- `.env` file at `prototype/.env`
- Contains contract addresses and RPC URLs

## Webhooks & Callbacks

**Incoming:**
- Analytics tracking endpoint: `POST http://localhost:3001/track`
  - Called by: `src/components/utils/RedirectPage.tsx`
  - Payload: `{ shortId, timestamp, referrer, userAgent }`

**Outgoing:**
- None detected

## Smart Contracts

**URL Shortener Contract:**
- Network: Gnosis Chain (xDAI)
- Address: `REACT_APP_CONTRACT_ADDRESS` env var
- ABI: `src/abi_xDAI.json`
- Key functions:
  - `createCustomShortUrl(customId: string, originalUrl: string)` - Create custom short link
  - `generateShortUrl(originalUrl: string)` - Generate random short link
  - `getOriginalUrl(shortId: string)` - Resolve short link to original URL
  - `getUserLinks(userAddress: string)` - Get user's created links
  - `shortIdExists(customId: string)` - Check if custom ID taken
- Events: `ShortUrlCreated(user, shortId, originalUrl, createdAt)`

**Circles Protocol Contracts:**
- Network: Gnosis Chain
- Hub Address (v1): `0x29b9a7fbb8995b2423a71cc17cf9810798f6c543`
- Hub Address (v2): `0x3D61f0A272eC69d65F5CFF097212079aaFDe8267`
- Used for: CRC token transfers and trust network operations
- Implementation: `src/contractMethods/CRCPaymentProvider.ts`
- Payment receiver: `0x266C002fd57F76138dAAf2c107202377e4C3B5A7` (or alternative if user is same)
- Payment amount: 5 CRC tokens per custom URL

---

*Integration audit: 2026-03-02*
