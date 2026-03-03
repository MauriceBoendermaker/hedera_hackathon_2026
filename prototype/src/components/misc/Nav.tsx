import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ShowToast } from '../utils/ShowToast';

export default function Nav() {
    const [isConnected, setIsConnected] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const closeSidebar = useCallback(() => setSidebarOpen(false), []);

    // Focus trap + Escape key for sidebar
    useEffect(() => {
        if (!sidebarOpen) return;

        const sidebar = sidebarRef.current;
        if (!sidebar) return;

        const focusable = sidebar.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        first?.focus();

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                closeSidebar();
                return;
            }
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [sidebarOpen, closeSidebar]);

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
                if (accounts.length > 0) setIsConnected(true);
            });

            window.ethereum.on('accountsChanged', (accounts: string[]) => {
                setIsConnected(accounts.length > 0);
            });
        }
    }, []);

    async function connectWallet() {
        if (!window.ethereum) {
            ShowToast('MetaMask not detected', 'danger');
            return;
        }

        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            ShowToast('Wallet connected successfully!', 'success');
            setIsConnected(true);
        } catch {
            ShowToast('Connection rejected.', 'danger');
        }
    }

    return (
        <>
            <div className="navbar-container">
                <nav className="navbar navbar-expand-lg">
                    <div className="container">
                        <div className="row justify-content-center w-100">
                            <div className="col-12">
                                <div className="d-flex justify-content-between align-items-center w-100">
                                    <Link className="navbar-brand" to="/">dURL <small>{'//'}dev</small></Link>
                                    <button
                                        className="navbar-toggler"
                                        type="button"
                                        onClick={() => setSidebarOpen(!sidebarOpen)}
                                        aria-label="Open navigation menu"
                                    >
                                        <span className="navbar-toggler-icon" />
                                    </button>
                                    <div className="collapse navbar-collapse justify-content-end" id="navbarNav">
                                        <ul className="navbar-nav align-items-center">
                                            <li className="nav-item">
                                                <NavLink to="/" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                                                    Home
                                                </NavLink>
                                            </li>
                                            <li className="nav-item">
                                                <NavLink to="/how-it-works" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                                                    How it works
                                                </NavLink>
                                            </li>
                                            <li className="nav-item">
                                                <NavLink to="/about" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                                                    About
                                                </NavLink>
                                            </li>
                                            <li className="nav-item">
                                                {!isConnected ? (
                                                    <button className="btn btn-outline-light ms-3" onClick={connectWallet}>
                                                        Connect Wallet
                                                    </button>
                                                ) : (
                                                    <NavLink to="/dashboard" className={({ isActive }) => 'btn btn-outline-light ms-4' + (isActive ? ' active' : '')}>
                                                        Dashboard
                                                    </NavLink>
                                                )}
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </nav>
            </div>

            <div
                className={`mobile-sidebar-backdrop${sidebarOpen ? ' mobile-sidebar-backdrop--open' : ''}`}
                onClick={closeSidebar}
                aria-hidden="true"
            />
            <div
                className={`mobile-sidebar${sidebarOpen ? ' mobile-sidebar--open' : ''}`}
                ref={sidebarRef}
                role="dialog"
                aria-label="Navigation menu"
                aria-hidden={!sidebarOpen}
            >
                <div className="sidebar-content">
                    <button className="close-btn" onClick={closeSidebar} aria-label="Close menu">&times;</button>
                    <NavLink to="/" className="nav-link" onClick={closeSidebar}>Home</NavLink>
                    <NavLink to="/how-it-works" className="nav-link" onClick={closeSidebar}>How it works</NavLink>
                    <NavLink to="/about" className="nav-link" onClick={closeSidebar}>About</NavLink>
                    {!isConnected ? (
                        <button className="btn btn-outline-light mt-3" onClick={() => { connectWallet(); closeSidebar(); }}>
                            Connect Wallet
                        </button>
                    ) : (
                        <NavLink to="/dashboard" className="btn-link" onClick={closeSidebar}>
                            Dashboard
                        </NavLink>
                    )}
                </div>
            </div>
        </>
    );
}
