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

  // Verify the wallet is actually on Hedera after the switch
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId !== HEDERA_CHAIN_ID_HEX) {
    throw new Error('Wrong network — please switch to Hedera Testnet in your wallet.');
  }
}
