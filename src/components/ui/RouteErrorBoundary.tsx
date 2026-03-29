import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = { error: Error | null };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50/90 p-6 text-center shadow-sm"
        >
          <p className="text-sm font-semibold text-red-900">
            Something went wrong on this page
          </p>
          <p className="mt-2 text-xs leading-relaxed text-red-800/90">
            {this.state.error.message || "Unknown error"}
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-medium text-red-900 shadow-sm ring-1 ring-red-200/80 transition hover:bg-red-50"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
