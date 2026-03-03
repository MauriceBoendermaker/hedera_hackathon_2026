import { useState } from 'react';
import { ethers } from 'ethers';
import abi from '../abi_hedera.json';
import { ShowToast } from './utils/ShowToast';
import { switchToHedera } from 'utils/NetworkSwitcher';
import { getHashScanTxUrl, CONTRACT_ADDRESS, PROJECT_URL } from 'utils/HederaConfig';
import { safeSetItem } from 'utils/safeStorage';

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
    const [checkingSlug, setCheckingSlug] = useState(false);
    const [slugHint, setSlugHint] = useState('');
    const [copied, setCopied] = useState(false);

    const hasWallet = typeof window !== 'undefined' && !!window.ethereum;
    const MAX_SLUG_LENGTH = 32;

    function resetForm() {
        setOriginalUrl('');
        setShortUrl('');
        setSlugHint('');
        setUrlInvalid(false);
        setShortUrlExistsError(false);
        setStatus('');
    }

    function isValidUrl(string: string) {
        try {
            const url = new URL(string);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return false;
            }
            const hostname = url.hostname.toLowerCase();
            if (
                hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname === '0.0.0.0' ||
                hostname === '[::1]' ||
                hostname.startsWith('10.') ||
                hostname.startsWith('192.168.') ||
                /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
            ) {
                return false;
            }
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

                setCheckingSlug(true);
                let exists: boolean;
                try {
                    exists = await contract.shortIdExists(customId);
                } finally {
                    setCheckingSlug(false);
                }
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
                    safeSetItem(`txHash_${shortId}`, receipt.hash);
                }

                setTxHash(receipt.hash);
                setGeneratedShortId(shortId ?? customId);
                resetForm();
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
                    safeSetItem(`txHash_${shortId}`, receipt.hash);
                }

                setTxHash(receipt.hash);
                setGeneratedShortId(shortId ?? '');
                resetForm();
                ShowToast('Short link created! View on HashScan', 'success');
                setStatus('Confirmed in block ' + receipt.blockNumber);
            }
        } catch (err: any) {
            let message: string;

            if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
                message = 'Transaction cancelled by user.';
            } else if (err.code === -32603) {
                message = 'Internal RPC error. The network may be congested — please try again.';
            } else if (err.code === -32002) {
                message = 'A wallet request is already pending. Check your MetaMask.';
            } else if (err.code === 'CALL_EXCEPTION' && err.reason) {
                message = `Contract error: ${err.reason}`;
            } else if (err.reason) {
                message = `Transaction failed: ${err.reason}`;
            } else if (err.message?.includes('timeout') || err.code === 'TIMEOUT') {
                message = 'Transaction timed out. Check your wallet for pending transactions.';
            } else if (err.message?.includes('insufficient funds')) {
                message = 'Insufficient funds to cover the transaction cost and gas.';
            } else if (err.message?.includes('nonce')) {
                message = 'Nonce conflict. Reset your wallet activity or wait for pending transactions.';
            } else {
                message = 'Transaction failed: ' + (err.message || 'Unknown error');
            }

            setStatus(message);
            ShowToast(message, 'danger');
            console.error('Transaction error:', err);
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

            <div className="nav nav-tabs" role="tablist">
                <div className="nav-item">
                    <button
                        className={`nav-link ${isCustomMode ? 'active' : ''}`}
                        onClick={() => setIsCustomMode(true)}
                        role="tab"
                        aria-selected={isCustomMode}
                        aria-controls="tab-custom"
                        id="tab-btn-custom"
                    >
                        Custom URL
                    </button>
                </div>
                <div className="nav-item">
                    <button
                        className={`nav-link ${!isCustomMode ? 'active' : ''}`}
                        onClick={() => setIsCustomMode(false)}
                        role="tab"
                        aria-selected={!isCustomMode}
                        aria-controls="tab-random"
                        id="tab-btn-random"
                    >
                        Random
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} role="tabpanel" id={isCustomMode ? 'tab-custom' : 'tab-random'} aria-labelledby={isCustomMode ? 'tab-btn-custom' : 'tab-btn-random'}>
                <div className="mb-3">
                    <label htmlFor="original-url" className="visually-hidden">Original URL</label>
                    <input
                        id="original-url"
                        type="text"
                        value={originalUrl}
                        onChange={(e) => {
                            setOriginalUrl(e.target.value);
                            setUrlInvalid(false);
                        }}
                        placeholder="Original URL (e.g. https://example.com/)"
                        className={`form-control ${urlInvalid ? 'is-invalid' : ''}`}
                    />

                    {isCustomMode && (() => {
                        const slugLength = shortUrl.replace(/^\//, '').length;
                        const isOverLimit = slugLength > MAX_SLUG_LENGTH;
                        return (
                            <>
                                <div className="input-group mt-3">
                                    <label htmlFor="custom-slug" className="visually-hidden">Custom slug</label>
                                    <span className="input-group-text" id="custom-slug-prefix">durl.dev/</span>
                                    <input
                                        id="custom-slug"
                                        type="text"
                                        value={shortUrl}
                                        aria-describedby="custom-slug-prefix"
                                        onChange={(e) => {
                                            const raw = e.target.value;

                                            let value = raw.trim();
                                            value = value.replace(/\s+/g, '-');

                                            const hadInvalid = /[^a-zA-Z0-9_\-/]/.test(value);
                                            value = value.replace(/[^a-zA-Z0-9_-]/g, '');

                                            if (!value.startsWith('/')) {
                                                value = '/' + value;
                                            }

                                            if (hadInvalid) {
                                                setSlugHint('Only letters, numbers, hyphens, and underscores allowed');
                                            } else if (value.replace(/^\//, '').length > MAX_SLUG_LENGTH) {
                                                setSlugHint(`Maximum ${MAX_SLUG_LENGTH} characters`);
                                            } else {
                                                setSlugHint('');
                                            }

                                            setShortUrl(value);
                                            setUrlInvalid(false);
                                            setShortUrlExistsError(false);
                                        }}
                                        maxLength={MAX_SLUG_LENGTH + 1} /* +1 accounts for the leading "/" prefix */
                                        placeholder="custom-link"
                                        className={`form-control ${shortUrlExistsError || isOverLimit ? 'is-invalid' : ''}`}
                                    />
                                </div>
                                <div className="slug-feedback mt-1">
                                    <span className={`slug-hint ${slugHint || checkingSlug ? 'visible' : ''}`}>
                                        {checkingSlug
                                            ? <><span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />Checking availability...</>
                                            : slugHint || '\u00A0'}
                                    </span>
                                    <span className={`slug-counter ${isOverLimit ? 'slug-counter--over' : ''}`}>
                                        {slugLength}/{MAX_SLUG_LENGTH}
                                    </span>
                                </div>
                                {shortUrlExistsError && (
                                    <div className="invalid-feedback d-block mt-1">
                                        That short URL is already taken.
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>

                <div className="button-group mt-3">
                    <div className="price-disclaimer small mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        <i className="fas fa-info-circle me-1" />
                        {isCustomMode
                            ? 'Cost: 1 HBAR + gas fee'
                            : 'Cost: Free (gas fee only)'}
                    </div>
                    <button type="submit" className="btn btn-primary w-100" disabled={submitting || !hasWallet} aria-busy={submitting}>
                        {submitting && <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />}
                        {submitting ? 'Submitting...' : 'Submit to Blockchain'}
                    </button>
                </div>
            </form>

            {status && !txHash && (
                <div className="status-banner mt-3">
                    <i className="fas fa-circle-notch fa-spin" />
                    <span>{status}</span>
                </div>
            )}

            {txHash && (() => {
                const fullUrl = `${PROJECT_URL}/#/${generatedShortId}`;
                const shareText = `Check out my decentralized short link: ${fullUrl}`;
                return (
                    <div className="link-created-card mt-3">
                        <div className="link-created-card__header">
                            <i className="fas fa-check-circle" />
                            <span>Link created</span>
                        </div>

                        <div className="link-created-card__url-row">
                            <a
                                href={fullUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link-created-card__url"
                            >
                                {fullUrl}
                            </a>
                            <button
                                className="link-created-card__copy-btn"
                                style={copied ? { background: '#198754', borderColor: '#198754', color: '#fff' } : undefined}
                                onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(fullUrl);
                                        ShowToast('Copied to clipboard', 'success');
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 1500);
                                    } catch {
                                        ShowToast('Failed to copy to clipboard', 'danger');
                                    }
                                }}
                                title="Copy short link"
                                aria-label="Copy short link"
                            >
                                <i className={copied ? 'fas fa-check' : 'fas fa-copy'} />
                            </button>
                        </div>

                        <div className="link-created-card__actions">
                            <a
                                className="link-created-card__action-btn"
                                href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Share on X"
                            >
                                <i className="fab fa-x-twitter" /> X
                            </a>
                            <a
                                className="link-created-card__action-btn"
                                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Share on WhatsApp"
                            >
                                <i className="fab fa-whatsapp" /> WhatsApp
                            </a>
                            <a
                                className="link-created-card__action-btn"
                                href={`https://t.me/share/url?url=${encodeURIComponent(fullUrl)}&text=${encodeURIComponent('Check out my decentralized short link!')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Share on Telegram"
                            >
                                <i className="fab fa-telegram" /> Telegram
                            </a>
                            <a
                                className="link-created-card__action-btn link-created-card__action-btn--accent"
                                href={getHashScanTxUrl(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="View on HashScan"
                            >
                                <i className="fas fa-external-link-alt" /> HashScan
                            </a>
                        </div>

                        {status && (
                            <div className="link-created-card__block-info">
                                {status}
                            </div>
                        )}

                        <button
                            type="button"
                            className="btn btn-sm btn-outline-light mt-3 w-100"
                            onClick={() => {
                                setTxHash('');
                                setGeneratedShortId('');
                                setStatus('');
                                setCopied(false);
                            }}
                        >
                            Create another link
                        </button>
                    </div>
                );
            })()}
        </div>
    );
}
