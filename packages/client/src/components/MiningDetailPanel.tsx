import { useStore } from '../state/store';
import { SectorArtwork } from './SectorArtwork';
import { btn } from '../ui-strings';

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
  const setActiveProgram = useStore((s) => s.setActiveProgram);

  const resources = currentSector?.resources;
  const hasResources =
    resources && (resources.ore > 0 || resources.gas > 0 || resources.crystal > 0);

  if (!hasResources) {
    return (
      <div
        style={{
          ...panelStyle,
          color: 'var(--color-dim)',
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        NO RESOURCES
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <SectorArtwork sectorType={currentSector?.type ?? 'empty'} />
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 'bold',
          marginBottom: 8,
          letterSpacing: '0.1em',
        }}
      >
        SECTOR RESOURCES
      </div>

      {resources.ore > 0 && (
        <div>
          <span style={{ color: 'var(--color-dim)' }}>ORE: </span>
          <span>{resources.ore}{resources.maxOre ? `/${resources.maxOre}` : ''}</span>
        </div>
      )}
      {resources.gas > 0 && (
        <div>
          <span style={{ color: 'var(--color-dim)' }}>GAS: </span>
          <span>{resources.gas}{resources.maxGas ? `/${resources.maxGas}` : ''}</span>
        </div>
      )}
      {resources.crystal > 0 && (
        <div>
          <span style={{ color: 'var(--color-dim)' }}>CRYSTAL: </span>
          <span>{resources.crystal}{resources.maxCrystal ? `/${resources.maxCrystal}` : ''}</span>
        </div>
      )}

      {mining?.active && (
        <div
          style={{
            marginTop: 12,
            padding: '6px 8px',
            border: '1px solid var(--color-primary)',
            fontSize: '0.65rem',
          }}
        >
          <div>MINING ACTIVE: {mining.resource?.toUpperCase()}</div>
          <div style={{ color: 'var(--color-dim)' }}>RATE: {mining.rate}u/s</div>
        </div>
      )}

      {hasResources && !mining?.active && (
        <button
          className="vs-btn"
          style={{ fontSize: '0.75rem', marginTop: '8px' }}
          onClick={() => setActiveProgram('MINING')}
        >
          {btn('MINING ÖFFNEN')}
        </button>
      )}
    </div>
  );
}
