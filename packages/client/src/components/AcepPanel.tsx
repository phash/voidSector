import React from 'react';
import { ACEP_LEVEL_THRESHOLDS, ACEP_LEVEL_MULTIPLIERS, getAcepLevel } from '@void-sector/shared';

interface AcepData {
  ausbau: number;
  intel: number;
  kampf: number;
  explorer: number;
  traits: string[];
}

const PATH_LABELS: Record<string, string> = {
  ausbau: 'AUSBAU',
  intel: 'INTEL',
  kampf: 'KAMPF',
  explorer: 'EXPLORER',
};

const PATH_COLORS: Record<string, string> = {
  ausbau: '#FFB000',
  intel: '#00CFFF',
  kampf: '#FF4444',
  explorer: '#00FF88',
};

export function AcepPanel({ acep }: { acep: AcepData }) {
  const paths = ['ausbau', 'intel', 'kampf', 'explorer'] as const;

  return (
    <div style={{ fontFamily: 'var(--font-mono)', padding: '8px' }}>
      <div style={{ marginBottom: '12px', color: '#8f8', fontSize: '11px' }}>
        ◈ ADAPTIVE CRAFT EVOLUTION PROTOCOL
      </div>

      {paths.map((path) => {
        const xp = acep[path];
        const level = getAcepLevel(xp);
        const nextThreshold = ACEP_LEVEL_THRESHOLDS[level + 1] ?? 50;
        const prevThreshold = ACEP_LEVEL_THRESHOLDS[level] ?? 0;
        const progress = level >= 5 ? 1 : (xp - prevThreshold) / (nextThreshold - prevThreshold);
        const multiplier = ACEP_LEVEL_MULTIPLIERS[level];

        return (
          <div key={path} style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span style={{ color: PATH_COLORS[path] }}>{PATH_LABELS[path]}</span>
              <span style={{ color: '#888' }}>
                LVL {level} · ×{multiplier.toFixed(1)} · {xp}/50 XP
              </span>
            </div>
            <div
              style={{ background: '#222', height: '4px', borderRadius: '2px', marginTop: '2px' }}
            >
              <div
                style={{
                  width: `${progress * 100}%`,
                  height: '100%',
                  background: PATH_COLORS[path],
                  borderRadius: '2px',
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        );
      })}

      {acep.traits.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: '1px solid #333', paddingTop: '8px' }}>
          <div style={{ color: '#666', fontSize: '9px', marginBottom: '4px' }}>TRAITS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {acep.traits.map((trait) => (
              <span
                key={trait}
                style={{
                  background: '#1a2a1a',
                  border: '1px solid #4a9',
                  color: '#4a9',
                  padding: '1px 6px',
                  fontSize: '9px',
                  borderRadius: '2px',
                }}
              >
                {trait.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
