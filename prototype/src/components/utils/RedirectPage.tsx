import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ethers } from 'ethers';
import abi from '../../abi_hedera.json';
import { CONTRACT_ADDRESS, HEDERA_RPC_URL, ANALYTICS_URL } from 'utils/HederaConfig';

function RedirectPage() {
    const { shortId } = useParams() as { shortId: string };
    const [error, setError] = useState('');

    useEffect(() => {
        async function resolveRedirect() {
            const id1 = shortId.startsWith('/') ? shortId.slice(1) : shortId;
            const id2 = shortId;

            try {
                const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
                const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

                let destination = '';
                try {
                    destination = await contract.getOriginalUrl(id1);
                } catch {
                    // First lookup failed, try fallback
                }

                if (!destination || destination.trim() === '') {
                    destination = await contract.getOriginalUrl(id2);
                }

                if (!destination || destination.trim() === '') {
                    setError('This short link does not exist or has no destination.');
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
                }).catch(() => {});

                setTimeout(() => {
                    window.location.href = destination;
                }, 300);
            } catch (err: any) {
                const message = err?.reason || err?.message || 'Unknown error';
                setError(`Could not resolve this link: ${message}`);
            }
        }

        resolveRedirect();
    }, [shortId]);

    if (error) {
        return (
            <div className="container text-center py-5">
                <h3 className="text-light mb-3">Link not found</h3>
                <p className="text-light mb-4">{error}</p>
                <a href="/" className="btn btn-outline-light">Go to Home</a>
            </div>
        );
    }

    return <p>Redirecting...</p>;
}

export default RedirectPage;
