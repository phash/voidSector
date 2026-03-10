import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import {
  SLATE_AP_COST_SECTOR,
  CUSTOM_SLATE_AP_COST,
  CUSTOM_SLATE_CREDIT_COST,
  CUSTOM_SLATE_MAX_NOTES_LENGTH,
  HULLS,
} from '@void-sector/shared';
import type { DataSlate } from '@void-sector/shared';
import { getItemArtwork } from '../assets/items';
import { btn, btnDisabled } from '../ui-strings';
import { useConfirm } from '../hooks/useConfirm';

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

  const { confirm, isArmed } = useConfirm();

  const [activeTab, setActiveTab] = useState<'resource' | 'module' | 'blueprint'>('resource');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  const resources = inventory.filter((i) => i.itemType === 'resource');
  const modules = inventory.filter((i) => i.itemType === 'module');
  const blueprints = inventory.filter((i) => i.itemType === 'blueprint');

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
        VESSEL: {ship ? HULLS[ship.hullType].name : 'VOID SCOUT'}
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
          RESSOURCEN
        </button>
        <button style={tabBtnStyle(activeTab === 'module')} onClick={() => setActiveTab('module')}>
          MODULE
        </button>
        <button
          style={tabBtnStyle(activeTab === 'blueprint')}
          onClick={() => setActiveTab('blueprint')}
        >
          BLAUPAUSEN
        </button>
      </div>

      {/* RESSOURCEN tab */}
      {activeTab === 'resource' && (
        <>
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
              <div style={{ opacity: 0.6, marginBottom: 4 }}>INVENTAR RESSOURCEN:</div>
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
                  }}
                >
                  <span style={{ opacity: 0.7 }}>
                    [{slate.slateType === 'sector' ? 'S' : slate.slateType === 'area' ? 'A' : 'C'}]
                    {slate.slateType === 'custom' && slate.customData
                      ? ` ${slate.customData.label}`
                      : ` ${slate.sectorData?.length ?? 0} Sektoren`}
                  </span>
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={() => network.sendActivateSlate(slate.id)}
                  >
                    [AKTIVIEREN]
                  </button>
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={() => network.sendNpcBuyback(slate.id)}
                  >
                    [NPC VERKAUF]
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              borderTop: '1px solid var(--color-dim)',
              paddingTop: '8px',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>
              CREATE SLATE
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                className="vs-btn"
                disabled={total >= cargoCap}
                onClick={() => network.sendCreateSlate('sector')}
              >
                [SEKTOR-SLATE {SLATE_AP_COST_SECTOR}AP]
              </button>
              <button
                className="vs-btn"
                disabled={total >= cargoCap}
                onClick={() => network.sendCreateSlate('area')}
              >
                [GEBIETS-SLATE]
              </button>
              <button
                className="vs-btn"
                disabled={total >= cargoCap}
                onClick={() => setShowCustomForm(!showCustomForm)}
              >
                [DATEN-DISK {CUSTOM_SLATE_AP_COST}AP/{CUSTOM_SLATE_CREDIT_COST}CR]
              </button>
            </div>
          </div>

          {showCustomForm && (
            <div
              style={{
                border: '1px solid rgba(255,176,0,0.3)',
                padding: 8,
                marginBottom: 16,
                fontSize: '0.8rem',
              }}
            >
              <div style={{ marginBottom: 4, opacity: 0.6 }}>NEUE DATENDISK</div>
              <input
                className="vs-input"
                placeholder="Label (max 32)"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value.slice(0, 32))}
                style={{ width: '100%', marginBottom: 4 }}
              />
              <textarea
                className="vs-input"
                placeholder="Notizen (max 500)"
                value={customNotes}
                onChange={(e) =>
                  setCustomNotes(e.target.value.slice(0, CUSTOM_SLATE_MAX_NOTES_LENGTH))
                }
                style={{ width: '100%', height: 60, resize: 'vertical', marginBottom: 4 }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="vs-btn"
                  disabled={!customLabel.trim()}
                  onClick={() => {
                    network.sendCreateCustomSlate({
                      label: customLabel.trim(),
                      notes: customNotes || undefined,
                    });
                    setCustomLabel('');
                    setCustomNotes('');
                    setShowCustomForm(false);
                  }}
                >
                  [ERSTELLEN]
                </button>
                <button className="vs-btn" onClick={() => setShowCustomForm(false)}>
                  [ABBRECHEN]
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              className="vs-btn"
              disabled={cargo.ore <= 0}
              onClick={() => confirm('jettison-ore', () => network.sendJettison('ore'))}
              style={isArmed('jettison-ore') ? { borderColor: '#ff4444', color: '#ff4444' } : undefined}
            >
              {isArmed('jettison-ore')
                ? btnDisabled('JETTISON ORE', 'SURE?')
                : btn('JETTISON ORE')}
            </button>
            <button
              className="vs-btn"
              disabled={cargo.gas <= 0}
              onClick={() => confirm('jettison-gas', () => network.sendJettison('gas'))}
              style={isArmed('jettison-gas') ? { borderColor: '#ff4444', color: '#ff4444' } : undefined}
            >
              {isArmed('jettison-gas')
                ? btnDisabled('JETTISON GAS', 'SURE?')
                : btn('JETTISON GAS')}
            </button>
            <button
              className="vs-btn"
              disabled={cargo.crystal <= 0}
              onClick={() => confirm('jettison-crystal', () => network.sendJettison('crystal'))}
              style={isArmed('jettison-crystal') ? { borderColor: '#ff4444', color: '#ff4444' } : undefined}
            >
              {isArmed('jettison-crystal')
                ? btnDisabled('JETTISON CRYSTAL', 'SURE?')
                : btn('JETTISON CRYSTAL')}
            </button>
            <button
              className="vs-btn"
              disabled={cargo.artefact <= 0}
              onClick={() => confirm('jettison-artefact', () => network.sendJettison('artefact'))}
              style={isArmed('jettison-artefact') ? { borderColor: '#ff4444', color: '#ff4444' } : undefined}
            >
              {isArmed('jettison-artefact')
                ? btnDisabled('JETTISON ARTEFACT', 'SURE?')
                : btn('JETTISON ARTEFACT')}
            </button>
          </div>
        </>
      )}

      {/* MODULE tab */}
      {activeTab === 'module' && (
        <div style={{ fontSize: '0.85rem' }}>
          {modules.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEINE MODULE IM INVENTAR</div>
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
                  [INSTALLIEREN]
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* BLAUPAUSEN tab */}
      {activeTab === 'blueprint' && (
        <div style={{ fontSize: '0.85rem' }}>
          {blueprints.length === 0 ? (
            <div style={{ opacity: 0.4 }}>KEINE BLAUPAUSEN IM INVENTAR</div>
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
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={() => network.sendActivateBlueprint(item.itemId)}
                  >
                    [AKTIVIEREN]
                  </button>
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={() => network.sendCraftModule(item.itemId)}
                  >
                    [HERSTELLEN]
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
