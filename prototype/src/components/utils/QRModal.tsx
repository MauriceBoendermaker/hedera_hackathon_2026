import { useEffect, useRef } from 'react';
import { useTiltEffect } from 'hooks/useTiltEffect';
import QRCustomizer from './QRCustomizer';

interface QRModalProps {
    qrValue: string;
    show: boolean;
    onHide: () => void;
}

function QRModal({ qrValue, show, onHide }: QRModalProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

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

    useTiltEffect(cardRef, glareRef, show);

    if (!show) return null;

    return (
        <>
            <div className="modal-backdrop fade show" onClick={onHide} />
            <div
                className="modal fade show"
                style={{ display: 'block' }}
                tabIndex={-1}
                aria-labelledby="qrModalLabel"
                role="dialog"
                onClick={(e) => { if (e.target === e.currentTarget) onHide(); }}
            >
                <div className="modal-dialog modal-dialog-centered modal-lg">
                    <div
                        ref={cardRef}
                        className="modal-content text-center text-white border-0 qr-card"
                        style={{
                            background: 'radial-gradient(circle at center, rgba(58,0,128,0.35), #111)',
                            transition: 'transform 0.1s ease-out, background 0.3s ease',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '1.5rem',
                            boxShadow: '0 0 30px rgba(128,0,255,0.5), 0 0 10px rgba(0,255,255,0.3)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <div ref={glareRef} className="glare position-absolute top-0 start-0 w-100 h-100" />
                        <div className="modal-header border-0">
                            <h5 className="modal-title w-100" id="qrModalLabel">QR Code</h5>
                            <button type="button" className="btn-close btn-close-white" onClick={onHide} aria-label="Close" />
                        </div>
                        <div className="modal-body">
                            <QRCustomizer value={qrValue} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default QRModal;
