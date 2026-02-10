import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Livemark] Unhandled error:", error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "24px",
            fontFamily: "var(--vscode-font-family, sans-serif)",
            color: "var(--vscode-errorForeground, #f44)",
          }}
        >
          <h2>Something went wrong</h2>
          <p style={{ color: "var(--vscode-foreground, #ccc)" }}>
            The editor encountered an unexpected error. You can try reloading or
            switch to Source Mode from the Command Palette.
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "12px",
              opacity: 0.8,
              maxHeight: "200px",
              overflow: "auto",
              background: "var(--vscode-textCodeBlock-background, #1e1e1e)",
              padding: "8px",
              borderRadius: "4px",
            }}
          >
            {this.state.error?.message}
            {"\n"}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: "12px",
              padding: "6px 16px",
              cursor: "pointer",
              background: "var(--vscode-button-background, #0e639c)",
              color: "var(--vscode-button-foreground, #fff)",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
