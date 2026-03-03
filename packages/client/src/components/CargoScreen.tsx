import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { SHIP_CLASSES, RESOURCE_TYPES, SLATE_AP_COST_SECTOR } from '@void-sector/shared';
import type { ResourceType, DataSlate } from '@void-sector/shared';

function CargoBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = 10;
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
      {label.padEnd(10)} {bar} {String(value).padStart(3)}
    </div>
  );
}

export function CargoScreen() {
  const cargo = useStore((s) => s.cargo);
  const ship = useStore((s) => s.ship);
  const mySlates = useStore((s) => s.mySlates);
  const cargoCap = ship ? SHIP_CLASSES[ship.shipClass].cargoCap : SHIP_CLASSES.aegis_scout_mk1.cargoCap;
  const total = cargo.ore + cargo.gas + cargo.crystal + cargo.slates;

  useEffect(() => {
    network.requestMySlates();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6, marginBottom: '12px' }}>
        CARGO HOLD
      </div>

      <div style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
        VESSEL: {ship ? SHIP_CLASSES[ship.shipClass].name : 'VOID SCOUT MK. I'}
      </div>

      <div style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
        CAPACITY: {total}/{cargoCap}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <CargoBar label="ORE" value={cargo.ore} max={cargoCap} />
        <CargoBar label="GAS" value={cargo.gas} max={cargoCap} />
        <CargoBar label="CRYSTAL" value={cargo.crystal} max={cargoCap} />
        <CargoBar label="SLATES" value={cargo.slates} max={cargoCap} />
      </div>

      <div style={{
        borderTop: '1px solid var(--color-dim)',
        paddingTop: '8px',
        marginBottom: '16px',
        fontSize: '0.9rem',
      }}>
        <CargoBar label="TOTAL" value={total} max={cargoCap} />
      </div>

      {cargo.slates > 0 && (
        <div style={{
          borderTop: '1px solid var(--color-dim)',
          paddingTop: '8px',
          marginBottom: '8px',
        }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>
            DATA SLATES: {cargo.slates}
          </div>
          {mySlates.map((slate: DataSlate) => (
            <div key={slate.id} style={{
              fontSize: '0.8rem',
              marginBottom: '4px',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}>
              <span style={{ opacity: 0.7 }}>
                [{slate.slateType === 'sector' ? 'S' : 'A'}] {slate.sectorData.length} Sektoren
              </span>
              <button className="vs-btn" style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                onClick={() => network.sendActivateSlate(slate.id)}>
                [AKTIVIEREN]
              </button>
              <button className="vs-btn" style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                onClick={() => network.sendNpcBuyback(slate.id)}>
                [NPC VERKAUF]
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{
        borderTop: '1px solid var(--color-dim)',
        paddingTop: '8px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>CREATE SLATE</div>
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
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {RESOURCE_TYPES.map((res: ResourceType) => (
          <button
            key={res}
            className="vs-btn"
            disabled={cargo[res] <= 0}
            onClick={() => network.sendJettison(res)}
          >
            [JETTISON {res.toUpperCase()}]
          </button>
        ))}
      </div>
    </div>
  );
}
