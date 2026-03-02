# Technology Stack

**Analysis Date:** 2026-03-02

## Languages

**Primary:**
- TypeScript 4.9.5 - Frontend React application
- JavaScript (CommonJS) - Analytics backend server

**Secondary:**
- SCSS - Styling (compiled from sass 1.87.0)
- JSON - Contract ABIs and configuration

## Runtime

**Environment:**
- Node.js (version not specified in package.json)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.1.0 - UI framework
- React DOM 19.1.0 - DOM rendering
- React Router DOM 6.30.0 - Client-side routing (HashRouter)

**Web3/Blockchain:**
- ethers 6.14.0 - Ethereum library for contract interaction
- @circles-sdk/sdk 0.24.0 - Circles protocol SDK
- @circles-sdk/adapter-ethers 0.24.0 - Ethers adapter for Circles SDK
- @circles-sdk/profiles 0.24.0 - Circles profile utilities
- @circles-sdk/data 0.24.0 - Circles data utilities
- @circles-sdk/utils 0.24.0 - Circles utilities

**UI/Visualization:**
- three 0.176.0 - 3D graphics library
- vanta 0.5.24 - Three.js animation effects
- qrcode.react 4.2.0 - QR code generation
- sass 1.87.0 - CSS preprocessor

**Testing:**
- @testing-library/react 16.3.0 - React testing utilities
- @testing-library/dom 10.4.0 - DOM testing utilities
- @testing-library/jest-dom 6.6.3 - Jest DOM matchers
- @testing-library/user-event 13.5.0 - User interaction simulation
- @types/jest 27.5.2 - Jest type definitions

**Build/Dev:**
- react-scripts 5.0.1 - Create React App build tools
- typescript 4.9.5 - TypeScript compiler
- concurrently 9.1.2 - Run multiple processes concurrently
- express (Node.js) - Analytics server framework
- body-parser - Express middleware for parsing JSON

## Key Dependencies

**Critical:**
- ethers 6.14.0 - Essential for blockchain interaction and contract calls
- @circles-sdk/sdk 0.24.0 - Core Circles protocol functionality for CRC token operations
- react-router-dom 6.30.0 - Application navigation and URL routing

**Infrastructure:**
- express - Simple Node.js server for analytics tracking
- react-scripts - Complete build pipeline and dev server

## Configuration

**Environment:**
- `.env` file present at `/c/xampp/htdocs/hedera_hackathon_2026/prototype/.env`
- Environment variables required:
  - `REACT_APP_CONTRACT_ADDRESS` - Smart contract address for URL shortener
  - `REACT_APP_PROJECT_URL` - Base URL for shortened links (e.g., https://durl.dev)
  - `REACT_APP_INFURA_URL` - RPC provider URL for read-only operations
  - `PORT` - Port for analytics server (default: 3001)

**Build:**
- TypeScript config: `prototype/tsconfig.json`
- Target: ES2017
- Module: ESNext
- Base URL: `./src` (path aliases enabled)
- Strict mode: enabled
- React JSX: react-jsx compiler

**ESLint:**
- Extends react-app and react-app/jest configurations
- Standard Create React App linting rules

## Platform Requirements

**Development:**
- Node.js with npm
- MetaMask browser extension (for wallet interaction)
- Modern browser with Web3 support (ethereum provider injection)

**Production:**
- Node.js runtime for analytics server
- Browser compatibility: Chrome, Firefox, Safari (last versions)
- Blockchain networks:
  - Gnosis Chain (chainId: 0x64, xDAI native currency)
  - Sepolia testnet (for Etherscan links)
  - Custom Circles RPC endpoints

---

*Stack analysis: 2026-03-02*
