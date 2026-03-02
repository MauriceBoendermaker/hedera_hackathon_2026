# Codebase Structure

**Analysis Date:** 2026-03-02

## Directory Layout

```
hedera_hackathon_2026/
├── .git/                           # Git repository metadata
├── .idea/                          # IDE configuration (IntelliJ/WebStorm)
├── .planning/                      # Documentation planning directory
│   └── codebase/                   # Codebase analysis documents
├── .claude/                        # Claude-specific metadata
├── prototype/                      # Main application directory
│   ├── analytics/                  # Analytics server (Node.js/Express)
│   │   └── server.cjs              # Analytics API server
│   ├── public/                     # Static web assets
│   │   ├── index.html              # HTML entry point
│   │   ├── manifest.json           # PWA manifest
│   │   ├── favicon.ico             # Favicon files
│   │   ├── durl_logo.png           # Application logo
│   │   └── [other image assets]
│   ├── src/                        # React application source
│   │   ├── index.tsx               # React entry point
│   │   ├── App.tsx                 # Main App component with routing
│   │   ├── abi_ETH.json            # Smart contract ABI (Ethereum)
│   │   ├── abi_xDAI.json           # Smart contract ABI (Gnosis/xDAI)
│   │   ├── react-app-env.d.ts      # TypeScript environment definitions
│   │   ├── reportWebVitals.ts      # Performance monitoring
│   │   ├── components/             # React page/feature components
│   │   │   ├── ShortenPage.tsx      # Main URL shortening page
│   │   │   ├── Dashboard.tsx        # User's links management
│   │   │   ├── About.tsx            # About page
│   │   │   ├── How-it-works.tsx     # Information page
│   │   │   ├── UrlForms.tsx         # URL shortening form with CRC payment
│   │   │   ├── misc/                # Miscellaneous components
│   │   │   │   ├── Nav.tsx          # Navigation bar component
│   │   │   │   ├── Footer.tsx       # Footer component
│   │   │   │   └── MouseDots.tsx    # Animated background canvas
│   │   │   └── utils/               # Utility components
│   │   │       ├── RedirectPage.tsx # Dynamic URL redirect handler
│   │   │       ├── QRModal.tsx      # QR code modal dialog
│   │   │       └── ShowToast.ts     # Toast notification utility
│   │   ├── contractMethods/         # Blockchain interaction functions
│   │   │   └── CRCPaymentProvider.ts # CRC token transfer (V1 & V2)
│   │   ├── utils/                   # Shared utility functions
│   │   │   ├── CirclesConfig.ts     # Gnosis Chain config + SDK factory
│   │   │   └── NetworkSwitcher.ts   # MetaMask network switching
│   │   └── assets/                  # Static resources
│   │       ├── scss/                # SCSS stylesheets (Sass)
│   │       │   ├── style.scss       # Main stylesheet entry point
│   │       │   ├── _default.scss    # Global default styles
│   │       │   ├── _variables.scss  # SCSS variables (colors, fonts)
│   │       │   ├── components/      # Component-specific styles
│   │       │   │   ├── _about.scss
│   │       │   │   ├── _dashboard.scss
│   │       │   │   ├── _how-it-works.scss
│   │       │   │   ├── _shorten-page.scss
│   │       │   │   └── nav/
│   │       │   │       └── _nav.scss
│   │       │   ├── misc/            # Miscellaneous styles
│   │       │   │   ├── _buttons.scss
│   │       │   │   ├── _cursor.scss
│   │       │   │   ├── _footer.scss
│   │       │   │   └── _form-control.scss
│   │       │   └── media_queries/   # Responsive breakpoints
│   │       │       ├── _media.scss
│   │       │       ├── _nav.scss
│   │       │       └── [other responsive styles]
│   ├── package.json                # Node.js dependencies and scripts
│   ├── tsconfig.json               # TypeScript configuration
│   └── .env[.local]                # Environment variables (not committed)
├── .gitignore                      # Git ignore rules
└── README.md                       # Project readme
```

## Directory Purposes

**`prototype/`:**
- Purpose: Root of the React + Node.js application
- Contains: All source code, assets, configuration, analytics server
- Key purpose: Represents the working prototype for the dURL decentralized URL shortener

**`prototype/src/`:**
- Purpose: React application source code
- Contains: Components, utilities, smart contract ABIs, stylesheets
- Compiled: `npm run build` outputs to `prototype/build/` (gitignored)

**`prototype/src/components/`:**
- Purpose: React page and feature components
- Contains: Page-level components (ShortenPage, Dashboard, About) and reusable UI components
- Structure: Top-level `.tsx` files for pages, subdirectories for grouped components

**`prototype/src/components/misc/`:**
- Purpose: Miscellaneous UI components used across pages
- Contains: Navigation, Footer, animated backgrounds, not page-specific
- Used by: Multiple pages for consistent UI chrome

**`prototype/src/components/utils/`:**
- Purpose: Utility components and helper functions
- Contains: Redirect handler, modal dialogs, toast notifications
- Type: Mix of React components and pure utility functions

**`prototype/src/contractMethods/`:**
- Purpose: Smart contract interaction and blockchain operations
- Contains: CRC payment handler, contract method wrappers
- Abstraction: Isolates Web3 logic from UI components

**`prototype/src/utils/`:**
- Purpose: Configuration and helper utilities
- Contains: Circles SDK setup, network switching, environment configuration
- Abstraction: Shared functions used by multiple components and contractMethods

**`prototype/src/assets/scss/`:**
- Purpose: SCSS stylesheets organized by feature
- Contains: Component styles, global variables, media queries, miscellaneous styles
- Compiled: SCSS compiled to CSS by Sass during build
- Structure: `style.scss` imports all partials, organized by concern

**`prototype/analytics/`:**
- Purpose: Separate Node.js analytics server
- Contains: Express server handling `/track` (POST) and `/stats` (GET) endpoints
- Port: Runs on port 3001 (separate from React dev server on 3000)
- Data: Stores visit logs in `logs.json` (fileystem-based, not a database)

**`prototype/public/`:**
- Purpose: Static web assets served directly by server
- Contains: HTML entry point, favicons, manifest, logos
- Not compiled: Copied as-is to build output

## Key File Locations

**Entry Points:**

- `prototype/src/index.tsx`: React DOM entry point - creates root and renders App
- `prototype/src/App.tsx`: Main App component - sets up routing and global effects
- `prototype/public/index.html`: HTML entry point - provides root div, loads Bootstrap and ethers.js
- `prototype/analytics/server.cjs`: Analytics server - Express app listening on port 3001

**Configuration:**

- `prototype/package.json`: npm dependencies, scripts (start, build, start-client, start-analytics)
- `prototype/tsconfig.json`: TypeScript configuration with baseUrl set to `src/`
- `prototype/src/utils/CirclesConfig.ts`: Circles SDK and Gnosis Chain configuration
- `prototype/public/index.html`: meta tags, CDN links (Bootstrap, fonts, ethers.js)

**Core Logic:**

- `prototype/src/components/UrlForms.tsx`: URL shortening form with CRC payment logic
- `prototype/src/contractMethods/CRCPaymentProvider.ts`: CRC token transfer and payment processing
- `prototype/src/components/utils/RedirectPage.tsx`: URL resolution and redirect logic
- `prototype/src/components/Dashboard.tsx`: User's shortened links management and statistics

**Smart Contract ABIs:**

- `prototype/src/abi_xDAI.json`: Gnosis Chain contract ABI (primary)
- `prototype/src/abi_ETH.json`: Ethereum contract ABI (alternate/legacy)

**Testing:**

- Not found - no test files present in repository

**Styling:**

- `prototype/src/assets/scss/style.scss`: Main stylesheet entry point
- `prototype/src/assets/scss/_variables.scss`: Color, font, and spacing variables
- `prototype/src/assets/scss/components/`: Component-specific styles
- `prototype/src/assets/scss/media_queries/`: Responsive design breakpoints

## Naming Conventions

**Files:**

- React components: PascalCase (e.g., `ShortenPage.tsx`, `UrlForms.tsx`)
- Utility/helper files: camelCase (e.g., `reportWebVitals.ts`, `CirclesConfig.ts`)
- SCSS partials: kebab-case with leading underscore (e.g., `_shorten-page.scss`)
- Contract ABIs: Uppercase with network suffix (e.g., `abi_xDAI.json`, `abi_ETH.json`)

**Directories:**

- Feature/page directories: kebab-case (e.g., `src/components/`, `media_queries/`)
- Category directories: camelCase (e.g., `contractMethods/`, `reportWebVitals.ts`)

**Components (React):**

- Page components: Singular descriptive name (e.g., `ShortenPage`, `Dashboard`)
- Functional components: PascalCase or descriptive noun (e.g., `Nav`, `MouseDots`, `ShowToast`)
- Exported as default when single-purpose, named export when reusable

**Functions:**

- Async functions: camelCase verb-first (e.g., `handleSubmit`, `resolveRedirect`, `createCirclesSdk`)
- Event handlers: `handle` prefix (e.g., `handleMouseMove`, `handleSubmit`)
- Utility functions: Descriptive verb or descriptor (e.g., `isValidUrl`, `switchToGnosis`)

**Variables & State:**

- State variables: camelCase noun (e.g., `shortUrl`, `txHash`, `isConnected`)
- Constants: UPPER_SNAKE_CASE (e.g., `CRC_PAYMENT_AMOUNT`, `CONTRACT_ADDRESS`)
- Environment variables: REACT_APP_ prefix + UPPER_SNAKE_CASE (e.g., `REACT_APP_CONTRACT_ADDRESS`)

## Where to Add New Code

**New Feature (URL Shortening Enhancement):**
- Primary code: `prototype/src/components/[FeatureName].tsx` or new feature subdirectory in `components/`
- Contract interaction: `prototype/src/contractMethods/[MethodName].ts`
- Utilities: `prototype/src/utils/[UtilityName].ts`
- Styles: `prototype/src/assets/scss/components/_[feature-name].scss`
- Tests (if added): `prototype/src/components/__tests__/[FeatureName].test.tsx`

**New Page/Route:**
- Component file: `prototype/src/components/[PageName].tsx` (PascalCase)
- Add route in: `prototype/src/App.tsx` inside Routes element
- Stylesheet: `prototype/src/assets/scss/components/_[page-name].scss`
- Add navigation link: `prototype/src/components/misc/Nav.tsx`

**New Utility Function:**
- Location: `prototype/src/utils/[utilityName].ts`
- Pattern: Pure functions, async where needed, no side effects
- Export: Named export or default, be consistent within module

**New Component (Reusable):**
- Location: `prototype/src/components/[FeatureName].tsx` or `prototype/src/components/misc/[ComponentName].tsx`
- If part of a feature: Create subdirectory like `prototype/src/components/wallet/` for wallet-related components
- Props: Define TypeScript interfaces for prop types
- Export: Named export for reusability

**Blockchain Interaction (Smart Contract Call):**
- Location: `prototype/src/contractMethods/[OperationName].ts`
- Pattern: Async function taking signer/provider and params
- Return: Promise<ContractTransaction> or parsed result
- Error handling: Try-catch with meaningful error messages

**Environment Variables:**
- Add to: `.env.local` (not committed) for local development
- Reference in components: `process.env.REACT_APP_[VARIABLE_NAME]`
- Required vars: `REACT_APP_CONTRACT_ADDRESS`, `REACT_APP_PROJECT_URL`, `REACT_APP_INFURA_URL`

**Styles for New Component:**
- Create SCSS file: `prototype/src/assets/scss/components/_[component-name].scss`
- Follow BEM naming: `.component-name { .component-name__element { } }`
- Import in: `prototype/src/assets/scss/style.scss` in appropriate section
- Responsive: Add media query rules to `prototype/src/assets/scss/media_queries/`

## Special Directories

**`prototype/analytics/`:**
- Purpose: Separate analytics backend server
- Generated: No, handwritten Node.js/Express server
- Committed: Yes, part of source
- Logs: `analytics/logs.json` created at runtime, should be gitignored
- Running: `npm run start-analytics` executes `node ./analytics/server.cjs`

**`prototype/node_modules/`:**
- Purpose: Installed npm dependencies
- Generated: Yes, created by `npm install`
- Committed: No, listed in `.gitignore`

**`prototype/build/`:**
- Purpose: Production build output
- Generated: Yes, created by `npm run build` (react-scripts)
- Committed: No, listed in `.gitignore`

**`.planning/codebase/`:**
- Purpose: Architecture and codebase documentation
- Generated: No, manually written by analysis
- Committed: Yes, helps coordinate development

---

*Structure analysis: 2026-03-02*
