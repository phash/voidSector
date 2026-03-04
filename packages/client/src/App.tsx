import { MonitorBezel } from './components/MonitorBezel';
import { LoginScreen } from './components/LoginScreen';
import { GameScreen } from './components/GameScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStore } from './state/store';
import './styles/global.css';

export function App() {
  const screen = useStore((s) => s.screen);

  if (screen === 'login') {
    return (
      <MonitorBezel
        monitorId="VOID-SEC"
      >
        <LoginScreen />
      </MonitorBezel>
    );
  }

  return (
    <ErrorBoundary>
      <GameScreen />
    </ErrorBoundary>
  );
}
