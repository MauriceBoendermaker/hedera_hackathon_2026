export const HEDERA_CHAIN_ID = 296;
export const HEDERA_CHAIN_ID_HEX = '0x128';
export const HEDERA_RPC_URL = process.env.REACT_APP_HEDERA_RPC_URL as string;
export const HEDERA_EXPLORER_URL = process.env.REACT_APP_EXPLORER_URL || 'https://hashscan.io/testnet';

export function getHashScanTxUrl(txHash: string): string {
  return `${HEDERA_EXPLORER_URL}/transaction/${txHash}`;
}

export function getHashScanContractUrl(contractAddress: string): string {
  return `${HEDERA_EXPLORER_URL}/contract/${contractAddress}`;
}
