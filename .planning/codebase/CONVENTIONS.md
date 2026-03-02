# Coding Conventions

**Analysis Date:** 2026-03-02

## Naming Patterns

**Files:**
- React component files: PascalCase (e.g., `Dashboard.tsx`, `About.tsx`, `QRModal.tsx`)
- Utility/service files: camelCase (e.g., `CirclesConfig.ts`, `ShowToast.ts`, `NetworkSwitcher.ts`)
- Kebab-case for page components when used as routes (e.g., `How-it-works.tsx`)
- All files use `.tsx` for React components and `.ts` for utilities

**Functions:**
- camelCase for all function names (both regular and async functions)
- Examples from codebase:
  - `createCirclesSdk()`
  - `CRCPaymentProvider()`
  - `copyToClipboard()`
  - `downloadDashboardQR()`
  - `handleSubmit()`
  - `isValidUrl()`
  - `validateInputUrl()`
  - `loadLinks()`

**Variables:**
- camelCase for all variable names
- State variables follow React hook convention: `const [state, setState] = useState(...)`
- Examples: `account`, `links`, `error`, `loading`, `qrTarget`, `visitCounts`
- Boolean prefixes: `is`, `has` patterns (e.g., `isConnected`, `isValidUrl`)

**Types/Interfaces:**
- PascalCase for interface names (e.g., `QRModalProps`, `CirclesConfig`)
- Generic types capitalized (e.g., `Record<string, number>`)

**Constants:**
- UPPER_SNAKE_CASE for constants (e.g., `CONTRACT_ADDRESS`, `PROJECT_URL`, `CRC_PAYMENT_AMOUNT`, `CRC_PAYMENT_RECEIVER`)
- Defined at module scope, typically before component/function definitions

## Code Style

**Formatting:**
- ESLint configuration extends `react-app` and `react-app/jest` (see `package.json` lines 39-43)
- No explicit Prettier config detected, using React Scripts default formatting
- Indentation: 2 spaces (observed in all code)
- Semicolons: Present on all statements
- Line length: Variable, no strict limit enforced

**Linting:**
- ESLint configured through react-scripts (built-in)
- Config in `package.json`: extends `["react-app", "react-app/jest"]`
- No separate `.eslintrc` file found
- react-scripts handles linting configuration automatically

**TypeScript Strictness:**
- `strict: true` enabled in `tsconfig.json` (line 11)
- `forceConsistentCasingInFileNames: true` enforced
- JSX mode: `"react-jsx"` (line 5 in tsconfig.json)
- Target: `es2017`
- Module resolution: `node`

## Import Organization

**Order (observed pattern):**
1. React imports (`import React from 'react'` or specific hooks)
2. External library imports (`ethers`, `react-router-dom`, third-party packages)
3. Internal absolute imports using baseUrl aliases
4. Internal relative imports
5. Asset imports (CSS/SCSS)

**Examples:**
```typescript
// App.tsx
import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/misc/Nav';
import { Footer } from './components/misc/Footer';
import "./assets/scss/style.scss";

// Dashboard.tsx
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import abi from '../abi_xDAI.json';
import { ShowToast } from './utils/ShowToast';
import QRModal from './utils/QRModal';
```

**Path Aliases:**
- Base URL set to `./src` in `tsconfig.json` (line 6)
- All imports from src directory use baseUrl resolution
- Examples: `import HowItWorks from 'components/How-it-works'` (absolute from src)
- Can mix relative and absolute imports in same file

## Error Handling

**Patterns:**
- Try-catch blocks for async operations
- Error messages displayed via `ShowToast()` utility function
- Example from `Dashboard.tsx`:
  ```typescript
  try {
      // async operation
  } catch (err: any) {
      console.error(err);
  } finally {
      setLoading(false);
  }
  ```
- Specific error codes handled (e.g., `err.code === 4001` for user cancellation in `UrlForms.tsx`)
- Error state stored in component state: `const [error, setError] = useState('')`
- Failed operations logged with `console.warn()` for non-critical issues

**User Feedback:**
- Toast notifications via `ShowToast(message, type)` where type is `'success'` or `'danger'`
- Alert divs for in-page validation errors
- Status messages displayed in UI for long-running operations

## Logging

**Framework:** `console` object (no logging library detected)

**Patterns:**
- `console.log()` for normal operations and debug info
- `console.warn()` for warnings about missing data
- `console.error()` for actual errors
- Examples from codebase:
  - `console.warn('Could not fetch visit stats');`
  - `console.error(err);`
  - `console.log("trust level: ", process);`
  - `console.log('CRC Transaction confirmed in block ', transferTx.blockNumber);`

**No structured logging:** Logs are simple console statements without context or levels

## Comments

**When to Comment:**
- Minimal commenting observed
- Comments used for non-obvious logic
- Example from `CRCPaymentProvider.ts` (lines 44-51): JSDoc comment for exported function
- No inline comments for obvious code
- Comments appear to be selectively used for complex blockchain operations

**JSDoc/TSDoc:**
- Function documentation present for exported utility functions
- Example:
  ```typescript
  /**
   * Sends CRC tokens (ERC-1155) from a V2 group.
   *
   * @param signer Ethers signer (already connected to wallet)
   * @param mintHandlerAddress The minting contract address (from AboutCircles group info)
   * @param groupAddress The group avatar address (used as token ID)
   * @param toAddress Recipient address
   * @param amount Number of tokens to send (as bigint or string)
   */
  export async function sendV2GroupCRC(...)
  ```
- No mandatory JSDoc requirement observed for all functions

## Function Design

**Size:**
- Functions range from 5-100+ lines
- Longer functions contain complex blockchain interactions
- Helper functions like `isValidUrl()` are minimal (3-8 lines)

**Parameters:**
- Parameters avoid excessive defaults
- Type annotations required (TypeScript strict mode)
- Examples: `function ShowToast(message: string, type: 'success' | 'danger')`
- Union types used for constrained string values

**Return Values:**
- Functions return promises for async operations
- React components return JSX (implicit return in function components)
- Utility functions return typed values or void
- Example: `export async function createCirclesSdk(): Promise<Sdk>`

**React Component Structure:**
- Function components with hooks
- State declared at top with `useState`
- Effects declared with `useEffect`
- Event handlers defined as functions inside component
- JSX returned at end

## Module Design

**Exports:**
- Named exports for utility functions: `export function ShowToast(...)`
- Named exports for Circles SDK: `export const GnosisChainConfig: CirclesConfig = {...}`
- Default exports for React components: `export default App`
- Mixed approach allows flexibility

**Barrel Files:**
- No barrel files (index.ts/index.tsx) for re-exporting found
- Direct imports from individual files preferred

**Component Composition:**
- Components accept props via destructuring
- Props typed with interfaces (e.g., `interface QRModalProps`)
- Example from `QRModal.tsx`:
  ```typescript
  interface QRModalProps {
      id: string;
      qrValue: string;
      onDownload: () => void;
  }
  function QRModal({ id, qrValue, onDownload }: QRModalProps)
  ```

---

*Convention analysis: 2026-03-02*
