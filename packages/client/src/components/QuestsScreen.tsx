import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { innerCoord } from '@void-sector/shared';
import type { AvailableQuest, StationNpc } from '@void-sector/shared';

export function QuestsScreen() {
  const activeQuests = useStore((s) => s.activeQuests);
  const reputations = useStore((s) => s.reputations);
  const playerUpgrades = useStore((s) => s.playerUpgrades);
  const scanEvents = useStore((s) => s.scanEvents);
  const currentSector = useStore((s) => s.currentSector);
  const position = useStore((s) => s.position);
  const distressCalls = useStore((s) => s.distressCalls);
  const rescuedSurvivors = useStore((s) => s.rescuedSurvivors);
  const navReturnProgram = useStore((s) => s.navReturnProgram);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const clearNavReturn = useStore((s) => s.clearNavReturn);

  const [tab, setTab] = useState<'active' | 'station' | 'rep' | 'events' | 'rescue'>('active');
  const [expandedQuestId, setExpandedQuestId] = useState<string | null>(null);
  const [stationNpcs, setStationNpcs] = useState<StationNpc[]>([]);
  const [availableQuests, setAvailableQuests] = useState<AvailableQuest[]>([]);

  useEffect(() => {
    network.requestActiveQuests();
    network.requestReputation();
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setStationNpcs(detail.npcs);
      setAvailableQuests(detail.quests);
    };
    window.addEventListener('stationNpcsResult', handler);
    return () => window.removeEventListener('stationNpcsResult', handler);
  }, []);

  const isAtStation = currentSector?.type === 'station';

  const tierColors: Record<string, string> = {
    hostile: '#FF3333',
    unfriendly: '#FF8C00',
    neutral: '#FFB000',
    friendly: '#00FF88',
    honored: '#00BFFF',
  };

  const tabLabels: Record<string, string> = {
    active: 'AKTIV',
    station: 'STATION',
    rep: 'REP',
    events: 'EVENTS',
    rescue: 'RETTUNG',
  };

  return (
    <div style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
      {navReturnProgram && (
        <button
          className="vs-btn"
          style={{ fontSize: '0.7rem', marginBottom: 8 }}
          onClick={() => { setActiveProgram(navReturnProgram); clearNavReturn(); }}
        >
          [← ZURÜCK]
        </button>
      )}
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {(['active', 'station', 'rep', 'events', 'rescue'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === 'station' && isAtStation) {
                network.requestStationNpcs(position.x, position.y);
              }
            }}
            style={{
              background: tab === t ? '#FFB000' : '#1a1a1a',
              color: tab === t ? '#000' : '#FFB000',
              border: '1px solid #FFB000',
              padding: '2px 6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Active quests tab — Journal format */}
      {tab === 'active' && (
        <div>
          <div style={{ color: '#FFB000', marginBottom: '4px', letterSpacing: '0.1em' }}>
            ─── JOURNAL ({activeQuests.length}/3) ───
          </div>
          {activeQuests.length === 0 && (
            <div style={{ color: 'rgba(255,176,0,0.4)', fontSize: '10px' }}>
              KEINE AKTIVEN AUFTRÄGE
            </div>
          )}
          {activeQuests.map((q) => {
            const isExpanded = expandedQuestId === q.id;
            const doneCount = q.objectives.filter((o) => o.fulfilled).length;
            const allDone = doneCount === q.objectives.length;
            const hasTarget = q.objectives.some((o) => o.targetX != null && o.targetY != null);
            return (
              <div
                key={q.id}
                style={{
                  border: `1px solid ${allDone ? '#00FF88' : 'rgba(255,176,0,0.3)'}`,
                  marginBottom: '4px',
                  overflow: 'hidden',
                }}
              >
                {/* Header row — click to expand */}
                <div
                  onClick={() => setExpandedQuestId(isExpanded ? null : q.id)}
                  style={{
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isExpanded ? 'rgba(255,176,0,0.08)' : 'transparent',
                  }}
                >
                  <span style={{ color: allDone ? '#00FF88' : '#FFB000' }}>
                    {allDone ? '[✓] ' : `[${doneCount}/${q.objectives.length}] `}
                    {q.title}
                    {hasTarget && <span style={{ color: 'rgba(255,176,0,0.5)', fontSize: '9px' }}> ◎</span>}
                  </span>
                  <span style={{ color: 'rgba(255,176,0,0.4)', fontSize: '9px' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded journal entry */}
                {isExpanded && (
                  <div style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,176,0,0.2)' }}>
                    <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '10px', marginBottom: '4px' }}>
                      {q.description}
                    </div>
                    {q.objectives.map((obj, i) => (
                      <div
                        key={i}
                        style={{
                          color: obj.fulfilled ? '#00FF88' : 'rgba(255,176,0,0.7)',
                          paddingLeft: '6px',
                          fontSize: '10px',
                          marginBottom: '2px',
                        }}
                      >
                        {obj.fulfilled ? '[x]' : '[ ]'} {obj.description}
                        {obj.amount != null && obj.progress != null && (
                          <span style={{ color: 'rgba(255,176,0,0.4)' }}>
                            {' '}({obj.progress}/{obj.amount})
                          </span>
                        )}
                        {obj.targetX != null && obj.targetY != null && !obj.fulfilled && (
                          <span style={{ color: 'rgba(255,176,0,0.4)' }}>
                            {' '}→ ({innerCoord(obj.targetX)}, {innerCoord(obj.targetY)})
                          </span>
                        )}
                      </div>
                    ))}
                    <div style={{ color: 'rgba(255,176,0,0.4)', fontSize: '9px', marginTop: '4px' }}>
                      BELOHNUNG: +{q.rewards.credits} CR | +{q.rewards.xp} XP
                      {q.rewards.reputation > 0 && ` | +${q.rewards.reputation} REP`}
                    </div>
                    <button
                      onClick={() => network.sendAbandonQuest(q.id)}
                      style={{
                        background: 'none',
                        color: '#FF3333',
                        border: '1px solid #FF3333',
                        padding: '1px 4px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: '9px',
                        marginTop: '3px',
                      }}
                    >
                      [ABBRECHEN]
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Station quests tab */}
      {tab === 'station' && (
        <div>
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- STATION ---</div>
          {!isAtStation && (
            <div style={{ color: 'rgba(255,176,0,0.5)' }}>Nicht an einer Station</div>
          )}
          {isAtStation && stationNpcs.length === 0 && (
            <div style={{ color: 'rgba(255,176,0,0.5)' }}>Lade NPCs...</div>
          )}
          {stationNpcs.map((npc) => (
            <div key={npc.id} style={{ color: '#00FF88', marginBottom: '2px' }}>
              {npc.name} [{npc.factionId.toUpperCase()}]
            </div>
          ))}
          {availableQuests.length > 0 && (
            <>
              <div style={{ color: '#FFB000', marginTop: '8px', marginBottom: '4px' }}>
                VERFUGBARE QUESTS:
              </div>
              {availableQuests.map((q) => (
                <div
                  key={q.templateId}
                  style={{
                    border: '1px solid rgba(255,176,0,0.3)',
                    padding: '4px',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ color: '#FFB000' }}>{q.title}</div>
                  <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '10px' }}>
                    {q.description}
                  </div>
                  <div style={{ color: 'rgba(255,176,0,0.4)', fontSize: '10px' }}>
                    +{q.rewards.credits} CR | +{q.rewards.xp} XP | +{q.rewards.reputation} REP
                  </div>
                  <button
                    onClick={() => network.sendAcceptQuest(q.templateId, position.x, position.y)}
                    style={{
                      background: '#1a1a1a',
                      color: '#00FF88',
                      border: '1px solid #00FF88',
                      padding: '1px 4px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '10px',
                      marginTop: '2px',
                    }}
                  >
                    [ANNEHMEN]
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Reputation tab */}
      {tab === 'rep' && (
        <div>
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- REPUTATION ---</div>
          {reputations.map((r) => (
            <div key={r.factionId} style={{ marginBottom: '6px' }}>
              <div style={{ color: tierColors[r.tier] ?? '#FFB000' }}>
                {r.factionId.toUpperCase()} [{r.tier.toUpperCase()}]
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div
                  style={{
                    width: '120px',
                    height: '8px',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,176,0,0.3)',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, (r.reputation + 100) / 2)}%`,
                      height: '100%',
                      background: tierColors[r.tier] ?? '#FFB000',
                    }}
                  />
                </div>
                <span style={{ color: 'rgba(255,176,0,0.6)', fontSize: '10px' }}>
                  {r.reputation}
                </span>
              </div>
            </div>
          ))}
          {playerUpgrades.length > 0 && (
            <>
              <div style={{ color: '#FFB000', marginTop: '8px', marginBottom: '4px' }}>
                UPGRADES:
              </div>
              {playerUpgrades.map((u) => (
                <div key={u.upgradeId} style={{ color: u.active ? '#00FF88' : '#FF3333' }}>
                  {u.active ? '[ON]' : '[OFF]'} {u.upgradeId.toUpperCase().replace('_', ' ')}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Scan events tab */}
      {tab === 'events' && (
        <div>
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- SCAN EVENTS ---</div>
          {scanEvents.filter((e) => e.status === 'discovered').length === 0 && (
            <div style={{ color: 'rgba(255,176,0,0.5)' }}>Keine aktiven Events</div>
          )}
          {scanEvents
            .filter((e) => e.status === 'discovered')
            .map((e) => {
              const typeLabels: Record<string, string> = {
                distress_signal: 'NOTSIGNAL',
                anomaly_reading: 'ANOMALIE',
                artifact_find: 'ARTEFAKT',
              };
              return (
                <div
                  key={e.id}
                  style={{
                    border: '1px solid rgba(255,176,0,0.3)',
                    padding: '4px',
                    marginBottom: '4px',
                  }}
                >
                  <div style={{ color: '#FF00FF' }}>{typeLabels[e.eventType] ?? e.eventType}</div>
                  <div style={{ color: 'rgba(255,176,0,0.6)', fontSize: '10px' }}>
                    Sektor ({innerCoord(e.sectorX)}, {innerCoord(e.sectorY)})
                  </div>
                  <button
                    onClick={() => network.sendCompleteScanEvent(e.id)}
                    style={{
                      background: '#1a1a1a',
                      color: '#00FF88',
                      border: '1px solid #00FF88',
                      padding: '1px 4px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '10px',
                      marginTop: '2px',
                    }}
                  >
                    [UNTERSUCHEN]
                  </button>
                </div>
              );
            })}
        </div>
      )}

      {/* Rescue tab */}
      {tab === 'rescue' && (
        <div>
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- RETTUNG ---</div>

          {/* Active distress calls */}
          {distressCalls.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: '#FF3333', marginBottom: '4px' }}>AKTIVE NOTRUFE:</div>
              {distressCalls.map((call) => {
                const minutesLeft = Math.max(0, Math.ceil((call.expiresAt - Date.now()) / 60000));
                return (
                  <div
                    key={call.id}
                    style={{
                      border: '1px solid rgba(255, 51, 51, 0.3)',
                      padding: '4px',
                      marginBottom: '4px',
                    }}
                  >
                    <div style={{ color: '#FF3333' }}>DISTRESS SIGNAL</div>
                    <div>RICHTUNG: {call.direction}</div>
                    <div>ENTFERNUNG: ~{call.estimatedDistance} SEKTOREN</div>
                    <div style={{ fontSize: '10px', opacity: 0.5 }}>
                      Verfällt in {minutesLeft} min
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {distressCalls.length === 0 && rescuedSurvivors.length === 0 && (
            <div style={{ color: 'rgba(255,176,0,0.5)' }}>Keine aktiven Rettungsmissionen</div>
          )}

          {/* Rescued survivors in transit */}
          {rescuedSurvivors.length > 0 && (
            <div>
              <div style={{ color: '#00FF88', marginBottom: '4px' }}>ÜBERLEBENDE AN BORD:</div>
              {rescuedSurvivors.map((s) => (
                <div
                  key={s.id}
                  style={{
                    border: '1px solid rgba(0, 255, 136, 0.3)',
                    padding: '4px',
                    marginBottom: '4px',
                  }}
                >
                  <div>{s.survivorCount} Überlebende</div>
                  <div style={{ fontSize: '10px', opacity: 0.5 }}>
                    Geborgen bei ({innerCoord(s.sectorX)}, {innerCoord(s.sectorY)})
                  </div>
                </div>
              ))}
              <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px' }}>
                An einer Station abliefern für Belohnung
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
