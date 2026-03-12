import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ANALYTICS_URL } from 'utils/HederaConfig';
import { authenticate, getAuthToken } from 'utils/auth';

interface DataField {
    field: string;
    purpose: string;
    storage: string;
}

interface PrivacyData {
    lastUpdated: string;
    dataCollected: DataField[];
    retention: string;
    rights: { erasure: string; access: string };
    legal: string;
}

interface EraseResult {
    feedback: number;
}

function PrivacyPolicy() {
    const [policy, setPolicy] = useState<PrivacyData | null>(null);
    const [error, setError] = useState('');
    const [erasing, setErasing] = useState(false);
    const [eraseResult, setEraseResult] = useState<EraseResult | null>(null);
    const [eraseError, setEraseError] = useState('');
    const [confirmStep, setConfirmStep] = useState(false);

    useEffect(() => {
        fetch(`${ANALYTICS_URL}/privacy`)
            .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
            .then(setPolicy)
            .catch(() => setError('Unable to load privacy policy. Please try again later.'));
    }, []);

    async function handleErase() {
        if (!confirmStep) {
            setConfirmStep(true);
            return;
        }

        setErasing(true);
        setEraseError('');
        setEraseResult(null);

        try {
            const token = await authenticate();
            if (!token) {
                setEraseError('Wallet authentication required. Please connect MetaMask.');
                return;
            }

            const res = await fetch(`${ANALYTICS_URL}/privacy/erase`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Erasure failed');
            }

            const { erased } = await res.json();
            setEraseResult(erased);
            setConfirmStep(false);
        } catch (err: any) {
            setEraseError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setErasing(false);
        }
    }

    return (
        <section className="about-container">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-md-8 glass-card">
                        <h1 className="title-glow mb-4">Privacy Policy</h1>

                        {error && <div className="alert alert-danger">{error}</div>}

                        {!policy && !error && (
                            <div className="text-center py-4">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        )}

                        {policy && (
                            <>
                                <p className="text-muted mb-4">Last updated: {policy.lastUpdated}</p>

                                <h2 className="h5 mb-3">Data We Collect</h2>
                                <div className="table-responsive mb-4">
                                    <table className="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Data</th>
                                                <th>Purpose</th>
                                                <th>How It's Stored</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {policy.dataCollected.map((d) => (
                                                <tr key={d.field}>
                                                    <td><strong>{d.field}</strong></td>
                                                    <td>{d.purpose}</td>
                                                    <td>{d.storage}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <h2 className="h5 mb-3">Data Retention</h2>
                                <p>{policy.retention}</p>

                                <h2 className="h5 mb-3">Your Rights</h2>
                                <ul>
                                    <li><strong>Right to access:</strong> Connect your wallet and visit your <Link to="/dashboard" className="btn-link">Dashboard</Link> to see link stats, or click any link to view its full analytics (visit timeline, traffic sources, geography).</li>
                                    <li><strong>Right to erasure:</strong> Use the button below to permanently delete all your data.</li>
                                </ul>

                                <div className="mt-4 mb-3">
                                    {eraseResult ? (
                                        <div className="alert alert-success">
                                            {eraseResult.feedback === 0
                                                ? 'No personal data found to delete. Link ownership and anonymous visitor analytics are derived from public blockchain data and are not erasable.'
                                                : `Deleted ${eraseResult.feedback} feedback entr${eraseResult.feedback !== 1 ? 'ies' : 'y'}. Link ownership and anonymous visitor analytics are retained as they are derived from public on-chain data.`
                                            }
                                        </div>
                                    ) : (
                                        <>
                                            {confirmStep && (
                                                <div className="alert alert-warning">
                                                    This will permanently delete all feedback you submitted and all visit analytics for links you own. This cannot be undone.
                                                </div>
                                            )}
                                            <button
                                                className={`btn ${confirmStep ? 'btn-danger' : 'btn-outline-danger'}`}
                                                onClick={handleErase}
                                                disabled={erasing}
                                            >
                                                {erasing && <span className="spinner-border spinner-border-sm me-2" role="status" />}
                                                {confirmStep ? 'Confirm — Delete My Data' : 'Delete My Data'}
                                            </button>
                                            {confirmStep && (
                                                <button
                                                    className="btn btn-outline-secondary ms-2"
                                                    onClick={() => setConfirmStep(false)}
                                                    disabled={erasing}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {eraseError && <div className="alert alert-danger mt-2">{eraseError}</div>}
                                </div>

                                <h2 className="h5 mb-3">Technical Details</h2>
                                <p>{policy.legal}</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default PrivacyPolicy;
