# Testing Patterns

**Analysis Date:** 2026-03-02

## Test Framework

**Runner:**
- Jest (via react-scripts)
- Configuration: Implicit through create-react-app
- No explicit `jest.config.js` file found

**Assertion Library:**
- `@testing-library/jest-dom` v6.6.3
- Not currently used in any tests (no test files exist)

**Run Commands:**
```bash
npm test              # Run tests in watch mode (via react-scripts)
npm run build         # Build for production
npm start             # Start development server with client and analytics
```

**Current Status:**
- Testing framework configured but no actual test files exist
- Dependencies installed: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/dom`, `@types/jest`
- Suggests testing infrastructure set up but not yet implemented

## Test File Organization

**Current State:**
- No test files currently present in codebase
- Search for `*.test.*` and `*.spec.*` patterns returns empty

**Recommended Location:**
- Co-located testing would follow pattern: component alongside its test
- Example: `src/components/Dashboard.tsx` → `src/components/Dashboard.test.tsx`

**Naming Convention (inferred from dependencies):**
- Pattern: `[ComponentName].test.tsx` or `[FunctionName].test.ts`
- Jest default pattern: files matching `*.test.js` or `*.spec.js`

## Test Structure

**Suggested Framework (based on installed dependencies):**
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { component } from './Component';

describe('ComponentName', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByText(/text/i)).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<Component />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText(/expected/i)).toBeInTheDocument();
  });
});
```

**Patterns to implement:**
- Setup: Render component with required props
- Action: Simulate user interactions with `userEvent`
- Assert: Check DOM state with `screen` and matchers from `@testing-library/jest-dom`
- Teardown: Automatic cleanup by testing-library

## Mocking

**Framework:** None explicitly configured (Jest mocking would be available)

**No Current Mocking Patterns:**
- No mock implementations observed in codebase
- No test files to demonstrate pattern

**What Needs Mocking (for future tests):**
- `window.ethereum` - MetaMask provider object
- `ethers.BrowserProvider` - Ethers.js blockchain provider
- `fetch()` - Network requests to stats API and blockchain RPCs
- `process.env` - Environment variables like `REACT_APP_CONTRACT_ADDRESS`

**Suggested Mocking Approach:**
```typescript
// Mock window.ethereum
Object.defineProperty(window, 'ethereum', {
  value: {
    request: jest.fn(),
    on: jest.fn(),
  },
});

// Mock ethers module
jest.mock('ethers', () => ({
  ethers: {
    BrowserProvider: jest.fn(),
    Contract: jest.fn(),
    Interface: jest.fn(),
    parseUnits: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

// Mock toast utility
jest.mock('./utils/ShowToast', () => ({
  ShowToast: jest.fn(),
}));
```

**What to Mock:**
- External blockchain providers (MetaMask)
- Ethers.js contract interactions
- Network requests (fetch calls)
- DOM APIs that require real DOM (use jsdom)
- Toast/notification system

**What NOT to Mock:**
- React components used in the test (unless testing their absence)
- Custom utility functions under test
- Helper functions that don't interact with external systems
- Bootstrap modal behavior (unless isolated tests require it)

## Fixtures and Factories

**No Current Fixtures:**
- No test data factories exist
- No fixture files detected

**Suggested Test Data (based on codebase usage):**
```typescript
// Mock wallet data
const mockAddress = '0x1234567890123456789012345678901234567890';
const mockAccounts = [mockAddress];

// Mock link data
const mockLinks = [
  { shortId: 'abc123', url: 'https://example.com' },
  { shortId: 'xyz789', url: 'https://test.com' },
];

// Mock contract response
const mockContractResponse = {
  getUserLinks: jest.fn().mockResolvedValue(['abc123', 'xyz789']),
  getOriginalUrl: jest.fn().mockResolvedValue('https://example.com'),
  shortIdExists: jest.fn().mockResolvedValue(false),
  createCustomShortUrl: jest.fn(),
  generateShortUrl: jest.fn(),
};

// Mock stats data
const mockStats = {
  'abc123': 42,
  'xyz789': 5,
};
```

**Recommended Location:**
- Create `src/test/fixtures.ts` or `src/test/mocks.ts`
- Store mock factory functions for contracts, wallet data, API responses
- Share across multiple test files

## Coverage

**Requirements:** Not enforced (no coverage config in package.json)

**View Coverage:**
```bash
npm test -- --coverage
```

**Current Coverage:** 0% (no tests exist)

**Critical Areas Needing Coverage (priority order):**
1. **URL validation** - `isValidUrl()` in `UrlForms.tsx` (line 23-30)
2. **Wallet connection** - MetaMask integration in `Nav.tsx` and `Dashboard.tsx`
3. **Blockchain interactions** - Contract calls in `UrlForms.tsx` (lines 74-151)
4. **Network switching** - `switchToGnosis()` in `NetworkSwitcher.ts`
5. **Form submission** - `handleSubmit()` in `UrlForms.tsx` (lines 43-161)
6. **Error handling** - Try-catch blocks in async functions
7. **Toast notifications** - `ShowToast()` in `ShowToast.ts`

## Test Types

**Unit Tests:**
- Scope: Individual functions and components in isolation
- Approach: Mock external dependencies (blockchain, wallet, fetch)
- Priority areas:
  - `isValidUrl()` - pure function, easy to test
  - `ShowToast()` - DOM manipulation, requires jsdom
  - `CRCPaymentProvider()` - async blockchain interaction, requires mocks
  - `NetworkSwitcher.switchToGnosis()` - wallet method calls, requires mocks

**Integration Tests:**
- Scope: Component + utils interaction (without full blockchain)
- Approach: Mock blockchain, test form submission flow
- Example: Test `UrlForms.tsx` with mocked contract and wallet
- Should verify: URL validation → form submission → toast notification → UI update

**E2E Tests:**
- Framework: Not configured (would require Cypress, Playwright, etc.)
- Not currently used
- Could test full flow: wallet connection → shorten URL → verify on blockchain

## Common Patterns

**Async Testing:**
```typescript
it('should load links from blockchain', async () => {
  render(<Dashboard />);

  await waitFor(() => {
    expect(screen.queryByText('Loading links...')).not.toBeInTheDocument();
  });

  expect(screen.getByText('Short link')).toBeInTheDocument();
});

// Or with userEvent
it('should handle form submission', async () => {
  const user = userEvent.setup();
  render(<UrlForms />);

  await user.type(screen.getByPlaceholderText(/Original URL/), 'https://example.com');
  await user.click(screen.getByText('Submit to Blockchain'));

  await waitFor(() => {
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
  });
});
```

**Error Testing:**
```typescript
it('should show error when wallet is not connected', async () => {
  // Mock ethereum as undefined
  Object.defineProperty(window, 'ethereum', {
    value: undefined,
    writable: true,
  });

  render(<UrlForms />);
  const submitButton = screen.getByText('Submit to Blockchain');

  await user.click(submitButton);

  expect(screen.getByText(/MetaMask not detected/i)).toBeInTheDocument();
});

it('should handle contract errors', async () => {
  const mockError = new Error('Contract call failed');
  mockContract.createCustomShortUrl.mockRejectedValue(mockError);

  // ... render and interact

  expect(screen.getByText(/Error/i)).toBeInTheDocument();
});
```

**Component Rendering:**
```typescript
it('should render Dashboard with links table', () => {
  const { container } = render(<Dashboard />);

  expect(container.querySelector('.table')).toBeInTheDocument();
  expect(screen.getByText('Your Shortened Links')).toBeInTheDocument();
});
```

## Testing Gaps

**Currently Untested (all code, as no tests exist):**

| Area | Files | Risk | Priority |
|------|-------|------|----------|
| Wallet Integration | `Nav.tsx`, `UrlForms.tsx`, `Dashboard.tsx` | High - user cannot interact with app | Critical |
| Blockchain Calls | `UrlForms.tsx`, `CRCPaymentProvider.ts`, `Dashboard.tsx` | High - core functionality | Critical |
| URL Validation | `UrlForms.tsx` (lines 23-30) | Medium - could accept invalid URLs | High |
| Error Handling | All async functions | High - silent failures possible | High |
| Form Submission | `UrlForms.tsx` (lines 43-161) | High - main user flow | Critical |
| Network Switching | `NetworkSwitcher.ts` | Medium - wrong chain could break functionality | High |
| Component Rendering | All components | Low - visual issues only | Medium |
| Circles SDK | `CirclesConfig.ts`, `CRCPaymentProvider.ts` | High - payment system | Critical |

---

*Testing analysis: 2026-03-02*
