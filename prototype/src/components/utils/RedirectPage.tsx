import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ethers } from 'ethers';
import abi from '../../abi_hedera.json';
import { CONTRACT_ADDRESS, HEDERA_RPC_URL, ANALYTICS_URL } from 'utils/HederaConfig';
import { ShowToast } from './ShowToast';

const COUNTDOWN_SECONDS = 3;

function RedirectPage() {
    const { shortId } = useParams() as { shortId: string };
    const [error, setError] = useState('');
    const [destination, setDestination] = useState('');
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

    useEffect(() => {
        async function resolveRedirect() {
            const id1 = shortId.startsWith('/') ? shortId.slice(1) : shortId;
            const id2 = shortId;

            try {
                const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
                const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

                let dest = '';
                try {
                    dest = await contract.getOriginalUrl(id1);
                } catch {
                    // First lookup failed, try fallback
                }

                if (!dest || dest.trim() === '') {
                    dest = await contract.getOriginalUrl(id2);
                }

                if (!dest || dest.trim() === '') {
                    setError('This short link does not exist or has no destination.');
                    return;
                }

                try {
                    const protocol = new URL(dest).protocol;
                    if (protocol !== 'http:' && protocol !== 'https:') {
                        setError('This link points to an unsafe destination and has been blocked.');
                        return;
                    }
                } catch {
                    setError('This link contains an invalid URL.');
                    return;
                }

                // Analytics tracking — fire-and-forget, don't block redirect
                fetch(`${ANALYTICS_URL}/track`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shortId,
                        timestamp: Date.now(),
                        referrer: document.referrer,
                        userAgent: navigator.userAgent
                    })
                }).then(res => {
                    if (res.status === 429) {
                        ShowToast('Rate limit reached — this visit was not counted.', 'danger');
                    }
                }).catch(() => {});

                setDestination(dest);
            } catch (err: any) {
                const message = err?.reason || err?.message || 'Unknown error';
                setError(`Could not resolve this link: ${message}`);
            }
        }

        resolveRedirect();
    }, [shortId]);

    // Countdown timer — starts once destination is resolved
    useEffect(() => {
        if (!destination) return;

        if (countdown <= 0) {
            window.location.href = destination;
            return;
        }

        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [destination, countdown]);

    if (error) {
        return (
            <section className="redirect-page">
                <div className="redirect-card glass-card text-center">
                    <div className="redirect-brand">
                        dURL <small>//dev</small>
                    </div>
                    <div className="redirect-icon redirect-icon--error">
                        <i className="fas fa-link-slash" />
                    </div>
                    <h3 className="text-light mb-3">Link not found</h3>
                    <p className="text-light mb-4">{error}</p>
                    <a href="/" className="btn btn-outline-light">Go to Home</a>
                </div>
            </section>
        );
    }

    if (!destination) {
        return (
            <section className="redirect-page">
                <div className="redirect-card glass-card text-center">
                    <div className="redirect-brand">
                        dURL <small>//dev</small>
                    </div>
                    <div className="redirect-icon">
                        <div className="spinner-border text-light" role="status" />
                    </div>
                    <p className="text-light mt-3">Resolving link from Hedera...</p>
                </div>
            </section>
        );
    }

    let displayDomain = '';
    try {
        displayDomain = new URL(destination).hostname;
    } catch {
        displayDomain = destination;
    }

    const progress = ((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100;

    return (
        <section className="redirect-page">
            <div className="redirect-card glass-card text-center">
                <div className="redirect-brand">
                    dURL <small>//dev</small>
                </div>

                <div className="redirect-countdown-ring">
                    <svg viewBox="0 0 100 100">
                        <circle
                            className="redirect-ring-bg"
                            cx="50" cy="50" r="42"
                        />
                        <circle
                            className="redirect-ring-fill"
                            cx="50" cy="50" r="42"
                            style={{ strokeDashoffset: 264 - (264 * progress / 100) }}
                        />
                    </svg>
                    <span className="redirect-countdown-number">{countdown}</span>
                </div>

                <p className="redirect-label">Redirecting you to</p>
                <p className="redirect-destination" title={destination}>
                    <i className="fas fa-arrow-up-right-from-square" />{' '}
                    {displayDomain}
                </p>

                <div className="redirect-progress-bar">
                    <div
                        className="redirect-progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <a
                    href={destination}
                    className="btn btn-outline-light btn-sm mt-3"
                >
                    Go now
                </a>

                <p className="redirect-powered">
                    Powered by <a href="/">dURL</a> on Hedera
                </p>
            </div>
        </section>
    );
}

export default RedirectPage;
