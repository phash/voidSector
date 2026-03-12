import { useState, useRef } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { HULLS } from '@void-sector/shared';

const mono = { fontFamily: 'var(--font-mono)', fontSize: '0.55rem' };
const dim  = { ...mono, color: 'var(--color-dim)' };
const pri  = { ...mono, fontSize: '0.6rem', color: 'var(--color-primary)' };
const row  = { display: 'flex', justifyContent: 'space-between', padding: '1px 0' };
const hdr  = { ...dim, borderBottom: '1px solid var(--color-dim)', paddingBottom: 2, marginTop: 8, marginBottom: 4, letterSpacing: '0.15em' };
const linkBtn = { background: 'transparent', border: 'none', color: 'var(--color-primary)', ...mono, cursor: 'pointer', textDecoration: 'underline', padding: '2px 0' } as React.CSSProperties;

type Tab = 'cargo' | 'stats';

export function ShipStatusPanel() {
  const ship             = useStore((s) => s.ship);
  const fuel             = useStore((s) => s.fuel);
  const cargo            = useStore((s) => s.cargo);
  const hyperdriveState  = useStore((s) => s.hyperdriveState);
  const setActiveProgram = useStore((s) => s.setActiveProgram);

  const [tab, setTab]             = useState<Tab>('cargo');
  const [renaming, setRenaming]   = useState(false);
  const [nameInput, setNameInput] = useState('');
  const escapeRef                 = useRef(false);

  if (!ship) {
    return <div style={{ padding: '4px 8px', ...dim, opacity: 0.5 }}>NO SHIP DATA</div>;
  }

  const { id: shipId, name: shipName, hullType, stats, acepXp: xp } = ship;
  const hull = HULLS[hullType];

  function startRename() {
    setNameInput(shipName);
    setRenaming(true);
  }
  function commitRename() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== shipName) {
      network.sendRenameShip(shipId, trimmed);
    }
    setRenaming(false);
  }
  function handleBlur() {
    if (escapeRef.current) {
      escapeRef.current = false;
      return;
    }
    commitRename();
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      escapeRef.current = false;
      commitRename();
    }
    if (e.key === 'Escape') {
      escapeRef.current = true;
      setRenaming(false);
    }
  }

  const hasHyperdrive = hyperdriveState && hyperdriveState.maxCharge > 0;
  const chargePercent = hasHyperdrive
    ? Math.round((hyperdriveState!.charge / hyperdriveState!.maxCharge) * 100)
    : 0;

  return (
    <div style={{ padding: '4px 8px', ...mono, color: 'var(--color-primary)' }}>

      {/* Ship name — click to rename */}
      {renaming ? (
        <input
          autoFocus
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          style={{ ...mono, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', width: '100%', marginBottom: 2 }}
        />
      ) : (
        <div
          onClick={startRename}
          title="Click to rename"
          style={{ fontSize: '0.6rem', letterSpacing: '0.15em', borderBottom: '1px solid var(--color-dim)', paddingBottom: 2, marginBottom: 2, cursor: 'text' }}
        >
          {shipName}
        </div>
      )}
      <div style={{ ...dim, marginBottom: 6 }}>{hull?.name ?? hullType.toUpperCase()}</div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {(['cargo', 'stats'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            ...linkBtn,
            color: tab === t ? 'var(--color-primary)' : 'var(--color-dim)',
            fontWeight: tab === t ? 'bold' : 'normal',
          }}>
            [{t.toUpperCase()}]
          </button>
        ))}
      </div>

      {/* Cargo tab */}
      {tab === 'cargo' && cargo && (
        <div style={{ marginTop: 4 }}>
          {([
            ['ORE',      cargo.ore],
            ['GAS',      cargo.gas],
            ['CRYSTAL',  cargo.crystal],
            ['ARTEFACT', cargo.artefact],
          ] as [string, number][]).map(([label, val]) => (
            <div key={label} style={row}>
              <span style={dim}>{label}</span>
              <span style={pri}>{val}</span>
            </div>
          ))}
          <div style={row}>
            <span style={dim}>CAPACITY</span>
            <span style={pri}>{stats.cargoCap}</span>
          </div>
        </div>
      )}

      {/* Stats tab */}
      {tab === 'stats' && (
        <div style={{ marginTop: 4 }}>
          {([
            ['HP',         stats.hp],
            ['SPEED',      stats.engineSpeed],
            ['SCANNER',    stats.scannerLevel],
            ['JUMP RANGE', stats.jumpRange],
            ['FUEL',       fuel ? `${fuel.current}/${fuel.max}` : `—/${stats.fuelMax}`],
          ] as [string, string | number][]).map(([label, val]) => (
            <div key={label} style={row}>
              <span style={dim}>{label}</span>
              <span style={pri}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hyperdrive charge */}
      {hasHyperdrive && (
        <>
          <div style={hdr}>HYPERDRIVE</div>
          <div style={row}>
            <span style={dim}>CHARGE</span>
            <span style={pri}>{chargePercent}%</span>
          </div>
          <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', marginTop: 2 }}>
            <div style={{ height: '100%', width: `${chargePercent}%`, background: '#8888ff', transition: 'width 0.3s' }} />
          </div>
        </>
      )}

      {/* Quick nav */}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, borderTop: '1px solid var(--color-dim)', paddingTop: 4 }}>
        <button style={linkBtn} onClick={() => setActiveProgram('ACEP')}>[ACEP]</button>
      </div>
    </div>
  );
}
