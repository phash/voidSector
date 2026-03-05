import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#050505',
            color: '#FF3333',
            fontFamily: 'monospace',
            fontSize: '14px',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <div>
            <div style={{ fontSize: '18px', marginBottom: '16px', letterSpacing: '0.2em' }}>
              SYSTEM FEHLER
            </div>
            <div
              style={{
                color: '#FFB000',
                marginBottom: '16px',
                fontSize: '12px',
                maxWidth: '400px',
              }}
            >
              {this.state.error?.message ?? 'Unbekannter Fehler'}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                background: 'transparent',
                border: '1px solid #FFB000',
                color: '#FFB000',
                fontFamily: 'inherit',
                fontSize: '12px',
                padding: '8px 16px',
                cursor: 'pointer',
                letterSpacing: '0.1em',
              }}
            >
              [WIEDERHERSTELLEN]
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
