import { useEffect, useMemo, useState } from 'react';
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

    useEffect(() => {
        let cancelled = false;
        const abortController = new AbortController();

        async function loadLinks() {
            if (!window.ethereum) return;

            try {
                const res = await fetch(`${ANALYTICS_URL}/stats`, { signal: abortController.signal });
                if (!res.ok) throw new Error(`Stats request failed (${res.status})`);
                const stats = await res.json();
                if (!cancelled) setVisitCounts(stats);
            } catch (e) {
                if (!cancelled && !(e instanceof DOMException)) {
                    ShowToast('Could not load visit stats. Analytics server may be down.', 'danger');
                }
            }

            try {
                if (typeof window === 'undefined' || !window.ethereum) {
                    if (!cancelled) {
                        setError('MetaMask not detected. Please install MetaMask to use this feature.');
                        setLoading(false);
                    }
                    return;
                }

                if (!cancelled) setLoading(true);

                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (cancelled) return;
                if (!accounts || accounts.length === 0) {
                    setError('Wallet connection rejected or failed.');
                    return;
                }

                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const address = await signer.getAddress();
                if (cancelled) return;
                setAccount(address);

                const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
                const shortIds: string[] = await contract.getUserLinks(address);
                if (cancelled) return;

                const formatted = await Promise.all(
                    shortIds.map(async (shortId) => {
                        const url = await contract.getOriginalUrl(shortId);
                        return { shortId, url };
                    })
                );

                if (!cancelled) {
                    setLinks(formatted);
                    setError('');
                }
            } catch (err: any) {
                if (!cancelled) {
                    const message = err?.reason || err?.message || 'Unknown error';
                    setError(`Failed to load links: ${message}`);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadLinks();

        let pollFailures = 0;
        const statsInterval = setInterval(async () => {
            if (cancelled) return;
            try {
                const res = await fetch(`${ANALYTICS_URL}/stats`, { signal: abortController.signal });
                if (!res.ok) throw new Error(`Stats request failed (${res.status})`);
                const stats = await res.json();
                if (!cancelled) {
                    setVisitCounts(stats);
                    pollFailures = 0;
                }
            } catch (e) {
                if (!cancelled && !(e instanceof DOMException)) {
                    pollFailures++;
                    if (pollFailures >= 3) {
                        ShowToast('Visit stats are temporarily unavailable.', 'danger');
                        pollFailures = 0;
                    }
                }
            }
        }, 5000);

        return () => {
            cancelled = true;
            abortController.abort();
            clearInterval(statsInterval);
        };
    }, []);

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

                        {error && <div className="alert alert-danger">{error}</div>}

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
                            ) : (
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
                                                            >
                                                                <i className="fas fa-copy" />
                                                            </button>
                                                            <button
                                                                className="btn btn-sm btn-outline-light"
                                                                title="Show QR"
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
                            )}
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
