import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';
import { MODULE_DEFINITIONS } from '@void-sector/shared';
import { RESEARCH_DEFINITIONS } from '@void-sector/shared';

const BRANCH_CONFIG = [
  { id: 'engines', label: 'ENGINES', subtitle: "That's what moves you", color: '#FFB000' },
  { id: 'generators', label: 'GENERATORS', subtitle: "That's what powers you", color: '#FFB000' },
  { id: 'mining', label: 'MINING', subtitle: "That's what fills your cargo", color: '#00FF66' },
  { id: 'cargo', label: 'CARGO', subtitle: "That's what holds your stuff", color: '#00FF66' },
  { id: 'scanner', label: 'SCANNER', subtitle: "That's what reveals the unknown", color: '#00BFFF' },
  { id: 'repair', label: 'REPAIR', subtitle: "That's what keeps you alive", color: '#00BFFF' },
  { id: 'armor', label: 'ARMOR', subtitle: "That's what takes the hits", color: '#FF8800' },
  { id: 'shields', label: 'SHIELDS', subtitle: "That's what deflects energy", color: '#FF8800' },
  { id: 'weapon_energy', label: 'ENERGY WEAPONS', subtitle: 'Puls-Laser', color: '#FF3333' },
  { id: 'weapon_kinetic', label: 'KINETIC WEAPONS', subtitle: 'Rail-Kanone', color: '#FF3333' },
  { id: 'weapon_missile', label: 'MISSILE WEAPONS', subtitle: 'Raketen-Pod', color: '#FF3333' },
  { id: 'defense_pv', label: 'POINT DEFENSE', subtitle: 'Punkt-Verteidigung', color: '#AA88FF' },
  { id: 'defense_ecm', label: 'ECM', subtitle: 'Electronic Counter Measures', color: '#AA88FF' },
];

const CATEGORY_MAP: Record<string, string[]> = {
  engines: ['drive'],
  generators: ['generator'],
  mining: ['mining'],
  cargo: ['cargo'],
  scanner: ['scanner'],
  repair: ['repair'],
  armor: ['armor'],
  shields: ['shield'],
  weapon_energy: ['weapon_energy'],
  weapon_kinetic: ['weapon_kinetic'],
  weapon_missile: ['weapon_missile'],
  defense_pv: ['defense_pv'],
  defense_ecm: ['defense_ecm'],
};

export function TechTreeScreen() {
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const playerResearch = useStore((s) => s.playerResearch);
  const wissen = useStore((s) => s.research.wissen ?? 0);

  useEffect(() => {
    network.requestPlayerResearch();
  }, []);

  function getModulesForBranch(branchId: string) {
    const cats = CATEGORY_MAP[branchId] ?? [];
    return MODULE_DEFINITIONS
      .filter((m) => cats.includes(m.category) && !m.isFoundOnly)
      .sort((a, b) => a.tier - b.tier);
  }

  function getResearchForBranch(branchId: string) {
    return RESEARCH_DEFINITIONS.filter((r) => r.branch === branchId);
  }

  function getNodeStatus(
    nodeId: string,
    prereqModuleId?: string,
    prereqResearchId?: string,
  ): 'researched' | 'available' | 'locked' {
    if (playerResearch.includes(nodeId)) return 'researched';
    if (prereqModuleId && !playerResearch.includes(prereqModuleId)) return 'locked';
    if (prereqResearchId && !playerResearch.includes(prereqResearchId)) return 'locked';
    return 'available';
  }

  function handleResearch(nodeId: string) {
    network.sendResearchNode(nodeId);
  }

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sticky header with Wissen display */}
      <div style={{
        padding: '8px 8px 6px', borderBottom: '1px solid rgba(255,176,0,0.2)',
        background: '#080808', flexShrink: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: 'var(--color-primary)', letterSpacing: '0.2em' }}>TECH TREE</span>
        <span style={{
          color: wissen >= 10 ? '#00FF88' : '#FF4444',
          fontSize: '0.75rem', fontWeight: 'bold',
          border: `1px solid ${wissen >= 10 ? 'rgba(0,255,136,0.3)' : 'rgba(255,68,68,0.3)'}`,
          padding: '2px 8px',
        }}>
          WISSEN: {wissen}
        </span>
      </div>
      {/* Scrollable branch list */}
      <div style={{ padding: '8px', overflowY: 'auto', flex: 1 }}>

      {BRANCH_CONFIG.map((branch) => {
        const isExpanded = expandedBranch === branch.id;
        const modules = getModulesForBranch(branch.id);
        const researches = getResearchForBranch(branch.id);

        const foundOnlyModules = MODULE_DEFINITIONS.filter((m) => {
          const cats = CATEGORY_MAP[branch.id] ?? [];
          return m.isFoundOnly && cats.includes(m.category);
        });

        return (
          <div key={branch.id} style={{ marginBottom: 4 }}>
            {/* Branch header — clickable */}
            <button
              onClick={() => setExpandedBranch(isExpanded ? null : branch.id)}
              style={{
                width: '100%', textAlign: 'left', background: 'none',
                border: `1px solid ${isExpanded ? branch.color : 'rgba(255,176,0,0.2)'}`,
                borderLeft: `3px solid ${branch.color}`,
                color: branch.color, fontFamily: 'inherit', fontSize: '0.65rem',
                padding: '4px 8px', cursor: 'pointer',
              }}
            >
              {isExpanded ? '▼' : '▶'} {branch.label}
              <span style={{ color: 'var(--color-dim)', marginLeft: 8, fontSize: '0.55rem' }}>{branch.subtitle}</span>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ padding: '6px 8px', borderLeft: `3px solid ${branch.color}`, background: 'rgba(255,255,255,0.02)' }}>
                {/* Main path — horizontal chain */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {modules.map((mod, i) => {
                    const status = getNodeStatus(mod.id, mod.prerequisiteModuleId);
                    const bgColor = status === 'researched' ? 'rgba(0,255,136,0.1)' : status === 'available' ? 'rgba(255,176,0,0.1)' : 'transparent';
                    const borderColor = status === 'researched' ? '#00FF88' : status === 'available' ? '#FFB000' : '#333';
                    return (
                      <div key={mod.id} style={{ display: 'flex', alignItems: 'center' }}>
                        <button
                          onClick={() => status === 'available' && handleResearch(mod.id)}
                          disabled={status !== 'available'}
                          style={{
                            background: bgColor, border: `1px solid ${borderColor}`,
                            color: status === 'locked' ? '#555' : branch.color,
                            fontFamily: 'inherit', fontSize: '0.6rem', padding: '3px 6px',
                            cursor: status === 'available' ? 'pointer' : 'default', minWidth: 80,
                          }}
                          title={`${mod.name} (T${mod.tier}) — ${status === 'available' ? '10 Wissen' : status}`}
                        >
                          T{mod.tier} {mod.name.split(' ').pop()}
                        </button>
                        {i < modules.length - 1 && <span style={{ color: '#333', margin: '0 2px' }}>→</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Research nodes */}
                {researches.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,176,0,0.1)', paddingTop: 4 }}>
                    <div style={{ color: 'var(--color-dim)', fontSize: '0.55rem', marginBottom: 3, letterSpacing: '0.1em' }}>FORSCHUNGEN:</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {researches.map((r) => {
                        const status = getNodeStatus(r.id, r.prerequisiteModuleId, r.prerequisiteResearchId);
                        return (
                          <button
                            key={r.id}
                            onClick={() => status === 'available' && handleResearch(r.id)}
                            disabled={status !== 'available'}
                            style={{
                              background: status === 'researched' ? 'rgba(0,255,136,0.1)' : 'transparent',
                              border: `1px solid ${status === 'researched' ? '#00FF88' : status === 'available' ? '#FFB000' : '#333'}`,
                              color: status === 'locked' ? '#555' : status === 'researched' ? '#00FF88' : '#FFB000',
                              fontFamily: 'inherit', fontSize: '0.55rem', padding: '2px 6px',
                              cursor: status === 'available' ? 'pointer' : 'default',
                            }}
                            title={`${r.name}: ${r.description} (10 Wissen)`}
                          >
                            {status === 'researched' ? '✓ ' : ''}{r.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Found-only hint */}
                {foundOnlyModules.length > 0 && (
                  <div style={{ color: '#FF4444', fontSize: '0.5rem', marginTop: 4, opacity: 0.7 }}>
                    + Found-Only Module (nicht erforschbar, nur im Weltraum findbar)
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
