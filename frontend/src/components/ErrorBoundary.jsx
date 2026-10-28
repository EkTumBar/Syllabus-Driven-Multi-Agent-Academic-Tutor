import React from 'react';
import { AlertOctagon, RotateCcw, Home, ChevronDown, Copy, Check } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught a fatal rendering error:', error, errorInfo);
    this.setState({ errorInfo });
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleCopyDetails = () => {
    const { error, errorInfo } = this.state;
    const text = `Error: ${error?.message || error}\n\nStack:\n${error?.stack || 'N/A'}\n\nComponent Stack:\n${errorInfo?.componentStack || 'N/A'}`;
    navigator.clipboard?.writeText(text);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({
            error: this.state.error,
            errorInfo: this.state.errorInfo,
            resetError: this.handleReset,
          });
        }
        return this.props.fallback;
      }

      const title = this.props.fallbackTitle || 'Component Rendering Error';
      const description = this.props.fallbackDescription || 
        'An error prevented this component from displaying properly. The details below can help resolve it:';

      return (
        <div className="w-full bg-[var(--bg-card)] rounded-2xl border border-rose-200 dark:border-rose-900/60 p-6 sm:p-8 shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <AlertOctagon className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-[var(--text-primary)]">{title}</h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Specific Error Message Banner */}
          {this.state.error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 font-mono text-xs text-rose-800 dark:text-rose-300 break-words leading-relaxed">
              <strong className="font-bold block mb-1">Error Message:</strong>
              {this.state.error.message || String(this.state.error)}
            </div>
          )}

          {/* Expandable Technical Details */}
          {(this.state.error?.stack || this.state.errorInfo?.componentStack) && (
            <details className="group rounded-xl border border-[var(--border)] bg-[var(--bg-card-hover)] overflow-hidden text-xs">
              <summary className="px-4 py-3 font-semibold text-[var(--text-primary)] cursor-pointer flex items-center justify-between hover:bg-[var(--bg-card)] transition">
                <span>View Technical Stack Trace & Component Stack</span>
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] group-open:rotate-180 transition-transform" />
              </summary>
              <div className="p-4 border-t border-[var(--border)] space-y-3 bg-[#070b14] text-slate-200 font-mono text-[11px] overflow-x-auto max-h-72">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={this.handleCopyDetails}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-sans font-medium transition cursor-pointer"
                  >
                    {this.state.copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Trace</span>
                      </>
                    )}
                  </button>
                </div>
                {this.state.error?.stack && (
                  <div>
                    <div className="text-slate-400 font-bold mb-1">JavaScript Stack:</div>
                    <pre className="whitespace-pre-wrap leading-relaxed">{this.state.error.stack}</pre>
                  </div>
                )}
                {this.state.errorInfo?.componentStack && (
                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-slate-400 font-bold mb-1">Component Hierarchy:</div>
                    <pre className="whitespace-pre-wrap leading-relaxed">{this.state.errorInfo.componentStack}</pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] font-semibold text-xs transition cursor-pointer"
            >
              <span>Reload Page</span>
            </button>
            <a
              href="/"
              className="px-4 py-2 rounded-xl text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold text-xs transition flex items-center gap-1.5 ml-auto"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return to Courses</span>
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
