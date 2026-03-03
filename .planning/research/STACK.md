# Stack Research: DURL Hedera Migration

**Research Date:** 2026-03-02
**Dimension:** Stack — Hedera EVM dApp migration
**Confidence:** MEDIUM (training data; verify versions against official docs before use)

## Recommended Stack Changes

### Keep (No Changes Needed)

| Technology | Version | Rationale | Confidence |
|-----------|---------|-----------|------------|
| React | 19.1.0 | UI framework, no blockchain dependency | HIGH |
| React Router DOM | 6.30.0 | Client-side routing, unchanged | HIGH |
| ethers.js | 6.14.0 | Works with Hedera JSON-RPC relay (Hashio) | HIGH |
| TypeScript | 4.9.5 | Build tooling, unchanged | HIGH |
| Bootstrap 5 | CDN | UI framework, unchanged | HIGH |
| SCSS / sass | 1.87.0 | Styling, unchanged | HIGH |
| qrcode.react | 4.2.0 | QR codes, no chain dependency | HIGH |
| three / vanta | 0.176.0 / 0.5.24 | Visual effects, unchanged | HIGH |
| react-scripts | 5.0.1 | Build pipeline, unchanged | HIGH |
| Express | analytics server | Analytics backend, unchanged | HIGH |

### Add

| Technology | Version | Purpose | Confidence |
|-----------|---------|---------|------------|
| @hashgraph/sdk | ^2.x | HCS topic creation and message submission | MEDIUM |
| @hashgraph/hardhat-hethers (optional) | latest | Hardhat plugin for Hedera deployment | LOW |

**@hashgraph/sdk** — Required for HCS (Hedera Consensus Service). ethers.js cannot interact with HCS — it only works with the EVM layer via JSON-RPC relay. The Hashgraph SDK provides `TopicCreateTransaction`, `TopicMessageSubmitTransaction`, and related classes.

**Note on HCS in browser:** The Pitfalls research flagged that submitting HCS messages from the browser exposes the operator private key. Consider either:
1. A lightweight backend endpoint for HCS submission (more secure)
2. Accepting the risk for testnet/hackathon (simpler, faster to ship)

### Remove

| Technology | Rationale | Confidence |
|-----------|-----------|------------|
| @circles-sdk/sdk 0.24.0 | Gnosis Chain only, not needed on Hedera | HIGH |
| @circles-sdk/adapter-ethers 0.24.0 | Circles adapter, removing | HIGH |
| @circles-sdk/profiles 0.24.0 | Circles profiles, removing | HIGH |
| @circles-sdk/data 0.24.0 | Circles data, removing | HIGH |
| @circles-sdk/utils 0.24.0 | Circles utils, removing | HIGH |

## Hedera Network Configuration

### Testnet (Primary for Hackathon)

| Setting | Value | Confidence |
|---------|-------|------------|
| Chain ID | 296 (0x128) | HIGH |
| RPC URL | `https://testnet.hashio.io/api` | MEDIUM |
| Native Currency | HBAR (18 decimals via relay) | HIGH |
| Currency Symbol | HBAR | HIGH |
| Block Explorer | `https://hashscan.io/testnet` | MEDIUM |
| Faucet | `https://faucet.hedera.com` | MEDIUM |

### Mainnet (Reference Only)

| Setting | Value | Confidence |
|---------|-------|------------|
| Chain ID | 295 (0x127) | HIGH |
| RPC URL | `https://mainnet.hashio.io/api` | MEDIUM |
| Block Explorer | `https://hashscan.io/mainnet` | MEDIUM |

### MetaMask Network Config

```javascript
{
  chainId: '0x128', // 296 decimal
  chainName: 'Hedera Testnet',
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls: ['https://testnet.hashio.io/api'],
  blockExplorerUrls: ['https://hashscan.io/testnet']
}
```

## ethers.js + Hedera Compatibility

ethers.js v6 works with Hedera through the JSON-RPC relay (Hashio). Key patterns:

**What works unchanged:**
- `ethers.BrowserProvider(window.ethereum)` — wallet connection
- `provider.getSigner()` — transaction signing
- `new ethers.Contract(address, abi, signer)` — contract interaction
- `contract.functionName()` — read/write calls
- `ethers.parseEther("1")` — 1 HBAR (18 decimals via relay)

**What needs attention:**
- **Gas estimation:** Hedera's gas model differs from EIP-1559. Hardcode `gasLimit` (e.g., 400000) instead of relying on `estimateGas()`
- **Transaction receipts:** `receipt.logs` may be empty on some Hedera relay versions. Use `provider.getLogs()` as fallback
- **Block confirmation:** Hedera has ~3-5 second finality, no reorgs. `wait(1)` is sufficient

## HCS Integration Stack

**SDK:** `@hashgraph/sdk` (JavaScript/TypeScript)

**Key classes:**
- `Client.forTestnet()` — create Hedera client
- `TopicCreateTransaction` — create HCS topic (one-time)
- `TopicMessageSubmitTransaction` — submit audit log messages
- `TopicId.fromString()` — parse topic IDs

**Mirror Node REST API** (for reading HCS messages):
- Base URL: `https://testnet.mirrornode.hedera.com`
- Endpoint: `GET /api/v1/topics/{topicId}/messages`
- Messages are base64-encoded JSON
- No authentication required

**HCS message size limit:** 1024 bytes per message

## Smart Contract Deployment

**Option 1: Hardhat (Recommended)**
- Use standard Hardhat with Hedera network config
- RPC: `https://testnet.hashio.io/api`
- Accounts: private key of funded testnet account

**Option 2: Remix + MetaMask**
- Connect MetaMask to Hedera testnet
- Deploy via Remix IDE as with any EVM chain
- Simpler for hackathon; less repeatable

**Solidity compatibility:**
- Hedera EVM supports Solidity ^0.8.x
- Most opcodes supported; some differences in gas costs
- `msg.value` works for HBAR payments (18 decimal wei equivalent)

## Environment Variables (New)

```
# Hedera Testnet
REACT_APP_CONTRACT_ADDRESS=<deployed contract address>
REACT_APP_PROJECT_URL=https://durl.dev
REACT_APP_RPC_URL=https://testnet.hashio.io/api
REACT_APP_CHAIN_ID=296
REACT_APP_EXPLORER_URL=https://hashscan.io/testnet
REACT_APP_HCS_TOPIC_ID=<created topic ID>
REACT_APP_HEDERA_OPERATOR_ID=<testnet account ID>
REACT_APP_HEDERA_OPERATOR_KEY=<testnet account private key>
PORT=3001
```

## What NOT to Use

| Technology | Reason | Confidence |
|-----------|--------|------------|
| @hashgraph/hedera-sdk (old) | Use `@hashgraph/sdk` v2 instead | HIGH |
| Hedera-specific wallet (HashPack) | MetaMask via JSON-RPC relay is sufficient and more accessible | HIGH |
| web3.js | Already using ethers.js v6, no reason to switch | HIGH |
| Foundry | Less Hedera ecosystem support than Hardhat | MEDIUM |

## Verification Needed

Before implementation, verify these against live Hedera docs:
1. Exact `@hashgraph/sdk` latest version number
2. Hashio testnet RPC URL is still `https://testnet.hashio.io/api`
3. Testnet faucet daily HBAR limits
4. Mirror Node testnet rate limits
5. Whether `ethers.parseEther("1")` correctly maps to 1 HBAR on Hashio relay

---
*Stack research: 2026-03-02*
