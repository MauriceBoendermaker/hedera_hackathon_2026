import { useState } from 'react';
import { ethers } from 'ethers';
import abi from '../abi_hedera.json';
import { ShowToast } from './utils/ShowToast';
import { switchToHedera } from 'utils/NetworkSwitcher';
import { getHashScanTxUrl } from 'utils/HederaConfig';

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS as string;
const PROJECT_URL = process.env.REACT_APP_PROJECT_URL as string;

export function UrlForms() {
    const [originalUrl, setOriginalUrl] = useState('');
    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');
    const [generatedShortId, setGeneratedShortId] = useState('');
    const [urlInvalid, setUrlInvalid] = useState(false);
    const [isCustomMode, setIsCustomMode] = useState(true);
    const [shortUrl, setShortUrl] = useState('');
    const [shortUrlExistsError, setShortUrlExistsError] = useState(false);

    function isValidUrl(string: string) {
        try {
            new URL(string);
            return true;
        } catch {
            return false;
        }
    }

    function validateInputUrl() {
        if (!isValidUrl(originalUrl)) {
            setUrlInvalid(true);
            ShowToast('Please enter a valid URL (https://...)', 'danger');
            return false;
        }
        return true;
    }

    async function parseShortUrlCreated(
        receipt: ethers.TransactionReceipt,
        provider: ethers.Provider
    ): Promise<string | null> {
        const iface = new ethers.Interface(abi);
        let logs = receipt.logs ? [...receipt.logs] : [];

        // Fallback to provider.getLogs if receipt.logs empty (Hedera relay quirk)
        if (logs.length === 0) {
            logs = await provider.getLogs({
                address: CONTRACT_ADDRESS,
                fromBlock: receipt.blockNumber,
                toBlock: receipt.blockNumber,
                topics: [iface.getEvent('ShortUrlCreated')!.topicHash],
            });
        }

        const parsedLog = logs
            .map((log) => {
                try { return iface.parseLog(log as any); } catch { return null; }
            })
            .find((log) => log?.name === 'ShortUrlCreated');

        return parsedLog?.args?.shortId ?? null;
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!validateInputUrl()) return;

        try {
            await switchToHedera();

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);

            if (isCustomMode) {
                // Strip leading slash from shortUrl for contract call
                const customId = shortUrl.replace(/^\//, '');

                if (!customId) {
                    ShowToast('Please enter a custom slug', 'danger');
                    return;
                }

                const exists = await contract.shortIdExists(customId);
                if (exists) {
                    setShortUrlExistsError(true);
                    ShowToast('That short URL is already taken', 'danger');
                    return;
                }

                setStatus('Confirm transaction in MetaMask (1 HBAR)...');

                const tx = await contract.createCustomShortUrl(
                    customId,
                    originalUrl,
                    { value: ethers.parseEther('1'), gasLimit: 400000 }
                );

                setStatus('Waiting for confirmation...');
                const receipt = await tx.wait();

                const shortId = await parseShortUrlCreated(receipt, provider);

                if (shortId) {
                    localStorage.setItem(`txHash_${shortId}`, receipt.hash);
                }

                setTxHash(receipt.hash);
                setGeneratedShortId(shortId ?? customId);
                ShowToast('Custom link created! View on HashScan', 'success');
                setStatus('Confirmed in block ' + receipt.blockNumber);
            } else {
                setStatus('Sending to blockchain...');

                const tx = await contract.generateShortUrl(
                    originalUrl,
                    { gasLimit: 400000 }
                );

                setStatus('Waiting for confirmation...');
                const receipt = await tx.wait();

                const shortId = await parseShortUrlCreated(receipt, provider);

                if (shortId) {
                    localStorage.setItem(`txHash_${shortId}`, receipt.hash);
                }

                setTxHash(receipt.hash);
                setGeneratedShortId(shortId ?? '');
                ShowToast('Short link created! View on HashScan', 'success');
                setStatus('Confirmed in block ' + receipt.blockNumber);
            }
        } catch (err: any) {
            if (err.code === 4001) {
                setStatus('Transaction cancelled by user.');
                ShowToast('Transaction cancelled', 'danger');
            } else {
                setStatus('');
                ShowToast('Transaction failed: ' + (err.message || 'Unknown error'), 'danger');
            }
        }
    }

    return (
        <div>
            <ul className="nav nav-tabs">
                <li className="nav-item">
                    <button
                        className={`nav-link ${isCustomMode ? 'active' : ''}`}
                        onClick={() => setIsCustomMode(true)}
                    >
                        Custom URL
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${!isCustomMode ? 'active' : ''}`}
                        onClick={() => setIsCustomMode(false)}
                    >
                        Random
                    </button>
                </li>
            </ul>

            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <input
                        type="text"
                        value={originalUrl}
                        onChange={(e) => {
                            setOriginalUrl(e.target.value);
                            setUrlInvalid(false);
                        }}
                        placeholder="Original URL (e.g. https://example.com/)"
                        className={`form-control ${urlInvalid ? 'is-invalid' : ''}`}
                    />

                    {isCustomMode && (
                        <div className="input-group mt-3">
                            <span className="input-group-text">durl.dev/</span>
                            <input
                                type="text"
                                value={shortUrl}
                                onChange={(e) => {
                                    let value = e.target.value.trim();

                                    value = value.replace(/\s+/g, '-');

                                    value = value.replace(/[^a-zA-Z0-9_-]/g, '');

                                    if (!value.startsWith('/')) {
                                        value = '/' + value;
                                    }

                                    setShortUrl(value);
                                    setUrlInvalid(false);
                                    setShortUrlExistsError(false);
                                }}
                                placeholder="custom-link"
                                className={`form-control ${shortUrlExistsError || !/^\/.*/.test(shortUrl) ? 'is-invalid' : ''}`}
                            />
                        </div>
                    )}

                    {shortUrlExistsError && (
                        <div className="invalid-feedback d-block mt-1">
                            That short URL is already taken.
                        </div>
                    )}
                </div>

                <div className="button-group mt-3">
                    <button type="submit" className="btn btn-primary w-100">
                        Submit to Blockchain
                    </button>
                </div>

                <div className="price-disclaimer small mt-3">
                    {isCustomMode
                        ? 'Cost: 1 HBAR + gas fee'
                        : 'Cost: Free (gas fee only)'}
                </div>
            </form>

            {status && <div className="alert alert-info mt-3">{status}</div>}

            {txHash && (
                <div className="alert alert-success mt-3">
                    <strong>Link created!</strong><br />
                    Short URL:{' '}
                    <a
                        href={`${PROJECT_URL}/#/${generatedShortId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {`${PROJECT_URL}/#/${generatedShortId}`}
                    </a>
                    <br />
                    <a
                        href={getHashScanTxUrl(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View on HashScan
                    </a>
                </div>
            )}
        </div>
    );
}
