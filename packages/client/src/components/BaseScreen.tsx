import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { STORAGE_TIERS, TRADING_POST_TIERS, PRODUCTION_RECIPES, RESEARCH_TREE } from '@void-sector/shared';

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
  research_lab: 'FORSCHUNGSLABOR',
  kontor: 'KONTOR',
};

const ITEM_LABELS: Record<string, string> = {
  fuel_cell: 'TREIBSTOFFZELLE',
  circuit_board: 'SCHALTKREIS',
  alloy_plate: 'LEGIERUNGSPLATTE',
  void_shard: 'VOID-KRISTALL',
  bio_extract: 'BIO-EXTRAKT',
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

const dimBtnStyle: React.CSSProperties = {
  ...btnStyle,
  border: '1px solid var(--color-dim)',
  color: 'var(--color-dim)',
};

function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div style={{ marginTop: 2 }}>
      {label && <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{label} </span>}
      <div style={{ display: 'inline-flex', width: 80, height: 6, background: 'var(--color-dim)', verticalAlign: 'middle' }}>
        <div style={{ width: `${pct}%`, background: 'var(--color-primary)' }} />
      </div>
      <span style={{ fontSize: '0.65rem', marginLeft: 4 }}>{pct}%</span>
    </div>
  );
}

function FactoryPanel({ structureId }: { structureId: string }) {
  const factoryStatus = useStore((s) => s.factoryStatus);
  const unlockedRecipes = useStore((s) => s.unlockedRecipes);
  const [selectedRecipe, setSelectedRecipe] = useState<string>('');

  useEffect(() => {
    network.requestFactoryStatus();
  }, []);

  // Poll for progress updates when active
  useEffect(() => {
    if (!factoryStatus?.activeRecipeId) return;
    const interval = setInterval(() => network.requestFactoryStatus(), 5000);
    return () => clearInterval(interval);
  }, [factoryStatus?.activeRecipeId]);

  const availableRecipes = Object.values(PRODUCTION_RECIPES).filter(
    (r) => r.researchRequired === null || unlockedRecipes.includes(r.researchRequired),
  );

  const outputItems = factoryStatus
    ? (Object.entries(factoryStatus.output) as [string, number][]).filter(([, v]) => v > 0)
    : [];

  const hasOutput = outputItems.length > 0;
  const activeRecipe = factoryStatus?.activeRecipeId
    ? PRODUCTION_RECIPES[factoryStatus.activeRecipeId]
    : null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: 4, marginBottom: 8 }}>
        FABRIK
      </div>

      {factoryStatus?.activeRecipeId ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
            AKTIV: {activeRecipe?.outputItem ? ITEM_LABELS[activeRecipe.outputItem] ?? activeRecipe.outputItem : factoryStatus.activeRecipeId}
          </div>
          <ProgressBar value={factoryStatus.progress} label="FORTSCHRITT" />
          <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: 2 }}>
            Zyklus: {factoryStatus.cycleSeconds}s
          </div>
          <button
            style={{ ...btnStyle, marginTop: 4 }}
            onClick={() => network.sendFactorySetRecipe(structureId, null)}
          >
            STOPPEN
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>INAKTIV</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedRecipe}
              onChange={(e) => setSelectedRecipe(e.target.value)}
              style={{ ...inputStyle, maxWidth: 200 }}
            >
              <option value="">— Rezept wählen —</option>
              {availableRecipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {ITEM_LABELS[r.outputItem] ?? r.outputItem} ({r.cycleSeconds}s)
                </option>
              ))}
            </select>
            <button
              style={selectedRecipe ? btnStyle : dimBtnStyle}
              disabled={!selectedRecipe}
              onClick={() => {
                if (selectedRecipe) network.sendFactorySetRecipe(structureId, selectedRecipe);
              }}
            >
              STARTEN
            </button>
          </div>
          {availableRecipes.length === 0 && (
            <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: 4 }}>
              Keine Rezepte verfügbar. Forschungslabor bauen und forschen.
            </div>
          )}
        </div>
      )}

      {hasOutput && (
        <div>
          <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: 4 }}>LAGER OUTPUT</div>
          {outputItems.map(([item, qty]) => (
            <div key={item} style={{ fontSize: '0.7rem' }}>
              {ITEM_LABELS[item] ?? item}: {qty}
            </div>
          ))}
          <button
            style={{ ...btnStyle, marginTop: 4 }}
            onClick={() => network.sendFactoryCollect(structureId)}
          >
            EINLAGERN
          </button>
        </div>
      )}
    </div>
  );
}

function ResearchPanel() {
  const unlockedRecipes = useStore((s) => s.unlockedRecipes);
  const activeResearch = useStore((s) => s.activeResearch);
  const credits = useStore((s) => s.credits);

  useEffect(() => {
    network.requestResearchStatus();
  }, []);

  // Poll when research is active
  useEffect(() => {
    if (!activeResearch) return;
    const interval = setInterval(() => network.requestResearchStatus(), 10000);
    return () => clearInterval(interval);
  }, [activeResearch]);

  const now = Date.now();
  const researchProgress = activeResearch
    ? Math.max(0, Math.min(1, 1 - (activeResearch.completesAt - now) / (activeResearch.completesAt - activeResearch.startedAt)))
    : 0;
  const secondsLeft = activeResearch ? Math.max(0, Math.round((activeResearch.completesAt - now) / 1000)) : 0;

  const treeEntries = Object.entries(RESEARCH_TREE);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: 4, marginBottom: 8 }}>
        FORSCHUNGSLABOR
      </div>

      {activeResearch ? (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
            AKTIV: {RESEARCH_TREE[activeResearch.recipeId]?.name ?? activeResearch.recipeId}
          </div>
          <ProgressBar value={researchProgress} label="FORTSCHRITT" />
          <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: 2 }}>
            Verbleibend: {secondsLeft >= 60 ? `${Math.round(secondsLeft / 60)}min` : `${secondsLeft}s`}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: 8 }}>KEIN AKTIVES PROJEKT</div>
      )}

      <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: 4 }}>FORSCHUNGSBAUM</div>
      {treeEntries.map(([id, info]) => {
        const isUnlocked = unlockedRecipes.includes(id);
        const prereqMet = !info.prerequisite || unlockedRecipes.includes(info.prerequisite);
        const isActive = activeResearch?.recipeId === id;
        const canStart = !isUnlocked && !activeResearch && prereqMet && credits >= info.creditCost;

        return (
          <div
            key={id}
            style={{
              marginBottom: 6,
              padding: '4px 6px',
              border: `1px solid ${isUnlocked ? 'var(--color-primary)' : 'var(--color-dim)'}`,
              opacity: isUnlocked || prereqMet ? 1 : 0.4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: isUnlocked ? 'bold' : 'normal' }}>
                {info.name}
              </span>
              <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>
                {isUnlocked ? '[FREIGESCHALTET]' : isActive ? '[LÄUFT...]' : `${info.creditCost} CR`}
              </span>
            </div>
            <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{info.description}</div>
            {info.prerequisite && !unlockedRecipes.includes(info.prerequisite) && (
              <div style={{ fontSize: '0.6rem', color: 'orange', opacity: 0.7 }}>
                Voraussetzung: {RESEARCH_TREE[info.prerequisite]?.name ?? info.prerequisite}
              </div>
            )}
            {!isUnlocked && !isActive && (
              <button
                style={canStart ? { ...btnStyle, marginTop: 2 } : { ...dimBtnStyle, marginTop: 2 }}
                disabled={!canStart}
                onClick={() => canStart && network.sendResearchStart(id)}
              >
                ERFORSCHEN ({info.durationMinutes}min)
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const factoryStruct = baseStructures.find((s: any) => s.type === 'factory');
  const researchLabStruct = baseStructures.find((s: any) => s.type === 'research_lab');
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

          {factoryStruct && <FactoryPanel structureId={factoryStruct.id} />}

          {researchLabStruct && <ResearchPanel />}

          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '4px', marginBottom: '8px', marginTop: '16px' }}>
            CARGO ON SHIP
          </div>
          <div>ERZ: {cargo.ore} &nbsp; GAS: {cargo.gas} &nbsp; KRISTALL: {cargo.crystal}</div>
        </>
      )}
    </div>
  );
}
