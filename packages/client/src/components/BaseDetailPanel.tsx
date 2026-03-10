import { useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { STORAGE_TIERS, TRADING_POST_TIERS, PRODUCTION_RECIPES } from '@void-sector/shared';

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--color-primary)',
  color: 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.6rem',
  padding: '2px 6px',
  cursor: 'pointer',
};

const STRUCTURE_LABELS: Record<string, string> = {
  base: 'COMMAND CENTER',
  comm_relay: 'COMM RELAY',
  mining_station: 'MINING STATION',
  storage: 'STORAGE',
  trading_post: 'TRADING POST',
  factory: 'FACTORY',
  kontor: 'KONTOR',
  research_lab: 'RESEARCH LAB',
};

export function BaseDetailPanel() {
  const selectedId = useStore((s) => s.selectedBaseStructure);
  const baseStructures = useStore((s) => s.baseStructures);
  const cargo = useStore((s) => s.cargo);
  const storage = useStore((s) => s.storage);
  const factoryState = useStore((s) => s.factoryState);
  const research = useStore((s) => s.research);
  const kontorOrders = useStore((s) => s.kontorOrders);
  const baseName = useStore((s) => s.baseName);
  const [transferAmount, setTransferAmount] = useState(1);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [kontorItemType, setKontorItemType] = useState('ore');
  const [kontorAmount, setKontorAmount] = useState(100);
  const [kontorPrice, setKontorPrice] = useState(2);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const structure = baseStructures.find((s: any) => s.id === selectedId);

  if (!structure) {
    return (
      <div
        style={{
          padding: '12px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          color: 'var(--color-dim)',
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        SELECT A STRUCTURE
      </div>
    );
  }

  const handleRenameBase = () => {
    if (renameValue.trim() && renameValue.length <= 20) {
      network.sendRenameBase(renameValue.trim());
      setRenaming(false);
      setRenameValue('');
    }
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        lineHeight: 1.6,
        height: '100%',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          color: 'var(--color-primary)',
          fontWeight: 'bold',
          marginBottom: 4,
        }}
      >
        {STRUCTURE_LABELS[structure.type] || structure.type.toUpperCase()}
      </div>
      <div style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        {structure.tier > 1 ? `TIER ${structure.tier}` : 'TIER 1'} | ACTIVE
      </div>

      {/* Base — rename + basic storage */}
      {structure.type === 'base' && (
        <>
          <div style={{ marginBottom: 8 }}>
            {renaming ? (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--color-dim)',
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    padding: '2px 4px',
                    maxWidth: 140,
                  }}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value.slice(0, 20))}
                  onKeyDown={(e) => e.key === 'Enter' && handleRenameBase()}
                  maxLength={20}
                  autoFocus
                  placeholder="Name..."
                />
                <button style={btnStyle} onClick={handleRenameBase}>
                  OK
                </button>
                <button style={btnStyle} onClick={() => setRenaming(false)}>
                  X
                </button>
              </div>
            ) : (
              <button
                style={btnStyle}
                onClick={() => {
                  setRenaming(true);
                  setRenameValue(baseName || '');
                }}
              >
                RENAME
              </button>
            )}
          </div>
          {/* Base has built-in tier 1 storage (50 units) */}
          {(() => {
            const hasStorageStruct = baseStructures.some((s: any) => s.type === 'storage');
            if (hasStorageStruct) return null; // storage structure handles this
            const storageCap = STORAGE_TIERS[1]?.capacity ?? 50;
            const storageTotal = storage.ore + storage.gas + storage.crystal + storage.artefact;
            return (
              <div
                style={{
                  marginBottom: 8,
                  border: '1px solid var(--color-dim)',
                  padding: '4px 6px',
                }}
              >
                <div style={{ opacity: 0.6, marginBottom: 4 }}>
                  BASE STORAGE: {storageTotal}/{storageCap}
                </div>
                <div style={{ marginBottom: 4 }}>
                  ORE: {storage.ore} | GAS: {storage.gas} | CRY: {storage.crystal} | ART:{' '}
                  {storage.artefact}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
                  <label>AMOUNT:</label>
                  <input
                    type="number"
                    min={1}
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      width: 50,
                      background: 'transparent',
                      border: '1px solid var(--color-dim)',
                      color: 'var(--color-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6rem',
                      padding: '2px 4px',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {(['ore', 'gas', 'crystal', 'artefact'] as const).map((res) => (
                    <div key={res} style={{ display: 'flex', gap: 2 }}>
                      <button
                        style={btnStyle}
                        onClick={() => network.sendTransfer(res, transferAmount, 'toStorage')}
                      >
                        {res.toUpperCase()}→STG
                      </button>
                      <button
                        style={btnStyle}
                        onClick={() => network.sendTransfer(res, transferAmount, 'fromStorage')}
                      >
                        STG→{res.toUpperCase()}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Storage */}
      {structure.type === 'storage' &&
        (() => {
          const storageTier = structure.tier ?? 1;
          const storageCap = STORAGE_TIERS[storageTier]?.capacity ?? 0;
          const storageTotal = storage.ore + storage.gas + storage.crystal + storage.artefact;
          return (
            <>
              <div style={{ marginBottom: 6 }}>
                CAPACITY: {storageTotal}/{storageCap}
              </div>
              <div style={{ marginBottom: 4 }}>
                ORE: {storage.ore} | GAS: {storage.gas} | CRY: {storage.crystal} | ART:{' '}
                {storage.artefact}
              </div>
              <div
                style={{
                  marginTop: 8,
                  marginBottom: 4,
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                <label>AMOUNT:</label>
                <input
                  type="number"
                  min={1}
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: 50,
                    background: 'transparent',
                    border: '1px solid var(--color-dim)',
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    padding: '2px 4px',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {(['ore', 'gas', 'crystal', 'artefact'] as const).map((res) => (
                  <div key={res} style={{ display: 'flex', gap: 2 }}>
                    <button
                      style={btnStyle}
                      onClick={() => network.sendTransfer(res, transferAmount, 'toStorage')}
                    >
                      {res.toUpperCase()}→LAG
                    </button>
                    <button
                      style={btnStyle}
                      onClick={() => network.sendTransfer(res, transferAmount, 'fromStorage')}
                    >
                      LAG→{res.toUpperCase()}
                    </button>
                  </div>
                ))}
              </div>
              {storageTier < 3 && (
                <button
                  style={{ ...btnStyle, marginTop: 8 }}
                  onClick={() => network.sendUpgradeStructure(structure.id)}
                >
                  UPGRADE T{storageTier + 1} ({STORAGE_TIERS[storageTier + 1]?.upgradeCost} CR)
                </button>
              )}
            </>
          );
        })()}

      {/* Factory */}
      {structure.type === 'factory' && factoryState && (
        <>
          {factoryState.error && (
            <div style={{ color: 'var(--color-danger)', marginBottom: 4 }}>
              ERROR: {factoryState.error}
            </div>
          )}
          {factoryState.activeRecipe ? (
            <>
              <div>
                Recipe: {factoryState.activeRecipe.outputItem.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)' }}>
                {(() => {
                  const pct = Math.min(factoryState.progress, 1);
                  const filled = Math.round(pct * 10);
                  return `${'\u2588'.repeat(filled)}${'\u2591'.repeat(10 - filled)} ${Math.round(pct * 100)}%`;
                })()}
              </div>
              <div>Done: {factoryState.completedCycles} cycles</div>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {factoryState.completedCycles > 0 && (
                  <button style={btnStyle} onClick={() => network.sendFactoryCollect()}>
                    [COLLECT]
                  </button>
                )}
                <button style={btnStyle} onClick={() => setShowRecipeSelector(!showRecipeSelector)}>
                  [CHANGE RECIPE]
                </button>
              </div>
            </>
          ) : (
            <div>
              <span style={{ opacity: 0.5 }}>No active recipe. </span>
              <button style={btnStyle} onClick={() => setShowRecipeSelector(!showRecipeSelector)}>
                [SELECT RECIPE]
              </button>
            </div>
          )}
          {showRecipeSelector && (
            <div style={{ marginTop: 6, border: '1px solid var(--color-dim)', padding: 4 }}>
              {PRODUCTION_RECIPES.map((r) => {
                const locked =
                  r.researchRequired && !research.unlockedModules.includes(r.researchRequired);
                const inputStr = r.inputs.map((i) => `${i.amount} ${i.resource}`).join(', ');
                return (
                  <div key={r.id} style={{ marginBottom: 2 }}>
                    {locked ? (
                      <span style={{ opacity: 0.4 }}>
                        {r.outputItem.replace(/_/g, ' ').toUpperCase()} — locked
                      </span>
                    ) : (
                      <button
                        style={{
                          ...btnStyle,
                          textAlign: 'left',
                          width: '100%',
                          border: 'none',
                          padding: '2px 0',
                        }}
                        onClick={() => {
                          network.sendFactorySetRecipe(r.id);
                          setShowRecipeSelector(false);
                        }}
                      >
                        {'> '}
                        {r.outputItem.replace(/_/g, ' ').toUpperCase()} — {inputStr} —{' '}
                        {r.cycleSeconds}s
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Kontor */}
      {structure.type === 'kontor' && (
        <>
          <div style={{ border: '1px solid var(--color-dim)', padding: 4, marginBottom: 6 }}>
            <div style={{ opacity: 0.6, marginBottom: 4 }}>NEW ORDER</div>
            <div
              style={{
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <select
                value={kontorItemType}
                onChange={(e) => setKontorItemType(e.target.value)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-dim)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  padding: '2px',
                }}
              >
                <option value="ore">ORE</option>
                <option value="gas">GAS</option>
                <option value="crystal">CRYSTAL</option>
              </select>
              <input
                type="number"
                min={1}
                value={kontorAmount}
                onChange={(e) => setKontorAmount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: 50,
                  background: 'transparent',
                  border: '1px solid var(--color-dim)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  padding: '2px',
                }}
              />
              <span>@</span>
              <input
                type="number"
                min={1}
                value={kontorPrice}
                onChange={(e) => setKontorPrice(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: 40,
                  background: 'transparent',
                  border: '1px solid var(--color-dim)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  padding: '2px',
                }}
              />
              <button
                style={btnStyle}
                onClick={() =>
                  network.sendKontorPlaceOrder(kontorItemType, kontorAmount, kontorPrice)
                }
              >
                PLACE
              </button>
            </div>
          </div>
          {kontorOrders.length > 0 ? (
            kontorOrders.map((order, idx) => (
              <div
                key={order.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 2,
                }}
              >
                <span>
                  #{idx + 1} {order.itemType.toUpperCase()} {order.amountFilled}/
                  {order.amountWanted} @{order.pricePerUnit}cr
                </span>
                <button
                  style={{
                    ...btnStyle,
                    borderColor: '#FF3333',
                    color: '#FF3333',
                    fontSize: '0.5rem',
                  }}
                  onClick={() => network.sendKontorCancel(order.id)}
                >
                  X
                </button>
              </div>
            ))
          ) : (
            <div style={{ opacity: 0.4 }}>NO ORDERS</div>
          )}
        </>
      )}

      {/* Trading Post — upgrade */}
      {structure.type === 'trading_post' && (structure.tier ?? 1) < 3 && (
        <button
          style={{ ...btnStyle, marginTop: 8 }}
          onClick={() => network.sendUpgradeStructure(structure.id)}
        >
          UPGRADE T{(structure.tier ?? 1) + 1} (
          {TRADING_POST_TIERS[(structure.tier ?? 1) + 1]?.upgradeCost} CR)
        </button>
      )}

      {/* Generic info for other structures */}
      {!['base', 'storage', 'factory', 'kontor', 'trading_post'].includes(structure.type) && (
        <div style={{ color: 'var(--color-dim)' }}>Status: ACTIVE</div>
      )}

      {/* Cargo on ship */}
      <div
        style={{
          borderTop: '1px solid var(--color-dim)',
          paddingTop: 6,
          marginTop: 8,
          color: 'var(--color-dim)',
          fontSize: '0.55rem',
        }}
      >
        CARGO: ORE:{cargo.ore} GAS:{cargo.gas} CRY:{cargo.crystal} ART:{cargo.artefact}
      </div>
    </div>
  );
}
