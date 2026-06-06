import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const RESOURCES = ['ore', 'gas', 'crystal', 'artefact'] as const;
const RES_LABEL: Record<(typeof RESOURCES)[number], string> = {
  ore: 'ORE',
  gas: 'GAS',
  crystal: 'CRYSTAL',
  artefact: 'ARTEFAKT',
};

/**
 * Personal storage ("Lager"/Tresor) at the home base. Move resources between the
 * ship's cargo hold and the storage bank that trade routes draw from (#521 / SP1).
 */
export function LagerPanel() {
  const cargo = useStore((s) => s.cargo);
  const storage = useStore((s) => s.storage);
  const showTip = useStore((s) => s.showTip);
  const [amount, setAmount] = useState(1);

  // Refresh storage on open + surface the help tip on first contact.
  useEffect(() => {
    network.requestStorage();
    showTip('first_lager');
  }, [showTip]);

  return (
    <div style={{ fontSize: '0.8rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ letterSpacing: '0.1em', opacity: 0.7 }}>LAGER (TRESOR)</span>
        <button
          className="vs-btn"
          style={{ fontSize: '0.65rem', padding: '1px 6px' }}
          title="Hilfe"
          onClick={() => showTip('first_lager')}
        >
          [?]
        </button>
      </div>

      <div style={{ fontSize: '0.7rem', marginBottom: 8 }}>
        <label>Menge: </label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
          style={{
            width: 60,
            background: 'transparent',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-primary)',
            fontFamily: 'var(--font-mono)',
            padding: '2px 4px',
          }}
        />
      </div>

      {RESOURCES.map((res) => {
        const inShip = cargo[res] ?? 0;
        const inLager = storage[res] ?? 0;
        const depositAmt = Math.min(amount, inShip);
        const withdrawAmt = Math.min(amount, inLager);
        return (
          <div
            key={res}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 0',
              borderBottom: '1px solid rgba(255,176,0,0.08)',
            }}
          >
            <span style={{ width: 70, fontWeight: 'bold' }}>{RES_LABEL[res]}</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.7, flex: 1 }}>
              Schiff: {inShip} | Lager: {inLager}
            </span>
            <button
              className="vs-btn"
              style={{ fontSize: '0.6rem', padding: '2px 6px' }}
              disabled={inShip <= 0}
              onClick={() => network.sendTransfer(res, depositAmt, 'toStorage')}
            >
              [→ Lager]
            </button>
            <button
              className="vs-btn"
              style={{ fontSize: '0.6rem', padding: '2px 6px' }}
              disabled={inLager <= 0}
              onClick={() => network.sendTransfer(res, withdrawAmt, 'fromStorage')}
            >
              [→ Schiff]
            </button>
          </div>
        );
      })}
    </div>
  );
}
