"use client";

import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);

        // In production, send to monitoring service
        if (process.env.NODE_ENV === 'production') {
            // TODO: Send to monitoring service (e.g., Sentry, LogRocket)
            // Example: Sentry.captureException(error);
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-base-200">
                    <div className="card w-96 bg-base-100 shadow-xl">
                        <div className="card-body">
                            <h2 className="card-title text-error">Something went wrong</h2>
                            <p className="text-sm text-base-content/70">
                                We encountered an unexpected error. Please try refreshing the page.
                            </p>
                            {process.env.NODE_ENV === 'development' && this.state.error && (
                                <div className="mt-4 p-4 bg-base-200 rounded-lg">
                                    <p className="text-xs font-mono text-error">
                                        {this.state.error.toString()}
                                    </p>
                                </div>
                            )}
                            <div className="card-actions justify-end mt-4">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => window.location.reload()}
                                >
                                    Refresh Page
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
