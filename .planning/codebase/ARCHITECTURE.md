# Architecture

**Analysis Date:** 2026-03-02

## Pattern Overview

**Overall:** Client-Server Hybrid Web3 dApp with Blockchain Integration

**Key Characteristics:**
- React single-page application (SPA) with client-side routing
- Web3 wallet integration (MetaMask) for blockchain interaction
- Dual blockchain support: Circles SDK (Gnosis Chain) and direct smart contract calls (xDAI)
- Separate analytics server running Node.js/Express
- Event-driven blockchain operations with transaction receipt parsing
- Component-based React architecture with state management via hooks

## Layers

**Presentation Layer:**
- Purpose: UI rendering, user interactions, form handling, state management
- Location: `src/components/`, `src/assets/scss/`
- Contains: React components, SCSS stylesheets, UI utilities
- Depends on: Web3 provider (window.ethereum), ethers.js, utilities
- Used by: Browser/React DOM

**Utility/Configuration Layer:**
- Purpose: Core configuration, shared helper functions, Web3 setup
- Location: `src/utils/`, `src/contractMethods/`
- Contains: CirclesConfig, NetworkSwitcher, CRC payment functions, contract method wrappers
- Depends on: ethers.js, Circles SDK
- Used by: Components, other utilities

**Smart Contract Interaction Layer:**
- Purpose: Blockchain communication, contract calls, transaction handling
- Location: `src/contractMethods/CRCPaymentProvider.ts`, ABI files (`src/abi_*.json`)
- Contains: Payment processing, token transfers, contract method calls
- Depends on: ethers.js, Circles SDK, provider/signer from MetaMask
- Used by: Components (UrlForms, Dashboard, RedirectPage)

**Analytics Layer:**
- Purpose: Track URL visits, serve visit statistics
- Location: `analytics/server.cjs`, logs stored in `analytics/logs.json`
- Contains: Express server with `/track` and `/stats` endpoints
- Depends on: Express, filesystem access
- Used by: Client-side tracking calls from RedirectPage, Dashboard

**Static Assets & Configuration:**
- Purpose: Entry point HTML, public assets, metadata
- Location: `public/`, `src/abi_*.json`
- Contains: index.html, favicon, logo, manifest, smart contract ABIs
- Depends on: Bootstrap CSS, Font Awesome, ethers.js library
- Used by: Browser, React app initialization

## Data Flow

**URL Shortening Flow (Custom URL with CRC Payment):**

1. User enters original URL and desired short path in `ShortenPage` → `UrlForms`
2. Form submits to `handleSubmit()` which:
   - Validates input URL format
   - Switches network to Gnosis Chain via `NetworkSwitcher.switchToGnosis()`
   - Requests wallet accounts via MetaMask
   - Checks if custom short URL already exists on contract
   - Calls `sendV2GroupCRC()` to transfer 5 CRC tokens to payment receiver (Circles SDK ERC-1155)
   - Calls smart contract `createCustomShortUrl(customId, originalUrl)` transaction
   - Parses transaction receipt for `ShortUrlCreated` event
   - Displays transaction hash and generated short link via `ShowToast` notifications

**URL Redirect Flow:**

1. User visits shortened URL (e.g., `durl.dev/#/shortid`)
2. `RedirectPage` component receives `shortId` from route params
3. Calls smart contract `getOriginalUrl(shortId)` via ethers.js JSON-RPC provider
4. Sends analytics data to `analytics/server.cjs` POST `/track` endpoint (user-agent, referrer, timestamp)
5. Redirects user to original URL via `window.location.href`

**Dashboard Data Fetch Flow:**

1. User navigates to `/dashboard` and component mounts
2. Calls wallet `eth_requestAccounts` to get connected address
3. Fetches all short links for wallet via contract `getUserLinks(address)`
4. For each short ID, calls contract `getOriginalUrl(shortId)` to get destination
5. Periodically fetches visit statistics from analytics server via GET `/stats` (every 5 seconds)
6. Renders table of user's shortened links with visit counts

**State Management:**

- Local component state via `useState()` hooks: form input, loading states, data arrays
- MetaMask provider state: wallet connection status, account address
- No centralized state management (Context API or Redux not used)
- Window global for custom cursor tracking in `App.tsx`

## Key Abstractions

**CirclesConfig (Circles SDK Configuration):**
- Purpose: Encapsulate Gnosis Chain network configuration and contract addresses
- Location: `src/utils/CirclesConfig.ts`
- Pattern: Singleton configuration object + async factory function
- Used by: `CRCPaymentProvider.ts` to initialize Circles SDK

**CRCPaymentProvider (Blockchain Payment Handler):**
- Purpose: Manage CRC token transfers using either Circles SDK (V1) or direct ERC-1155 contract calls (V2 group tokens)
- Location: `src/contractMethods/CRCPaymentProvider.ts`
- Pattern: Async functions wrapping ethers.js contract calls with error handling
- Exports: `CRCPaymentProvider()` (V1 legacy), `sendV2GroupCRC()` (current V2 implementation)

**URL Form Component (UrlForms):**
- Purpose: Handle URL shortening submission with dual modes (custom with CRC payment or random/free)
- Location: `src/components/UrlForms.tsx`
- Pattern: Functional component with local state, form validation, transaction handling
- Manages: Form input validation, blockchain transaction flow, UI feedback

**RedirectPage (Dynamic Route Handler):**
- Purpose: Resolve shortened URL to original destination and track visit
- Location: `src/components/utils/RedirectPage.tsx`
- Pattern: Functional component with useEffect for side-effect (redirect)
- Handles: Fallback logic for shortId variants, error handling, analytics posting

**ShowToast (Notification Utility):**
- Purpose: Create and display Bootstrap toast notifications
- Location: `src/components/utils/ShowToast.ts`
- Pattern: Pure function that creates DOM elements and uses Bootstrap Toast API
- Called by: Components for user feedback (success/danger notifications)

**MouseDots (Canvas Animation):**
- Purpose: Animated background with moving dots and connection lines
- Location: `src/components/misc/MouseDots.tsx`
- Pattern: Functional component with useEffect managing canvas animation loop
- Features: Dot physics, inter-dot connections, mouse interaction lines

## Entry Points

**Application Entry Point:**
- Location: `src/index.tsx`
- Triggers: Browser loads index.html, React mounts root
- Responsibilities: Creates React root, renders App component

**Main Application Component:**
- Location: `src/App.tsx`
- Triggers: Page load, navigation
- Responsibilities: Sets up React Router with HashRouter, defines route structure, manages custom cursor effect

**Route Structure:**
- `/` (ShortenPage) - Main URL shortening interface
- `/how-it-works` (HowItWorks) - Information page
- `/about` (About) - About page
- `/dashboard` (Dashboard) - User's shortened links management
- `/:shortId` (RedirectPage) - Dynamic redirect handler
- `*` (Navigate to /) - Fallback for unknown routes

**Analytics Server:**
- Location: `analytics/server.cjs`
- Triggers: `npm run start` executes concurrently with client
- Responsibilities: Listens on port 3001, handles /track and /stats endpoints

## Error Handling

**Strategy:** Try-catch blocks at critical blockchain operations with user feedback via toast notifications

**Patterns:**

- **Smart Contract Calls:** Wrapped in try-catch, errors displayed as alert/toast
  - Example: `Dashboard.tsx` useEffect catches contract read failures gracefully

- **Wallet Integration:** Checks for MetaMask availability before operations
  - Location: `UrlForms.tsx`, `Nav.tsx`, `CRCPaymentProvider.ts`
  - Pattern: `if (!window.ethereum)` validation before MetaMask calls

- **Transaction User Cancellation:** MetaMask returns error code 4001
  - Location: `UrlForms.tsx` line 155
  - Pattern: Specific check for `err.code === 4001`

- **Network Errors:** Fallback behavior in RedirectPage
  - If contract call fails, redirect to home page
  - Analytics failures logged to console but don't block redirect

## Cross-Cutting Concerns

**Logging:**
- `console.log()` and `console.error()` throughout for debugging
- No structured logging framework
- Trust level checks and transaction confirmations logged to console

**Validation:**
- URL validation: `isValidUrl()` in UrlForms checks URL format with URL constructor
- Short ID validation: Regex pattern `/^\/.*/.test(shortUrl)` requires leading slash
- Whitespace and special character removal: `value.replace(/[^a-zA-Z0-9_-]/g, '')`

**Authentication & Authorization:**
- No centralized authentication system
- Wallet address serves as user identity (derived from signer)
- No explicit access control; features available to any connected wallet
- Payment requirement (5 CRC) acts as rate-limiting mechanism for custom URLs

**Network Switching:**
- Gnosis Chain (chainId: 0x64) required for all blockchain operations
- Automatic network switching attempted in `NetworkSwitcher.switchToGnosis()`
- Fallback to adding network if not installed on user's wallet

---

*Architecture analysis: 2026-03-02*
