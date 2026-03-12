# Tech Tree Rework Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the linear module research system with a star-shaped tech tree featuring 4 branches (KAMPF, AUSBAU, INTEL, EXPLORER), exclusive choices, active Wissen generation, and a new Canvas UI.

**Architecture:** Static tree config in shared package defines all 148 nodes. Server validates research/reset via new TechTreeService. Wissen is earned actively through gameplay (mining, scanning, combat, exploration) with research lab multiplier. New radial TechTreeCanvas replaces old 8×5 grid. Old research handlers (startResearch, cancelResearch, claimResearch) and passive Wissen tick removed.

**Tech Stack:** TypeScript (shared/server/client), PostgreSQL (migration 059), Vitest (TDD), Canvas 2D (UI), Colyseus messages

**Spec:** `docs/superpowers/specs/2026-03-12-tech-tree-rework-design.md`

---

## Chunk 1: Shared Types, Config & Engine

### Task 1: Tech Tree Node Types & Config (shared)

**Files:**
- Create: `packages/shared/src/techTree.ts`
- Modify: `packages/shared/src/index.ts` (add export)

- [ ] **Step 1: Write failing test for tree config**

Create `packages/shared/src/__tests__/techTree.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  TECH_TREE_NODES,
  getTechNode,
  getChildNodes,
  getExclusiveGroup,
  TechNodeType,
} from '../techTree';

describe('TECH_TREE_NODES', () => {
  it('has 4 root branches with parent null', () => {
    const roots = Object.values(TECH_TREE_NODES).filter((n) => n.parent === null);
    expect(roots).toHaveLength(4);
    expect(roots.map((r) => r.id).sort()).toEqual(['ausbau', 'explorer', 'intel', 'kampf']);
  });

  it('all nodes have valid parent references', () => {
    for (const node of Object.values(TECH_TREE_NODES)) {
      if (node.parent !== null) {
        expect(TECH_TREE_NODES[node.parent]).toBeDefined();
      }
    }
  });

  it('exclusive groups have 2+ members', () => {
    const groups = new Map<string, string[]>();
    for (const node of Object.values(TECH_TREE_NODES)) {
      if (node.exclusiveGroup) {
        const arr = groups.get(node.exclusiveGroup) ?? [];
        arr.push(node.id);
        groups.set(node.exclusiveGroup, arr);
      }
    }
    for (const [group, members] of groups) {
      expect(members.length, `group ${group}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('has exactly 148 nodes total', () => {
    expect(Object.keys(TECH_TREE_NODES).length).toBe(148);
  });

  it('spec-leaves have depth 3 (one deeper than module-leaves)', () => {
    const specLeaves = Object.values(TECH_TREE_NODES).filter(
      (n) => n.type === 'leaf' && TECH_TREE_NODES[n.parent!]?.type === 'specialization',
    );
    expect(specLeaves.length).toBe(72);
    for (const sl of specLeaves) {
      expect(sl.depth, `${sl.id} depth`).toBe(3);
    }
  });
});

describe('getTechNode', () => {
  it('returns node by id', () => {
    const node = getTechNode('kampf');
    expect(node).toBeDefined();
    expect(node!.type).toBe('branch');
    expect(node!.branch).toBe('kampf');
  });

  it('returns undefined for invalid id', () => {
    expect(getTechNode('nonexistent')).toBeUndefined();
  });
});

describe('getChildNodes', () => {
  it('returns children of kampf branch', () => {
    const children = getChildNodes('kampf');
    expect(children.map((c) => c.id).sort()).toEqual([
      'kampf.laser',
      'kampf.missile',
      'kampf.railgun',
    ]);
  });
});

describe('getExclusiveGroup', () => {
  it('laser/missile/railgun share exclusive group', () => {
    const laserGroup = getExclusiveGroup('kampf.laser');
    const missileGroup = getExclusiveGroup('kampf.missile');
    expect(laserGroup).toBe(missileGroup);
    expect(laserGroup).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/__tests__/techTree.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement techTree.ts with types and full config**

Create `packages/shared/src/techTree.ts`:

```typescript
export type TechBranch = 'kampf' | 'ausbau' | 'intel' | 'explorer';
export type TechNodeType = 'branch' | 'module' | 'specialization' | 'leaf';

export type TechStatKey =
  | 'weapon_damage' | 'weapon_range' | 'weapon_efficiency'
  | 'shield_strength' | 'shield_regen' | 'shield_efficiency'
  | 'cargo_capacity' | 'cargo_weight' | 'cargo_protection'
  | 'mining_yield' | 'mining_speed' | 'mining_range'
  | 'scan_range' | 'scan_detail' | 'scan_speed'
  | 'sensor_precision' | 'sensor_stealth' | 'sensor_range'
  | 'lab_wissen_rate' | 'lab_efficiency' | 'lab_capacity'
  | 'drive_ap_efficiency' | 'drive_speed' | 'drive_jump_range'
  | 'fuel_capacity' | 'fuel_consumption' | 'fuel_regen'
  | 'nav_autopilot' | 'nav_route_efficiency' | 'nav_discovery';

export interface TechEffect {
  type: 'unlock_tier' | 'stat_bonus';
  /** For unlock_tier: module category. For stat_bonus: stat key */
  target: string;
  /** For unlock_tier: tier number. For stat_bonus: bonus value (decimal, e.g. 0.15 = +15%) */
  value: number;
  /** Optional penalty for stat_bonus */
  penalty?: { target: TechStatKey; value: number };
}

export interface TechTreeNode {
  id: string;
  type: TechNodeType;
  name: string;
  description: string;
  parent: string | null;
  exclusiveGroup?: string;
  maxLevel: number;
  baseCost: number;
  costPerLevel?: number[];  // for branch/leaf with maxLevel > 1
  effects: TechEffect[];
  branch: TechBranch;
  depth: number;
}

// --- Helpers ---

function branch(id: string, name: string, desc: string, b: TechBranch): TechTreeNode {
  return {
    id, type: 'branch', name, description: desc, parent: null,
    maxLevel: 3, baseCost: 150, costPerLevel: [150, 450, 1350],
    effects: [{ type: 'unlock_tier', target: b, value: 2 }], // level 1 unlocks tier 2, etc.
    branch: b, depth: 0,
  };
}

function mod(id: string, name: string, desc: string, parentId: string, b: TechBranch, group: string, effects: TechEffect[]): TechTreeNode {
  return {
    id, type: 'module', name, description: desc, parent: parentId,
    exclusiveGroup: group, maxLevel: 1, baseCost: 280, effects, branch: b, depth: 1,
  };
}

function spec(id: string, name: string, desc: string, parentId: string, b: TechBranch, group: string, effects: TechEffect[]): TechTreeNode {
  return {
    id, type: 'specialization', name, description: desc, parent: parentId,
    exclusiveGroup: group, maxLevel: 1, baseCost: 620, effects, branch: b, depth: 2,
  };
}

/** Depth is auto-computed: module-leaf → depth 2, spec-leaf → depth 3 */
function leaf(id: string, name: string, desc: string, parentId: string, b: TechBranch, group: string, stat: TechStatKey, value: number, penalty?: { target: TechStatKey; value: number }): TechTreeNode {
  const eff: TechEffect = { type: 'stat_bonus', target: stat, value };
  if (penalty) eff.penalty = penalty;
  // depth derived later from parent after all nodes are built
  return {
    id, type: 'leaf', name, description: desc, parent: parentId,
    exclusiveGroup: group, maxLevel: 3, baseCost: 180, costPerLevel: [180, 540, 1620],
    effects: [eff], branch: b, depth: -1,  // placeholder, computed below
  };
}

// --- Full Tree Definition ---

const nodes: TechTreeNode[] = [
  // ===== KAMPF =====
  branch('kampf', 'KAMPF', 'Waffensysteme und Kampftechnologie.', 'kampf'),

  mod('kampf.laser', 'LASER', 'Präzisionswaffe mit hoher Reichweite und niedrigem Energieverbrauch.', 'kampf', 'kampf', 'kampf.weapons', []),
  mod('kampf.missile', 'MISSILE', 'Raketensysteme mit hohem Burst-Schaden. Begrenzte Munition.', 'kampf', 'kampf', 'kampf.weapons', []),
  mod('kampf.railgun', 'RAILGUN', 'Elektromagnetische Massegeschosse. Extrem hoher Einzelschaden.', 'kampf', 'kampf', 'kampf.weapons', []),

  leaf('kampf.laser.dmg', 'SCHADEN', 'Erhöhter Laser-Schaden.', 'kampf.laser', 'kampf', 'kampf.laser.leaves', 'weapon_damage', 0.15, { target: 'weapon_efficiency', value: -0.05 }),
  leaf('kampf.laser.range', 'REICHWEITE', 'Erhöhte Laser-Reichweite.', 'kampf.laser', 'kampf', 'kampf.laser.leaves', 'weapon_range', 0.20, { target: 'weapon_damage', value: -0.05 }),
  leaf('kampf.laser.eff', 'ENERGIEEFFIZIENZ', 'Reduzierter Energieverbrauch.', 'kampf.laser', 'kampf', 'kampf.laser.leaves', 'weapon_efficiency', 0.15, { target: 'weapon_damage', value: -0.10 }),

  spec('kampf.laser.phaser', 'PHASER', 'Phasenstrahlen durchdringen Schilde teilweise.', 'kampf.laser', 'kampf', 'kampf.laser.specs', [{ type: 'stat_bonus', target: 'weapon_damage', value: -0.20 }]),
  spec('kampf.laser.impulse', 'IMPULSLASER', 'Kurze hochenergetische Impulse. Burst-DPS.', 'kampf.laser', 'kampf', 'kampf.laser.specs', [{ type: 'stat_bonus', target: 'weapon_efficiency', value: -0.20 }]),

  // Repeat pattern for missile and railgun (abbreviated — full list in implementation)
  leaf('kampf.missile.dmg', 'SCHADEN', 'Erhöhter Raketenschaden.', 'kampf.missile', 'kampf', 'kampf.missile.leaves', 'weapon_damage', 0.15),
  leaf('kampf.missile.range', 'REICHWEITE', 'Erhöhte Raketenreichweite.', 'kampf.missile', 'kampf', 'kampf.missile.leaves', 'weapon_range', 0.20),
  leaf('kampf.missile.eff', 'ENERGIEEFFIZIENZ', 'Reduzierter Munitionsverbrauch.', 'kampf.missile', 'kampf', 'kampf.missile.leaves', 'weapon_efficiency', 0.15),
  spec('kampf.missile.antimatter', 'ANTI-MATTER', 'Anti-Materie-Sprengkopf. Maximaler Einzelzielschaden.', 'kampf.missile', 'kampf', 'kampf.missile.specs', []),
  spec('kampf.missile.swarm', 'MISSILE SWARM', 'Schwarm kleiner Raketen. Flächenschaden.', 'kampf.missile', 'kampf', 'kampf.missile.specs', []),

  leaf('kampf.railgun.dmg', 'SCHADEN', 'Erhöhter Railgun-Schaden.', 'kampf.railgun', 'kampf', 'kampf.railgun.leaves', 'weapon_damage', 0.15),
  leaf('kampf.railgun.range', 'REICHWEITE', 'Erhöhte Railgun-Reichweite.', 'kampf.railgun', 'kampf', 'kampf.railgun.leaves', 'weapon_range', 0.20),
  leaf('kampf.railgun.eff', 'ENERGIEEFFIZIENZ', 'Reduzierter Energieverbrauch.', 'kampf.railgun', 'kampf', 'kampf.railgun.leaves', 'weapon_efficiency', 0.15),
  spec('kampf.railgun.power', 'POWERGUN', 'Maximale Durchschlagskraft. Panzerungsignorierung.', 'kampf.railgun', 'kampf', 'kampf.railgun.specs', []),
  spec('kampf.railgun.multi', 'MULTI GUN', 'Schnellfeuer-Railgun. Geringerer Einzelschaden.', 'kampf.railgun', 'kampf', 'kampf.railgun.specs', []),

  // --- KAMPF spec-leaves (3 per specialization × 6 specs = 18) ---
  leaf('kampf.laser.phaser.dmg', 'SCHADEN', 'Phaser-Schaden.', 'kampf.laser.phaser', 'kampf', 'kampf.laser.phaser.leaves', 'weapon_damage', 0.15),
  leaf('kampf.laser.phaser.range', 'REICHWEITE', 'Phaser-Reichweite.', 'kampf.laser.phaser', 'kampf', 'kampf.laser.phaser.leaves', 'weapon_range', 0.20),
  leaf('kampf.laser.phaser.eff', 'ENERGIEEFFIZIENZ', 'Phaser-Effizienz.', 'kampf.laser.phaser', 'kampf', 'kampf.laser.phaser.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.laser.impulse.dmg', 'SCHADEN', 'Impulslaser-Schaden.', 'kampf.laser.impulse', 'kampf', 'kampf.laser.impulse.leaves', 'weapon_damage', 0.15),
  leaf('kampf.laser.impulse.range', 'REICHWEITE', 'Impulslaser-Reichweite.', 'kampf.laser.impulse', 'kampf', 'kampf.laser.impulse.leaves', 'weapon_range', 0.20),
  leaf('kampf.laser.impulse.eff', 'ENERGIEEFFIZIENZ', 'Impulslaser-Effizienz.', 'kampf.laser.impulse', 'kampf', 'kampf.laser.impulse.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.missile.antimatter.dmg', 'SCHADEN', 'Anti-Matter-Schaden.', 'kampf.missile.antimatter', 'kampf', 'kampf.missile.antimatter.leaves', 'weapon_damage', 0.15),
  leaf('kampf.missile.antimatter.range', 'REICHWEITE', 'Anti-Matter-Reichweite.', 'kampf.missile.antimatter', 'kampf', 'kampf.missile.antimatter.leaves', 'weapon_range', 0.20),
  leaf('kampf.missile.antimatter.eff', 'ENERGIEEFFIZIENZ', 'Anti-Matter-Effizienz.', 'kampf.missile.antimatter', 'kampf', 'kampf.missile.antimatter.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.missile.swarm.dmg', 'SCHADEN', 'Schwarm-Schaden.', 'kampf.missile.swarm', 'kampf', 'kampf.missile.swarm.leaves', 'weapon_damage', 0.15),
  leaf('kampf.missile.swarm.range', 'REICHWEITE', 'Schwarm-Reichweite.', 'kampf.missile.swarm', 'kampf', 'kampf.missile.swarm.leaves', 'weapon_range', 0.20),
  leaf('kampf.missile.swarm.eff', 'ENERGIEEFFIZIENZ', 'Schwarm-Effizienz.', 'kampf.missile.swarm', 'kampf', 'kampf.missile.swarm.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.railgun.power.dmg', 'SCHADEN', 'Powergun-Schaden.', 'kampf.railgun.power', 'kampf', 'kampf.railgun.power.leaves', 'weapon_damage', 0.15),
  leaf('kampf.railgun.power.range', 'REICHWEITE', 'Powergun-Reichweite.', 'kampf.railgun.power', 'kampf', 'kampf.railgun.power.leaves', 'weapon_range', 0.20),
  leaf('kampf.railgun.power.eff', 'ENERGIEEFFIZIENZ', 'Powergun-Effizienz.', 'kampf.railgun.power', 'kampf', 'kampf.railgun.power.leaves', 'weapon_efficiency', 0.15),
  leaf('kampf.railgun.multi.dmg', 'SCHADEN', 'Multi-Gun-Schaden.', 'kampf.railgun.multi', 'kampf', 'kampf.railgun.multi.leaves', 'weapon_damage', 0.15),
  leaf('kampf.railgun.multi.range', 'REICHWEITE', 'Multi-Gun-Reichweite.', 'kampf.railgun.multi', 'kampf', 'kampf.railgun.multi.leaves', 'weapon_range', 0.20),
  leaf('kampf.railgun.multi.eff', 'ENERGIEEFFIZIENZ', 'Multi-Gun-Effizienz.', 'kampf.railgun.multi', 'kampf', 'kampf.railgun.multi.leaves', 'weapon_efficiency', 0.15),

  // ===== AUSBAU =====
  branch('ausbau', 'AUSBAU', 'Schiffsbau und Verteidigungssysteme.', 'ausbau'),

  mod('ausbau.schild', 'SCHILD', 'Fortschrittliche Schildsysteme.', 'ausbau', 'ausbau', 'ausbau.modules', []),
  mod('ausbau.cargo', 'CARGO', 'Frachtsysteme.', 'ausbau', 'ausbau', 'ausbau.modules', []),
  mod('ausbau.mining', 'MINING', 'Abbausysteme.', 'ausbau', 'ausbau', 'ausbau.modules', []),

  leaf('ausbau.schild.str', 'STÄRKE', 'Erhöhte Schildstärke.', 'ausbau.schild', 'ausbau', 'ausbau.schild.leaves', 'shield_strength', 0.15),
  leaf('ausbau.schild.regen', 'REGENERATION', 'Schnellere Schildregeneration.', 'ausbau.schild', 'ausbau', 'ausbau.schild.leaves', 'shield_regen', 0.20),
  leaf('ausbau.schild.eff', 'EFFIZIENZ', 'Reduzierter Schild-Energieverbrauch.', 'ausbau.schild', 'ausbau', 'ausbau.schild.leaves', 'shield_efficiency', 0.15),
  spec('ausbau.schild.deflektor', 'DEFLEKTOR', 'Kinetische Ablenkung. Bonus gegen Projektile.', 'ausbau.schild', 'ausbau', 'ausbau.schild.specs', []),
  spec('ausbau.schild.energy', 'ENERGIESCHILD', 'Energiebarriere. Bonus gegen Energiewaffen.', 'ausbau.schild', 'ausbau', 'ausbau.schild.specs', []),

  leaf('ausbau.cargo.cap', 'KAPAZITÄT', 'Erhöhte Frachtkapazität.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.leaves', 'cargo_capacity', 0.15),
  leaf('ausbau.cargo.weight', 'GEWICHT', 'Reduziertes Frachtgewicht.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.leaves', 'cargo_weight', 0.15),
  leaf('ausbau.cargo.prot', 'SCHUTZ', 'Frachtschutz bei Kampf.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.leaves', 'cargo_protection', 0.20),
  spec('ausbau.cargo.smuggler', 'SCHMUGGLERFACH', 'Versteckter Frachtraum.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.specs', []),
  spec('ausbau.cargo.bulk', 'MASSENFRACHTER', 'Maximale Kapazität.', 'ausbau.cargo', 'ausbau', 'ausbau.cargo.specs', []),

  leaf('ausbau.mining.yield', 'AUSBEUTE', 'Erhöhte Mining-Ausbeute.', 'ausbau.mining', 'ausbau', 'ausbau.mining.leaves', 'mining_yield', 0.15),
  leaf('ausbau.mining.speed', 'GESCHWINDIGKEIT', 'Schnellerer Abbau.', 'ausbau.mining', 'ausbau', 'ausbau.mining.leaves', 'mining_speed', 0.20),
  leaf('ausbau.mining.range', 'REICHWEITE', 'Erhöhte Mining-Reichweite.', 'ausbau.mining', 'ausbau', 'ausbau.mining.leaves', 'mining_range', 0.15),
  spec('ausbau.mining.deep', 'TIEFBOHRER', 'Seltene Ressourcen. Kristall-Bonus.', 'ausbau.mining', 'ausbau', 'ausbau.mining.specs', []),
  spec('ausbau.mining.strip', 'STRIP-MINER', 'Massenabbau. Erz-Bonus.', 'ausbau.mining', 'ausbau', 'ausbau.mining.specs', []),

  // --- AUSBAU spec-leaves (18) ---
  leaf('ausbau.schild.deflektor.str', 'STÄRKE', 'Deflektor-Stärke.', 'ausbau.schild.deflektor', 'ausbau', 'ausbau.schild.deflektor.leaves', 'shield_strength', 0.15),
  leaf('ausbau.schild.deflektor.regen', 'REGENERATION', 'Deflektor-Regen.', 'ausbau.schild.deflektor', 'ausbau', 'ausbau.schild.deflektor.leaves', 'shield_regen', 0.20),
  leaf('ausbau.schild.deflektor.eff', 'EFFIZIENZ', 'Deflektor-Effizienz.', 'ausbau.schild.deflektor', 'ausbau', 'ausbau.schild.deflektor.leaves', 'shield_efficiency', 0.15),
  leaf('ausbau.schild.energy.str', 'STÄRKE', 'Energieschild-Stärke.', 'ausbau.schild.energy', 'ausbau', 'ausbau.schild.energy.leaves', 'shield_strength', 0.15),
  leaf('ausbau.schild.energy.regen', 'REGENERATION', 'Energieschild-Regen.', 'ausbau.schild.energy', 'ausbau', 'ausbau.schild.energy.leaves', 'shield_regen', 0.20),
  leaf('ausbau.schild.energy.eff', 'EFFIZIENZ', 'Energieschild-Effizienz.', 'ausbau.schild.energy', 'ausbau', 'ausbau.schild.energy.leaves', 'shield_efficiency', 0.15),
  leaf('ausbau.cargo.smuggler.cap', 'KAPAZITÄT', 'Schmugglerfach-Kapazität.', 'ausbau.cargo.smuggler', 'ausbau', 'ausbau.cargo.smuggler.leaves', 'cargo_capacity', 0.15),
  leaf('ausbau.cargo.smuggler.weight', 'GEWICHT', 'Schmugglerfach-Gewicht.', 'ausbau.cargo.smuggler', 'ausbau', 'ausbau.cargo.smuggler.leaves', 'cargo_weight', 0.15),
  leaf('ausbau.cargo.smuggler.prot', 'SCHUTZ', 'Schmugglerfach-Schutz.', 'ausbau.cargo.smuggler', 'ausbau', 'ausbau.cargo.smuggler.leaves', 'cargo_protection', 0.20),
  leaf('ausbau.cargo.bulk.cap', 'KAPAZITÄT', 'Massenfrachter-Kapazität.', 'ausbau.cargo.bulk', 'ausbau', 'ausbau.cargo.bulk.leaves', 'cargo_capacity', 0.15),
  leaf('ausbau.cargo.bulk.weight', 'GEWICHT', 'Massenfrachter-Gewicht.', 'ausbau.cargo.bulk', 'ausbau', 'ausbau.cargo.bulk.leaves', 'cargo_weight', 0.15),
  leaf('ausbau.cargo.bulk.prot', 'SCHUTZ', 'Massenfrachter-Schutz.', 'ausbau.cargo.bulk', 'ausbau', 'ausbau.cargo.bulk.leaves', 'cargo_protection', 0.20),
  leaf('ausbau.mining.deep.yield', 'AUSBEUTE', 'Tiefbohrer-Ausbeute.', 'ausbau.mining.deep', 'ausbau', 'ausbau.mining.deep.leaves', 'mining_yield', 0.15),
  leaf('ausbau.mining.deep.speed', 'GESCHWINDIGKEIT', 'Tiefbohrer-Speed.', 'ausbau.mining.deep', 'ausbau', 'ausbau.mining.deep.leaves', 'mining_speed', 0.20),
  leaf('ausbau.mining.deep.range', 'REICHWEITE', 'Tiefbohrer-Reichweite.', 'ausbau.mining.deep', 'ausbau', 'ausbau.mining.deep.leaves', 'mining_range', 0.15),
  leaf('ausbau.mining.strip.yield', 'AUSBEUTE', 'Strip-Miner-Ausbeute.', 'ausbau.mining.strip', 'ausbau', 'ausbau.mining.strip.leaves', 'mining_yield', 0.15),
  leaf('ausbau.mining.strip.speed', 'GESCHWINDIGKEIT', 'Strip-Miner-Speed.', 'ausbau.mining.strip', 'ausbau', 'ausbau.mining.strip.leaves', 'mining_speed', 0.20),
  leaf('ausbau.mining.strip.range', 'REICHWEITE', 'Strip-Miner-Reichweite.', 'ausbau.mining.strip', 'ausbau', 'ausbau.mining.strip.leaves', 'mining_range', 0.15),

  // ===== INTEL =====
  branch('intel', 'INTEL', 'Aufklärung und Informationsgewinnung.', 'intel'),

  mod('intel.scanner', 'SCANNER', 'Sektoranalyse und Entdeckung.', 'intel', 'intel', 'intel.modules', []),
  mod('intel.sensor', 'SENSOR', 'Echtzeiterfassung und Ortung.', 'intel', 'intel', 'intel.modules', []),
  mod('intel.labor', 'LABOR', 'Forschungseinrichtung.', 'intel', 'intel', 'intel.modules', []),

  leaf('intel.scanner.range', 'REICHWEITE', 'Erhöhte Scan-Reichweite.', 'intel.scanner', 'intel', 'intel.scanner.leaves', 'scan_range', 0.20),
  leaf('intel.scanner.detail', 'DETAILGRAD', 'Bessere Scan-Details.', 'intel.scanner', 'intel', 'intel.scanner.leaves', 'scan_detail', 0.15),
  leaf('intel.scanner.speed', 'SCANZEIT', 'Schnellere Scans.', 'intel.scanner', 'intel', 'intel.scanner.leaves', 'scan_speed', 0.20),
  spec('intel.scanner.deep', 'DEEP-SCANNER', 'Fernreichweiten-Scanner.', 'intel.scanner', 'intel', 'intel.scanner.specs', []),
  spec('intel.scanner.bio', 'BIO-SCANNER', 'Anomalien- und Lebenserkennung.', 'intel.scanner', 'intel', 'intel.scanner.specs', []),

  leaf('intel.sensor.prec', 'PRÄZISION', 'Erhöhte Sensorpräzision.', 'intel.sensor', 'intel', 'intel.sensor.leaves', 'sensor_precision', 0.15),
  leaf('intel.sensor.stealth', 'TARNENTDECKUNG', 'Erkennung getarnter Objekte.', 'intel.sensor', 'intel', 'intel.sensor.leaves', 'sensor_stealth', 0.20),
  leaf('intel.sensor.range', 'REICHWEITE', 'Erhöhte Sensor-Reichweite.', 'intel.sensor', 'intel', 'intel.sensor.leaves', 'sensor_range', 0.15),
  spec('intel.sensor.taktik', 'TAKTIK-ARRAY', 'Kampfinformationssystem.', 'intel.sensor', 'intel', 'intel.sensor.specs', []),
  spec('intel.sensor.survey', 'SURVEY-SONDE', 'Ressourcen-Kartierung.', 'intel.sensor', 'intel', 'intel.sensor.specs', []),

  leaf('intel.labor.rate', 'WISSEN-RATE', 'Erhöhte Wissen-Generierung.', 'intel.labor', 'intel', 'intel.labor.leaves', 'lab_wissen_rate', 0.20),
  leaf('intel.labor.eff', 'EFFIZIENZ', 'Labor-Effizienz.', 'intel.labor', 'intel', 'intel.labor.leaves', 'lab_efficiency', 0.15),
  leaf('intel.labor.cap', 'KAPAZITÄT', 'Labor-Kapazität.', 'intel.labor', 'intel', 'intel.labor.leaves', 'lab_capacity', 0.15),
  spec('intel.labor.forschung', 'FORSCHUNGSLAB', 'Wissen-Boost.', 'intel.labor', 'intel', 'intel.labor.specs', []),
  spec('intel.labor.analyse', 'ANALYSE-LAB', 'Artefakt-Analyse.', 'intel.labor', 'intel', 'intel.labor.specs', []),

  // --- INTEL spec-leaves (18) ---
  leaf('intel.scanner.deep.range', 'REICHWEITE', 'Deep-Scanner-Reichweite.', 'intel.scanner.deep', 'intel', 'intel.scanner.deep.leaves', 'scan_range', 0.20),
  leaf('intel.scanner.deep.detail', 'DETAILGRAD', 'Deep-Scanner-Details.', 'intel.scanner.deep', 'intel', 'intel.scanner.deep.leaves', 'scan_detail', 0.15),
  leaf('intel.scanner.deep.speed', 'SCANZEIT', 'Deep-Scanner-Speed.', 'intel.scanner.deep', 'intel', 'intel.scanner.deep.leaves', 'scan_speed', 0.20),
  leaf('intel.scanner.bio.range', 'REICHWEITE', 'Bio-Scanner-Reichweite.', 'intel.scanner.bio', 'intel', 'intel.scanner.bio.leaves', 'scan_range', 0.20),
  leaf('intel.scanner.bio.detail', 'DETAILGRAD', 'Bio-Scanner-Details.', 'intel.scanner.bio', 'intel', 'intel.scanner.bio.leaves', 'scan_detail', 0.15),
  leaf('intel.scanner.bio.speed', 'SCANZEIT', 'Bio-Scanner-Speed.', 'intel.scanner.bio', 'intel', 'intel.scanner.bio.leaves', 'scan_speed', 0.20),
  leaf('intel.sensor.taktik.prec', 'PRÄZISION', 'Taktik-Array-Präzision.', 'intel.sensor.taktik', 'intel', 'intel.sensor.taktik.leaves', 'sensor_precision', 0.15),
  leaf('intel.sensor.taktik.stealth', 'TARNENTDECKUNG', 'Taktik-Array-Tarnerkennung.', 'intel.sensor.taktik', 'intel', 'intel.sensor.taktik.leaves', 'sensor_stealth', 0.20),
  leaf('intel.sensor.taktik.range', 'REICHWEITE', 'Taktik-Array-Reichweite.', 'intel.sensor.taktik', 'intel', 'intel.sensor.taktik.leaves', 'sensor_range', 0.15),
  leaf('intel.sensor.survey.prec', 'PRÄZISION', 'Survey-Sonde-Präzision.', 'intel.sensor.survey', 'intel', 'intel.sensor.survey.leaves', 'sensor_precision', 0.15),
  leaf('intel.sensor.survey.stealth', 'TARNENTDECKUNG', 'Survey-Sonde-Tarnerkennung.', 'intel.sensor.survey', 'intel', 'intel.sensor.survey.leaves', 'sensor_stealth', 0.20),
  leaf('intel.sensor.survey.range', 'REICHWEITE', 'Survey-Sonde-Reichweite.', 'intel.sensor.survey', 'intel', 'intel.sensor.survey.leaves', 'sensor_range', 0.15),
  leaf('intel.labor.forschung.rate', 'WISSEN-RATE', 'Forschungslab-Rate.', 'intel.labor.forschung', 'intel', 'intel.labor.forschung.leaves', 'lab_wissen_rate', 0.20),
  leaf('intel.labor.forschung.eff', 'EFFIZIENZ', 'Forschungslab-Effizienz.', 'intel.labor.forschung', 'intel', 'intel.labor.forschung.leaves', 'lab_efficiency', 0.15),
  leaf('intel.labor.forschung.cap', 'KAPAZITÄT', 'Forschungslab-Kapazität.', 'intel.labor.forschung', 'intel', 'intel.labor.forschung.leaves', 'lab_capacity', 0.15),
  leaf('intel.labor.analyse.rate', 'WISSEN-RATE', 'Analyse-Lab-Rate.', 'intel.labor.analyse', 'intel', 'intel.labor.analyse.leaves', 'lab_wissen_rate', 0.20),
  leaf('intel.labor.analyse.eff', 'EFFIZIENZ', 'Analyse-Lab-Effizienz.', 'intel.labor.analyse', 'intel', 'intel.labor.analyse.leaves', 'lab_efficiency', 0.15),
  leaf('intel.labor.analyse.cap', 'KAPAZITÄT', 'Analyse-Lab-Kapazität.', 'intel.labor.analyse', 'intel', 'intel.labor.analyse.leaves', 'lab_capacity', 0.15),

  // ===== EXPLORER =====
  branch('explorer', 'EXPLORER', 'Erkundung und Mobilität.', 'explorer'),

  mod('explorer.antrieb', 'ANTRIEB', 'Fortbewegungssysteme.', 'explorer', 'explorer', 'explorer.modules', []),
  mod('explorer.treibstoff', 'TREIBSTOFF', 'Energieversorgung.', 'explorer', 'explorer', 'explorer.modules', []),
  mod('explorer.nav', 'NAVIGATION', 'Wegfindung und Kartierung.', 'explorer', 'explorer', 'explorer.modules', []),

  leaf('explorer.antrieb.ap', 'AP-EFFIZIENZ', 'Reduzierter AP-Verbrauch.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.leaves', 'drive_ap_efficiency', 0.15),
  leaf('explorer.antrieb.speed', 'GESCHWINDIGKEIT', 'Erhöhte Reisegeschwindigkeit.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.leaves', 'drive_speed', 0.20),
  leaf('explorer.antrieb.jump', 'SPRUNGREICHWEITE', 'Größere Sprungdistanz.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.leaves', 'drive_jump_range', 0.15),
  spec('explorer.antrieb.warp', 'WARP-CORE', 'Weite Sprünge.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.specs', []),
  spec('explorer.antrieb.ion', 'IONEN-ANTRIEB', 'AP-Effizienz.', 'explorer.antrieb', 'explorer', 'explorer.antrieb.specs', []),

  leaf('explorer.treibstoff.cap', 'TANKGRÖSSE', 'Erhöhte Treibstoffkapazität.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.leaves', 'fuel_capacity', 0.20),
  leaf('explorer.treibstoff.cons', 'VERBRAUCH', 'Reduzierter Treibstoffverbrauch.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.leaves', 'fuel_consumption', 0.15),
  leaf('explorer.treibstoff.regen', 'REGENERATION', 'Passive Treibstoff-Regeneration.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.leaves', 'fuel_regen', 0.10),
  spec('explorer.treibstoff.processor', 'FUEL-PROZESSOR', 'Erz → Treibstoff Konvertierung.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.specs', []),
  spec('explorer.treibstoff.solar', 'SOLAR-KOLLEKTOR', 'Passive Treibstoff-Regeneration.', 'explorer.treibstoff', 'explorer', 'explorer.treibstoff.specs', []),

  leaf('explorer.nav.autopilot', 'AUTOPILOT', 'Erhöhte Autopilot-Reichweite.', 'explorer.nav', 'explorer', 'explorer.nav.leaves', 'nav_autopilot', 0.20),
  leaf('explorer.nav.route', 'ROUTEN', 'Effizientere Routenberechnung.', 'explorer.nav', 'explorer', 'explorer.nav.leaves', 'nav_route_efficiency', 0.15),
  leaf('explorer.nav.discovery', 'ENTDECKUNG', 'Höhere Entdeckungsrate.', 'explorer.nav', 'explorer', 'explorer.nav.leaves', 'nav_discovery', 0.15),
  spec('explorer.nav.pathfinder', 'PATHFINDER-AI', 'Optimale Routen.', 'explorer.nav', 'explorer', 'explorer.nav.specs', []),
  spec('explorer.nav.kartograph', 'KARTOGRAPH', 'Sektoren-Aufdeckung.', 'explorer.nav', 'explorer', 'explorer.nav.specs', []),

  // --- EXPLORER spec-leaves (18) ---
  leaf('explorer.antrieb.warp.ap', 'AP-EFFIZIENZ', 'Warp-AP-Effizienz.', 'explorer.antrieb.warp', 'explorer', 'explorer.antrieb.warp.leaves', 'drive_ap_efficiency', 0.15),
  leaf('explorer.antrieb.warp.speed', 'GESCHWINDIGKEIT', 'Warp-Geschwindigkeit.', 'explorer.antrieb.warp', 'explorer', 'explorer.antrieb.warp.leaves', 'drive_speed', 0.20),
  leaf('explorer.antrieb.warp.jump', 'SPRUNGREICHWEITE', 'Warp-Sprungreichweite.', 'explorer.antrieb.warp', 'explorer', 'explorer.antrieb.warp.leaves', 'drive_jump_range', 0.15),
  leaf('explorer.antrieb.ion.ap', 'AP-EFFIZIENZ', 'Ionen-AP-Effizienz.', 'explorer.antrieb.ion', 'explorer', 'explorer.antrieb.ion.leaves', 'drive_ap_efficiency', 0.15),
  leaf('explorer.antrieb.ion.speed', 'GESCHWINDIGKEIT', 'Ionen-Geschwindigkeit.', 'explorer.antrieb.ion', 'explorer', 'explorer.antrieb.ion.leaves', 'drive_speed', 0.20),
  leaf('explorer.antrieb.ion.jump', 'SPRUNGREICHWEITE', 'Ionen-Sprungreichweite.', 'explorer.antrieb.ion', 'explorer', 'explorer.antrieb.ion.leaves', 'drive_jump_range', 0.15),
  leaf('explorer.treibstoff.processor.cap', 'TANKGRÖSSE', 'Fuel-Prozessor-Tank.', 'explorer.treibstoff.processor', 'explorer', 'explorer.treibstoff.processor.leaves', 'fuel_capacity', 0.20),
  leaf('explorer.treibstoff.processor.cons', 'VERBRAUCH', 'Fuel-Prozessor-Verbrauch.', 'explorer.treibstoff.processor', 'explorer', 'explorer.treibstoff.processor.leaves', 'fuel_consumption', 0.15),
  leaf('explorer.treibstoff.processor.regen', 'REGENERATION', 'Fuel-Prozessor-Regen.', 'explorer.treibstoff.processor', 'explorer', 'explorer.treibstoff.processor.leaves', 'fuel_regen', 0.10),
  leaf('explorer.treibstoff.solar.cap', 'TANKGRÖSSE', 'Solar-Tank.', 'explorer.treibstoff.solar', 'explorer', 'explorer.treibstoff.solar.leaves', 'fuel_capacity', 0.20),
  leaf('explorer.treibstoff.solar.cons', 'VERBRAUCH', 'Solar-Verbrauch.', 'explorer.treibstoff.solar', 'explorer', 'explorer.treibstoff.solar.leaves', 'fuel_consumption', 0.15),
  leaf('explorer.treibstoff.solar.regen', 'REGENERATION', 'Solar-Regen.', 'explorer.treibstoff.solar', 'explorer', 'explorer.treibstoff.solar.leaves', 'fuel_regen', 0.10),
  leaf('explorer.nav.pathfinder.autopilot', 'AUTOPILOT', 'Pathfinder-Autopilot.', 'explorer.nav.pathfinder', 'explorer', 'explorer.nav.pathfinder.leaves', 'nav_autopilot', 0.20),
  leaf('explorer.nav.pathfinder.route', 'ROUTEN', 'Pathfinder-Routen.', 'explorer.nav.pathfinder', 'explorer', 'explorer.nav.pathfinder.leaves', 'nav_route_efficiency', 0.15),
  leaf('explorer.nav.pathfinder.discovery', 'ENTDECKUNG', 'Pathfinder-Entdeckung.', 'explorer.nav.pathfinder', 'explorer', 'explorer.nav.pathfinder.leaves', 'nav_discovery', 0.15),
  leaf('explorer.nav.kartograph.autopilot', 'AUTOPILOT', 'Kartograph-Autopilot.', 'explorer.nav.kartograph', 'explorer', 'explorer.nav.kartograph.leaves', 'nav_autopilot', 0.20),
  leaf('explorer.nav.kartograph.route', 'ROUTEN', 'Kartograph-Routen.', 'explorer.nav.kartograph', 'explorer', 'explorer.nav.kartograph.leaves', 'nav_route_efficiency', 0.15),
  leaf('explorer.nav.kartograph.discovery', 'ENTDECKUNG', 'Kartograph-Entdeckung.', 'explorer.nav.kartograph', 'explorer', 'explorer.nav.kartograph.leaves', 'nav_discovery', 0.15),
];

// Build lookup map and compute leaf depths from parent
export const TECH_TREE_NODES: Record<string, TechTreeNode> = {};
for (const node of nodes) {
  TECH_TREE_NODES[node.id] = node;
}
// Fix leaf depths: derive from parent depth + 1
for (const node of Object.values(TECH_TREE_NODES)) {
  if (node.depth === -1 && node.parent) {
    const parent = TECH_TREE_NODES[node.parent];
    node.depth = parent ? parent.depth + 1 : 2;
  }
}

export const TECH_TREE_NODE_COUNT = nodes.length;

export function getTechNode(id: string): TechTreeNode | undefined {
  return TECH_TREE_NODES[id];
}

export function getChildNodes(parentId: string): TechTreeNode[] {
  return Object.values(TECH_TREE_NODES).filter((n) => n.parent === parentId);
}

export function getExclusiveGroup(nodeId: string): string | undefined {
  return TECH_TREE_NODES[nodeId]?.exclusiveGroup;
}

export const BRANCH_COLORS: Record<TechBranch, string> = {
  kampf: '#ff4444',
  ausbau: '#4488ff',
  intel: '#bb44ff',
  explorer: '#44ff88',
};

/** Global cost escalation: +5% per researched node */
export const GLOBAL_COST_ESCALATION = 0.05;

/** Reset cooldown in milliseconds (24 hours) */
export const TECH_TREE_RESET_COOLDOWN_MS = 24 * 60 * 60 * 1000;
```

Note: Specialization leaves (e.g., `kampf.laser.phaser.dmg`) follow the same pattern. The implementer should add all leaves for all 24 specializations following the pattern above. Each specialization gets 3 leaves with the same stat keys as its parent module's leaves.

- [ ] **Step 4: Add export to index.ts**

Add to `packages/shared/src/index.ts`:
```typescript
export * from './techTree.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/shared && npx vitest run src/__tests__/techTree.test.ts`
Expected: PASS

- [ ] **Step 6: Build shared package**

Run: `cd packages/shared && npm run build`

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/techTree.ts packages/shared/src/index.ts packages/shared/src/__tests__/techTree.test.ts
git commit -m "feat: tech tree node types and config (#297)"
```

---

### Task 2: Tech Tree Effects Engine (shared)

**Files:**
- Create: `packages/shared/src/techTreeEffects.ts`
- Modify: `packages/shared/src/index.ts` (add export)

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/__tests__/techTreeEffects.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getTechTreeEffects, calculateResearchCost } from '../techTreeEffects';

describe('getTechTreeEffects', () => {
  it('returns empty effects for empty nodes', () => {
    const effects = getTechTreeEffects({});
    expect(effects.unlockedTiers).toEqual({});
    expect(effects.statBonuses).toEqual({});
  });

  it('branch level determines unlocked tier', () => {
    const effects = getTechTreeEffects({ kampf: 2 });
    // kampf level 2 → tier 3 for weapon category
    expect(effects.unlockedTiers['kampf']).toBe(3);
  });

  it('leaf bonuses accumulate by level', () => {
    const effects = getTechTreeEffects({
      'kampf': 1,
      'kampf.laser': 1,
      'kampf.laser.dmg': 2,
    });
    // weapon_damage = 0.15 * 2 = 0.30
    expect(effects.statBonuses['weapon_damage']).toBeCloseTo(0.30);
  });

  it('leaf penalties also accumulate', () => {
    const effects = getTechTreeEffects({
      'kampf': 1,
      'kampf.laser': 1,
      'kampf.laser.dmg': 3,
    });
    // penalty: weapon_efficiency -0.05 * 3 = -0.15
    expect(effects.statBonuses['weapon_efficiency']).toBeCloseTo(-0.15);
  });

  it('multiple branches aggregate independently', () => {
    const effects = getTechTreeEffects({ kampf: 1, ausbau: 2 });
    expect(effects.unlockedTiers['kampf']).toBe(2);
    expect(effects.unlockedTiers['ausbau']).toBe(3);
  });

  it('parent module leaf effects cascade to child specialization (top-down inheritance)', () => {
    const effects = getTechTreeEffects({
      'kampf': 1,
      'kampf.laser': 1,
      'kampf.laser.dmg': 1,      // +0.15 weapon_damage, -0.05 weapon_efficiency
      'kampf.laser.phaser': 1,   // specialization: -0.20 weapon_damage own effect
    });
    // weapon_damage = leaf +0.15 + phaser own -0.20 = -0.05
    // (leaf bonus cascades to child spec)
    expect(effects.statBonuses['weapon_damage']).toBeCloseTo(-0.05);
    // weapon_efficiency = leaf penalty -0.05
    expect(effects.statBonuses['weapon_efficiency']).toBeCloseTo(-0.05);
  });
});

describe('calculateResearchCost', () => {
  it('branch level 1 costs 150 with 0 total', () => {
    expect(calculateResearchCost('kampf', 0, 0)).toBe(150);
  });

  it('applies global escalation', () => {
    // 150 * (1 + 10 * 0.05) = 150 * 1.5 = 225
    expect(calculateResearchCost('kampf', 0, 10)).toBe(225);
  });

  it('branch level 2 uses costPerLevel', () => {
    // costPerLevel[1] = 450, with 5 total: 450 * 1.25 = 562.5 → 563
    expect(calculateResearchCost('kampf', 1, 5)).toBe(563);
  });

  it('leaf level uses costPerLevel', () => {
    // costPerLevel[1] = 540, with 3 total: 540 * 1.15 = 621
    expect(calculateResearchCost('kampf.laser.dmg', 1, 3)).toBe(621);
  });

  it('module (maxLevel 1) uses baseCost', () => {
    // 280 * (1 + 0 * 0.05) = 280
    expect(calculateResearchCost('kampf.laser', 0, 0)).toBe(280);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared && npx vitest run src/__tests__/techTreeEffects.test.ts`

- [ ] **Step 3: Implement techTreeEffects.ts**

Create `packages/shared/src/techTreeEffects.ts`:

```typescript
import { TECH_TREE_NODES, GLOBAL_COST_ESCALATION, type TechStatKey, type TechTreeNode } from './techTree.js';

export interface TechTreeEffects {
  unlockedTiers: Record<string, number>;
  statBonuses: Partial<Record<TechStatKey, number>>;
}

/**
 * Compute aggregated effects from researched nodes.
 * Branch level N → unlocked tier N+1 for that branch.
 * Leaf bonuses scale with level, penalties included.
 * Top-down inheritance: parent module leaves cascade to child specializations.
 */
export function getTechTreeEffects(
  researchedNodes: Record<string, number>,
): TechTreeEffects {
  const unlockedTiers: Record<string, number> = {};
  const statBonuses: Partial<Record<TechStatKey, number>> = {};

  function applyEffects(node: TechTreeNode, level: number): void {
    for (const effect of node.effects) {
      if (effect.type === 'stat_bonus') {
        const key = effect.target as TechStatKey;
        const multiplier = node.type === 'leaf' || node.type === 'branch' ? level : 1;
        statBonuses[key] = (statBonuses[key] ?? 0) + effect.value * multiplier;
        if (effect.penalty) {
          statBonuses[effect.penalty.target] =
            (statBonuses[effect.penalty.target] ?? 0) + effect.penalty.value * multiplier;
        }
      }
    }
  }

  for (const [nodeId, level] of Object.entries(researchedNodes)) {
    if (level <= 0) continue;
    const node = TECH_TREE_NODES[nodeId];
    if (!node) continue;

    if (node.type === 'branch') {
      unlockedTiers[node.branch] = Math.max(
        unlockedTiers[node.branch] ?? 1,
        level + 1,
      );
    }

    applyEffects(node, level);
  }

  // Top-down inheritance note: Parent module leaf effects automatically cascade
  // to child specializations because all effects aggregate into one flat
  // statBonuses map. E.g., if kampf.laser.dmg (+0.15 weapon_damage) and
  // kampf.laser.phaser (-0.20 weapon_damage) are both researched, the first
  // loop already applies both effects. No separate inheritance loop needed.

  return { unlockedTiers, statBonuses };
}

/**
 * Calculate the Wissen cost to research a node at a given current level.
 * @param nodeId - The tech node to research
 * @param currentLevel - Current level of the node (0 = not yet researched)
 * @param totalResearched - Total number of research actions performed (for global escalation)
 */
export function calculateResearchCost(
  nodeId: string,
  currentLevel: number,
  totalResearched: number,
): number {
  const node = TECH_TREE_NODES[nodeId];
  if (!node) return Infinity;

  let baseCost: number;
  if (node.costPerLevel && node.costPerLevel[currentLevel] !== undefined) {
    baseCost = node.costPerLevel[currentLevel];
  } else {
    baseCost = node.baseCost;
  }

  const escalation = 1 + totalResearched * GLOBAL_COST_ESCALATION;
  return Math.ceil(baseCost * escalation);
}
```

- [ ] **Step 4: Add export to index.ts**

Add to `packages/shared/src/index.ts`:
```typescript
export * from './techTreeEffects.js';
```

- [ ] **Step 5: Run tests, build shared**

Run: `cd packages/shared && npx vitest run src/__tests__/techTreeEffects.test.ts && npm run build`

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/techTreeEffects.ts packages/shared/src/index.ts packages/shared/src/__tests__/techTreeEffects.test.ts
git commit -m "feat: tech tree effects engine and cost calculator (#297)"
```

---

### Task 3: DB Migration & Queries

**Files:**
- Create: `packages/server/src/db/migrations/059_player_tech_tree.sql`
- Create: `packages/server/src/db/techTreeQueries.ts`

- [ ] **Step 1: Create migration**

Create `packages/server/src/db/migrations/059_player_tech_tree.sql`:

```sql
CREATE TABLE IF NOT EXISTS player_tech_tree (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  researched_nodes JSONB NOT NULL DEFAULT '{}',
  total_researched INTEGER NOT NULL DEFAULT 0,
  last_reset_at TIMESTAMPTZ
);
```

- [ ] **Step 2: Write failing test for queries**

Create `packages/server/src/__tests__/techTreeQueries.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mock the db client
vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  pool: { query: vi.fn() },
}));

import { getOrCreateTechTree, saveTechTree, resetTechTree } from '../db/techTreeQueries';
import { query } from '../db/client.js';

const mockQuery = vi.mocked(query);

describe('getOrCreateTechTree', () => {
  it('returns existing row', async () => {
    const row = { player_id: 'p1', researched_nodes: { kampf: 1 }, total_researched: 1, last_reset_at: null };
    mockQuery.mockResolvedValueOnce({ rows: [row], rowCount: 1 } as any);
    const result = await getOrCreateTechTree('p1');
    expect(result.researched_nodes).toEqual({ kampf: 1 });
  });
});

describe('saveTechTree', () => {
  it('updates researched_nodes and total', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await saveTechTree('p1', { kampf: 2 }, 5);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE player_tech_tree'),
      expect.arrayContaining(['p1']),
    );
  });
});

describe('resetTechTree', () => {
  it('clears nodes and sets last_reset_at', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);
    await resetTechTree('p1');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE player_tech_tree'),
      expect.arrayContaining(['p1']),
    );
  });
});
```

- [ ] **Step 3: Implement techTreeQueries.ts**

Create `packages/server/src/db/techTreeQueries.ts`:

```typescript
import { query } from './client.js';

export interface TechTreeRow {
  player_id: string;
  researched_nodes: Record<string, number>;
  total_researched: number;
  last_reset_at: string | null;
}

export async function getOrCreateTechTree(playerId: string): Promise<TechTreeRow> {
  const { rows } = await query<TechTreeRow>(
    `INSERT INTO player_tech_tree (player_id)
     VALUES ($1)
     ON CONFLICT (player_id) DO UPDATE SET player_id = player_tech_tree.player_id
     RETURNING *`,
    [playerId],
  );
  return rows[0];
}

export async function saveTechTree(
  playerId: string,
  researchedNodes: Record<string, number>,
  totalResearched: number,
): Promise<void> {
  await query(
    `UPDATE player_tech_tree
     SET researched_nodes = $2, total_researched = $3
     WHERE player_id = $1`,
    [playerId, JSON.stringify(researchedNodes), totalResearched],
  );
}

export async function resetTechTree(playerId: string): Promise<void> {
  await query(
    `UPDATE player_tech_tree
     SET researched_nodes = '{}', total_researched = 0, last_reset_at = NOW()
     WHERE player_id = $1`,
    [playerId],
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/server && npx vitest run src/__tests__/techTreeQueries.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/migrations/059_player_tech_tree.sql packages/server/src/db/techTreeQueries.ts packages/server/src/__tests__/techTreeQueries.test.ts
git commit -m "feat: tech tree migration 059 and queries (#297)"
```

---

### Task 4: Wissen Service (active generation)

**Files:**
- Create: `packages/server/src/engine/wissenService.ts`
- Modify: `packages/shared/src/constants.ts` (add LAB_WISSEN_MULTIPLIER)

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/__tests__/wissenService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  pool: { query: vi.fn() },
}));
vi.mock('../db/queries.js', () => ({
  addWissen: vi.fn(),
  getResearchLabTier: vi.fn(),
}));

import { awardWissen } from '../engine/wissenService';
import { addWissen, getResearchLabTier } from '../db/queries.js';

const mockAddWissen = vi.mocked(addWissen);
const mockGetLabTier = vi.mocked(getResearchLabTier);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('awardWissen', () => {
  it('adds base wissen when no lab', async () => {
    mockGetLabTier.mockResolvedValue(0);
    await awardWissen('p1', 5);
    expect(mockAddWissen).toHaveBeenCalledWith('p1', 5);
  });

  it('applies lab tier 3 multiplier (3.0)', async () => {
    mockGetLabTier.mockResolvedValue(3);
    await awardWissen('p1', 5);
    expect(mockAddWissen).toHaveBeenCalledWith('p1', 15); // 5 * 3.0
  });

  it('floors fractional wissen', async () => {
    mockGetLabTier.mockResolvedValue(1);
    await awardWissen('p1', 3);
    expect(mockAddWissen).toHaveBeenCalledWith('p1', 4); // 3 * 1.5 = 4.5 → 4
  });

  it('does nothing for 0 base', async () => {
    mockGetLabTier.mockResolvedValue(5);
    await awardWissen('p1', 0);
    expect(mockAddWissen).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/wissenService.test.ts`

- [ ] **Step 3: Add LAB_WISSEN_MULTIPLIER to constants.ts**

In `packages/shared/src/constants.ts`, add after `RESEARCH_LAB_WISSEN_RATE` block (~line 118):

```typescript
/** Lab tier Wissen multiplier for active generation (replaces passive tick) */
export const LAB_WISSEN_MULTIPLIER: Record<number, number> = {
  0: 1.0,
  1: 1.5,
  2: 2.0,
  3: 3.0,
  4: 4.0,
  5: 5.0,
};
```

- [ ] **Step 4: Implement wissenService.ts**

Create `packages/server/src/engine/wissenService.ts`:

```typescript
import { LAB_WISSEN_MULTIPLIER } from '@void-sector/shared';
import { addWissen, getResearchLabTier } from '../db/queries.js';

/**
 * Award Wissen for a gameplay action, applying lab multiplier.
 */
export async function awardWissen(playerId: string, baseAmount: number): Promise<void> {
  if (baseAmount <= 0) return;
  const labTier = await getResearchLabTier(playerId);
  const multiplier = LAB_WISSEN_MULTIPLIER[labTier] ?? 1.0;
  const gain = Math.floor(baseAmount * multiplier);
  if (gain > 0) {
    await addWissen(playerId, gain);
  }
}
```

- [ ] **Step 5: Build shared, run tests**

Run: `cd packages/shared && npm run build && cd ../server && npx vitest run src/__tests__/wissenService.test.ts`

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/constants.ts packages/server/src/engine/wissenService.ts packages/server/src/__tests__/wissenService.test.ts
git commit -m "feat: active Wissen generation service with lab multiplier (#297)"
```

---

### Task 5: Remove Passive Wissen Tick

**Files:**
- Modify: `packages/server/src/engine/strategicTickService.ts` (~line 20, 82)
- Delete: `packages/server/src/engine/wissenTickHandler.ts`
- Delete: `packages/server/src/__tests__/wissenTickHandler.test.ts`

- [ ] **Step 1: Remove processWissenTick import and call**

In `packages/server/src/engine/strategicTickService.ts`:
- Remove import line (~20): `import { processWissenTick } from './wissenTickHandler.js'`
- Remove call (~82): `await processWissenTick(60_000);`

- [ ] **Step 2: Delete wissenTickHandler files**

```bash
rm packages/server/src/engine/wissenTickHandler.ts
rm packages/server/src/__tests__/wissenTickHandler.test.ts
```

- [ ] **Step 3: Update strategicTickService.test.ts**

In `packages/server/src/__tests__/strategicTickService.test.ts`, remove the `vi.mock('../engine/wissenTickHandler.js', ...)` block and any assertions referencing `processWissenTick`.

- [ ] **Step 4: Run server tests to verify nothing breaks**

Run: `cd packages/server && npx vitest run`
Expected: All tests pass (minus removed wissenTickHandler tests)

- [ ] **Step 5: Commit**

```bash
git add -u packages/server/src/engine/strategicTickService.ts packages/server/src/engine/wissenTickHandler.ts packages/server/src/__tests__/wissenTickHandler.test.ts packages/server/src/__tests__/strategicTickService.test.ts
git commit -m "refactor: remove passive Wissen tick (#297)"
```

---

## Chunk 2: Server Services & Integration

### Task 6: TechTreeService (research & reset handlers)

**Files:**
- Create: `packages/server/src/rooms/services/TechTreeService.ts`
- Modify: `packages/server/src/rooms/SectorRoom.ts` (register handlers)

- [ ] **Step 1: Write failing tests**

Create `packages/server/src/__tests__/techTreeService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/client.js', () => ({
  query: vi.fn(),
  pool: { query: vi.fn() },
}));
vi.mock('../db/techTreeQueries.js', () => ({
  getOrCreateTechTree: vi.fn(),
  saveTechTree: vi.fn(),
  resetTechTree: vi.fn(),
}));
vi.mock('../db/queries.js', () => ({
  deductWissen: vi.fn(),
  getWissen: vi.fn(),
}));

import { getOrCreateTechTree, saveTechTree, resetTechTree } from '../db/techTreeQueries.js';
import { deductWissen, getWissen } from '../db/queries.js';

const mockGetTree = vi.mocked(getOrCreateTechTree);
const mockSaveTree = vi.mocked(saveTechTree);
const mockResetTree = vi.mocked(resetTechTree);
const mockDeductWissen = vi.mocked(deductWissen);
const mockGetWissen = vi.mocked(getWissen);

// Import the validation function we'll test
import { validateResearch } from '../rooms/services/TechTreeService';
import { TECH_TREE_NODES } from '@void-sector/shared';

describe('validateResearch', () => {
  it('rejects unknown nodeId', () => {
    const result = validateResearch('nonexistent', {}, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects if parent not researched', () => {
    // kampf.laser requires kampf >= 1
    const result = validateResearch('kampf.laser', {}, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('parent');
  });

  it('rejects if exclusive group blocked', () => {
    // kampf.laser is in group kampf.weapons, kampf.missile is too
    const result = validateResearch('kampf.missile', { kampf: 1, 'kampf.laser': 1 }, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exclusive');
  });

  it('rejects if max level reached', () => {
    const result = validateResearch('kampf', { kampf: 3 }, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('max level');
  });

  it('accepts valid research (branch level up)', () => {
    const result = validateResearch('kampf', {}, 0);
    expect(result.valid).toBe(true);
    expect(result.cost).toBe(150);
  });

  it('accepts valid module research when parent is at level 1', () => {
    const result = validateResearch('kampf.laser', { kampf: 1 }, 0);
    expect(result.valid).toBe(true);
    expect(result.cost).toBe(280);
  });

  it('applies global cost escalation', () => {
    const result = validateResearch('kampf', {}, 10);
    // 150 * (1 + 10 * 0.05) = 225
    expect(result.cost).toBe(225);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/server && npx vitest run src/__tests__/techTreeService.test.ts`

- [ ] **Step 3: Implement TechTreeService**

Create `packages/server/src/rooms/services/TechTreeService.ts`:

```typescript
import type { Client } from 'colyseus';
import type { AuthPayload } from '../../auth.js';
import {
  TECH_TREE_NODES,
  TECH_TREE_RESET_COOLDOWN_MS,
  getTechNode,
  calculateResearchCost,
} from '@void-sector/shared';
import { getOrCreateTechTree, saveTechTree, resetTechTree as dbResetTree } from '../../db/techTreeQueries.js';
import { deductWissen, getWissen } from '../../db/queries.js';
import type { ServiceContext } from './ServiceContext.js';

interface ValidationResult {
  valid: boolean;
  error?: string;
  cost?: number;
}

export function validateResearch(
  nodeId: string,
  researchedNodes: Record<string, number>,
  totalResearched: number,
): ValidationResult {
  const node = getTechNode(nodeId);
  if (!node) return { valid: false, error: `Node ${nodeId} not found` };

  const currentLevel = researchedNodes[nodeId] ?? 0;

  // Check max level
  if (currentLevel >= node.maxLevel) {
    return { valid: false, error: `Node ${nodeId} already at max level ${node.maxLevel}` };
  }

  // Check parent
  if (node.parent !== null) {
    const parentLevel = researchedNodes[node.parent] ?? 0;
    if (parentLevel <= 0) {
      return { valid: false, error: `Parent ${node.parent} not yet researched` };
    }
  }

  // Check exclusive group
  if (node.exclusiveGroup) {
    for (const [otherId, otherLevel] of Object.entries(researchedNodes)) {
      if (otherLevel <= 0 || otherId === nodeId) continue;
      const other = getTechNode(otherId);
      if (other && other.exclusiveGroup === node.exclusiveGroup) {
        return { valid: false, error: `Exclusive group ${node.exclusiveGroup}: ${otherId} already researched` };
      }
    }
  }

  const cost = calculateResearchCost(nodeId, currentLevel, totalResearched);
  return { valid: true, cost };
}

export class TechTreeService {
  constructor(private ctx: ServiceContext) {}

  async handleGetTechTree(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const row = await getOrCreateTechTree(auth.userId);
    this.sendTechTreeUpdate(client, row.researched_nodes, row.total_researched, row.last_reset_at);
  }

  async handleResearchNode(client: Client, data: { nodeId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (!this.ctx.checkRate(client.sessionId, 'techResearch', 1000)) return;

    const row = await getOrCreateTechTree(auth.userId);
    const validation = validateResearch(data.nodeId, row.researched_nodes, row.total_researched);

    if (!validation.valid) {
      this.ctx.send(client, 'actionError', { code: 'TECH_RESEARCH_INVALID', message: validation.error! });
      return;
    }

    // Atomic deduction — avoids TOCTOU race condition
    const deducted = await deductWissen(auth.userId, validation.cost!);
    if (!deducted) {
      this.ctx.send(client, 'actionError', { code: 'INSUFFICIENT_WISSEN', message: 'Nicht genug Wissen' });
      return;
    }

    const currentLevel = row.researched_nodes[data.nodeId] ?? 0;
    row.researched_nodes[data.nodeId] = currentLevel + 1;
    row.total_researched += 1;

    await saveTechTree(auth.userId, row.researched_nodes, row.total_researched);

    // Read actual remaining wissen from DB after deduction
    const remainingWissen = await getWissen(auth.userId);
    this.sendTechTreeUpdate(client, row.researched_nodes, row.total_researched, row.last_reset_at);
    this.ctx.send(client, 'wissenUpdate', { wissen: remainingWissen });
  }

  async handleResetTree(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    if (!this.ctx.checkRate(client.sessionId, 'techReset', 5000)) return;

    const row = await getOrCreateTechTree(auth.userId);

    if (row.last_reset_at) {
      const elapsed = Date.now() - new Date(row.last_reset_at).getTime();
      if (elapsed < TECH_TREE_RESET_COOLDOWN_MS) {
        const remaining = Math.ceil((TECH_TREE_RESET_COOLDOWN_MS - elapsed) / 1000);
        this.ctx.send(client, 'actionError', {
          code: 'RESET_COOLDOWN',
          message: `Reset Cooldown: ${remaining}s`,
        });
        return;
      }
    }

    await dbResetTree(auth.userId);
    this.sendTechTreeUpdate(client, {}, 0, new Date().toISOString());
  }

  private sendTechTreeUpdate(
    client: Client,
    researchedNodes: Record<string, number>,
    totalResearched: number,
    lastResetAt: string | null,
  ): void {
    const resetCooldownRemaining = lastResetAt
      ? Math.max(0, Math.ceil((TECH_TREE_RESET_COOLDOWN_MS - (Date.now() - new Date(lastResetAt).getTime())) / 1000))
      : 0;

    this.ctx.send(client, 'techTreeUpdate', {
      researchedNodes,
      totalResearched,
      resetCooldownRemaining,
    });
  }
}
```

- [ ] **Step 4: Register handlers in SectorRoom**

In `packages/server/src/rooms/SectorRoom.ts`:

Add import:
```typescript
import { TechTreeService } from './services/TechTreeService.js';
```

Add field (near other service fields):
```typescript
private techTree!: TechTreeService;
```

Add instantiation (in onCreate or setupServices):
```typescript
this.techTree = new TechTreeService(this.serviceContext);
```

Add message handlers (near existing research handlers ~line 674):
```typescript
this.onMessage('getTechTree', (client) => this.techTree.handleGetTechTree(client));
this.onMessage('researchTechNode', (client, data) => this.techTree.handleResearchNode(client, data));
this.onMessage('resetTechTree', (client) => this.techTree.handleResetTree(client));
```

- [ ] **Step 5: Run tests**

Run: `cd packages/server && npx vitest run src/__tests__/techTreeService.test.ts`

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/rooms/services/TechTreeService.ts packages/server/src/__tests__/techTreeService.test.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: TechTreeService with research and reset handlers (#297)"
```

---

### Task 7: Wissen Hooks in Services

**Files:**
- Modify: `packages/server/src/rooms/services/MiningService.ts` (~line 118)
- Modify: `packages/server/src/rooms/services/ScanService.ts` (~line 186)
- Modify: `packages/server/src/rooms/services/CombatService.ts` (~line 256)
- Modify: `packages/server/src/rooms/services/NavigationService.ts` (~line 158)
- Modify: `packages/server/src/rooms/services/QuestService.ts` (~line 382)
- Modify: `packages/server/src/rooms/services/ShipService.ts` (~line 426, handleCraftModule)

Each service gets a one-liner `awardWissen()` call at the appropriate point.

- [ ] **Step 1: Add wissen hooks to MiningService**

In `packages/server/src/rooms/services/MiningService.ts`, add import:
```typescript
import { awardWissen } from '../../engine/wissenService.js';
```

After mining completion (~line 118, after `addAcepXpForPlayer`):
```typescript
awardWissen(playerId, 1).catch(() => {});  // +1 per mining load
```

After mining loot (~line 288, after ACEP XP grant):
```typescript
awardWissen(playerId, 1).catch(() => {});
```

- [ ] **Step 2: Add wissen hooks to ScanService**

In `packages/server/src/rooms/services/ScanService.ts`, add import:
```typescript
import { awardWissen } from '../../engine/wissenService.js';
```

After scan completion (where ACEP XP is granted for scanning):
```typescript
awardWissen(auth.userId, 2).catch(() => {});  // +2 per scan
```

After artefact discovery (~line 186 or similar), scale by artefact type:
```typescript
// +5-15 depending on artefact type (spec: +5-15 nach Typ)
const artefactWissen = ['ancient_data', 'alien_tech'].includes(artefactType) ? 15 : artefactType === 'common' ? 5 : 10;
awardWissen(auth.userId, artefactWissen).catch(() => {});
```

- [ ] **Step 3: Add wissen hooks to CombatService**

In `packages/server/src/rooms/services/CombatService.ts`, add import:
```typescript
import { awardWissen } from '../../engine/wissenService.js';
```

After NPC defeat (~line 256, after ACEP XP), scale by enemy strength:
```typescript
// +3-8 depending on NPC strength (spec: +3-8 nach Stärke)
const npcWissen = Math.min(8, Math.max(3, Math.ceil(state.enemyLevel / 2)));
awardWissen(playerId, npcWissen).catch(() => {});
```

After PvP victory (in the PvP outcome handler):
```typescript
awardWissen(playerId, 10).catch(() => {});  // +10 per PvP win (spec)
```

- [ ] **Step 4: Add wissen hooks to NavigationService**

In `packages/server/src/rooms/services/NavigationService.ts`, add import:
```typescript
import { awardWissen } from '../../engine/wissenService.js';
```

After sector entry (~line 158, after checkFirstContact):
```typescript
awardWissen(auth.userId, 1).catch(() => {});  // +1 per new sector
```

After quadrant change (~line 370):
```typescript
awardWissen(auth.userId, 5).catch(() => {});  // +5 per quadrant change
```

- [ ] **Step 5: Add wissen hooks to QuestService**

In `packages/server/src/rooms/services/QuestService.ts`, add import:
```typescript
import { awardWissen } from '../../engine/wissenService.js';
```

After quest completion (~line 382, after rewards), scale by quest difficulty:
```typescript
// +5-20 depending on quest (spec: +5-20 nach Schwierigkeit)
const questWissen = quest.type === 'story' ? 20 : quest.type === 'community' ? 15 : quest.rewards?.credits > 500 ? 10 : 5;
awardWissen(auth.userId, questWissen).catch(() => {});
```

- [ ] **Step 6: Add wissen hook to ShipService (craft)**

In `packages/server/src/rooms/services/ShipService.ts`, add import:
```typescript
import { awardWissen } from '../../engine/wissenService.js';
```

After module crafting (in handleCraftModule, after success):
```typescript
awardWissen(auth.userId, 3).catch(() => {});  // +3 per craft
```

- [ ] **Step 7: Run server tests**

Run: `cd packages/server && npx vitest run`
Expected: All existing tests still pass

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/rooms/services/MiningService.ts packages/server/src/rooms/services/ScanService.ts packages/server/src/rooms/services/CombatService.ts packages/server/src/rooms/services/NavigationService.ts packages/server/src/rooms/services/QuestService.ts packages/server/src/rooms/services/ShipService.ts
git commit -m "feat: active Wissen hooks in all gameplay services (#297)"
```

---

### Task 8: Remove Old Research Handlers

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` (remove startResearch/cancelResearch/claimResearch registrations)
- Modify: `packages/server/src/rooms/services/ShipService.ts` (remove handleStartResearch, handleCancelResearch, handleClaimResearch methods)
- Modify: `packages/shared/src/constants.ts` (remove WISSEN_COST_BY_TIER, RESEARCH_LAB_TIER_FOR_MODULE_TIER, RESEARCH_LAB_NAMES, WISSEN_SECTOR_MULTIPLIERS)
- Modify: `packages/shared/src/types.ts` (remove activeResearch/activeResearch2/wissenRate from ResearchState)

- [ ] **Step 1: Remove message registrations from SectorRoom**

In `packages/server/src/rooms/SectorRoom.ts`, remove lines ~674-682:
```typescript
// DELETE these lines:
this.onMessage('startResearch', ...);
this.onMessage('cancelResearch', ...);
this.onMessage('claimResearch', ...);
this.onMessage('getResearchState', ...);  // old research state handler
```

Keep `activateBlueprint` handler — blueprints remain.

- [ ] **Step 2: Remove handler methods from ShipService**

In `packages/server/src/rooms/services/ShipService.ts`:
- Remove `handleStartResearch` method (~line 258-376)
- Remove `handleCancelResearch` method (~line 378-392)
- Remove `handleClaimResearch` method (~line 394-424)
- Remove `handleGetResearchState` method (~line 235-256) — replaced by `getTechTree` in TechTreeService
- In `handleCraftModule` (~line 530): replace `await this.handleGetResearchState(client)` with `this.ctx.send(client, 'wissenUpdate', { wissen: await getWissen(auth.userId) })`
- Keep `handleCraftModule` and `handleActivateBlueprint`

- [ ] **Step 3: Remove old constants from shared**

In `packages/shared/src/constants.ts`, remove:
- `WISSEN_COST_BY_TIER` (~line 150-156)
- `RESEARCH_LAB_TIER_FOR_MODULE_TIER` (~line 132-138)
- `RESEARCH_LAB_NAMES` (~line 120-126)
- `WISSEN_SECTOR_MULTIPLIERS` (~line 141-147)
- `ARTEFACT_REQUIRED_BY_TIER` (~line 159-165)
- `ARTEFACT_WISSEN_BONUS` (~line 168)
- `ARTEFACT_TIME_BONUS_PER` (~line 171)
- `MAX_ARTEFACTS_PER_RESEARCH` (~line 174)

Also remove: `RESEARCH_LAB_WISSEN_RATE` (~line 112-118) — only used by deleted `wissenTickHandler.ts`, now dead code.

Keep: `RESEARCH_LAB_UPGRADE_COSTS` (lab building still works).

- [ ] **Step 4: Update ResearchState type**

In `packages/shared/src/types.ts`, update ResearchState (~line 1222):

```typescript
export interface ResearchState {
  unlockedModules: string[];  // legacy — will be replaced by tech tree effects
  blueprints: string[];
  wissen?: number;
  // REMOVED: activeResearch, activeResearch2, wissenRate
}
```

- [ ] **Step 5: Fix compilation errors from removed exports**

Files that import removed constants/types:
- `packages/server/src/rooms/services/ShipService.ts`: remove imports of `MAX_ARTEFACTS_PER_RESEARCH`, `ARTEFACT_WISSEN_BONUS`, `ARTEFACT_TIME_BONUS_PER`, `WISSEN_COST_BY_TIER`, `RESEARCH_LAB_TIER_FOR_MODULE_TIER` (these were only used in removed handler methods)
- `packages/shared/src/index.ts`: remove re-exports of deleted constants if explicitly listed
- Any client file referencing `activeResearch`/`activeResearch2`/`wissenRate` from ResearchState

Run: `cd packages/shared && npm run build`

- [ ] **Step 6: Fix affected test files**

Affected test files:
- `packages/server/src/__tests__/research.test.ts`: remove tests for `canStartResearch`, update `isModuleUnlocked` tests (signature changes in Task 11)
- `packages/server/src/__tests__/shipService.test.ts` or any file testing `handleStartResearch`/`handleCancelResearch`/`handleClaimResearch`: remove those test cases
- `packages/client/src/__tests__/` files referencing `activeResearch`/`wissenRate`: remove or update

Run: `cd packages/server && npx vitest run`
Run: `cd packages/shared && npx vitest run`

- [ ] **Step 7: Commit**

```bash
git add -u packages/server/src/rooms/SectorRoom.ts packages/server/src/rooms/services/ShipService.ts packages/shared/src/constants.ts packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "refactor: remove old research handlers and constants (#297)"
```

---

## Chunk 3: Client State, Network & UI

### Task 9: Client State & Network

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts` (~line 414, 625, 755)
- Modify: `packages/client/src/network/client.ts` (add tech tree message handlers)

- [ ] **Step 1: Add tech tree state to gameSlice**

In `packages/client/src/state/gameSlice.ts`, add to GameSlice interface:
```typescript
techTree: {
  researchedNodes: Record<string, number>;
  totalResearched: number;
  resetCooldownRemaining: number;
} | null;
setTechTree: (data: { researchedNodes: Record<string, number>; totalResearched: number; resetCooldownRemaining: number }) => void;
```

Add default state:
```typescript
techTree: null,
```

Add setter:
```typescript
setTechTree: (data) => set({ techTree: data }),
```

- [ ] **Step 2: Update research state defaults**

Remove `activeResearch`, `activeResearch2`, `wissenRate` from the `research` initial state (~line 755-761):

```typescript
research: {
  unlockedModules: [],
  blueprints: [],
  wissen: 0,
},
```

- [ ] **Step 3: Add network handlers**

In `packages/client/src/network/client.ts`, add send methods:

```typescript
getTechTree(): void {
  this.sectorRoom?.send('getTechTree');
}

researchTechNode(nodeId: string): void {
  this.sectorRoom?.send('researchTechNode', { nodeId });
}

resetTechTree(): void {
  this.sectorRoom?.send('resetTechTree');
}
```

Add message listeners (in `registerRoomListeners` or equivalent):

```typescript
this.sectorRoom.onMessage('techTreeUpdate', (data) => {
  useStore.getState().setTechTree(data);
});

// NEW handler — wissenUpdate does not exist yet, create it
this.sectorRoom.onMessage('wissenUpdate', (data) => {
  useStore.getState().setResearch({
    ...useStore.getState().research,
    wissen: data.wissen,
  });
});
```

- [ ] **Step 4: Remove old research message handlers**

Remove `startResearch`, `cancelResearch`, `claimResearch` send methods from client.ts.
Remove or update the `researchResult` message handler (~line 592-625) — it no longer receives old-format messages.

- [ ] **Step 5: Update client components referencing removed fields**

Files that reference `activeResearch`/`wissenRate` (removed from ResearchState):
- `packages/client/src/components/TechDetailPanel.tsx`: remove references to `activeResearch`/`activeResearch2`
- `packages/client/src/components/TechTreePanel.tsx`: remove references to `activeResearch`/`wissenRate`
- `packages/client/src/test/mockStore.ts`: remove `activeResearch`/`wissenRate` from mock state
- `packages/client/src/__tests__/TechTreePanel.test.tsx`: update test to not use removed fields

- [ ] **Step 6: Run client tests**

Run: `cd packages/client && npx vitest run`
Expected: Fix any failures from removed `activeResearch`/`wissenRate` fields.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts packages/client/src/components/TechDetailPanel.tsx packages/client/src/components/TechTreePanel.tsx packages/client/src/test/mockStore.ts packages/client/src/__tests__/TechTreePanel.test.tsx
git commit -m "feat: client state and network for tech tree (#297)"
```

---

### Task 10: New TechTreeCanvas (UI)

**Files:**
- Rewrite: `packages/client/src/components/TechTreeCanvas.tsx`

This is the largest task. The new canvas renders a star-shaped tree with radial layout, CRT styling, pan/zoom, click-to-select, and an info panel.

- [ ] **Step 1: Write basic render test**

Create `packages/client/src/__tests__/TechTreeCanvas.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TechTreeCanvas from '../components/TechTreeCanvas';

// Mock store
vi.mock('../state/store', () => ({
  useStore: vi.fn(() => ({
    techTree: {
      researchedNodes: { kampf: 1 },
      totalResearched: 1,
      resetCooldownRemaining: 0,
    },
    research: { wissen: 500 },
  })),
}));

// Mock network
vi.mock('../network/client', () => ({
  network: {
    researchTechNode: vi.fn(),
    resetTechTree: vi.fn(),
    getTechTree: vi.fn(),
  },
}));

describe('TechTreeCanvas', () => {
  it('renders canvas element', () => {
    render(<TechTreeCanvas />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('shows WISSEN display', () => {
    render(<TechTreeCanvas />);
    expect(screen.getByText(/WISSEN/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement layout engine and constants**

In `TechTreeCanvas.tsx`, create layout constants and position calculator:

```typescript
// Branch angles (screen coords: 0° = right, 90° = down)
const BRANCH_ANGLES: Record<TechBranch, number> = {
  kampf: 270,     // top
  ausbau: 180,    // left
  intel: 0,       // right
  explorer: 90,   // bottom
};

const RING_SPACING = 120;        // px per depth
const MODULE_FAN_ANGLE = 30;     // ±degrees
const LEAF_FAN_ANGLE = 10;       // ±degrees
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 3.0;

// Node sizes (spec)
const NODE_SIZES = {
  core: 90,                      // circle radius
  branch: { w: 110, h: 50 },    // hexagon
  module: { w: 100, h: 42 },    // rounded rect
  specialization: { w: 100, h: 42 },
  leaf: 32,                      // circle diameter
};

// Node status colors
const STATUS_STYLES = {
  researched: { opacity: 1.0, glow: true },
  available: { opacity: 0.7, glow: 'pulse' },
  locked: { color: '#333', opacity: 0.3, glow: false },
  exclusive_blocked: { color: '#661111', opacity: 0.5, strikethrough: true },
};

function polarToCartesian(cx: number, cy: number, angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
}

/** Pre-compute positions for all 148 nodes + TECH CORE center */
function computeNodePositions(centerX: number, centerY: number): Map<string, { x: number; y: number }> {
  // ... compute positions using BRANCH_ANGLES, RING_SPACING, fan angles
  // Returns Map<nodeId, {x, y}> — see spec layout section
}
```

- [ ] **Step 3: Implement draw functions**

Add node drawing functions:

```typescript
function drawCenterNode(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  // Green glowing circle, 90px, "TECH CORE" text
}

function drawNode(ctx: CanvasRenderingContext2D, node: TechTreeNode, x: number, y: number, status: string): void {
  const branchColor = BRANCH_COLORS[node.branch];
  // Branch: hexagon 110×50
  // Module/Spec: rounded rect 100×42
  // Leaf: circle 32px diameter
  // Apply STATUS_STYLES[status] for opacity, glow, color override
}

function drawConnection(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, status: string): void {
  // Glow line between parent-child nodes
  // Researched: full brightness, Available: dim, Locked: very dim
}
```

- [ ] **Step 4: Implement pan/zoom interaction**

Add React state and event handlers:

```typescript
const [offset, setOffset] = useState({ x: 0, y: 0 });
const [zoom, setZoom] = useState(1.0);
const [dragging, setDragging] = useState(false);
const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

// Mouse handlers: onMouseDown (start drag), onMouseMove (pan), onMouseUp (end drag)
// onWheel: zoom = clamp(zoom + delta, ZOOM_MIN, ZOOM_MAX)
// Apply transform: ctx.setTransform(zoom, 0, 0, zoom, offset.x, offset.y)
```

- [ ] **Step 5: Implement click hit-testing and selection**

```typescript
const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

// onClick: transform mouse coords to canvas space, find nearest node within hit radius
// onDoubleClick: if node is available, show research confirmation dialog
```

- [ ] **Step 6: Implement info panel (React overlay)**

```typescript
// React div, positioned absolutely right of canvas
// Shows: node name, type, status, description
// Shows: cost (with global escalation %)
// Shows: effects (+/- with green/red color)
// Shows: leaf level and costs per level
// Shows: exclusivity warning if applicable
// [ERFORSCHEN] button → network.researchTechNode(nodeId)
```

- [ ] **Step 7: Implement header and reset button**

```typescript
// Header div above canvas:
// TECH TREE /// FORSCHUNGSBAUM    [WISSEN: {wissen.toLocaleString()}]    ERFORSCHT: {total} /// AUFSCHLAG: +{total*5}%

// Reset button (bottom-left):
// If cooldown > 0: "RESET TREE ({cooldown}s)" disabled
// Else: "RESET TREE" → network.resetTechTree()
// Also: +/- zoom buttons
```

- [ ] **Step 8: Add CRT overlay effects**

```typescript
// Scanlines: semi-transparent horizontal lines every 2px
// Vignette: radial gradient overlay (dark edges)
// Font: 'Courier New', monospace
// Glow: ctx.shadowColor + ctx.shadowBlur for researched nodes
// Match existing game CRT aesthetic
```

- [ ] **Step 9: Run tests**

Run: `cd packages/client && npx vitest run src/__tests__/TechTreeCanvas.test.tsx`

- [ ] **Step 10: Commit**

```bash
git add packages/client/src/components/TechTreeCanvas.tsx packages/client/src/__tests__/TechTreeCanvas.test.tsx
git commit -m "feat: new star-shaped TechTreeCanvas with CRT styling (#297)"
```

---

### Task 11: Integration & Cleanup

**Files:**
- Modify: `packages/shared/src/research.ts` (update isModuleUnlocked to use tech tree)
- Modify: `packages/shared/src/index.ts` (remove `canStartResearch` export)
- Modify: `packages/server/src/rooms/services/ShipService.ts` (update isModuleUnlocked callers)
- Various test file fixes

- [ ] **Step 1: Update isModuleUnlocked**

In `packages/shared/src/research.ts`, update `isModuleUnlocked` to check tech tree effects.

**Note:** The existing `isModuleFreelyAvailable(moduleId: string)` takes a string, not a ModuleDefinition. Keep the existing call pattern.

```typescript
import { getTechTreeEffects } from './techTreeEffects.js';

export function isModuleUnlocked(
  moduleId: string,
  mod: { category: string; tier: number },
  researchedNodes: Record<string, number>,
  blueprints: string[],
): boolean {
  if (isModuleFreelyAvailable(moduleId)) return true;
  if (blueprints.includes(moduleId)) return true;

  // Check tech tree tier unlock
  const effects = getTechTreeEffects(researchedNodes);
  const branchForCategory = getCategoryBranch(mod.category);
  if (branchForCategory) {
    const unlockedTier = effects.unlockedTiers[branchForCategory] ?? 1;
    return mod.tier <= unlockedTier;
  }
  return false;
}

/** Map module category to tech tree branch */
function getCategoryBranch(category: string): string | undefined {
  const mapping: Record<string, string | undefined> = {
    weapon: 'kampf',
    shield: 'ausbau',
    armor: 'ausbau',
    defense: 'ausbau',
    cargo: 'ausbau',
    mining: 'ausbau',
    scanner: 'intel',
    drive: 'explorer',
    generator: 'ausbau',
    special: undefined,
    repair: 'ausbau',
  };
  return mapping[category];
}
```

- [ ] **Step 2: Remove canStartResearch and update exports**

In `packages/shared/src/research.ts`: Remove the entire `canStartResearch` function.

In `packages/shared/src/index.ts`: Update the research export to remove `canStartResearch`:
```typescript
export { isModuleFreelyAvailable, isModuleUnlocked } from './research.js';
```

- [ ] **Step 3: Update isModuleUnlocked callers in ShipService**

In `packages/server/src/rooms/services/ShipService.ts`:

The old call was `isModuleUnlocked(moduleId, researchState)`. Update all callers to use new signature. The caller needs to:
1. Load `researchedNodes` from `player_tech_tree` table (via `getOrCreateTechTree`)
2. Get the module definition (category + tier) from the module registry
3. Pass `blueprints` from the research state

```typescript
import { getOrCreateTechTree } from '../../db/techTreeQueries.js';

// In handleEquipModule or handleBuyModule:
const techTree = await getOrCreateTechTree(auth.userId);
const moduleInfo = getModuleDefinition(data.moduleId);  // existing function
const research = await getResearchState(auth.userId);   // for blueprints only
if (!isModuleUnlocked(data.moduleId, moduleInfo, techTree.researched_nodes, research.blueprints)) {
  // ... error
}
```

- [ ] **Step 4: Fix affected tests**

Affected files:
- `packages/shared/src/__tests__/research.test.ts`: update `isModuleUnlocked` tests to new signature, remove `canStartResearch` tests
- `packages/server/src/__tests__/blueprintInventory.test.ts`: update mocks
- `packages/server/src/__tests__/moduleInventory.test.ts`: update mocks
- `packages/server/src/__tests__/werkstatt.test.ts`: update mocks

Run: `cd packages/shared && npx vitest run && cd ../server && npx vitest run`

- [ ] **Step 5: Build all packages**

```bash
cd packages/shared && npm run build
```

- [ ] **Step 6: Final test run**

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/research.ts packages/shared/src/index.ts packages/server/src/rooms/services/ShipService.ts packages/server/src/db/techTreeQueries.ts
git add packages/shared/src/__tests__/research.test.ts packages/server/src/__tests__/blueprintInventory.test.ts packages/server/src/__tests__/moduleInventory.test.ts packages/server/src/__tests__/werkstatt.test.ts
git commit -m "feat: integrate tech tree with module unlock system, cleanup (#297)"
```
