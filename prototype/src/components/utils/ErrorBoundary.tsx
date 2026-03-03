import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('ErrorBoundary caught:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="container text-center py-5">
                    <h2 className="text-light mb-3">Something went wrong</h2>
                    <p className="text-light mb-4">An unexpected error occurred. Please try refreshing the page.</p>
                    <button
                        className="btn btn-outline-light"
                        onClick={() => {
                            this.setState({ hasError: false });
                            window.location.href = '/';
                        }}
                    >
                        Return to Home
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
