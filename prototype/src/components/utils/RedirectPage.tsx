import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ethers } from 'ethers';
import abi from '../../abi_hedera.json';

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS as string;
const HEDERA_RPC_URL = process.env.REACT_APP_HEDERA_RPC_URL as string;
const ANALYTICS_URL = process.env.REACT_APP_ANALYTICS_URL as string;

function RedirectPage() {
    const { shortId } = useParams() as { shortId: string };

    useEffect(() => {
        async function resolveRedirect() {
            console.log("Received shortId from route:", shortId);
            const id1 = shortId.startsWith('/') ? shortId.slice(1) : shortId;
            const id2 = shortId;

            try {
                const provider = new ethers.JsonRpcProvider(HEDERA_RPC_URL);
                const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
                console.log("Connected to contract:", contract.address);

                let destination = '';
                try {
                    console.log("Trying with id1:", id1);
                    destination = await contract.getOriginalUrl(id1);
                    console.log("Result from id1:", destination);
                } catch (e) {
                    console.warn("First lookup failed, trying fallback...");
                }

                if (!destination || destination.trim() === '') {
                    console.log("Trying with id2:", id2);
                    destination = await contract.getOriginalUrl(id2);
                    console.log("Result from id2:", destination);
                }

                if (!destination || destination.trim() === '') {
                    throw new Error("Empty destination after both attempts");
                }

                try {
                    await fetch(`${ANALYTICS_URL}/track`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            shortId,
                            timestamp: Date.now(),
                            referrer: document.referrer,
                            userAgent: navigator.userAgent
                        })
                    });
                    console.log('Analytics posted successfully');
                } catch (err) {
                    console.warn('Analytics failed:', err);
                }

                setTimeout(() => {
                    window.location.href = destination;
                }, 300);
            } catch (err) {
                console.error("Redirect failed:", err);
                window.location.href = '/';
            }
        }

        resolveRedirect();
    }, [shortId]);

    return <p>Redirecting...</p>;
}

export default RedirectPage;
