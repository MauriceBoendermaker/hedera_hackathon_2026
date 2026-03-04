import { useState, useRef } from 'react';
import MouseDots from './misc/MouseDots';
import { QRCodeCanvas } from 'qrcode.react';
import { UrlForms } from './UrlForms';
import { PROJECT_URL } from 'utils/HederaConfig';
import { useTiltEffect } from 'hooks/useTiltEffect';

declare global {
    interface Window {
        ethereum?: any;
    }
}

function ShortenPage() {
    const qrRef = useRef<HTMLCanvasElement | null>(null);
    const [qrUrl, setQrUrl] = useState('');
    const cardRef = useRef<HTMLDivElement | null>(null);

    useTiltEffect(cardRef);

    function downloadQR() {
        const canvas = qrRef.current;
        if (!canvas) return;
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qr-code.png';
        a.click();
    }

    return (
        <>
            <MouseDots />
            <section className="homepage-hero">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-8 text-center">
                            <h1 className="title">Decentralized URL Shortener</h1>
                            <p className="subtitle-glow mb-4">Trustless. On-chain. Powered by Hedera.</p>
                        </div>
                    </div>
                    <div className="row justify-content-center mt-4">
                        <div className="col-md-8 glass-card">
                            <h1 className="title-glow pb-4">Shorten a long link</h1>
                            <UrlForms />
                        </div>
                    </div>
                </div>
            </section>

            <div
                className="modal fade"
                id="qrModal"
                tabIndex={-1}
                aria-labelledby="qrModalLabel"
                aria-hidden="true"
            >
                <div className="modal-dialog modal-dialog-centered">
                    <div
                        ref={cardRef}
                        className="glare modal-content text-center text-white border-0 qr-card"
                        style={{
                            background: 'radial-gradient(circle at center, rgba(58,0,128,0.35), #111)',
                            transition: 'transform 0.1s ease-out, background 0.3s ease',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '1.5rem',
                            boxShadow: '0 0 30px rgba(128,0,255,0.5), 0 0 10px rgba(0,255,255,0.3)'
                        }}
                    >
                        <div className="modal-header border-0">
                            <h5 className="modal-title w-100" id="qrModalLabel">QR Code</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <QRCodeCanvas
                                value={qrUrl || `${PROJECT_URL}/#/example`}
                                size={200}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                level="H"
                                includeMargin={true}
                                ref={qrRef}
                            />
                            <br />
                            <button className="btn btn-outline-light mt-3" onClick={downloadQR}>
                                Download QR Code
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default ShortenPage;
