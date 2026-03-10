import { useStore } from '../state/store';
import { network } from '../network/client';

const green = '#00FF88';
const dimGreen = 'rgba(0,255,136,0.3)';

const panelStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  color: green,
  overflowY: 'auto',
  height: '100%',
};

const headerStyle: React.CSSProperties = {
  borderBottom: `1px solid ${dimGreen}`,
  paddingBottom: 3,
  marginBottom: 6,
  letterSpacing: '0.1em',
  opacity: 0.7,
  marginTop: 8,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '3px 0',
  borderBottom: `1px solid rgba(0,255,136,0.1)`,
  gap: 8,
  flexWrap: 'wrap',
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${green}`,
  color: green,
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  padding: '2px 6px',
  cursor: 'pointer',
};

export function FabrikPanel() {
  const inventory = useStore((s) => s.inventory);
  const ship = useStore((s) => s.ship);

  const blueprints = inventory.filter((i) => i.itemType === 'blueprint');
  const cargoModules = inventory.filter((i) => i.itemType === 'module');
  const installedIds = new Set((ship?.modules ?? []).map((m) => m.moduleId));

  return (
    <div style={panelStyle}>
      {/* Craft from blueprints */}
      <div style={{ ...headerStyle, marginTop: 0 }}>HERSTELLEN</div>
      {blueprints.length === 0 ? (
        <div style={{ opacity: 0.4 }}>KEINE BLAUPAUSEN</div>
      ) : (
        blueprints.map((bp) => (
          <div key={bp.itemId} style={rowStyle}>
            <span>{bp.itemId.toUpperCase().replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                style={btnStyle}
                onClick={() => network.sendActivateBlueprint(bp.itemId)}
                title="Blaupause aktivieren (Forschungsbaum)"
              >
                [AKTIVIEREN]
              </button>
              <button
                style={btnStyle}
                onClick={() => network.sendCraftModule(bp.itemId)}
                title="Modul herstellen"
              >
                [HERSTELLEN]
              </button>
            </div>
          </div>
        ))
      )}

      {/* Install cargo modules */}
      {cargoModules.length > 0 && (
        <>
          <div style={headerStyle}>AUS CARGO INSTALLIEREN</div>
          {cargoModules.map((m) => (
            <div key={m.itemId} style={rowStyle}>
              <span>
                {m.itemId.toUpperCase().replace(/_/g, ' ')} x{m.quantity}
              </span>
              <button
                style={{ ...btnStyle, opacity: installedIds.has(m.itemId) ? 0.4 : 1 }}
                disabled={installedIds.has(m.itemId)}
                onClick={() => network.sendInstallModule('', m.itemId, 0)}
              >
                {installedIds.has(m.itemId) ? '[EINGEBAUT]' : '[INSTALLIEREN]'}
              </button>
            </div>
          ))}
        </>
      )}

      {blueprints.length === 0 && cargoModules.length === 0 && (
        <div style={{ opacity: 0.4, marginTop: 8 }}>
          KEINE MODULE ODER BLAUPAUSEN IM CARGO
        </div>
      )}
    </div>
  );
}
