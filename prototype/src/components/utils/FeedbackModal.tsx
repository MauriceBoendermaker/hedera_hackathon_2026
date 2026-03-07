import { useEffect, useRef, useState, useMemo } from 'react';
import { FeedbackWidget } from './FeedbackWidget';
import { useTiltEffect } from 'hooks/useTiltEffect';

const SURVEY_QUESTIONS = [
    {
        key: 'hederaExperience',
        label: 'Have you used Hedera before?',
        options: ['Yes', 'No', 'Just exploring'],
    },
    {
        key: 'referralSource',
        label: 'How did you hear about dURL?',
        options: ['Social media', 'Hackathon', 'Friend or colleague', 'Search engine', 'Other'],
    },
    {
        key: 'blockchainReason',
        label: 'Main reason for choosing a blockchain URL shortener?',
        options: ['Censorship resistance', 'Transparency', 'Decentralization', 'Curiosity', 'Other'],
    },
] as const;

interface FeedbackModalProps {
    show: boolean;
    onHide: () => void;
}

function FeedbackModal({ show, onHide }: FeedbackModalProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

    const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);

    useTiltEffect(cardRef, glareRef, show);

    const survey = useMemo(() => {
        const filled: Record<string, string> = {};
        for (const [k, v] of Object.entries(surveyAnswers)) {
            if (v) filled[k] = v;
        }
        return filled;
    }, [surveyAnswers]);

    useEffect(() => {
        if (!show) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onHide();
        };

        document.addEventListener('keydown', handleEscape);
        document.body.classList.add('modal-open');

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.classList.remove('modal-open');
        };
    }, [show, onHide]);

    if (!show) return null;

    return (
        <>
            <div className="feedback-modal-backdrop" onClick={onHide} />
            <div
                className="modal fade show"
                style={{ display: 'block' }}
                tabIndex={-1}
                aria-labelledby="feedbackModalLabel"
                role="dialog"
                onClick={(e) => { if (e.target === e.currentTarget) onHide(); }}
            >
                <div className="modal-dialog modal-dialog-centered">
                    <div
                        ref={cardRef}
                        className="modal-content text-center text-white border-0 feedback-modal-card"
                        style={{
                            background: 'radial-gradient(circle at center, rgba(58,0,128,0.35), #111)',
                            transition: 'transform 0.1s ease-out, background 0.3s ease',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '1.5rem',
                            boxShadow: '0 0 30px rgba(128,0,255,0.5), 0 0 10px rgba(0,255,255,0.3)',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        <div ref={glareRef} className="glare position-absolute top-0 start-0 w-100 h-100" />
                        <div className="modal-header border-0">
                            <h5 className="modal-title w-100" id="feedbackModalLabel">Help us improve dURL</h5>
                            <button type="button" className="btn-close btn-close-white" onClick={onHide} aria-label="Close" />
                        </div>
                        <div className="modal-body">
                            {!submitted && <p className="text-white-50 small mb-3">How has your experience been?</p>}

                            {!submitted && SURVEY_QUESTIONS.map((q) => (
                                <div key={q.key} className="feedback-survey">
                                    <p className="feedback-survey__question">{q.label}</p>
                                    <div className="feedback-survey__pills">
                                        {q.options.map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                className={`feedback-pill${surveyAnswers[q.key] === opt ? ' feedback-pill--active' : ''}`}
                                                onClick={() =>
                                                    setSurveyAnswers((prev) => ({
                                                        ...prev,
                                                        [q.key]: prev[q.key] === opt ? '' : opt,
                                                    }))
                                                }
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            <FeedbackWidget context="footer" survey={survey} onSubmitted={() => { setSubmitted(true); setTimeout(onHide, 1500); }} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default FeedbackModal;
