import { useStore } from '../state/store';

const panelStyle: React.CSSProperties = {
  padding: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-primary)',
  fontSize: '0.7rem',
  height: '100%',
  overflow: 'auto',
};

const RESOURCE_LABELS: Record<string, string> = {
  ore: 'ERZ',
  gas: 'GAS',
  crystal: 'KRISTALL',
  slates: 'DATENPLATTE',
  artefact: 'ARTEFAKT',
};

export function CargoDetailPanel() {
  const selectedCargoItem = useStore((s) => s.selectedCargoItem);
  const cargo = useStore((s) => s.cargo);

  if (!selectedCargoItem) {
    return (
      <div style={{
        ...panelStyle,
        color: 'var(--color-dim)',
        textAlign: 'center',
        marginTop: 24,
      }}>
        AUSWAHL TREFFEN
      </div>
    );
  }

  const quantity = cargo[selectedCargoItem as keyof typeof cargo] ?? 0;
  const label = RESOURCE_LABELS[selectedCargoItem] ?? selectedCargoItem.toUpperCase();

  return (
    <div style={panelStyle}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 'bold',
        marginBottom: 4,
        letterSpacing: '0.1em',
      }}>
        {label}
      </div>

      <div style={{ marginTop: 8 }}>
        <span style={{ color: 'var(--color-dim)' }}>MENGE: </span>
        <span>{quantity}</span>
      </div>

      <button
        className="vs-btn"
        style={{
          marginTop: 12,
          fontSize: '0.65rem',
          display: 'block',
          width: '100%',
        }}
        disabled
      >
        [ABWERFEN]
      </button>
    </div>
  );
}
