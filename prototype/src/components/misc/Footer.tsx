import React from 'react';

export const Footer = () => {
    return (
        <div className="container-fluid footer-parent">
            <footer className="container d-flex justify-content-center">
                <div className="row">
                    <div className="col-auto footer-bottom-row text-center">
                        <p>&copy; {new Date().getFullYear()} - Made with ❤️ by&nbsp;
                            <a className="btn-link" target="_blank" href="https://github.com/MauriceBoendermaker">Maurice</a>,&nbsp;
                            <a className="btn-link" target="_blank" href="https://github.com/yassyass2">Yassine</a>,&nbsp;
                            <a className="btn-link" target="_blank" href="https://github.com/imatthew55">Mathijs</a>
                            &nbsp;and&nbsp;
                            <a className="btn-link" target="_blank" href="https://github.com/uhTivs">Thijs</a>
                        </p>

                    </div>
                </div>
            </footer>
        </div>
    );
}
