import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import abi from '../abi_hedera.json';
import { ShowToast } from './utils/ShowToast';
import QRModal from './utils/QRModal';
import { getHashScanTxUrl, CONTRACT_ADDRESS, PROJECT_URL, ANALYTICS_URL } from 'utils/HederaConfig';

function Dashboard() {
    const [account, setAccount] = useState('');
    const [links, setLinks] = useState<{ shortId: string; url: string }[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [qrTarget, setQrTarget] = useState<string | null>(null);
    const [visitCounts, setVisitCounts] = useState<Record<string, number>>({});

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
                            <div className="text-center my-5">
                                <div className="spinner-border text-light" role="status" />
                                <p className="mt-3">Loading links...</p>
                            </div>
                        ) : links.length === 0 ? (
                            <div className="alert alert-danger">No links found for this wallet.</div>
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
                                        {links.map((link) => {
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
