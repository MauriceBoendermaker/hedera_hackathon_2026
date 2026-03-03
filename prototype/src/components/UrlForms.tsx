import { useState } from 'react';
import { ethers } from 'ethers';
import abi from '../abi_hedera.json';
import { ShowToast } from './utils/ShowToast';
import { switchToHedera } from 'utils/NetworkSwitcher';
import { getHashScanTxUrl, CONTRACT_ADDRESS, PROJECT_URL } from 'utils/HederaConfig';

export function UrlForms() {
    const [originalUrl, setOriginalUrl] = useState('');
    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');
    const [generatedShortId, setGeneratedShortId] = useState('');
    const [urlInvalid, setUrlInvalid] = useState(false);
    const [isCustomMode, setIsCustomMode] = useState(true);
    const [shortUrl, setShortUrl] = useState('');
    const [shortUrlExistsError, setShortUrlExistsError] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const hasWallet = typeof window !== 'undefined' && !!window.ethereum;

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
        if (submitting) return;

        setSubmitting(true);
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
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div>
            {!hasWallet && (
                <div className="metamask-banner mb-3">
                    <div className="d-flex align-items-center gap-3">
                        <i className="fab fa-ethereum metamask-banner-icon" />
                        <div>
                            <strong>Wallet required</strong>
                            <p className="mb-0 small">
                                Install MetaMask to create short links on Hedera.
                            </p>
                        </div>
                        <a
                            href="https://metamask.io/download/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-light ms-auto text-nowrap"
                        >
                            Install MetaMask
                        </a>
                    </div>
                </div>
            )}

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
                    <button type="submit" className="btn btn-primary w-100" disabled={submitting || !hasWallet}>
                        {submitting ? 'Submitting...' : 'Submit to Blockchain'}
                    </button>
                </div>

                <div className="price-disclaimer small mt-3">
                    {isCustomMode
                        ? 'Cost: 1 HBAR + gas fee'
                        : 'Cost: Free (gas fee only)'}
                </div>
            </form>

            {status && <div className="alert alert-info mt-3">{status}</div>}

            {txHash && (() => {
                const fullUrl = `${PROJECT_URL}/#/${generatedShortId}`;
                const shareText = `Check out my decentralized short link: ${fullUrl}`;
                return (
                    <div className="alert alert-success mt-3">
                        <strong>Link created!</strong><br />
                        Short URL:{' '}
                        <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {fullUrl}
                        </a>
                        <div className="d-flex flex-wrap gap-2 mt-3">
                            <button
                                className="btn btn-sm btn-outline-light"
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(fullUrl);
                                        ShowToast('Copied to clipboard', 'success');
                                    } catch {
                                        ShowToast('Failed to copy to clipboard', 'danger');
                                    }
                                }}
                                title="Copy short link"
                            >
                                <i className="fas fa-copy" /> Copy
                            </button>
                            <a
                                className="btn btn-sm btn-outline-light"
                                href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Share on X"
                            >
                                <i className="fab fa-x-twitter" /> X
                            </a>
                            <a
                                className="btn btn-sm btn-outline-light"
                                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Share on WhatsApp"
                            >
                                <i className="fab fa-whatsapp" /> WhatsApp
                            </a>
                            <a
                                className="btn btn-sm btn-outline-light"
                                href={`https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent('Check out my decentralized short link!')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Share on Telegram"
                            >
                                <i className="fab fa-telegram" /> Telegram
                            </a>
                            <a
                                className="btn btn-sm btn-outline-light"
                                href={getHashScanTxUrl(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View on HashScan"
                            >
                                <i className="fas fa-external-link-alt" /> HashScan
                            </a>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
