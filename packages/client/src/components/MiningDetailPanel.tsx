import { useStore } from '../state/store';

const panelStyle: React.CSSProperties = {
  padding: '12px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-primary)',
  fontSize: '0.7rem',
  height: '100%',
  overflow: 'auto',
};

export function MiningDetailPanel() {
  const currentSector = useStore((s) => s.currentSector);
  const mining = useStore((s) => s.mining);

  const resources = currentSector?.resources;
  const hasResources = resources && (resources.ore > 0 || resources.gas > 0 || resources.crystal > 0);

  if (!hasResources) {
    return (
      <div style={{
        ...panelStyle,
        color: 'var(--color-dim)',
        textAlign: 'center',
        marginTop: 24,
      }}>
        KEINE RESSOURCEN
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{
        fontSize: '0.75rem',
        fontWeight: 'bold',
        marginBottom: 8,
        letterSpacing: '0.1em',
      }}>
        SEKTOR-RESSOURCEN
      </div>

      {resources.ore > 0 && (
        <div>
          <span style={{ color: 'var(--color-dim)' }}>ERZ: </span>
          <span>{resources.ore}</span>
        </div>
      )}
      {resources.gas > 0 && (
        <div>
          <span style={{ color: 'var(--color-dim)' }}>GAS: </span>
          <span>{resources.gas}</span>
        </div>
      )}
      {resources.crystal > 0 && (
        <div>
          <span style={{ color: 'var(--color-dim)' }}>KRISTALL: </span>
          <span>{resources.crystal}</span>
        </div>
      )}

      {mining?.active && (
        <div style={{
          marginTop: 12,
          padding: '6px 8px',
          border: '1px solid var(--color-primary)',
          fontSize: '0.65rem',
        }}>
          <div>ABBAU AKTIV: {mining.resource?.toUpperCase()}</div>
          <div style={{ color: 'var(--color-dim)' }}>RATE: {mining.rate}u/s</div>
        </div>
      )}
    </div>
  );
}
