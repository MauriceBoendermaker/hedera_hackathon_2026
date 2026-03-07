import React, { useState } from 'react';
import FeedbackModal from 'components/utils/FeedbackModal';

export const Footer = () => {
    const [showFeedback, setShowFeedback] = useState(false);

    return (
        <div className="container-fluid footer-parent">
            <footer className="container d-flex justify-content-center">
                <div className="row">
                    <div className="col-auto footer-bottom-row text-center">
                        <p>&copy; {new Date().getFullYear()} - Made with &#10084;&#65039; by&nbsp;
                            <a className="btn-link" target="_blank" rel="noreferrer" href="https://github.com/MauriceBoendermaker">Maurice</a>,&nbsp;
                            <a className="btn-link" target="_blank" rel="noreferrer" href="https://github.com/yassyass2">Yassine</a>,&nbsp;
                            <a className="btn-link" target="_blank" rel="noreferrer" href="https://github.com/imatthew55">Mathijs</a>
                            &nbsp;and&nbsp;
                            <a className="btn-link" target="_blank" rel="noreferrer" href="https://github.com/uhTivs">Thijs</a>
                            &nbsp;|&nbsp;
                            <button
                                type="button"
                                className="btn-link feedback-footer-btn"
                                onClick={() => setShowFeedback(true)}
                            >
                                <i className="fas fa-comment-dots me-1" />Feedback
                            </button>
                        </p>

                    </div>
                </div>
            </footer>
            <FeedbackModal show={showFeedback} onHide={() => setShowFeedback(false)} />
        </div>
    );
}
