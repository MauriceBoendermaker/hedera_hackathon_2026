import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import abi from '../abi_hedera.json';
import { ShowToast } from './utils/ShowToast';
import QRModal from './utils/QRModal';
import { getHashScanTxUrl, CONTRACT_ADDRESS, PROJECT_URL, ANALYTICS_URL } from 'utils/HederaConfig';

type SortOption = 'newest' | 'oldest' | 'most-visited' | 'least-visited';

function Dashboard() {
    const [account, setAccount] = useState('');
    const [links, setLinks] = useState<{ shortId: string; url: string }[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [qrTarget, setQrTarget] = useState<string | null>(null);
    const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('newest');
    const [retryCount, setRetryCount] = useState(0);

    const loadLinks = useCallback(async (signal: AbortSignal) => {
        if (!window.ethereum) return;

        try {
            const res = await fetch(`${ANALYTICS_URL}/stats`, { signal });
            if (res.status === 429) {
                ShowToast('Rate limit reached — stats requests are temporarily throttled.', 'danger');
                return;
            }
            if (!res.ok) throw new Error(`Stats request failed (${res.status})`);
            const stats = await res.json();
            setVisitCounts(stats);
        } catch (e) {
            if (!(e instanceof DOMException)) {
                ShowToast('Could not load visit stats. Analytics server may be down.', 'danger');
            }
        }

        try {
            if (typeof window === 'undefined' || !window.ethereum) {
                setError('MetaMask not detected. Please install MetaMask to use this feature.');
                setLoading(false);
                return;
            }

            setLoading(true);

            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (signal.aborted) return;
            if (!accounts || accounts.length === 0) {
                setError('Wallet connection rejected or failed.');
                return;
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            if (signal.aborted) return;
            setAccount(address);

            const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
            const shortIds: string[] = await contract.getUserLinks(address);
            if (signal.aborted) return;

            const BATCH_SIZE = 5;
            const formatted: { shortId: string; url: string }[] = [];
            for (let i = 0; i < shortIds.length; i += BATCH_SIZE) {
                if (signal.aborted) return;
                const batch = shortIds.slice(i, i + BATCH_SIZE);
                const results = await Promise.all(
                    batch.map(async (shortId) => {
                        const url = await contract.getOriginalUrl(shortId);
                        return { shortId, url };
                    })
                );
                formatted.push(...results);
            }

            if (!signal.aborted) {
                setLinks(formatted);
                setError('');
            }
        } catch (err: any) {
            if (!signal.aborted) {
                const message = err?.reason || err?.message || 'Unknown error';
                setError(`Failed to load links: ${message}`);
            }
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const abortController = new AbortController();

        loadLinks(abortController.signal);

        let pollFailures = 0;
        const statsInterval = setInterval(async () => {
            if (abortController.signal.aborted) return;
            try {
                const res = await fetch(`${ANALYTICS_URL}/stats`, { signal: abortController.signal });
                if (res.status === 429) {
                    ShowToast('Rate limit reached — stats requests are temporarily throttled.', 'danger');
                    return;
                }
                if (!res.ok) throw new Error(`Stats request failed (${res.status})`);
                const stats = await res.json();
                if (!abortController.signal.aborted) {
                    setVisitCounts(stats);
                    pollFailures = 0;
                }
            } catch (e) {
                if (!abortController.signal.aborted && !(e instanceof DOMException)) {
                    pollFailures++;
                    if (pollFailures >= 3) {
                        ShowToast('Visit stats are temporarily unavailable.', 'danger');
                        pollFailures = 0;
                    }
                }
            }
        }, 5000);

        return () => {
            abortController.abort();
            clearInterval(statsInterval);
        };
    }, [loadLinks, retryCount]);

    async function copyToClipboard(shortId: string) {
        const fullUrl = `${PROJECT_URL}/#/${shortId}`;
        try {
            await navigator.clipboard.writeText(fullUrl);
            ShowToast('Copied to clipboard', 'success');
        } catch {
            ShowToast('Failed to copy to clipboard', 'danger');
        }
    }

    function downloadDashboardQR() {
        const canvas = document.querySelector('#dashboardQrModal canvas') as HTMLCanvasElement;
        if (!canvas || !qrTarget) return;

        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${qrTarget.split('/').pop()}.png`;
        a.click();
    }

    const filteredLinks = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        let result = links;

        if (q) {
            result = result.filter(
                (link) =>
                    link.shortId.toLowerCase().includes(q) ||
                    link.url.toLowerCase().includes(q)
            );
        }

        const sorted = [...result];
        switch (sortBy) {
            case 'oldest':
                // Original chain order is oldest-first already
                break;
            case 'newest':
                sorted.reverse();
                break;
            case 'most-visited':
                sorted.sort((a, b) => (visitCounts[b.shortId] || 0) - (visitCounts[a.shortId] || 0));
                break;
            case 'least-visited':
                sorted.sort((a, b) => (visitCounts[a.shortId] || 0) - (visitCounts[b.shortId] || 0));
                break;
        }

        return sorted;
    }, [links, searchQuery, sortBy, visitCounts]);

    return (
        <section className="dashboard-container">
            <div className="container py-5">
                <div className="row justify-content-center">
                    <div className="col-md-10 glass-card">
                        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                            <h2 className="title-glow m-0">Your Shortened Links</h2>
                            <span className="text-light small">Wallet: {account}</span>
                        </div>

                        {error && (
                            <div className="alert alert-danger d-flex justify-content-between align-items-center">
                                <span>{error}</span>
                                <button
                                    className="btn btn-sm btn-outline-danger ms-3 flex-shrink-0"
                                    onClick={() => setRetryCount(c => c + 1)}
                                >
                                    <i className="fas fa-redo me-1" /> Retry
                                </button>
                            </div>
                        )}

                        {loading ? (
                            <div className="table-responsive">
                                <table className="table table-dark align-middle">
                                    <thead>
                                        <tr>
                                            <th>Short link</th>
                                            <th>Original URL</th>
                                            <th className="text-center">Actions</th>
                                            <th className="text-center">Visits</th>
                                            <th className="text-center">HashScan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...Array(4)].map((_, i) => (
                                            <tr key={i}>
                                                <td><span className="skeleton skeleton--short" /></td>
                                                <td><span className="skeleton skeleton--long" /></td>
                                                <td className="text-center">
                                                    <div className="d-flex justify-content-center gap-2">
                                                        <span className="skeleton skeleton--btn" />
                                                        <span className="skeleton skeleton--btn" />
                                                    </div>
                                                </td>
                                                <td className="text-center"><span className="skeleton skeleton--num" /></td>
                                                <td className="text-center">
                                                    <div className="d-flex justify-content-center gap-2">
                                                        <span className="skeleton skeleton--btn" />
                                                        <span className="skeleton skeleton--btn" />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : links.length === 0 ? (
                            <div className="dashboard-empty text-center">
                                <i className="fas fa-link" />
                                <h4>No links yet</h4>
                                <p>Create your first decentralized short link to see it here.</p>
                                <a href="/#/" className="btn btn-primary">
                                    Shorten a link
                                </a>
                            </div>
                        ) : (
                            <>
                            <div className="dashboard-toolbar">
                                <div className="dashboard-search">
                                    <i className="fas fa-search" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by slug or URL..."
                                        className="form-control form-control-sm"
                                    />
                                </div>
                                <div className="dashboard-sort">
                                    <label htmlFor="sort-select" className="small text-light me-2">Sort:</label>
                                    <select
                                        id="sort-select"
                                        className="form-select form-select-sm"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                                    >
                                        <option value="newest">Newest first</option>
                                        <option value="oldest">Oldest first</option>
                                        <option value="most-visited">Most visited</option>
                                        <option value="least-visited">Least visited</option>
                                    </select>
                                </div>
                            </div>

                            {filteredLinks.length === 0 ? (
                                <p className="text-center text-muted my-4">
                                    No links matching "{searchQuery}"
                                </p>
                            ) : (<>
                            {/* Desktop table */}
                            <div className="table-responsive d-none d-md-block">
                                <table className="table table-dark align-middle">
                                    <thead>
                                        <tr>
                                            <th>Short link</th>
                                            <th>Original URL</th>
                                            <th className="text-center">Actions</th>
                                            <th className="text-center">Visits</th>
                                            <th className="text-center">HashScan</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredLinks.map((link) => {
                                            const shortUrl = `${PROJECT_URL}/#/${link.shortId}`;
                                            return (
                                                <tr key={link.shortId}>
                                                    <td>
                                                        <a
                                                            href={shortUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-light text-decoration-none"
                                                        >
                                                            <code>{link.shortId}</code>
                                                            &nbsp;
                                                            <i className="fas fa-external-link-alt small" />
                                                        </a>
                                                    </td>
                                                    <td style={{ wordBreak: 'break-all' }}>
                                                        <a
                                                            href={link.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-light text-decoration-none"
                                                        >
                                                            {link.url}
                                                            &nbsp;
                                                            <i className="fas fa-external-link-alt small" />
                                                        </a>
                                                    </td>
                                                    <td className="text-center">
                                                        <div className="d-flex justify-content-center gap-2 flex-wrap">
                                                            <button
                                                                className="btn btn-sm btn-outline-light"
                                                                onClick={() => copyToClipboard(link.shortId)}
                                                                title="Copy short link"
                                                                aria-label="Copy short link"
                                                            >
                                                                <i className="fas fa-copy" />
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-outline-light"
                                                                title="Show QR"
                                                                aria-label="Show QR code"
                                                                onClick={() => {
                                                                    setQrTarget(shortUrl);
                                                                    setTimeout(() => {
                                                                        const modal = new (window as any).bootstrap.Modal(document.getElementById('dashboardQrModal'));
                                                                        modal.show();
                                                                    }, 0);
                                                                }}
                                                            >
                                                                <i className="fas fa-qrcode" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        {visitCounts[link.shortId] || 0}
                                                    </td>
                                                    <td className="text-center">
                                                        {(() => {
                                                            const txHash = localStorage.getItem(`txHash_${link.shortId}`);
                                                            if (txHash) {
                                                                return (
                                                                    <div className="d-flex justify-content-center gap-2">
                                                                        <a
                                                                            href={getHashScanTxUrl(txHash)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="btn btn-sm btn-outline-light"
                                                                            title="View on HashScan"
                                                                            aria-label="View transaction on HashScan"
                                                                        >
                                                                            <i className="fas fa-external-link-alt" />
                                                                        </a>
                                                                        <button
                                                                            className="btn btn-sm btn-outline-light"
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(txHash);
                                                                                ShowToast('Tx hash copied!', 'success');
                                                                            }}
                                                                            title="Copy tx hash"
                                                                            aria-label="Copy transaction hash"
                                                                        >
                                                                            <i className="fas fa-hashtag" />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            }
                                                            return <span className="text-muted small">--</span>;
                                                        })()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="link-cards d-md-none">
                                {filteredLinks.map((link) => {
                                    const shortUrl = `${PROJECT_URL}/#/${link.shortId}`;
                                    const txHash = localStorage.getItem(`txHash_${link.shortId}`);
                                    return (
                                        <div key={link.shortId} className="link-card">
                                            <div className="link-card-header">
                                                <a
                                                    href={shortUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-decoration-none"
                                                >
                                                    <code>{link.shortId}</code>
                                                    &nbsp;
                                                    <i className="fas fa-external-link-alt small" />
                                                </a>
                                                <span className="link-card-visits">
                                                    <i className="fas fa-chart-bar" /> {visitCounts[link.shortId] || 0}
                                                </span>
                                            </div>
                                            <p className="link-card-url">
                                                <a
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-light text-decoration-none"
                                                >
                                                    {link.url}
                                                </a>
                                            </p>
                                            <div className="link-card-actions">
                                                <button
                                                    className="btn btn-sm btn-outline-light"
                                                    onClick={() => copyToClipboard(link.shortId)}
                                                    aria-label="Copy short link"
                                                >
                                                    <i className="fas fa-copy" /> Copy
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-light"
                                                    aria-label="Show QR code"
                                                    onClick={() => {
                                                        setQrTarget(shortUrl);
                                                        setTimeout(() => {
                                                            const modal = new (window as any).bootstrap.Modal(document.getElementById('dashboardQrModal'));
                                                            modal.show();
                                                        }, 0);
                                                    }}
                                                >
                                                    <i className="fas fa-qrcode" /> QR
                                                </button>
                                                {txHash && (
                                                    <a
                                                        href={getHashScanTxUrl(txHash)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-sm btn-outline-light"
                                                        aria-label="View transaction on HashScan"
                                                    >
                                                        <i className="fas fa-external-link-alt" /> HashScan
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            </>)}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {qrTarget && (
                <QRModal
                    id="dashboardQrModal"
                    qrValue={qrTarget}
                    onDownload={downloadDashboardQR}
                />
            )}
        </section>
    );
}

export default Dashboard;
