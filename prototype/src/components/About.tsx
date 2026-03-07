import React from 'react';
import { FeedbackStats } from './utils/FeedbackStats';

function About() {
    return (
        <section className="about-container">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-md-8 glass-card">
                        <h1 className="title-glow mb-4">About dURL</h1>
                        <p>
                            <strong>dURL</strong> is a decentralized, blockchain-based URL shortener hosted at <a className="btn-link" href="https://durl.dev" target="_blank" rel="noopener noreferrer">durl.dev</a>.
                            Built on Hedera, it creates permanent, censorship-resistant short links that no central authority can modify or remove.
                        </p>
                        <p>
                            All data is stored on the Hedera network using a smart contract deployed via the Hedera EVM, ensuring transparency and immutability.
                            Every link creation is verifiable on HashScan, Hedera's official blockchain explorer.
                        </p>
                        <p>
                            You retain complete control over your links. MetaMask is required to interact with the system.
                            Custom links cost 1 HBAR, while random links are free.
                        </p>
                    </div>
                    <div className="col-md-8">
                        <FeedbackStats />
                    </div>
                </div>
            </div>
        </section>
    );
}

export default About;
