import { useCallback, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

interface QRModalProps {
    qrValue: string;
    show: boolean;
    onHide: () => void;
}

function QRModal({ qrValue, show, onHide }: QRModalProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        const card = cardRef.current;
        if (!card || !show) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        function handleMouseMove(e: MouseEvent) {
            if (!card) return;
            const { innerWidth, innerHeight } = window;
            const x = e.clientX / innerWidth - 0.5;
            const y = e.clientY / innerHeight - 0.5;
            const rotateX = y * -10;
            const rotateY = x * 10;
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;

            const glare = glareRef.current;
            if (glare) {
                const glareX = e.clientX / innerWidth * 100;
                const glareY = e.clientY / innerHeight * 100;
                glare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.02), transparent 60%)`;
            }
        }

        function reset() {
            if (card) {
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
            }
        }

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseleave', reset);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseleave', reset);
        };
    }, [show]);

    const handleDownload = useCallback(() => {
        const canvas = canvasWrapperRef.current?.querySelector('canvas');
        if (!canvas) return;
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `${qrValue.split('/').pop() || 'qr'}.png`;
        a.click();
    }, [qrValue]);

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
                <div className="modal-dialog modal-dialog-centered">
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
                        <div className="modal-body" ref={canvasWrapperRef}>
                            <QRCodeCanvas
                                value={qrValue}
                                size={200}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                includeMargin={true}
                                level="H"
                            />
                            <br />
                            <button className="btn btn-outline-light mt-3" onClick={handleDownload}>
                                Download QR Code
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default QRModal;
