import { ANALYTICS_URL } from './HederaConfig';

const TOKEN_KEY = 'durl_auth_token';
const WALLET_KEY = 'durl_auth_wallet';
const EXPIRES_KEY = 'durl_auth_expires';

let cachedToken: string | null = null;
let cachedWallet: string | null = null;
let cachedExpires: number = 0;

function loadFromStorage(): void {
  if (cachedToken) return;
  try {
    cachedToken = sessionStorage.getItem(TOKEN_KEY);
    cachedWallet = sessionStorage.getItem(WALLET_KEY);
    cachedExpires = parseInt(sessionStorage.getItem(EXPIRES_KEY) || '0', 10);
  } catch { /* storage unavailable */ }
}

function saveToStorage(token: string, wallet: string, expiresAt: number): void {
  cachedToken = token;
  cachedWallet = wallet;
  cachedExpires = expiresAt;
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(WALLET_KEY, wallet);
    sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
  } catch { /* storage unavailable */ }
}

export function clearAuth(): void {
  cachedToken = null;
  cachedWallet = null;
  cachedExpires = 0;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(WALLET_KEY);
    sessionStorage.removeItem(EXPIRES_KEY);
  } catch { /* storage unavailable */ }
}

export function getAuthToken(): string | null {
  loadFromStorage();
  if (cachedToken && cachedExpires > Date.now() + 60_000) {
    return cachedToken;
  }
  return null;
}

export function getAuthWallet(): string | null {
  loadFromStorage();
  return cachedWallet;
}

/**
 * Authenticate with the analytics server using the connected wallet.
 * Returns the auth token, or null if auth fails.
 */
export async function authenticate(): Promise<string | null> {
  // Return cached token if still valid
  const existing = getAuthToken();
  if (existing) return existing;

  if (!window.ethereum) return null;

  try {
    // 1. Get challenge nonce from server
    const challengeRes = await fetch(`${ANALYTICS_URL}/auth/challenge`);
    if (!challengeRes.ok) return null;
    const { nonce, message } = await challengeRes.json();

    // 2. Request wallet accounts (requestAccounts prompts connection if needed)
    const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts.length === 0) return null;

    // 3. Sign the challenge message with MetaMask (personal_sign)
    const signature: string = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, accounts[0]],
    });

    // 4. Verify signature with server and get token
    const verifyRes = await fetch(`${ANALYTICS_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature, nonce }),
    });
    if (!verifyRes.ok) return null;

    const { token, wallet, expiresAt } = await verifyRes.json();
    saveToStorage(token, wallet, expiresAt);

    // 5. Sync ownership from contract (must complete before analytics work)
    try {
      await fetch(`${ANALYTICS_URL}/auth/sync-ownership`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch { /* sync failed — ownership may be missing but auth still valid */ }

    return token;
  } catch {
    return null;
  }
}

/**
 * Create a headers object with Authorization if a token is available.
 */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}
