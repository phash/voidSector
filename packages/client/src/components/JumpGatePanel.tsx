import { useState } from 'react';
import { network } from '../network/client';
import { FrequencyMinigame } from './FrequencyMinigame';
import type { JumpGateInfo } from '@void-sector/shared';

interface Props {
  gate: JumpGateInfo;
}

export function JumpGatePanel({ gate }: Props) {
  const [code, setCode] = useState('');
  const [showMinigame, setShowMinigame] = useState(false);

  const handleUseGate = () => {
    if (gate.requiresMinigame && !showMinigame) {
      setShowMinigame(true);
      return;
    }
    network.sendUseJumpGate(gate.id, gate.requiresCode ? code : undefined);
  };

  const handleMinigameComplete = (matched: boolean) => {
    setShowMinigame(false);
    if (matched) {
      network.sendFrequencyMatch(gate.id, true);
    }
  };

  const needsCode = gate.requiresCode && !gate.hasCode;

  return (
    <div
      style={{
        marginTop: 12,
        padding: 8,
        border: '1px solid rgba(0, 191, 255, 0.4)',
        background: 'rgba(0, 191, 255, 0.05)',
      }}
    >
      <div
        style={{ color: '#00BFFF', fontSize: '0.8rem', letterSpacing: '0.15em', marginBottom: 6 }}
      >
        JUMPGATE — {gate.gateType.toUpperCase()}
      </div>

      {gate.gateType === 'wormhole' && (
        <div style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: 4 }}>
          ZIEL: UNBEKANNT (EINBAHNSTRASSE)
        </div>
      )}

      {needsCode && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: '0.7rem', color: '#FF3333', marginBottom: 2 }}>
            LOCKED — ACCESS CODE REQUIRED
          </div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="CODE"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 176, 0, 0.3)',
              color: '#FFB000',
              fontFamily: 'inherit',
              fontSize: '0.75rem',
              padding: '2px 6px',
              width: '100px',
            }}
          />
        </div>
      )}

      {gate.requiresCode && gate.hasCode && (
        <div style={{ fontSize: '0.7rem', color: '#00FF88', marginBottom: 4 }}>CODE: VORHANDEN</div>
      )}

      {showMinigame ? (
        <FrequencyMinigame
          onComplete={handleMinigameComplete}
          onCancel={() => setShowMinigame(false)}
        />
      ) : (
        <button
          onClick={handleUseGate}
          disabled={needsCode && code.length < 8}
          style={{
            background: 'transparent',
            border: '1px solid #00BFFF',
            color: '#00BFFF',
            fontFamily: 'inherit',
            fontSize: '0.75rem',
            padding: '4px 12px',
            cursor: needsCode && code.length < 8 ? 'default' : 'pointer',
            opacity: needsCode && code.length < 8 ? 0.4 : 1,
          }}
        >
          {gate.requiresMinigame ? 'FREQUENZ-MATCHING STARTEN' : 'USE GATE'} (1 FUEL)
        </button>
      )}
    </div>
  );
}
