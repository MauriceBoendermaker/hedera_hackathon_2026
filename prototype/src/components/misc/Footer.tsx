import React from 'react';

export const Footer = () => {
    return (
        <div className="container-fluid footer-parent">
            <footer className="container d-flex justify-content-center">
                <div className="row">
                    <div className="col-auto footer-bottom-row text-center">
                        <p>&copy; {new Date().getFullYear()} - Made with ❤️ by&nbsp;
                            <a className="btn-link" target="_blank" href="https://github.com/MauriceBoendermaker">Maurice</a>,&nbsp;
                            <a className="btn-link" target="_blank" href="https://github.com/yassyass2">Yassine</a>
                            &nbsp;and&nbsp;
                            <a className="btn-link" target="_blank" href="https://github.com/Adel-Atzouza">Adil</a>
                        </p>
                        <p className="small mt-1">Built on <a className="btn-link" target="_blank" href="https://hedera.com" rel="noopener noreferrer">Hedera</a></p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
