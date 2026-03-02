import { MonitorBezel } from './components/MonitorBezel';
import { LoginScreen } from './components/LoginScreen';
import { useStore } from './state/store';
import './styles/global.css';

export function App() {
  const screen = useStore((s) => s.screen);

  return (
    <MonitorBezel
      monitorId={screen === 'login' ? 'VOID-SEC' : 'NAV-COM'}
      statusLeds={[
        { label: 'SYS', active: true },
        { label: 'NAV', active: screen === 'game' },
      ]}
    >
      {screen === 'login' && <LoginScreen />}
      {screen === 'game' && (
        <div style={{ position: 'relative', zIndex: 1, padding: 16 }}>
          <p>GAME SCREEN — TODO</p>
        </div>
      )}
    </MonitorBezel>
  );
}
