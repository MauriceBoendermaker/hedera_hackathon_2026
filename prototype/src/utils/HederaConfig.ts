function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}. Check your .env file.`);
    }
    return value;
}

export const HEDERA_CHAIN_ID = 296;
export const HEDERA_CHAIN_ID_HEX = '0x128';
export const HEDERA_RPC_URL = requireEnv('REACT_APP_HEDERA_RPC_URL');
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
