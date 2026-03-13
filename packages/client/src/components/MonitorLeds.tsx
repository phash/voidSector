import { useStore } from '../state/store';
import { getPhysicalCargoTotal } from '@void-sector/shared';
// Ship stats accessed via ship.stats from store

export interface LedConfig {
  label: string;
  color: 'green' | 'yellow' | 'red' | 'gray';
  blink?: boolean;
}

export function useMonitorLeds(monitorId: string): LedConfig[] {
  const fuel = useStore((s) => s.fuel);
  const mining = useStore((s) => s.mining);
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const alerts = useStore((s) => s.alerts);
  const autopilot = useStore((s) => (s as unknown as Record<string, unknown>).autopilot);
  const distressCalls = useStore((s) => (s as unknown as Record<string, unknown>).distressCalls) as
    | unknown[]
    | undefined;

  switch (monitorId) {
    case 'NAV-COM': {
      const navColor = autopilot ? 'yellow' : 'green';
      return [
        { label: 'SYS', color: 'green' },
        { label: 'NAV', color: navColor },
      ];
    }

    case 'SHIP-SYS': {
      let fuelColor: LedConfig['color'] = 'green';
      if (fuel) {
        const pct = fuel.current / fuel.max;
        if (pct < 0.2) fuelColor = 'red';
        else if (pct < 0.5) fuelColor = 'yellow';
      }
      return [
        { label: 'PWR', color: 'green' },
        { label: 'FUEL', color: fuelColor },
      ];
    }

    case 'MINING': {
      const rigColor: LedConfig['color'] = mining?.active ? 'green' : 'gray';
      return [{ label: 'RIG', color: rigColor }];
    }

    case 'CARGO': {
      let capColor: LedConfig['color'] = 'green';
      if (ship) {
        const total = getPhysicalCargoTotal(cargo);
        const cap = ship.stats?.cargoCap ?? 5;
        const pct = cap > 0 ? total / cap : 0;
        if (pct >= 1) capColor = 'red';
        else if (pct > 0.7) capColor = 'yellow';
      }
      return [{ label: 'CAP', color: capColor }];
    }

    case 'COMMS': {
      const hasAlert = !!alerts['COMMS'];
      const hasDistress = distressCalls && distressCalls.length > 0;
      const leds: LedConfig[] = [
        { label: 'SIG', color: 'green' },
        { label: 'MSG', color: hasAlert ? 'yellow' : 'gray', blink: hasAlert },
      ];
      if (hasDistress) {
        leds.push({ label: 'SOS', color: 'red', blink: true });
      }
      return leds;
    }

    case 'QUESTS': {
      const hasAlert = !!alerts['QUESTS'];
      return [{ label: 'QST', color: hasAlert ? 'yellow' : 'gray', blink: hasAlert }];
    }

    default:
      return [{ label: 'SYS', color: 'green' }];
  }
}

export function LedDot({ led }: { led: LedConfig }) {
  const colors = { green: '#00FF88', yellow: '#FFB000', red: '#FF3333', gray: '#444' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6rem' }}>
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: colors[led.color],
          boxShadow: led.color !== 'gray' ? `0 0 4px ${colors[led.color]}` : undefined,
          animation: led.blink ? 'bezel-alert-pulse 1.5s infinite' : undefined,
        }}
      />
      <span style={{ opacity: 0.6 }}>{led.label}</span>
    </div>
  );
}
