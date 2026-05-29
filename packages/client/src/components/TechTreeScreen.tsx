import { MODULE_DEFINITIONS, getMaxTier, getResearchCost, isModuleUnlocked } from '@void-sector/shared';
import { useEffect } from 'react';
import { useStore } from '../state/store';
import { network } from '../network/client';

const CATEGORIES = [...new Set(MODULE_DEFINITIONS.map((m) => m.category))];

export function TechTreeScreen() {
  const categoryTiers = useStore((s) => s.categoryTiers);
  const blueprints = useStore((s) => s.research?.blueprints ?? []);
  const wissen = useStore((s) => s.research?.wissen ?? 0);
  useEffect(() => {
    network.requestCategoryTech();
    useStore.getState().showTip('first_tech_tree');
  }, []);
  return (
    <div data-testid="tech-tree" style={{ padding: 12, fontFamily: 'var(--font-mono)', overflowY: 'auto', height: '100%' }}>
      <div style={{
        padding: '8px 8px 6px', borderBottom: '1px solid rgba(255,176,0,0.2)',
        background: '#080808', marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ color: 'var(--color-primary)', letterSpacing: '0.2em' }}>TECH TREE</span>
        <span style={{
          color: wissen >= 15 ? '#00FF88' : '#FF4444',
          fontSize: '0.75rem', fontWeight: 'bold',
          border: `1px solid ${wissen >= 15 ? 'rgba(0,255,136,0.3)' : 'rgba(255,68,68,0.3)'}`,
          padding: '2px 8px',
        }}>
          WISSEN: {wissen}
        </span>
      </div>
      {CATEGORIES.map((cat) => {
        const max = getMaxTier(cat);
        if (max <= 1) return null;
        const tier = categoryTiers[cat] ?? 1;
        const nextCost = getResearchCost(tier + 1);
        const canResearch = tier < max && wissen >= nextCost;
        return (
          <div key={cat} data-testid={`track-${cat}`} style={{ marginBottom: 10, borderBottom: '1px solid #234', paddingBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-primary)' }}>{cat.toUpperCase()} — TIER {tier}/{max}</span>
              {tier < max && (
                <button data-testid={`research-${cat}`} disabled={!canResearch}
                  onClick={() => network.sendResearchCategoryTier(cat)}
                  style={{ opacity: canResearch ? 1 : 0.4, fontFamily: 'inherit', fontSize: '0.65rem', cursor: canResearch ? 'pointer' : 'not-allowed' }}>
                  [FORSCHEN T{tier + 1} — {nextCost} W]
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {MODULE_DEFINITIONS.filter((m) => m.category === cat).map((m) => {
                const unlocked = isModuleUnlocked(m.id, categoryTiers, blueprints);
                return <span key={m.id} style={{ fontSize: '0.6rem', color: unlocked ? '#4a9' : '#555' }}>{m.name}{unlocked ? '' : ' 🔒'}</span>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
