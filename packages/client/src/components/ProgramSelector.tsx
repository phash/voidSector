import { useStore } from '../state/store';
import { COCKPIT_PROGRAMS, COCKPIT_PROGRAM_LABELS } from '@void-sector/shared';

const EXTRA_PROGRAMS = ['MODULES', 'HANGAR'];

export function ProgramSelector() {
  const activeProgram = useStore((s) => s.activeProgram);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const alerts = useStore((s) => s.alerts);

  const allPrograms = [...COCKPIT_PROGRAMS, ...EXTRA_PROGRAMS];

  return (
    <div className="program-selector" data-testid="program-selector">
      {allPrograms.map((id) => {
        const isActive = activeProgram === id;
        const hasAlert = !!alerts[id];
        const label = COCKPIT_PROGRAM_LABELS[id] ?? id.slice(0, 3);
        return (
          <button
            key={id}
            className={`program-btn${isActive ? ' active' : ''}${hasAlert ? ' alert' : ''}`}
            data-testid={`program-btn-${id}`}
            onClick={() => setActiveProgram(id)}
          >
            <span className={`program-led${hasAlert ? ' blink' : ''}${isActive ? ' on' : ''}`} />
            <span className="program-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
