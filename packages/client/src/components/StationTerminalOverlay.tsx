import { useState } from 'react';
import { useStore } from '../state/store';
import { FabrikPanel } from './FabrikPanel';
import { TradeScreen } from './TradeScreen';
import { QuestsScreen } from './QuestsScreen';
import { generateStationName, innerCoord } from '@void-sector/shared';
import { useTranslation } from 'react-i18next';
import { btn } from '../ui-helpers';

type TerminalProgram = 'fabrik' | 'handel' | 'quests';

const PROGRAM_LABELS: Record<TerminalProgram, string> = {
  fabrik: 'FABRIK',
  handel: 'HANDEL',
  quests: 'QUESTS',
};

const green = '#00FF88';
const dimGreen = 'rgba(0,255,136,0.4)';
const bg = '#050505';

export function StationTerminalOverlay() {
  const { t } = useTranslation('ui');
  const closeStationTerminal = useStore((s) => s.closeStationTerminal);
  const position = useStore((s) => s.position);
  const currentSector = useStore((s) => s.currentSector);
  const [program, setProgram] = useState<TerminalProgram>('handel');

  const stationName = generateStationName(position.x, position.y);
  const coord = `(${innerCoord(position.x)}, ${innerCoord(position.y)})`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: bg,
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-mono)',
        color: green,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: `1px solid ${dimGreen}`,
          fontSize: '0.85rem',
          letterSpacing: '0.15em',
        }}
      >
        <div>
          <span style={{ opacity: 0.5 }}>STATION </span>
          {stationName.toUpperCase()}
          <span style={{ opacity: 0.4, marginLeft: 8, fontSize: '0.7rem' }}>{coord}</span>
          {currentSector?.type && (
            <span style={{ opacity: 0.4, marginLeft: 8, fontSize: '0.7rem' }}>
              [{currentSector.type.toUpperCase()}]
            </span>
          )}
        </div>
        <button
          onClick={closeStationTerminal}
          style={{
            background: 'none',
            border: `1px solid ${dimGreen}`,
            color: green,
            fontFamily: 'inherit',
            fontSize: '0.7rem',
            padding: '2px 10px',
            cursor: 'pointer',
            letterSpacing: '0.1em',
          }}
        >
          {btn(t('actions.undock'))}
        </button>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Program sidebar */}
        <div
          style={{
            width: 120,
            borderRight: `1px solid ${dimGreen}`,
            padding: '12px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {(Object.keys(PROGRAM_LABELS) as TerminalProgram[]).map((p) => (
            <button
              key={p}
              onClick={() => setProgram(p)}
              style={{
                background: program === p ? `rgba(0,255,136,0.1)` : 'none',
                border: 'none',
                borderLeft: program === p ? `2px solid ${green}` : '2px solid transparent',
                color: program === p ? green : dimGreen,
                fontFamily: 'inherit',
                fontSize: '0.75rem',
                padding: '6px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                letterSpacing: '0.1em',
              }}
            >
              {PROGRAM_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div
          style={
            {
              flex: 1,
              overflow: 'auto',
              '--color-primary': green,
              '--color-dim': dimGreen,
            } as React.CSSProperties
          }
        >
          {program === 'fabrik' && <FabrikPanel />}
          {program === 'handel' && <TradeScreen />}
          {program === 'quests' && <QuestsScreen />}
        </div>
      </div>
    </div>
  );
}
