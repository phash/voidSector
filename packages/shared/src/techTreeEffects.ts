import { TECH_TREE_NODES, GLOBAL_COST_ESCALATION } from './techTree.js';
import type { TechStatKey, TechTreeNode } from './techTree.js';

export interface TechTreeEffects {
  unlockedTiers: Record<string, number>;
  statBonuses: Partial<Record<TechStatKey, number>>;
}

/**
 * Compute aggregated effects from researched nodes.
 * Branch level N → unlocked tier N+1 for that branch.
 * Leaf bonuses scale with level, penalties included.
 * Top-down inheritance: parent module leaves cascade to child specializations
 * because all effects aggregate into one flat statBonuses map.
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
