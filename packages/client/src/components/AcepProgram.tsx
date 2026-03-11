import { useStore } from '../state/store';
import { AcepTab } from './AcepTab';
import { ModuleTab } from './ModuleTab';
import { ShopTab } from './ShopTab';

type AcepTabId = 'acep' | 'module' | 'shop';

const TABS: Array<{ id: AcepTabId; label: string }> = [
  { id: 'acep',   label: '[ACEP]' },
  { id: 'module', label: '[MODULE]' },
  { id: 'shop',   label: '[SHOP]' },
];

export function AcepProgram() {
  const ship = useStore((s) => s.ship);
  const activeTab = useStore((s) => s.acepActiveTab);
  const setActiveTab = useStore((s) => s.setAcepActiveTab);

  if (!ship) {
    return (
      <div style={{ padding: 12, fontFamily: 'var(--font-mono)', fontSize: '0.65rem', opacity: 0.5 }}>
        NO ACTIVE SHIP
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'var(--font-mono)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid #333', flexShrink: 0 }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            style={{
              background: 'transparent',
              border: activeTab === id ? '1px solid var(--color-primary)' : '1px solid #333',
              color: activeTab === id ? 'var(--color-primary)' : '#555',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              padding: '3px 10px',
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'acep'   && <AcepTab />}
        {activeTab === 'module' && <ModuleTab />}
        {activeTab === 'shop'   && <ShopTab />}
      </div>
    </div>
  );
}
