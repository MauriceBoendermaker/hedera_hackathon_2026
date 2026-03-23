# dURL - Decentralized URL Shortener on Hedera

**Hedera Hello Future Apex Hackathon 2026 | Theme 4: Open Track**

dURL is a decentralized URL shortener that stores short-link mappings on-chain via a Solidity smart contract deployed on the Hedera network. Once a link is created, it cannot be censored, modified, or taken down by any central authority, delivering truly immutable, censorship-resistant short URLs.

## Table of Contents

- [About the Hackathon](#about-the-hackathon)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Hedera Integration](#hedera-integration)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Smart Contract](#smart-contract)
- [Project Structure](#project-structure)
- [Demo](#demo)
- [Submission Details](#submission-details)
- [Hackathon Resources](#hackathon-resources)
- [License](#license)

## About the Hackathon

The [Hedera Hello Future Apex Hackathon](https://hellofuturehackathon.dev/) brings together new and experienced builders worldwide to collaborate and compete virtually, with a **$250K prize pool** and five weeks of hacking.

- **Hackathon Period:** February 17 - March 23, 2026
- **Track:** Theme 4: Open Track

## Features

- **Random Short URLs**: Generate short links via `keccak256(sender, url, timestamp)` hashing, completely free
- **Custom Short URLs**: Reserve a custom short ID for 1 HBAR
- **On-Chain Resolution**: All URL mappings stored and resolved directly from the smart contract
- **User Dashboard**: View and manage all your created links from a personal dashboard
- **Link Analytics**: Track visit counts, geographic distribution, and referrer data
- **QR Code Generation**: Create customizable QR codes for any short link
- **HCS Audit Trail**: Every URL creation is logged to the Hedera Consensus Service for a public, timestamped, immutable audit trail
- **Wallet Authentication**: Connect via MetaMask to create and manage links
- **Social Previews**: Server-side rendered Open Graph metadata for link sharing

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│            (React 19 + TypeScript + Bootstrap 5)         │
├──────────────┬──────────────────────┬───────────────────┤
│  MetaMask    │    ethers.js v6      │   QR Code Styling │
│  Wallet      │    (Contract Calls)  │   + Chart.js      │
└──────┬───────┴──────────┬───────────┴───────────────────┘
       │                  │
       ▼                  ▼
┌──────────────┐  ┌───────────────────────────────────────┐
│ Hedera EVM   │  │         Analytics Server (Express)     │
│ (Hashio RPC) │  │  ┌─────────────┐  ┌────────────────┐  │
│              │  │  │  SQLite DB   │  │  HCS Logger    │  │
│ Smart        │  │  │  (Analytics) │  │  (@hashgraph/  │  │
│ Contract     │  │  │              │  │   sdk)         │  │
└──────────────┘  │  └─────────────┘  └────────────────┘  │
                  └───────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Bootstrap 5, SCSS |
| Blockchain Interaction | ethers.js v6 |
| Smart Contract | Solidity ^0.8.19 |
| Network | Hedera Testnet (Chain ID 296) via Hashio JSON-RPC Relay |
| Consensus Logging | Hedera Consensus Service (HCS) via @hashgraph/sdk |
| Analytics Backend | Express.js, better-sqlite3, geoip-lite |
| QR Codes | qr-code-styling |
| Charts | Chart.js + react-chartjs-2 |
| Visual Effects | Three.js + Vanta.js |
| Logging | Pino |

## Hedera Integration

dURL leverages multiple Hedera network services:

1. **Hedera EVM (Smart Contract Service)**: The `DURLShortener.sol` contract is deployed on Hedera's EVM-compatible layer, accessed via the Hashio JSON-RPC relay. All URL mappings, ownership records, and payments are handled on-chain.


2. **Hedera Consensus Service (HCS)**: Every URL creation event is submitted as an HCS message, providing a publicly verifiable, timestamped audit trail independent of the smart contract state. Topic ID: `0.0.8191793`


3. **Native HBAR Payments**: Custom short URL reservations require a payment of 1 HBAR (100,000,000 tinybars), processed natively through the smart contract's `payable` function.

## Getting Started

### Prerequisites

- Node.js >= 18
- npm
- MetaMask browser extension
- Hedera Testnet HBAR ([faucet](https://portal.hedera.com/faucet))

### Installation

```bash
# Clone the repository
git clone https://github.com/MauriceBoendermaker/hedera_hackathon_2026.git
cd hedera_hackathon_2026/prototype

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# Start the app (frontend + analytics server)
npm start
```

This runs both the React frontend and the Express analytics server concurrently.

- Frontend: `http://localhost:3000`
- Analytics API: `http://localhost:5000`

### Build for Production

```bash
npm run build
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `REACT_APP_CONTRACT_ADDRESS` | Deployed DURLShortener contract address | Yes |
| `REACT_APP_CHAIN_ID` | Hedera Testnet chain ID (`296`) | Yes |
| `REACT_APP_HEDERA_RPC_URL` | Hashio RPC endpoint | Yes |
| `REACT_APP_EXPLORER_URL` | HashScan explorer base URL | Yes |
| `REACT_APP_HCS_TOPIC_ID` | HCS topic ID for audit trail | Yes |
| `TOKEN_SECRET` | JWT secret for auth tokens | Yes |
| `IP_HASH_SECRET` | Secret for hashing visitor IPs | Yes |
| `OPERATOR_ID` | Hedera operator account ID (server-side HCS) | Yes |
| `OPERATOR_KEY` | Hedera operator private key (server-side HCS) | Yes |
| `HCS_TOPIC_ID` | HCS topic ID (server-side) | Yes |
| `RETENTION_DAYS` | Analytics data retention period (default: 90) | No |

> **Note:** Never commit your `.env` file. The `.env.example` is provided as a template.

## Smart Contract

The `DURLShortener` contract (`prototype/contracts/DURLShortener.sol`) provides:

| Function | Description |
|----------|-------------|
| `generateShortUrl(originalUrl)` | Create a free random short URL (8-char hash) |
| `createCustomShortUrl(customId, originalUrl)` | Reserve a custom short ID (costs 1 HBAR) |
| `getOriginalUrl(shortId)` | Resolve a short ID to its original URL |
| `getShortLink(shortId)` | Get full link details (URL + creation timestamp) |
| `getUserLinks(address)` | List all short IDs created by a wallet address |
| `shortIdExists(shortId)` | Check if a short ID is already taken |

**Deployed Contract:** [`0xd8deBB79061f8eA999b6cF0f78D0e230367243cB`](https://hashscan.io/testnet/contract/0xd8deBB79061f8eA999b6cF0f78D0e230367243cB)

## Project Structure

```
prototype/
├── analytics/
│   └── server.cjs          # Express analytics server + HCS logger
├── contracts/
│   └── DURLShortener.sol    # Solidity smart contract
├── public/                  # Static assets & favicons
├── src/
│   ├── components/
│   │   ├── About.tsx            # About page
│   │   ├── Dashboard.tsx        # User link dashboard
│   │   ├── How-it-works.tsx     # How it works page
│   │   ├── LinkAnalytics.tsx    # Link analytics view
│   │   ├── PrivacyPolicy.tsx    # Privacy policy
│   │   ├── ShortenPage.tsx      # Main URL shortening page
│   │   ├── UrlForms.tsx         # URL input forms
│   │   ├── misc/                # Nav, Footer, MouseDots
│   │   └── utils/               # QR modal, Feedback, ErrorBoundary, RedirectPage
│   ├── hooks/                   # useTiltEffect, useDebounce
│   ├── utils/
│   │   ├── HederaConfig.ts      # Hedera network configuration
│   │   ├── NetworkSwitcher.ts   # MetaMask network switching
│   │   ├── hcsLogger.ts         # HCS message submission
│   │   ├── auth.ts              # Wallet authentication
│   │   ├── ethereum.js          # ethers.js provider setup
│   │   └── isSafeUrl.ts         # URL validation
│   ├── App.tsx                  # Root app component with routing
│   ├── config.ts                # App configuration
│   └── index.tsx                # Entry point
├── .env.example                 # Environment template
├── package.json
└── tsconfig.json
```

## Demo

> **Demo Video:** [YouTube link here]
>
> **Live Demo:** [https://durl.dev](https://durl.dev)

## Submission Details

- **Track:** Theme 4: Open Track
- **Team size:** 4 members

### Judging Criteria

| Criteria | Weight |
|----------|--------|
| Execution | 20% |
| Success | 20% |
| Integration | 15% |
| Validation | 15% |
| Innovation | 10% |
| Feasibility | 10% |
| Pitch | 10% |

## Hackathon Resources

- [Hackathon Website](https://hellofuturehackathon.dev/)
- [Resources Page](https://hellofuturehackathon.dev/resources)
- [Hedera Discord](https://go.hellofuturehackathon.dev/apex-discord)
- [Program Calendar](https://go.hellofuturehackathon.dev/calendar)
- [Hedera Documentation](https://docs.hedera.com/)
- [HashScan Explorer](https://hashscan.io/testnet)
- [Hedera Testnet Faucet](https://portal.hedera.com/faucet)

## License

This project is licensed under the MIT License, see the [LICENSE](LICENSE) file for details.
