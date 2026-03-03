import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { STORAGE_TIERS, TRADING_POST_TIERS } from '@void-sector/shared';

const inputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-dim)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  padding: '2px 4px',
  width: '100%',
  maxWidth: 140,
};

const STRUCTURE_LABELS: Record<string, string> = {
  base: 'KOMMANDO-KERN',
  comm_relay: 'COMM RELAY',
  mining_station: 'MINING STATION',
  storage: 'LAGER',
  trading_post: 'HANDELSPLATZ',
};

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  padding: '2px 6px',
  cursor: 'pointer',
};

export function BaseScreen() {
  const baseStructures = useStore((s) => s.baseStructures);
  const cargo = useStore((s) => s.cargo);
  const storage = useStore((s) => s.storage);
  const credits = useStore((s) => s.credits);
  const baseName = useStore((s) => s.baseName);
  const [transferAmount, setTransferAmount] = useState(1);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    network.requestBase();
    network.requestStorage();
    network.requestCredits();
  }, []);

  const hasBase = baseStructures.some((s: any) => s.type === 'base');

  const handleRenameBase = () => {
    if (renameValue.trim() && renameValue.length <= 20) {
      network.sendRenameBase(renameValue.trim());
      setRenaming(false);
      setRenameValue('');
    }
  };
  const storageStruct = baseStructures.find((s: any) => s.type === 'storage');
  const tradingPostStruct = baseStructures.find((s: any) => s.type === 'trading_post');
  const storageTier = storageStruct?.tier ?? 0;
  const storageCap = storageTier > 0 ? STORAGE_TIERS[storageTier]?.capacity ?? 0 : 0;
  const storageTotal = storage.ore + storage.gas + storage.crystal;

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8, height: '100%', overflow: 'auto' }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '4px', opacity: 0.6 }}>
        BASE-LINK — {hasBase ? 'CONNECTED' : 'NO SIGNAL'}
      </div>

      {hasBase && (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
          {renaming ? (
            <>
              <input
                style={inputStyle}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value.slice(0, 20))}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameBase()}
                maxLength={20}
                autoFocus
                placeholder="Basisname..."
              />
              <button style={btnStyle} onClick={handleRenameBase}>OK</button>
              <button style={btnStyle} onClick={() => setRenaming(false)}>X</button>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>
                {baseName || 'HEIMATBASIS'}
              </span>
              <button
                style={btnStyle}
                onClick={() => {
                  setRenaming(true);
                  setRenameValue(baseName || '');
                }}
              >
                UMBENENNEN
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ marginBottom: 8 }}>CREDITS: {credits}</div>

      {!hasBase ? (
        <div>
          <div style={{ opacity: 0.4, marginBottom: '12px' }}>NO BASE CONSTRUCTED</div>
          <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>
            Navigate to a sector and use [BUILD BASE] to establish your home base.
          </div>
        </div>
      ) : (
        <>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px' }}>
            STRUCTURES
          </div>
          {baseStructures.map((s: any) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{STRUCTURE_LABELS[s.type] || s.type.toUpperCase()}</span>
              <span style={{ opacity: 0.5, fontSize: '0.7rem' }}>
                {s.tier > 1 ? `T${s.tier}` : ''} [ACTIVE]
              </span>
            </div>
          ))}

          {storageStruct && (
            <>
              <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '16px' }}>
                LAGER ({storageTotal}/{storageCap})
              </div>
              <div>ERZ: {storage.ore} &nbsp; GAS: {storage.gas} &nbsp; KRISTALL: {storage.crystal}</div>

              <div style={{ marginTop: 8, fontSize: '0.7rem' }}>
                <label>MENGE: </label>
                <input
                  type="number" min={1} value={transferAmount}
                  onChange={(e) => setTransferAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: 50, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', padding: '2px 4px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {(['ore', 'gas', 'crystal'] as const).map((res) => (
                  <div key={res} style={{ display: 'flex', gap: 2 }}>
                    <button style={btnStyle} onClick={() => network.sendTransfer(res, transferAmount, 'toStorage')}>
                      {res.toUpperCase()} → LAGER
                    </button>
                    <button style={btnStyle} onClick={() => network.sendTransfer(res, transferAmount, 'fromStorage')}>
                      LAGER → {res.toUpperCase()}
                    </button>
                  </div>
                ))}
              </div>

              {storageTier < 3 && (
                <button style={{ ...btnStyle, marginTop: 8 }} onClick={() => network.sendUpgradeStructure(storageStruct.id)}>
                  UPGRADE LAGER T{storageTier + 1} ({STORAGE_TIERS[storageTier + 1]?.upgradeCost} CR)
                </button>
              )}
            </>
          )}

          {tradingPostStruct && (tradingPostStruct.tier ?? 1) < 3 && (
            <button
              style={{ ...btnStyle, marginTop: 8 }}
              onClick={() => network.sendUpgradeStructure(tradingPostStruct.id)}
            >
              UPGRADE HANDELSPLATZ T{(tradingPostStruct.tier ?? 1) + 1} ({TRADING_POST_TIERS[(tradingPostStruct.tier ?? 1) + 1]?.upgradeCost} CR)
            </button>
          )}

          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '16px' }}>
            CARGO ON SHIP
          </div>
          <div>ERZ: {cargo.ore} &nbsp; GAS: {cargo.gas} &nbsp; KRISTALL: {cargo.crystal}</div>
        </>
      )}
    </div>
  );
}
