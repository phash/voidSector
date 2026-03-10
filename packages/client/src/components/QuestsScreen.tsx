import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { innerCoord } from '@void-sector/shared';
import type { AvailableQuest, StationNpc, SectorData } from '@void-sector/shared';
import type { TrackedQuest } from '../state/gameSlice';
import { findNearestStation } from '../utils/sectorUtils';
import { btn, btnDisabled, UI } from '../ui-strings';
import { useConfirm } from '../hooks/useConfirm';

const MAX_TRACKED = 5;

const QUEST_TYPE_LABELS: Record<string, string> = {
  fetch: 'DELIVERY',
  scan: 'SCAN',
  delivery: 'DELIVERY',
  bounty: 'BOUNTY',
  story: 'STORY',
  community: 'COMMUNITY',
  traders: 'TRADERS',
  scientists: 'SCI.',
  pirates: 'PIRATES',
  ancients: 'ANCIENTS',
  diplomacy: 'DIPLOMACY',
  war_support: 'WAR',
};

function JournalTab() {
  const activeQuests = useStore((s) => s.activeQuests);
  const trackedQuests = useStore((s) => s.trackedQuests);
  const position = useStore((s) => s.position);

  const [filterNearby, setFilterNearby] = useState(false);
  const [filterFaction, setFilterFaction] = useState('');
  const [filterType, setFilterType] = useState('');
  const [nearbyRadius, setNearbyRadius] = useState(10);

  useEffect(() => {
    network.requestTrackedQuests();
  }, []);

  const trackedIds = new Set(trackedQuests.map((t) => t.questId));

  // Gather available faction IDs from active quests
  const factionIds = Array.from(
    new Set(activeQuests.map((q) => (q.npcFactionId as string) || '').filter(Boolean)),
  );
  // Gather quest types from template_id prefix
  const questTypes = Array.from(
    new Set(
      activeQuests.map((q) => {
        const prefix = (q.templateId as string)?.split('_')[0] ?? '';
        return prefix;
      }),
    ).values(),
  ).filter(Boolean);

  // Filter logic
  const filtered = activeQuests.filter((q) => {
    if (filterFaction && q.npcFactionId !== filterFaction) return false;
    if (filterType) {
      const prefix = (q.templateId as string)?.split('_')[0] ?? '';
      if (prefix !== filterType) return false;
    }
    if (filterNearby) {
      const hasNearTarget = q.objectives.some((o) => {
        if (o.targetX == null || o.targetY == null) return false;
        const dist = Math.abs(o.targetX - position.x) + Math.abs(o.targetY - position.y);
        return dist <= nearbyRadius;
      });
      const hasStationNear =
        Math.abs(q.stationX - position.x) + Math.abs(q.stationY - position.y) <= nearbyRadius;
      if (!hasNearTarget && !hasStationNear) return false;
    }
    return true;
  });

  function toggleTrack(questId: string) {
    const isTracked = trackedIds.has(questId);
    if (!isTracked && trackedQuests.length >= MAX_TRACKED) return;
    network.sendTrackQuest(questId, !isTracked);
  }

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
      {/* Filter bar */}
      <div
        style={{
          padding: '4px 0',
          marginBottom: 6,
          borderBottom: '1px solid rgba(255,176,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
          <button
            onClick={() => setFilterNearby((v) => !v)}
            style={{
              background: filterNearby ? '#FFB000' : '#1a1a1a',
              color: filterNearby ? '#000' : '#FFB000',
              border: '1px solid #FFB000',
              padding: '1px 5px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.65rem',
            }}
          >
            {filterNearby ? `[✓] ${UI.status.NEARBY}` : `[ ] ${UI.status.NEARBY}`}
          </button>
          {filterNearby && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'rgba(255,176,0,0.6)', fontSize: '0.6rem' }}>R≤</span>
              <input
                type="number"
                min={1}
                max={50}
                value={nearbyRadius}
                onChange={(e) => setNearbyRadius(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: 36,
                  background: '#0a0a0a',
                  color: '#FFB000',
                  border: '1px solid rgba(255,176,0,0.4)',
                  fontFamily: 'inherit',
                  fontSize: '0.65rem',
                  padding: '1px 3px',
                }}
              />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {factionIds.length > 0 && (
            <select
              value={filterFaction}
              onChange={(e) => setFilterFaction(e.target.value)}
              style={{
                background: '#0a0a0a',
                color: '#FFB000',
                border: '1px solid rgba(255,176,0,0.4)',
                fontFamily: 'inherit',
                fontSize: '0.65rem',
                padding: '1px 3px',
              }}
            >
              <option value="">{UI.status.ALL_FACTIONS}</option>
              {factionIds.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          )}
          {questTypes.length > 0 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                background: '#0a0a0a',
                color: '#FFB000',
                border: '1px solid rgba(255,176,0,0.4)',
                fontFamily: 'inherit',
                fontSize: '0.65rem',
                padding: '1px 3px',
              }}
            >
              <option value="">{UI.status.ALL_TYPES}</option>
              {questTypes.map((t) => (
                <option key={t} value={t}>
                  {QUEST_TYPE_LABELS[t] ?? t.toUpperCase()}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tracked counter */}
      <div
        style={{
          color: trackedQuests.length >= MAX_TRACKED ? '#FF3333' : 'rgba(255,176,0,0.5)',
          fontSize: '0.6rem',
          marginBottom: 4,
          letterSpacing: '0.05em',
        }}
      >
        {UI.status.TRACKED}: {trackedQuests.length}/{MAX_TRACKED}
      </div>

      {/* Quest list */}
      {filtered.length === 0 && (
        <div style={{ color: 'rgba(255,176,0,0.4)', fontSize: '10px' }}>
          {UI.empty.NO_QUESTS_FILTERED}
        </div>
      )}
      {filtered.map((q) => {
        const isTracked = trackedIds.has(q.id);
        const doneCount = q.objectives.filter((o) => o.fulfilled).length;
        const allDone = doneCount === q.objectives.length;
        const typePrefix = (q.templateId as string)?.split('_')[0] ?? '';
        const typeLabel = QUEST_TYPE_LABELS[typePrefix] ?? typePrefix.toUpperCase();
        const canTrack = isTracked || trackedQuests.length < MAX_TRACKED;
        return (
          <div
            key={q.id}
            style={{
              border: `1px solid ${isTracked ? 'rgba(0,120,255,0.6)' : 'rgba(255,176,0,0.25)'}`,
              marginBottom: 4,
              padding: '4px 6px',
              background: isTracked ? 'rgba(0,60,180,0.06)' : 'transparent',
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: 'rgba(255,176,0,0.5)', fontSize: '0.6rem', marginRight: 4 }}>
                  [{typeLabel}]
                </span>
                <span style={{ color: allDone ? '#00FF88' : '#FFB000' }}>{q.title}</span>
              </div>
              <button
                onClick={() => toggleTrack(q.id)}
                disabled={!canTrack}
                title={isTracked ? 'Stop tracking' : 'Track quest (max 5)'}
                style={{
                  background: isTracked ? 'rgba(0,120,255,0.3)' : 'none',
                  color: isTracked ? '#4488FF' : canTrack ? 'rgba(255,176,0,0.5)' : '#333',
                  border: `1px solid ${isTracked ? '#4488FF' : canTrack ? 'rgba(255,176,0,0.4)' : '#333'}`,
                  padding: '0px 4px',
                  cursor: canTrack ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  fontSize: '0.6rem',
                  marginLeft: 4,
                  flexShrink: 0,
                }}
              >
                {isTracked ? '[T✓]' : '[T]'}
              </button>
            </div>
            <div
              style={{ color: 'rgba(255,176,0,0.45)', fontSize: '0.6rem', marginTop: 2 }}
            >
              {doneCount}/{q.objectives.length} {UI.status.OBJECTIVES}
              {q.npcFactionId && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  [{(q.npcFactionId as string).toUpperCase()}]
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StoryTab() {
  const progress = useStore((s) => s.storyProgress);

  useEffect(() => {
    network.requestStoryProgress();
  }, []);

  if (!progress) {
    return <div style={{ color: 'var(--color-dim)', fontSize: '0.7rem', padding: 8 }}>{UI.status.LOADING}</div>;
  }

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', overflow: 'auto' }}>
      {progress.chapters.map((ch) => {
        const completed = progress.completedChapters.includes(ch.id);
        const current = progress.currentChapter === ch.id && !completed;
        return (
          <div
            key={ch.id}
            style={{
              padding: '6px 8px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: completed
                ? '#00ff88'
                : current
                  ? 'var(--color-primary)'
                  : 'rgba(255,255,255,0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              {completed ? '✓' : current ? '▶' : '○'} CH.{ch.id} — {ch.title}
            </span>
            <span
              style={{
                fontSize: '0.6rem',
                color: 'rgba(255,255,255,0.3)',
                flexShrink: 0,
                marginLeft: 8,
              }}
            >
              {completed && progress.branchChoices[String(ch.id)]
                ? `[${progress.branchChoices[String(ch.id)]}]`
                : !completed
                  ? `Q${ch.minQDist}`
                  : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AlienRepTab() {
  const alienReps = useStore((s) => s.alienReputations);
  const humanityReps = useStore((s) => s.humanityReps);

  useEffect(() => {
    network.requestHumanityReps();
  }, []);

  const TIER_COLORS = {
    FREUNDLICH: '#00FF88',
    NEUTRAL: 'var(--color-primary)',
    FEINDSELIG: '#FF3333',
  };

  const FACTION_LABELS: Record<string, string> = {
    archivists: 'Archivists',
    kthari: "K'thari",
    mycelians: 'Mycelians',
    consortium: 'Consortium',
    tourist_guild: 'Tourist Guild',
    scrappers: 'Scrappers',
    mirror_minds: 'Mirror Minds',
    silent_swarm: 'Silent Swarm',
    helions: 'Helions',
    axioms: 'Axioms',
  };

  return (
    <div style={{ padding: '8px', fontSize: '0.75rem', overflowY: 'auto', height: '100%' }}>
      {/* Personal alien rep */}
      <div style={{ opacity: 0.6, marginBottom: '4px', letterSpacing: '0.1em' }}>
        MY ALIEN REPUTATIONS
      </div>
      {Object.entries(FACTION_LABELS).map(([id, label]) => {
        const rep = alienReps[id] ?? 0;
        return (
          <div key={id} style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
            <span style={{ width: '100px', opacity: 0.7 }}>{label}</span>
            <span style={{ color: rep >= 0 ? 'var(--color-primary)' : '#FF3333' }}>
              {rep >= 0 ? '+' : ''}
              {rep}
            </span>
          </div>
        );
      })}

      {/* Humanity rep */}
      <div style={{ opacity: 0.6, marginBottom: '4px', marginTop: '12px', letterSpacing: '0.1em' }}>
        GALACTIC HUMANITY REP
      </div>
      {Object.entries(FACTION_LABELS).map(([id, label]) => {
        const entry = humanityReps[id];
        if (!entry)
          return (
            <div
              key={id}
              style={{ display: 'flex', gap: '8px', marginBottom: '2px', opacity: 0.4 }}
            >
              <span style={{ width: '100px' }}>{label}</span>
              <span>0 — NEUTRAL</span>
            </div>
          );
        const color = TIER_COLORS[entry.tier as keyof typeof TIER_COLORS] ?? 'var(--color-primary)';
        return (
          <div key={id} style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
            <span style={{ width: '100px', opacity: 0.7 }}>{label}</span>
            <span style={{ color }}>
              {entry.repValue >= 0 ? '+' : ''}
              {entry.repValue} — {entry.tier}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CommunityTab() {
  const quest = useStore((s) => s.activeCommunityQuest);

  useEffect(() => {
    network.requestActiveCommunityQuest();
  }, []);

  if (!quest) {
    return (
      <div style={{ color: 'var(--color-dim)', fontSize: '0.7rem', padding: 8 }}>
        {UI.empty.NO_COMMUNITY_QUEST}
      </div>
    );
  }

  const pct = Math.min(((quest.currentCount ?? 0) / (quest.targetCount ?? 1)) * 100, 100);
  const deadline = quest.expiresAt ? new Date(quest.expiresAt).toLocaleDateString() : '—';

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: 8 }}>
      <div style={{ color: 'var(--color-primary)', marginBottom: 8, letterSpacing: '0.1em' }}>
        {quest.title}
      </div>
      <div
        style={{
          color: 'var(--color-dim)',
          marginBottom: 12,
          lineHeight: 1.5,
          fontSize: '0.65rem',
        }}
      >
        {quest.description}
      </div>
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 4,
            fontSize: '0.65rem',
          }}
        >
          <span style={{ color: 'var(--color-dim)' }}>{UI.status.PROGRESS}</span>
          <span style={{ color: 'var(--color-primary)' }}>
            {(quest.currentCount ?? 0).toLocaleString()} / {(quest.targetCount ?? 0).toLocaleString()}
          </span>
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.1)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)' }} />
        </div>
      </div>
      <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>{UI.status.DEADLINE}: {deadline}</div>
    </div>
  );
}

export function QuestsScreen() {
  const activeQuests = useStore((s) => s.activeQuests);
  const reputations = useStore((s) => s.reputations);
  const playerUpgrades = useStore((s) => s.playerUpgrades);
  const scanEvents = useStore((s) => s.scanEvents);
  const currentSector = useStore((s) => s.currentSector);
  const position = useStore((s) => s.position);
  const discoveries = useStore((s) => s.discoveries);
  const distressCalls = useStore((s) => s.distressCalls);
  const rescuedSurvivors = useStore((s) => s.rescuedSurvivors);
  const navReturnProgram = useStore((s) => s.navReturnProgram);
  const setActiveProgram = useStore((s) => s.setActiveProgram);
  const clearNavReturn = useStore((s) => s.clearNavReturn);
  const { confirm, isArmed } = useConfirm();

  const [tab, setTab] = useState<'auftraege' | 'verfuegbar' | 'reputation' | 'story'>('auftraege');
  const [subFilter, setSubFilter] = useState<'all' | 'rescue'>('all');
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
    auftraege: 'AUFTRÄGE',
    verfuegbar: 'VERFÜGBAR',
    reputation: 'REPUTATION',
    story: 'STORY',
  };

  return (
    <div style={{ padding: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
      {navReturnProgram && (
        <button
          className="vs-btn"
          style={{ fontSize: '0.7rem', marginBottom: 8 }}
          onClick={() => {
            setActiveProgram(navReturnProgram);
            clearNavReturn();
          }}
        >
          [← BACK]
        </button>
      )}
      {/* Tab bar */}
      <div style={{ display: 'flex', width: '100%', flexWrap: 'nowrap', marginBottom: '8px' }}>
        {(['auftraege', 'verfuegbar', 'reputation', 'story'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === 'verfuegbar' && isAtStation) {
                network.requestStationNpcs(position.x, position.y);
              }
            }}
            style={{
              width: '25%',
              textAlign: 'center',
              flexShrink: 0,
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

      {/* AUFTRÄGE tab: active quests + journal + rescue */}
      {tab === 'auftraege' && (
        <div>
          {/* Sub-filter toggle */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', fontSize: '0.7rem' }}>
            <button
              onClick={() => setSubFilter('all')}
              style={{
                border: `1px solid ${subFilter === 'all' ? 'var(--color-primary)' : '#333'}`,
                background: subFilter === 'all' ? '#001100' : 'none',
                color: subFilter === 'all' ? 'var(--color-primary)' : '#555',
                padding: '2px 6px',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              [ALLE]
            </button>
            <button
              onClick={() => setSubFilter('rescue')}
              style={{
                border: `1px solid ${subFilter === 'rescue' ? 'var(--color-primary)' : '#333'}`,
                background: subFilter === 'rescue' ? '#001100' : 'none',
                color: subFilter === 'rescue' ? 'var(--color-primary)' : '#555',
                padding: '2px 6px',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              [RETTUNG]
            </button>
          </div>

          {subFilter === 'all' && (
            <>
              {/* Active quests — Journal format */}
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
                        {hasTarget && (
                          <span style={{ color: 'rgba(255,176,0,0.5)', fontSize: '9px' }}> ◎</span>
                        )}
                      </span>
                      <span style={{ color: 'rgba(255,176,0,0.4)', fontSize: '9px' }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>

                    {/* Expanded journal entry */}
                    {isExpanded && (
                      <div
                        style={{ padding: '4px 6px', borderTop: '1px solid rgba(255,176,0,0.2)' }}
                      >
                        <div
                          style={{
                            color: 'rgba(255,176,0,0.6)',
                            fontSize: '10px',
                            marginBottom: '4px',
                          }}
                        >
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
                                {' '}
                                ({obj.progress}/{obj.amount})
                              </span>
                            )}
                            {obj.targetX != null && obj.targetY != null && !obj.fulfilled && (
                              <span style={{ color: 'rgba(255,176,0,0.4)' }}>
                                {' '}
                                → ({innerCoord(obj.targetX)}, {innerCoord(obj.targetY)})
                              </span>
                            )}
                          </div>
                        ))}
                        <div
                          style={{
                            color: 'rgba(255,176,0,0.4)',
                            fontSize: '9px',
                            marginTop: '4px',
                          }}
                        >
                          BELOHNUNG: +{q.rewards.credits} CR | +{q.rewards.xp} XP
                          {q.rewards.reputation > 0 && ` | +${q.rewards.reputation} REP`}
                        </div>
                        <button
                          className="vs-btn"
                          onClick={() => confirm(`abandon-${q.id}`, () => network.sendAbandonQuest(q.id))}
                          style={isArmed(`abandon-${q.id}`) ? { borderColor: '#ff4444', color: '#ff4444' } : undefined}
                        >
                          {isArmed(`abandon-${q.id}`)
                            ? btnDisabled(UI.actions.ABANDON, 'SURE?')
                            : btn(UI.actions.ABANDON)}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Journal filter panel */}
              <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,176,0,0.15)', paddingTop: '8px' }}>
                <JournalTab />
              </div>
            </>
          )}

          {subFilter === 'rescue' && (
            <div>
              <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- RETTUNG ---</div>

              {/* Active distress calls */}
              {distressCalls.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ color: '#FF3333', marginBottom: '4px' }}>AKTIVE NOTRUFE:</div>
                  {distressCalls.map((call) => {
                    const minutesLeft = Math.max(
                      0,
                      Math.ceil((call.expiresAt - Date.now()) / 60000),
                    );
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
      )}

      {/* VERFÜGBAR tab: station + community + events */}
      {tab === 'verfuegbar' && (
        <div>
          {/* Station quests */}
          <div style={{ color: '#FFB000', marginBottom: '4px' }}>--- STATION ---</div>
          {!isAtStation && (() => {
            const nearest = findNearestStation(position, discoveries);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', fontFamily: 'monospace', color: '#555', marginBottom: '8px' }}>
                <div>NO QUESTS AVAILABLE</div>
                <div style={{ fontSize: '0.7rem' }}>Dock at a station to find missions.</div>
                {nearest && <div style={{ fontSize: '0.7rem' }}>Nearest: ({nearest.x}, {nearest.y})</div>}
              </div>
            );
          })()}
          {isAtStation && stationNpcs.length === 0 && (
            <div style={{ color: 'rgba(255,176,0,0.5)' }}>{UI.status.LOADING}</div>
          )}
          {stationNpcs.map((npc) => (
            <div key={npc.id} style={{ color: '#00FF88', marginBottom: '2px' }}>
              {npc.name} [{npc.factionId.toUpperCase()}]
            </div>
          ))}
          {availableQuests.length > 0 && (
            <>
              <div style={{ color: '#FFB000', marginTop: '8px', marginBottom: '4px' }}>
                AVAILABLE QUESTS:
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
                    {btn(UI.actions.ACCEPT)}
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Community quest */}
          <div
            style={{
              borderTop: '1px solid #222',
              marginTop: '8px',
              paddingTop: '8px',
            }}
          >
            <CommunityTab />
          </div>

          {/* Scan events */}
          <div
            style={{
              borderTop: '1px solid #222',
              marginTop: '8px',
              paddingTop: '8px',
            }}
          >
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
        </div>
      )}

      {/* REPUTATION tab: faction rep + alien rep */}
      {tab === 'reputation' && (
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
          <div style={{ borderTop: '1px solid #222', marginTop: '8px', paddingTop: '8px' }}>
            <AlienRepTab />
          </div>
        </div>
      )}

      {/* STORY tab */}
      {tab === 'story' && <StoryTab />}
    </div>
  );
}
