import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULES } from '@void-sector/shared';

export function BlueprintDialog() {
  const pendingBlueprint = useStore((s) => s.pendingBlueprint);
  const setPendingBlueprint = useStore((s) => s.setPendingBlueprint);

  if (!pendingBlueprint) return null;

  const mod = MODULES[pendingBlueprint];
  if (!mod) return null;

  const handleActivate = () => {
    network.sendActivateBlueprint(pendingBlueprint);
    setPendingBlueprint(null);
  };

  const handleClose = () => {
    setPendingBlueprint(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="blueprint-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          border: '2px solid #00BFFF',
          background: '#0a0a0a',
          padding: '16px',
          maxWidth: '380px',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}
      >
        <div
          id="blueprint-title"
          style={{
            color: '#00BFFF',
            fontSize: '14px',
            marginBottom: '8px',
            textAlign: 'center',
            letterSpacing: '0.15em',
          }}
        >
          BLAUPAUSE GEFUNDEN
        </div>

        <div style={{ color: '#00BFFF', textAlign: 'center', fontSize: '16px', margin: '12px 0' }}>
          {mod.name}
        </div>

        <div style={{ color: '#FFB000', marginBottom: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem' }}>{mod.primaryEffect.label}</div>
          {mod.secondaryEffects.map((eff, i) => (
            <div key={i} style={{ fontSize: '0.65rem', opacity: 0.7 }}>
              {eff.label}
            </div>
          ))}
        </div>

        <div
          style={{
            color: 'rgba(255,176,0,0.5)',
            fontSize: '10px',
            textAlign: 'center',
            marginBottom: '12px',
          }}
        >
          Tier {mod.tier} {mod.category.toUpperCase()}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            onClick={handleActivate}
            style={{
              background: '#1a1a1a',
              color: '#00BFFF',
              border: '1px solid #00BFFF',
              padding: '6px 12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '12px',
            }}
          >
            [AKTIVIEREN]
          </button>
          <button
            onClick={handleClose}
            style={{
              background: '#1a1a1a',
              color: '#FFB000',
              border: '1px solid #FFB000',
              padding: '6px 12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '12px',
            }}
          >
            [SCHLIESSEN]
          </button>
        </div>
      </div>
    </div>
  );
}
