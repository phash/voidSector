import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const STRUCTURE_LABELS: Record<string, string> = {
  base: 'KOMMANDO-KERN',
  comm_relay: 'COMM RELAY',
  mining_station: 'MINING STATION',
};

export function BaseScreen() {
  const baseStructures = useStore((s) => s.baseStructures);
  const cargo = useStore((s) => s.cargo);

  useEffect(() => {
    network.requestBase();
  }, []);

  const hasBase = baseStructures.length > 0;

  return (
    <div style={{ padding: '12px', fontSize: '0.8rem', lineHeight: 1.8 }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: '12px', opacity: 0.6 }}>
        BASE-LINK — {hasBase ? 'CONNECTED' : 'NO SIGNAL'}
      </div>

      {!hasBase ? (
        <div>
          <div style={{ opacity: 0.4, marginBottom: '12px' }}>
            NO BASE CONSTRUCTED
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>
            Navigate to a sector and use [BUILD BASE] to establish your home base.
          </div>
        </div>
      ) : (
        <>
          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '8px', marginBottom: '8px' }}>
            STRUCTURES
          </div>
          {baseStructures.map((s: any) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{STRUCTURE_LABELS[s.type] || s.type.toUpperCase()}</span>
              <span style={{ opacity: 0.5 }}>[ACTIVE]</span>
            </div>
          ))}

          <div style={{ borderBottom: '1px solid var(--color-dim)', paddingBottom: '8px', marginBottom: '8px', marginTop: '16px' }}>
            CARGO ON SHIP
          </div>
          <div>ERZ: {cargo.ore} &nbsp; GAS: {cargo.gas} &nbsp; KRISTALL: {cargo.crystal}</div>
        </>
      )}
    </div>
  );
}
