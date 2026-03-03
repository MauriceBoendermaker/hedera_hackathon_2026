import { HEDERA_CHAIN_ID_HEX } from './HederaConfig';

export async function switchToHedera() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HEDERA_CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: HEDERA_CHAIN_ID_HEX,
            chainName: 'Hedera Testnet',
            nativeCurrency: {
              name: 'HBAR',
              symbol: 'HBAR',
              decimals: 18,
            },
            rpcUrls: ['https://testnet.hashio.io/api'],
            blockExplorerUrls: ['https://hashscan.io/testnet/'],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}
