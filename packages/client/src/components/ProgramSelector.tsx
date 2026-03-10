import { useStore } from '../state/store';
import { COCKPIT_PROGRAMS, COCKPIT_PROGRAM_LABELS, MONITORS } from '@void-sector/shared';

export function ProgramSelector() {
  const activeProgram = useStore((s) => s.activeProgram);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const alerts = useStore((s) => s.alerts);
  const miningActive = useStore((s) => s.mining?.active ?? false);
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);

  const cargoCap = ship?.stats?.cargoCap ?? 5;
  const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
  const cargoPercent = cargoCap > 0 ? cargoTotal / cargoCap : 0;

  const allPrograms = COCKPIT_PROGRAMS;

  return (
    <div className="program-selector" data-testid="program-selector">
      {allPrograms.map((id) => {
        const isActive = activeProgram === id;
        const hasAlert = !!alerts[id];
        const label = COCKPIT_PROGRAM_LABELS[id] ?? id.slice(0, 3);
        const showMiningLed = id === MONITORS.MINING && (miningActive || cargoPercent >= 0.9);
        const ledColor = cargoPercent >= 0.9 ? '#f80' : '#0f0';
        return (
          <button
            key={id}
            className={`program-btn${isActive ? ' active' : ''}${hasAlert ? ' alert' : ''}`}
            data-testid={`program-btn-${id}`}
            onClick={() => setActiveProgram(id)}
          >
            <span className={`program-led${hasAlert ? ' blink' : ''}${isActive ? ' on' : ''}`} />
            {showMiningLed && (
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: ledColor,
                  boxShadow: `0 0 4px ${ledColor}`,
                  animation: 'led-pulse 1s infinite',
                  marginRight: '4px',
                }}
              />
            )}
            <span className="program-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
