import type { TechStatKey } from './techTree.js';
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
export declare function getTechTreeEffects(researchedNodes: Record<string, number>): TechTreeEffects;
/**
 * Calculate the Wissen cost to research a node at a given current level.
 * @param nodeId - The tech node to research
 * @param currentLevel - Current level of the node (0 = not yet researched)
 * @param totalResearched - Total number of research actions performed (for global escalation)
 */
export declare function calculateResearchCost(nodeId: string, currentLevel: number, totalResearched: number): number;
//# sourceMappingURL=techTreeEffects.d.ts.map