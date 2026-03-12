import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ethers } from 'ethers';
import abi from '../../abi_hedera.json';
import { CONTRACT_ADDRESS, HEDERA_RPC_URL, ANALYTICS_URL } from 'utils/HederaConfig';
import { ShowToast } from './ShowToast';
import { COUNTDOWN_SECONDS, REDIRECT_SURVEY_TIMEOUT_MS } from 'config';
import { FeedbackWidget } from './FeedbackWidget';

function RedirectPage() {
    const { shortId } = useParams() as { shortId: string };
    const [error, setError] = useState('');
    const [destination, setDestination] = useState('');
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
    const [showSurvey, setShowSurvey] = useState(false);

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
                    const u = new URL(dest);
                    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
                        setError('This link points to an unsafe destination and has been blocked.');
                        return;
                    }
                    const h = u.hostname.toLowerCase();
                    if (
                        h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' ||
                        h === '[::1]' || h === '::1' ||
                        h.startsWith('10.') || h.startsWith('192.168.') ||
                        /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
                        h.endsWith('.local') || h.endsWith('.internal')
                    ) {
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
            // Check if feedback was already submitted; if so, redirect immediately
            const alreadySubmitted = (() => {
                try { return localStorage.getItem('feedback_submitted_redirect') === '1'; } catch { return true; }
            })();
            if (alreadySubmitted) {
                window.location.href = destination;
                return;
            }
            setShowSurvey(true);
            return;
        }

        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [destination, countdown]);

    // Auto-redirect after survey timeout
    useEffect(() => {
        if (!showSurvey || !destination) return;
        const timer = setTimeout(() => { window.location.href = destination; }, REDIRECT_SURVEY_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [showSurvey, destination]);

    if (error) {
        const isBlocked = error.includes('unsafe destination');
        const isNotFound = error.includes('does not exist') || error.includes('invalid URL');
        const heading = isBlocked ? 'Link blocked' : isNotFound ? 'Link not found' : 'Something went wrong';

        return (
            <section className="redirect-page">
                <div className="redirect-card glass-card text-center">
                    <div className="redirect-brand">
                        dURL <small>//dev</small>
                    </div>

                    {isBlocked ? (
                        <svg className="redirect-illustration" viewBox="0 0 120 120" aria-hidden="true">
                            <defs>
                                <filter id="err-glow">
                                    <feGaussianBlur stdDeviation="3" />
                                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            </defs>
                            <path
                                d="M60 18 L98 40 V84 L60 106 L22 84 V40 Z"
                                fill="none" stroke="#FFCCCC" strokeWidth="2.5"
                                filter="url(#err-glow)" opacity="0.85"
                            />
                            <line x1="60" y1="46" x2="60" y2="70" stroke="#FFCCCC" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="60" cy="82" r="3" fill="#FFCCCC" />
                        </svg>
                    ) : isNotFound ? (
                        <svg className="redirect-illustration" viewBox="0 0 160 100" aria-hidden="true">
                            <defs>
                                <filter id="err-glow">
                                    <feGaussianBlur stdDeviation="3" />
                                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            </defs>
                            <g filter="url(#err-glow)">
                                <rect x="12" y="28" width="48" height="20" rx="10"
                                      fill="none" stroke="#c95fff" strokeWidth="2.5"
                                      transform="rotate(-30 36 38)" />
                                <rect x="100" y="28" width="48" height="20" rx="10"
                                      fill="none" stroke="#c95fff" strokeWidth="2.5"
                                      transform="rotate(-30 124 38)" />
                            </g>
                            <g className="redirect-sparks">
                                <circle cx="80" cy="42" r="3" fill="#00ffe0" />
                                <circle cx="73" cy="54" r="2" fill="#FFCCCC" />
                                <circle cx="87" cy="50" r="2" fill="#00ffe0" />
                                <circle cx="76" cy="62" r="1.5" fill="#c95fff" />
                                <circle cx="84" cy="60" r="1.5" fill="#FFCCCC" />
                            </g>
                        </svg>
                    ) : (
                        <svg className="redirect-illustration" viewBox="0 0 120 120" aria-hidden="true">
                            <defs>
                                <filter id="err-glow">
                                    <feGaussianBlur stdDeviation="3" />
                                    <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            </defs>
                            <circle cx="60" cy="60" r="40" fill="none" stroke="#c95fff"
                                    strokeWidth="2.5" strokeDasharray="8 6"
                                    filter="url(#err-glow)" opacity="0.7" />
                            <g filter="url(#err-glow)">
                                <line x1="44" y1="44" x2="76" y2="76" stroke="#FFCCCC" strokeWidth="3" strokeLinecap="round" />
                                <line x1="76" y1="44" x2="44" y2="76" stroke="#FFCCCC" strokeWidth="3" strokeLinecap="round" />
                            </g>
                        </svg>
                    )}

                    <h3 className="text-light mb-2">{heading}</h3>
                    <p className="redirect-error-detail">{error}</p>
                    <a href="/" className="btn btn-outline-light mt-2">Go to Home</a>

                    <p className="redirect-powered">
                        Powered by <a href="/">dURL</a> on Hedera
                    </p>
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

    if (showSurvey) {
        return (
            <section className="redirect-page">
                <div className="redirect-card glass-card text-center">
                    <div className="redirect-brand">
                        dURL <small>//dev</small>
                    </div>
                    <p className="text-light mt-3 mb-2">Was this link useful?</p>
                    <FeedbackWidget
                        context="redirect"
                        compact
                        onSubmitted={() => { window.location.href = destination; }}
                    />
                    <p className="text-white-50 small mt-2">Redirecting shortly...</p>
                </div>
            </section>
        );
    }

    let displayHost = '';
    let displayPath = '';
    try {
        const parsed = new URL(destination);
        displayHost = parsed.hostname;
        displayPath = parsed.pathname + parsed.search + parsed.hash;
        if (displayPath === '/') displayPath = '';
    } catch {
        displayHost = destination;
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

                <p className="redirect-label">You are leaving dURL for an external site</p>
                <p className="redirect-destination" title={destination}>
                    <i className="fas fa-arrow-up-right-from-square" />{' '}
                    <strong>{displayHost}</strong>
                    {displayPath && <span className="redirect-destination-path">{displayPath}</span>}
                </p>
                <p className="redirect-warning text-warning small">
                    <i className="fas fa-triangle-exclamation" /> dURL does not control or endorse the destination. Verify the URL before proceeding.
                </p>

                <div className="redirect-progress-bar">
                    <div
                        className="redirect-progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <a
                    href={destination}
                    rel="noopener noreferrer nofollow"
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
