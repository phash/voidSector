import type { Client } from 'colyseus';
import type { AuthPayload } from '../../auth.js';
import {
  TECH_TREE_RESET_COOLDOWN_MS,
  getTechNode,
  calculateResearchCost,
  getTechTreeEffects,
  MODULES,
} from '@void-sector/shared';
import { getOrCreateTechTree, saveTechTree, resetTechTree as dbResetTree } from '../../db/techTreeQueries.js';
import { deductWissen, getWissen } from '../../db/queries.js';
import { addToInventory } from '../../engine/inventoryService.js';
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

    // Auto-grant first blueprint for newly accessible modules
    const node = getTechNode(data.nodeId);
    if (node && node.type === 'branch') {
      // Branch level increased — tier = newLevel + 1 (level 1→tier 2, level 2→tier 3, level 3→tier 4)
      const newTier = (currentLevel + 1) + 1;
      try {
        for (const mod of Object.values(MODULES)) {
          if (!mod.cost || !mod.acepPaths) continue;
          if (mod.tier !== newTier) continue;
          if (!(mod.acepPaths as string[]).includes(node.branch)) continue;
          await addToInventory(auth.userId, 'blueprint', mod.id, 1);
          client.send('logEntry', `BLUEPRINT ERHALTEN: ${mod.name}`);
        }
        client.send('inventoryUpdated', {});
      } catch { /* don't block research on blueprint grant failure */ }
    }

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
