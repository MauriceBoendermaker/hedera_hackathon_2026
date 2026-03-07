import { useState } from 'react';
import { ANALYTICS_URL } from 'utils/HederaConfig';
import { FEEDBACK_COMMENT_MAX } from 'config';

interface FeedbackWidgetProps {
    context: 'creation' | 'redirect' | 'footer';
    compact?: boolean;
    onSubmitted?: () => void;
    survey?: Record<string, string>;
}

const STORAGE_KEY_PREFIX = 'feedback_submitted_';

function wasAlreadySubmitted(context: string): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY_PREFIX + context) === '1';
    } catch {
        return false;
    }
}

function markSubmitted(context: string) {
    try {
        localStorage.setItem(STORAGE_KEY_PREFIX + context, '1');
    } catch { /* quota exceeded or private mode */ }
}

export function FeedbackWidget({ context, compact, onSubmitted, survey }: FeedbackWidgetProps) {
    const [rating, setRating] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(() => wasAlreadySubmitted(context));
    const [submitting, setSubmitting] = useState(false);

    if (submitted) {
        return (
            <div className="feedback-widget feedback-widget--done">
                <i className="fas fa-check-circle" />
                <span>Thanks for your feedback!</span>
            </div>
        );
    }

    async function handleSubmit() {
        if (rating === 0 || submitting) return;
        setSubmitting(true);
        try {
            let wallet = '';
            try {
                if (window.ethereum) {
                    const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts.length > 0) wallet = accounts[0].toLowerCase();
                }
            } catch { /* no wallet connected */ }

            const res = await fetch(`${ANALYTICS_URL}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, comment: comment.trim(), context, wallet, ...(survey && Object.keys(survey).length > 0 && { survey }) }),
            });
            if (res.ok || res.status === 429) {
                markSubmitted(context);
                setSubmitted(true);
                onSubmitted?.();
            }
        } catch {
            // Network error — still mark as submitted to avoid nagging
            markSubmitted(context);
            setSubmitted(true);
            onSubmitted?.();
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className={`feedback-widget ${compact ? 'feedback-widget--compact' : ''}`}>
            <div className="feedback-widget__stars" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        className={`feedback-widget__star ${star <= (hoveredStar || rating) ? 'feedback-widget__star--active' : ''}`}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        aria-checked={star === rating}
                        role="radio"
                    >
                        <i className={`fa${star <= (hoveredStar || rating) ? 's' : 'r'} fa-star`} />
                    </button>
                ))}
            </div>

            {rating > 0 && !compact && (
                <textarea
                    className="feedback-widget__comment form-control mt-2"
                    placeholder="Any additional thoughts? (optional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, FEEDBACK_COMMENT_MAX))}
                    rows={2}
                    maxLength={FEEDBACK_COMMENT_MAX}
                />
            )}

            {rating > 0 && (
                <button
                    type="button"
                    className="btn btn-sm btn-primary mt-2 feedback-widget__submit"
                    onClick={handleSubmit}
                    disabled={submitting}
                >
                    {submitting && <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />}
                    Submit
                </button>
            )}
        </div>
    );
}
