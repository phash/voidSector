import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { RESOURCE_TYPES } from '@void-sector/shared';
import type { DataSlate } from '@void-sector/shared';
import { getItemArtwork } from '../assets/items';
import { btn, UI } from '../ui-strings';

function CargoBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = 10;
  const filled = max > 0 ? Math.min(Math.round((value / max) * width), width) : 0;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
  const svgUrl = getItemArtwork(label.toLowerCase().trim());
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
      }}
    >
      {svgUrl && (
        <img
          src={svgUrl}
          alt={label}
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            filter: 'drop-shadow(0 0 4px var(--color-primary))',
          }}
        />
      )}
      <div>
        <div>{label.padEnd(10)}</div>
        <div>
          {bar} {String(value).padStart(3)}
        </div>
      </div>
    </div>
  );
}

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'var(--color-primary)' : 'transparent',
  border: '1px solid var(--color-primary)',
  color: active ? '#050505' : 'var(--color-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  padding: '3px 8px',
  cursor: 'pointer',
});

export function CargoScreen() {
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const mySlates = useStore((s) => s.mySlates);
  const credits = useStore((s) => s.credits);
  const alienCredits = useStore((s) => s.alienCredits);
  const inventory = useStore((s) => s.inventory);
  const cargoCap = ship?.stats?.cargoCap ?? 5;
  const total = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;

  const [jettisoning, setJettisoning] = useState<string | null>(null);

  const doJettison = (resource: string) => {
    if (jettisoning) return;
    setJettisoning(resource);
    network.sendJettison(resource);
    setTimeout(() => setJettisoning(null), 1000);
  };

  const [activeTab, setActiveTab] = useState<'resource' | 'module' | 'blueprint'>('resource');
  const [selectedSlateId, setSelectedSlateId] = useState<string | null>(null);

  const resources = inventory.filter((i) => i.itemType === 'resource');
  const modules = inventory.filter((i) => i.itemType === 'module');
  const blueprints = inventory.filter((i) => i.itemType === 'blueprint');
  const setActiveProgram = useStore((s) => s.setActiveProgram);

  useEffect(() => {
    network.requestMySlates();
    network.requestInventory();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: '8px 12px',
      }}
    >
      <div
        style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '12px' }}
      >
        CARGO HOLD
      </div>

      <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
        VESSEL: {ship?.name ?? '---'}
      </div>

      <div
        style={{
          fontSize: '0.9rem',
          marginBottom: '16px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <span>
          CAPACITY: {total}/{cargoCap}
        </span>
        <span>CR: {credits.toLocaleString()}</span>
        {alienCredits > 0 && (
          <span style={{ color: '#00BFFF' }}>A-CR: {alienCredits.toLocaleString()}</span>
        )}
      </div>

      {/* Inventory Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button
          style={tabBtnStyle(activeTab === 'resource')}
          onClick={() => setActiveTab('resource')}
        >
          {UI.tabs.RESOURCES}
        </button>
        <button style={tabBtnStyle(activeTab === 'module')} onClick={() => setActiveTab('module')}>
          {UI.tabs.MODULES}
        </button>
        <button
          style={tabBtnStyle(activeTab === 'blueprint')}
          onClick={() => setActiveTab('blueprint')}
        >
          {UI.tabs.BLUEPRINTS}
        </button>
      </div>

      {/* RESOURCES tab */}
      {activeTab === 'resource' && (
        <>
          {total === 0 && resources.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', fontFamily: 'monospace', color: '#555', marginBottom: '12px' }}>
              <div>CARGO HOLD EMPTY</div>
              <button onClick={() => setActiveProgram('MINING')} style={{ border: '1px solid #333', background: 'none', color: '#888', fontFamily: 'monospace', cursor: 'pointer', padding: '3px 8px', fontSize: '0.75rem' }}>
                [OPEN MINING]
              </button>
            </div>
          )}
          <div style={{ marginBottom: '16px' }}>
            <CargoBar label="ORE" value={cargo.ore} max={cargoCap} />
            <CargoBar label="GAS" value={cargo.gas} max={cargoCap} />
            <CargoBar label="CRYSTAL" value={cargo.crystal} max={cargoCap} />
            <CargoBar label="SLATES" value={cargo.slates} max={cargoCap} />
            <CargoBar label="ARTEFAKT" value={cargo.artefact} max={cargoCap} />
          </div>

          <div
            style={{
              borderTop: '1px solid var(--color-dim)',
              paddingTop: '8px',
              marginBottom: '16px',
              fontSize: '0.9rem',
            }}
          >
            <CargoBar label="TOTAL" value={total} max={cargoCap} />
          </div>

          {resources.length > 0 && (
            <div
              style={{
                borderTop: '1px solid var(--color-dim)',
                paddingTop: '8px',
                marginBottom: '16px',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ opacity: 0.6, marginBottom: 4 }}>INVENTORY RESOURCES:</div>
              {resources.map((item) => (
                <div key={item.itemId} style={{ marginBottom: 2 }}>
                  {item.itemId.toUpperCase()} x{item.quantity}
                </div>
              ))}
            </div>
          )}

          {cargo.slates > 0 && (
            <div
              style={{
                borderTop: '1px solid var(--color-dim)',
                paddingTop: '8px',
                marginBottom: '8px',
              }}
            >
              <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>
                DATA SLATES: {cargo.slates}
              </div>
              {mySlates.map((slate: DataSlate) => (
                <div
                  key={slate.id}
                  style={{
                    fontSize: '0.8rem',
                    marginBottom: '4px',
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedSlateId(selectedSlateId === slate.id ? null : slate.id)}
                >
                  <span style={{ opacity: 0.7 }}>
                    [{slate.slateType === 'sector' ? 'S' : slate.slateType === 'area' ? 'A' : slate.slateType === 'scan' ? 'SC' : 'C'}]
                    {slate.slateType === 'custom' && slate.customData
                      ? ` ${slate.customData.label}`
                      : slate.slateType === 'scan'
                        ? ` Scan Q${(slate.sectorData?.[0] as any)?.quadrantX ?? '?'}:${(slate.sectorData?.[0] as any)?.quadrantY ?? '?'} (${slate.sectorData?.[0]?.x ?? '?'},${slate.sectorData?.[0]?.y ?? '?'})`
                        : ` ${slate.sectorData?.length ?? 0} Sektoren`}
                  </span>
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={() => network.sendActivateSlate(slate.id)}
                  >
                    {btn(UI.actions.ACTIVATE)}
                  </button>
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={() => network.sendNpcBuyback(slate.id)}
                  >
                    {btn('NPC SELL')}
                  </button>
                  {slate.slateType === 'scan' && selectedSlateId === slate.id && slate.sectorData?.[0] && (
                    <div style={{
                      padding: '6px 8px',
                      border: '1px solid rgba(255,176,0,0.15)',
                      marginTop: '4px',
                      fontSize: '0.7rem',
                      width: '100%',
                    }}>
                      <div style={{ color: 'var(--color-dim)', marginBottom: 4 }}>
                        SCAN · TICK {(slate.sectorData[0] as any).scannedAtTick ?? '?'}
                      </div>
                      <div>Q {(slate.sectorData[0] as any).quadrantX}:{(slate.sectorData[0] as any).quadrantY} — ({slate.sectorData[0].x}, {slate.sectorData[0].y})</div>
                      <div>Typ: {slate.sectorData[0].type?.toUpperCase()}</div>
                      <div>Ore: {slate.sectorData[0].ore} | Gas: {slate.sectorData[0].gas} | Crystal: {slate.sectorData[0].crystal}</div>
                      {(slate.sectorData[0] as any).structures?.length > 0 && (
                        <div>Strukturen: {(slate.sectorData[0] as any).structures.join(', ')}</div>
                      )}
                      {(slate.sectorData[0] as any).wrecks?.length > 0 && (
                        <div>Wracks: {(slate.sectorData[0] as any).wrecks.map((w: any) => `${w.playerName} (T${w.tier})`).join(', ')}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {RESOURCE_TYPES.map((res) => (
                <button
                  key={res}
                  className="vs-btn"
                  disabled={cargo[res] <= 0 || jettisoning === res}
                  onClick={() => doJettison(res)}
                >
                  {btn(`JETTISON ${res.toUpperCase()}`)}
                </button>
              ))}
            <button
              className="vs-btn"
              disabled={cargo.artefact <= 0 || jettisoning === 'artefact'}
              onClick={() => doJettison('artefact')}
            >
              {btn('JETTISON ARTEFACT')}
            </button>
          </div>
        </>
      )}

      {/* MODULE tab */}
      {activeTab === 'module' && (
        <div style={{ fontSize: '0.85rem' }}>
          {modules.length === 0 ? (
            <div style={{ opacity: 0.4 }}>{UI.empty.NO_MODULES}</div>
          ) : (
            modules.map((item) => (
              <div
                key={item.itemId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  gap: 8,
                }}
              >
                <span>
                  {item.itemId.toUpperCase()} x{item.quantity}
                </span>
                <button
                  className="vs-btn"
                  style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                  onClick={() => network.sendInstallModule('', item.itemId, 0)}
                >
                  {btn(UI.actions.INSTALL)}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* BLUEPRINTS tab */}
      {activeTab === 'blueprint' && (
        <div style={{ fontSize: '0.85rem' }}>
          {blueprints.length === 0 ? (
            <div style={{ opacity: 0.4 }}>{UI.empty.NO_BLUEPRINTS}</div>
          ) : (
            blueprints.map((item) => (
              <div
                key={item.itemId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  {item.itemId.toUpperCase()} x{item.quantity}
                </span>
                <button
                  className="vs-btn"
                  style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                  onClick={() => network.sendActivateBlueprint(item.itemId)}
                >
                  {btn(UI.actions.ACTIVATE)}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
