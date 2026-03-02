import { MonitorBezel } from './components/MonitorBezel';
import './styles/global.css';

export function App() {
  return (
    <MonitorBezel
      monitorId="NAV-COM"
      statusLeds={[
        { label: 'SYS', active: true },
        { label: 'NAV', active: true },
      ]}
    >
      <div style={{ padding: '16px' }}>
        <h1 style={{ fontSize: '1.2rem', letterSpacing: '0.2em' }}>
          VOID SECTOR
        </h1>
        <p style={{ marginTop: '8px', opacity: 0.6 }}>
          SYSTEM INITIALIZING...
        </p>
      </div>
    </MonitorBezel>
  );
}
