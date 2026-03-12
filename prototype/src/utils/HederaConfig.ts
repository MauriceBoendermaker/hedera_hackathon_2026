function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        console.error(`Missing required environment variable: ${key}. Check your .env file.`);
        return '';
    }
    return value;
}

// Allowlisted Hedera JSON-RPC hosts — add new relay providers here
const ALLOWED_RPC_HOSTS = new Set([
    'testnet.hashio.io',
    'mainnet.hashio.io',
    'pool.arkhia.io',
    'hedera.validationcloud.io',
    'localhost',
    '127.0.0.1',
]);

function validateRpcUrl(url: string): string {
    if (!url) return url;
    try {
        const { hostname, protocol } = new URL(url);
        if (!ALLOWED_RPC_HOSTS.has(hostname)) {
            throw new Error(
                `RPC host "${hostname}" is not in the Hedera allowlist. ` +
                `Allowed: ${[...ALLOWED_RPC_HOSTS].join(', ')}`
            );
        }
        if (hostname !== 'localhost' && hostname !== '127.0.0.1' && protocol !== 'https:') {
            throw new Error(`RPC URL must use HTTPS for non-local hosts`);
        }
    } catch (e) {
        if (e instanceof TypeError) {
            throw new Error(`Invalid RPC URL: "${url}"`);
        }
        throw e;
    }
    return url;
}

export const HEDERA_CHAIN_ID = 296;
export const HEDERA_CHAIN_ID_HEX = '0x128';
export const HEDERA_RPC_URL = validateRpcUrl(requireEnv('REACT_APP_HEDERA_RPC_URL'));
export const CONTRACT_ADDRESS = requireEnv('REACT_APP_CONTRACT_ADDRESS');
export const PROJECT_URL = requireEnv('REACT_APP_PROJECT_URL');
export const ANALYTICS_URL = requireEnv('REACT_APP_ANALYTICS_URL');
export const HEDERA_EXPLORER_URL = process.env.REACT_APP_EXPLORER_URL || 'https://hashscan.io/testnet';

export function getHashScanTxUrl(txHash: string): string {
  return `${HEDERA_EXPLORER_URL}/transaction/${txHash}`;
}

export function getHashScanContractUrl(contractAddress: string): string {
  return `${HEDERA_EXPLORER_URL}/contract/${contractAddress}`;
}

export function getHashScanTopicUrl(topicId: string): string {
  return `${HEDERA_EXPLORER_URL}/topic/${topicId}`;
}
