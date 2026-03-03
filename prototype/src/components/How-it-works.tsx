import React from 'react';

function HowItWorks() {
    return (
        <section className="how-it-works-container">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-md-8 glass-card">
                        <h1 className="title-glow mb-4">How it works</h1>
                        <p>
                            The Decentralized URL Shortener is built to store and manage links fully on-chain.
                            It uses a smart contract deployed on Hedera's EVM-compatible network to create permanent, tamper-proof, and publicly verifiable short URLs.
                        </p>
                        <ul>
                            <li>Random links are generated using a keccak256 hash of the sender address, original URL, and timestamp.</li>
                            <li>Custom links require a 1 HBAR payment and are reserved by the slug you choose.</li>
                            <li>Links are stored in a public smart contract and can be resolved by anyone using the short ID.</li>
                            <li>The front-end at <a className="btn-link" href="https://durl.dev" target="_blank" rel="noopener noreferrer">durl.dev</a> interacts with the chain via MetaMask and ethers.js through Hedera's JSON-RPC relay.</li>
                            <li>Styling is handled using Bootstrap 5 and custom SCSS.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default HowItWorks;
