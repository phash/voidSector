import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  monitorId?: string;
}

interface State {
  hasError: boolean;
  rebooting: boolean;
  error: Error | null;
}

export class CrtErrorBoundary extends Component<Props, State> {
  private rebootTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, rebooting: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, rebooting: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[CRT:${this.props.monitorId ?? '?'}]`, error, info.componentStack);
    this.rebootTimer = setTimeout(() => {
      this.setState({ rebooting: false });
    }, 2000);
  }

  componentWillUnmount() {
    if (this.rebootTimer) clearTimeout(this.rebootTimer);
  }

  handleReboot = () => {
    this.setState({ hasError: false, rebooting: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.state.rebooting) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          background: '#050505',
          fontFamily: "'Share Tech Mono', 'Courier New', monospace",
          overflow: 'hidden',
        }}>
          <div style={{
            color: '#FF3333',
            fontSize: '0.8rem',
            letterSpacing: '0.2em',
            animation: 'crt-flicker 0.15s infinite',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: 8 }}>SYSTEM FAULT</div>
            <div style={{
              width: '80%',
              margin: '0 auto',
              height: 2,
              background: 'linear-gradient(90deg, transparent, #FF3333, transparent)',
              animation: 'crt-glitch-bar 0.3s infinite',
            }} />
            <div style={{ marginTop: 12, color: '#FFB000', fontSize: '0.7rem' }}>
              REBOOTING...
            </div>
            <div style={{
              marginTop: 8,
              fontSize: '0.6rem',
              color: 'var(--color-dim)',
              maxWidth: 200,
              wordBreak: 'break-word',
            }}>
              {this.state.error?.message}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: '#050505',
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
      }}>
        <div style={{ color: '#FFB000', fontSize: '0.8rem', letterSpacing: '0.15em', marginBottom: 12 }}>
          MONITOR OFFLINE
        </div>
        <div style={{ color: 'var(--color-dim)', fontSize: '0.65rem', marginBottom: 12, textAlign: 'center', maxWidth: 200 }}>
          {this.state.error?.message}
        </div>
        <button
          onClick={this.handleReboot}
          style={{
            background: 'transparent',
            border: '1px solid #FFB000',
            color: '#FFB000',
            fontFamily: 'inherit',
            fontSize: '0.7rem',
            padding: '4px 12px',
            cursor: 'pointer',
            letterSpacing: '0.1em',
          }}
        >
          [REBOOT]
        </button>
      </div>
    );
  }
}
