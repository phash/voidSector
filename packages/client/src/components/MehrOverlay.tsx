import { useStore } from '../state/store';
import type { MobileTab } from '../hooks/useMobileTabs';

interface MehrOverlayProps {
  monitors: Array<{ id: string; icon: string; label: string }>;
}

export function MehrOverlay({ monitors }: MehrOverlayProps) {
  const open = useStore((s) => s.moreOverlayOpen);
  const setOpen = useStore((s) => s.setMoreOverlayOpen);
  const setActiveMonitor = useStore((s) => s.setActiveMonitor);
  const alerts = useStore((s) => s.alerts);
  const clearAlert = useStore((s) => s.clearAlert);

  if (!open) return null;

  const handleSelect = (id: string) => {
    setActiveMonitor(id);
    if (alerts[id]) clearAlert(id);
    setOpen(false);
  };

  return (
    <div className="mehr-overlay" data-testid="mehr-overlay" onClick={() => setOpen(false)}>
      <div
        className="mehr-overlay-content"
        data-testid="mehr-overlay-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mehr-overlay-header">
          <span className="mehr-overlay-title">PROGRAMME</span>
          <button
            className="mehr-overlay-close"
            data-testid="mehr-overlay-close"
            onClick={() => setOpen(false)}
            aria-label="Close overlay"
          >
            [X]
          </button>
        </div>
        <div className="mehr-overlay-grid" data-testid="mehr-overlay-grid">
          {monitors.map(({ id, icon, label }) => (
            <button
              key={id}
              className={`mehr-overlay-card${alerts[id] ? ' alert' : ''}`}
              data-testid={`mehr-card-${id}`}
              onClick={() => handleSelect(id)}
            >
              <span className="mehr-card-icon">{icon}</span>
              <span className="mehr-card-label">{label}</span>
              {alerts[id] && <span className="mehr-card-badge" data-testid={`mehr-badge-${id}`} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
