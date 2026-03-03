import { useState } from 'react';
import { ethers } from 'ethers';
import abi from '../abi_hedera.json';
import { ShowToast } from './utils/ShowToast';

const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS as string;

export function UrlForms() {
    const [originalUrl, setOriginalUrl] = useState('');
    const [status, setStatus] = useState('');
    const [txHash, setTxHash] = useState('');
    const [generatedShortId, setGeneratedShortId] = useState('');
    const [urlInvalid, setUrlInvalid] = useState(false);
    const [CRCVersion, setCRCVersion] = useState(true);
    const [shortUrl, setShortUrl] = useState('');

    function isValidUrl(string: string) {
        try {
            new URL(string);
            return true;
        } catch {
            return false;
        }
    }

    function validateInputUrl() {
        if (!isValidUrl(originalUrl)) {
            setUrlInvalid(true);
            ShowToast('Please enter a valid URL (https://...)', 'danger');
            return false;
        }
        return true;
    }

    const [shortUrlExistsError, setShortUrlExistsError] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        // TODO: Rewrite for Hedera (Plan 02)
    }

    return (
        <div>
            <ul className="nav nav-tabs">
                <li className="nav-item">
                    <button
                        className={`nav-link ${CRCVersion ? 'active' : ''}`}
                        onClick={() => setCRCVersion(true)}
                    >
                        Custom URL
                    </button>
                </li>
                <li className="nav-item">
                    <button
                        className={`nav-link ${!CRCVersion ? 'active' : ''}`}
                        onClick={() => setCRCVersion(false)}
                    >
                        Random
                    </button>
                </li>
            </ul>

            <form onSubmit={handleSubmit}>
                <div className="mb-3">
                    <input
                        type="text"
                        value={originalUrl}
                        onChange={(e) => {
                            setOriginalUrl(e.target.value);
                            setUrlInvalid(false);
                        }}
                        placeholder="Original URL (e.g. https://aboutcircles.com/)"
                        className={`form-control ${urlInvalid ? 'is-invalid' : ''}`}
                    />

                    {CRCVersion && (
                        <div className="input-group mt-3">
                            <span className="input-group-text">durl.dev/</span>
                            <input
                                type="text"
                                value={shortUrl}
                                onChange={(e) => {
                                    let value = e.target.value.trim();

                                    value = value.replace(/\s+/g, '-');

                                    value = value.replace(/[^a-zA-Z0-9_-]/g, '');

                                    if (!value.startsWith('/')) {
                                        value = '/' + value;
                                    }

                                    setShortUrl(value);
                                    setUrlInvalid(false);
                                    setShortUrlExistsError(false);
                                }}

                                placeholder="custom-link"
                                className={`form-control ${shortUrlExistsError || !/^\/.*/.test(shortUrl) ? 'is-invalid' : ''}`}
                            />
                        </div>
                    )}

                    {shortUrlExistsError && (
                        <div className="invalid-feedback d-block mt-1">
                            That short URL is already taken.
                        </div>
                    )}
                </div>
                <div className="button-group mt-3">
                    <button type="submit" className="btn btn-primary w-100">
                        Submit to Blockchain
                    </button>
                </div>

                <div className="price-disclaimer small mt-3">
                    {CRCVersion
                        ? 'Cost: 5 CRC + xDAI gas fee'
                        : 'Cost: only xDAI gas fee'}
                </div>
            </form>

            {status && <div className="alert alert-info mt-3">{status}</div>}
            {txHash && (
                <div className="mt-2">
                    <span>Your shortened URL: </span>
                    <a
                        href={`https://durl.dev/#/${generatedShortId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-light underline"
                    >
                        <br />
                        https://durl.dev/#/{generatedShortId}</a> points to {originalUrl}
                    <a
                        href={`https://hashscan.io/testnet/transaction/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-light"
                    >
                        <br />
                        View on HashScan
                    </a>

                </div>
            )}
        </div>
    );
}
