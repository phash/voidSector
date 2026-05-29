import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { InlineError } from './InlineError';

const FACTION_LABELS: Record<string, string> = {
  scrappers: 'SCRAPPERS',
  archivists: 'ARCHIVISTS',
  consortium: 'KONSORTIUM',
  kthari: "K'THARI",
  mycelians: 'MYCELIANER',
  mirror_minds: 'MIRROR MINDS',
  tourist_guild: 'TOURIST GUILD',
  silent_swarm: 'SILENT SWARM',
  helions: 'HELIONS',
  axioms: 'AXIOMS',
};

function label(factionId: string): string {
  return FACTION_LABELS[factionId] ?? factionId.toUpperCase();
}

export function XenoScreen() {
  const xenoStatus = useStore((s) => s.xenoStatus);
  const result = useStore((s) => s.alienInteractResult);
  const showTip = useStore((s) => s.showTip);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    network.requestXenoStatus();
    showTip('first_xeno');
  }, [showTip]);

  const selected = xenoStatus.find((f) => f.factionId === selectedId) ?? null;

  // Generic action runner: dispatch then refresh status (server processes both in order).
  function runAction(factionId: string, action: string, payload?: Record<string, unknown>) {
    network.sendAlienInteract(factionId, action, payload);
    network.requestXenoStatus();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '0.8rem', letterSpacing: '0.2em', opacity: 0.6 }}>
          XENO — FREMDE FRAKTIONEN
        </span>
        <button
          onClick={() => showTip('first_xeno')}
          style={{
            background: 'none',
            border: '1px solid var(--color-dim)',
            color: 'var(--color-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            padding: '0 4px',
            cursor: 'pointer',
          }}
          title="Hilfe"
        >
          [?]
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
        {/* Faction list */}
        <div
          data-testid="xeno-faction-list"
          style={{
            width: '45%',
            overflowY: 'auto',
            borderRight: '1px solid var(--color-dim)',
            paddingRight: 6,
          }}
        >
          {xenoStatus.length === 0 && (
            <div style={{ opacity: 0.5, fontSize: '0.75rem' }}>LADE FRAKTIONEN…</div>
          )}
          {xenoStatus.map((f) => (
            <button
              key={f.factionId}
              data-testid={`xeno-faction-${f.factionId}`}
              disabled={!f.reachable}
              onClick={() => setSelectedId(f.factionId)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                marginBottom: 2,
                background: selectedId === f.factionId ? 'var(--color-dim)' : 'none',
                color: f.reachable ? 'var(--color-primary)' : 'var(--color-dim)',
                border: '1px solid var(--color-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                padding: '2px 4px',
                cursor: f.reachable ? 'pointer' : 'default',
                opacity: f.reachable ? 1 : 0.5,
              }}
            >
              <span>{label(f.factionId)}</span>
              <span style={{ float: 'right', opacity: 0.7 }}>
                {f.reachable ? f.tier : 'außer Reichweite'}
              </span>
            </button>
          ))}
        </div>

        {/* Detail / action area */}
        <div style={{ flex: 1, overflowY: 'auto', fontSize: '0.8rem' }}>
          {!selected && <div style={{ opacity: 0.5 }}>Fraktion auswählen…</div>}
          {selected && (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{label(selected.factionId)}</div>
              <div style={{ opacity: 0.7, marginBottom: 6 }}>
                RUF: {selected.reputation} · {selected.tier}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                {!selected.firstContacted && (
                  <button
                    className="vs-btn"
                    data-testid="xeno-firstcontact-btn"
                    onClick={() => runAction(selected.factionId, 'firstContact')}
                  >
                    [ERSTKONTAKT]
                  </button>
                )}
                <button
                  className="vs-btn"
                  data-testid="xeno-greet-btn"
                  onClick={() => runAction(selected.factionId, 'greet')}
                >
                  [GREET]
                </button>
              </div>
              <InlineError codes={['XENO_ERROR']} />
              {result && result.success && result.factionId === selected.factionId && (
                <div
                  data-testid="xeno-result"
                  style={{
                    marginTop: 6,
                    whiteSpace: 'pre-wrap',
                    borderTop: '1px solid var(--color-dim)',
                    paddingTop: 6,
                  }}
                >
                  {result.message}
                  {typeof result.repAfter === 'number' && (
                    <div style={{ opacity: 0.7, marginTop: 4 }}>
                      RUF: {result.repBefore ?? '—'} → {result.repAfter}
                      {result.repTier ? ` (${result.repTier})` : ''}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
