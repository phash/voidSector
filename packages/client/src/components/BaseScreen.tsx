import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { STORAGE_TIERS, TRADING_POST_TIERS, PRODUCTION_RECIPES } from '@void-sector/shared';

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
  factory: 'FABRIK',
  kontor: 'KONTOR',
  research_lab: 'FORSCHUNGSLABOR',
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
  const factoryState = useStore((s) => s.factoryState);
  const research = useStore((s) => s.research);
  const kontorOrders = useStore((s) => s.kontorOrders);
  const [transferAmount, setTransferAmount] = useState(1);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  const [kontorItemType, setKontorItemType] = useState('ore');
  const [kontorAmount, setKontorAmount] = useState(100);
  const [kontorPrice, setKontorPrice] = useState(2);

  const hasFactory = baseStructures.some((s: any) => s.type === 'factory');
  const hasKontor = baseStructures.some((s: any) => s.type === 'kontor');

  useEffect(() => {
    network.requestBase();
    network.requestStorage();
    network.requestCredits();
    if (hasFactory) network.requestFactoryStatus();
    if (hasKontor) network.requestKontorOrders();
  }, [hasFactory, hasKontor]);

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
  const storageTotal = storage.ore + storage.gas + storage.crystal + storage.artefact;

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
              <div>ERZ: {storage.ore} &nbsp; GAS: {storage.gas} &nbsp; KRISTALL: {storage.crystal} &nbsp; ARTEFAKT: {storage.artefact}</div>

              <div style={{ marginTop: 8, fontSize: '0.7rem' }}>
                <label>MENGE: </label>
                <input
                  type="number" min={1} value={transferAmount}
                  onChange={(e) => setTransferAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: 50, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', padding: '2px 4px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {(['ore', 'gas', 'crystal', 'artefact'] as const).map((res) => (
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

          {hasFactory && (
            <>
              <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '16px' }}>
                FACTORY {factoryState?.activeRecipe ? '— ACTIVE' : '— IDLE'}
              </div>

              {factoryState?.error && (
                <div style={{ color: 'var(--color-warning, #f55)', fontSize: '0.7rem', marginBottom: 4 }}>
                  ERROR: {factoryState.error}
                </div>
              )}

              {factoryState?.activeRecipe ? (
                <>
                  <div style={{ fontSize: '0.7rem' }}>
                    Recipe: {factoryState.activeRecipe.outputItem.replace(/_/g, ' ').toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                    Progress: {(() => {
                      const pct = Math.min(factoryState.progress, 1);
                      const filled = Math.round(pct * 10);
                      const empty = 10 - filled;
                      const elapsed = Math.round(pct * factoryState.activeRecipe!.cycleSeconds);
                      return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${Math.round(pct * 100)}%  (${elapsed}s / ${factoryState.activeRecipe!.cycleSeconds}s)`;
                    })()}
                  </div>
                  <div style={{ fontSize: '0.7rem' }}>
                    Completed: {factoryState.completedCycles} cycles ready
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {factoryState.completedCycles > 0 && (
                      <button style={btnStyle} onClick={() => network.sendFactoryCollect()}>
                        COLLECT
                      </button>
                    )}
                    <button style={btnStyle} onClick={() => setShowRecipeSelector(!showRecipeSelector)}>
                      CHANGE RECIPE
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>
                  No recipe selected.{' '}
                  <button style={btnStyle} onClick={() => setShowRecipeSelector(!showRecipeSelector)}>
                    SELECT RECIPE
                  </button>
                </div>
              )}

              {factoryState && Object.values(factoryState.output).some((v) => v > 0) && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 2 }}>Factory Storage:</div>
                  <div style={{ fontSize: '0.7rem', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(factoryState.output).map(([item, qty]) => (
                      <span key={item}>{item}: {qty}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {Object.entries(factoryState.output)
                      .filter(([, qty]) => qty > 0)
                      .map(([item]) => (
                        <button
                          key={item}
                          style={btnStyle}
                          onClick={() => network.sendFactoryTransfer(item, transferAmount)}
                        >
                          {item.replace(/_/g, ' ').toUpperCase()} → CARGO
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {showRecipeSelector && (
                <div style={{ marginTop: 8, border: '1px solid var(--color-dim)', padding: 6 }}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: 4 }}>Select Recipe:</div>
                  {PRODUCTION_RECIPES.map((r) => {
                    const locked = r.researchRequired && !research.unlockedModules.includes(r.researchRequired);
                    const inputStr = r.inputs.map((i) => `${i.amount} ${i.resource}`).join(', ');
                    return (
                      <div key={r.id} style={{ fontSize: '0.7rem', marginBottom: 2 }}>
                        {locked ? (
                          <span style={{ opacity: 0.4 }}>
                            {r.outputItem.replace(/_/g, ' ').toUpperCase()} — not researched
                          </span>
                        ) : (
                          <button
                            style={{ ...btnStyle, textAlign: 'left', width: '100%', border: 'none', padding: '2px 0' }}
                            onClick={() => {
                              network.sendFactorySetRecipe(r.id);
                              setShowRecipeSelector(false);
                            }}
                          >
                            {'> '}{r.outputItem.replace(/_/g, ' ').toUpperCase()} — {inputStr} — {r.cycleSeconds}s
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {hasKontor && (
            <>
              <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '16px' }}>
                KONTOR
              </div>

              <div style={{ fontSize: '0.7rem', marginBottom: 8, border: '1px solid var(--color-dim)', padding: 6 }}>
                <div style={{ opacity: 0.6, marginBottom: 4 }}>[+] NEW ORDER</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                  <label>Item:</label>
                  <select
                    value={kontorItemType}
                    onChange={(e) => setKontorItemType(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-dim)',
                      color: 'var(--color-primary)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      padding: '2px 4px',
                    }}
                  >
                    <option value="ore">ORE</option>
                    <option value="gas">GAS</option>
                    <option value="crystal">CRYSTAL</option>
                  </select>
                  <label>Amount:</label>
                  <input
                    type="number" min={1} value={kontorAmount}
                    onChange={(e) => setKontorAmount(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 60, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '2px 4px' }}
                  />
                  <label>Price/unit:</label>
                  <input
                    type="number" min={1} value={kontorPrice}
                    onChange={(e) => setKontorPrice(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 50, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '2px 4px' }}
                  />
                  <button
                    style={btnStyle}
                    onClick={() => network.sendKontorPlaceOrder(kontorItemType, kontorAmount, kontorPrice)}
                  >
                    PLACE
                  </button>
                </div>
              </div>

              {kontorOrders.length > 0 && (
                <div style={{ fontSize: '0.7rem' }}>
                  <div style={{ opacity: 0.6, marginBottom: 4 }}>Active Orders:</div>
                  {kontorOrders.map((order, idx) => (
                    <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span>
                        #{idx + 1} {order.itemType.toUpperCase()} {order.amountWanted}u @{order.pricePerUnit}cr [{order.amountFilled}/{order.amountWanted}] {order.active ? 'ACTIVE' : 'PAUSED'}
                      </span>
                      <button
                        style={{ ...btnStyle, fontSize: '0.6rem', borderColor: '#FF3333', color: '#FF3333' }}
                        onClick={() => network.sendKontorCancel(order.id)}
                      >
                        CANCEL
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {kontorOrders.length === 0 && (
                <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>NO ACTIVE ORDERS</div>
              )}
            </>
          )}

          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '16px' }}>
            CARGO ON SHIP
          </div>
          <div>ERZ: {cargo.ore} &nbsp; GAS: {cargo.gas} &nbsp; KRISTALL: {cargo.crystal} &nbsp; ARTEFAKT: {cargo.artefact}</div>
        </>
      )}
    </div>
  );
}
