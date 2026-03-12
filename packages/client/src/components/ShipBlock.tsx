import { useState, useRef } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { HULLS, getPhysicalCargoTotal } from '@void-sector/shared';

const mono = { fontFamily: 'var(--font-mono)', fontSize: '0.55rem' };
const dim  = { ...mono, color: 'var(--color-dim)' };

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min(1, current / max) : 1;
  const width = 8;
  const filled = Math.round(pct * width);
  const label =
    pct >= 1 ? 'INTAKT' :
    pct >= 0.6 ? 'LEICHT' :
    pct >= 0.3 ? 'SCHWER' :
    'KRIT';
  const color = pct >= 0.6 ? 'var(--color-primary)' : pct >= 0.3 ? '#FF6644' : '#FF3333';
  return (
    <span style={{ color }}>
      {'█'.repeat(filled)}{'░'.repeat(width - filled)} {label}
    </span>
  );
}

export function ShipBlock() {
  const ship             = useStore((s) => s.ship);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const [renaming, setRenaming]   = useState(false);
  const [nameInput, setNameInput] = useState('');
  const escapeRef = useRef(false);

  if (!ship) {
    return (
      <div className="nav-block">
        <div className="nav-block-header">── SHIP ──</div>
        <span style={dim}>NO DATA</span>
      </div>
    );
  }

  const { id: shipId, name: shipName, hullType, stats, modules } = ship;
  const hull = HULLS[hullType];

  // Aggregate HP from modules; fall back to stats.hp when no modules or all modules have 0 maxHp
  const modulesMaxHp = modules.reduce((s, m) => s + (m.maxHp ?? 0), 0);
  const totalMaxHp = modules.length > 0 && modulesMaxHp > 0
    ? modulesMaxHp
    : (stats.hp ?? 100);

  const modulesCurrentHp = modules.reduce((s, m) => s + (m.currentHp ?? m.maxHp ?? 0), 0);
  const totalCurrentHp = modules.length > 0 && modulesMaxHp > 0
    ? modulesCurrentHp
    : (stats.hp ?? 100);

  function startRename() { setNameInput(shipName); setRenaming(true); }
  function commitRename() {
    const t = nameInput.trim();
    if (t && t !== shipName) network.sendRenameShip(shipId, t);
    setRenaming(false);
  }
  function handleBlur() {
    if (escapeRef.current) { escapeRef.current = false; return; }
    commitRename();
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { escapeRef.current = false; commitRename(); }
    if (e.key === 'Escape') { escapeRef.current = true; setRenaming(false); }
  }

  return (
    <div className="nav-block">
      <div className="nav-block-header">── SHIP ──</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        {renaming ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={onKeyDown}
            style={{ ...mono, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', flex: 1 }}
          />
        ) : (
          <span
            onClick={startRename}
            title="Click to rename"
            style={{ cursor: 'text', color: 'var(--color-primary)', fontSize: '0.6rem', letterSpacing: '0.1em' }}
          >
            {shipName}
          </span>
        )}
        <span style={dim}>[{hull?.name ?? hullType.toUpperCase()}]</span>
        <button
          style={{ background: 'transparent', border: 'none', ...mono, color: 'var(--color-dim)', cursor: 'pointer', padding: '0 2px', textDecoration: 'underline' }}
          onClick={() => setActiveProgram('HANGAR')}
          title="Open HANGAR program"
        >
          [HANGAR ▶]
        </button>
      </div>
      <div style={dim}>
        HP: {totalCurrentHp}/{totalMaxHp}{' '}
        <HpBar current={totalCurrentHp} max={totalMaxHp} />
      </div>
    </div>
  );
}

export function CargoBlock() {
  const cargo            = useStore((s) => s.cargo);
  const ship             = useStore((s) => s.ship);
  const setActiveProgram = useStore((s) => s.setActiveProgram);

  if (!cargo || !ship) return null;

  const used = getPhysicalCargoTotal(cargo);
  const cap  = ship.stats.cargoCap;

  // Total typed artefacts
  const artTotal =
    (cargo.artefact ?? 0) +
    (cargo.artefact_drive ?? 0) +
    (cargo.artefact_cargo ?? 0) +
    (cargo.artefact_scanner ?? 0) +
    (cargo.artefact_armor ?? 0) +
    (cargo.artefact_weapon ?? 0) +
    (cargo.artefact_shield ?? 0) +
    (cargo.artefact_defense ?? 0) +
    (cargo.artefact_special ?? 0) +
    (cargo.artefact_mining ?? 0);

  const nearFull = used >= cap * 0.8;

  return (
    <div className="nav-block">
      <div className="nav-block-header">── CARGO ──</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={dim}>ORE:<span style={{ color: 'var(--color-primary)' }}>{cargo.ore}</span></span>
        <span style={dim}>GAS:<span style={{ color: 'var(--color-primary)' }}>{cargo.gas}</span></span>
        <span style={dim}>CRYSTAL:<span style={{ color: 'var(--color-primary)' }}>{cargo.crystal}</span></span>
        <span style={dim}>ART:<span style={{ color: 'var(--color-primary)' }}>{artTotal}</span></span>
        <span style={{ color: nearFull ? '#FF6644' : 'var(--color-dim)' }}>
          [{used}/{cap}]
        </span>
        <button
          style={{ background: 'transparent', border: 'none', ...mono, color: 'var(--color-dim)', cursor: 'pointer', padding: '0 2px', textDecoration: 'underline' }}
          onClick={() => setActiveProgram('CARGO')}
          title="Open CARGO program"
        >
          [CARGO ▶]
        </button>
      </div>
    </div>
  );
}
