import { useEffect, useState } from 'react';
import { ANALYTICS_URL } from 'utils/HederaConfig';
import { authenticate, authHeaders } from 'utils/auth';

interface StatsData {
    total: number;
    averageRating: number;
    distribution: Record<number, number>;
}

export function FeedbackStats() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        authenticate().then((token) => {
            if (!token) return;
            fetch(`${ANALYTICS_URL}/feedback/stats`, { headers: authHeaders() })
                .then((res) => res.ok ? res.json() : Promise.reject())
                .then((data) => setStats(data))
                .catch(() => setError(true));
        });
    }, []);

    if (error || !stats || stats.total === 0) return null;

    const maxCount = Math.max(...Object.values(stats.distribution), 1);

    return (
        <div className="feedback-stats glass-card mt-4">
            <h3 className="title-glow mb-3">Community Sentiment</h3>

            <div className="feedback-stats__layout">
                <div className="feedback-stats__avg">
                    <span className="feedback-stats__avg-number">{stats.averageRating.toFixed(1)}</span>
                    <div className="feedback-stats__avg-stars">
                        {[1, 2, 3, 4, 5].map((s) => (
                            <i
                                key={s}
                                className={`fa${s <= Math.round(stats.averageRating) ? 's' : 'r'} fa-star`}
                            />
                        ))}
                    </div>
                    <span className="feedback-stats__avg-label">{stats.total} response{stats.total !== 1 ? 's' : ''}</span>
                </div>

                <div className="feedback-stats__distribution">
                    {[5, 4, 3, 2, 1].map((star) => (
                        <div key={star} className="feedback-stats__bar-row">
                            <span className="feedback-stats__bar-label">{star}<i className="fas fa-star ms-1" /></span>
                            <div className="feedback-stats__bar-track">
                                <div
                                    className="feedback-stats__bar-fill"
                                    style={{ width: `${(stats.distribution[star] / maxCount) * 100}%` }}
                                />
                            </div>
                            <span className="feedback-stats__bar-count">{stats.distribution[star]}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
