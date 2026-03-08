import MouseDots from './misc/MouseDots';
import { UrlForms } from './UrlForms';

declare global {
    interface Window {
        ethereum?: any;
    }
}

function ShortenPage() {
    return (
        <>
            <MouseDots />
            <section className="homepage-hero">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-8 text-center">
                            <h1 className="title">Decentralized URL Shortener</h1>
                            <p className="subtitle-glow mb-4">Trustless. On-chain. Powered by Hedera network.</p>
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
        </>
    );
}

export default ShortenPage;
