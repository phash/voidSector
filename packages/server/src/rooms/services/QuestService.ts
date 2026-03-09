import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  GetStationNpcsMessage,
  AcceptQuestMessage,
  AbandonQuestMessage,
  Quest,
  QuestObjective,
  PlayerReputation,
  PlayerUpgrade,
  ReputationTier,
  NpcFactionId,
} from '@void-sector/shared';
import { QUEST_EXPIRY_DAYS, FACTION_UPGRADES } from '@void-sector/shared';
import { generateStationNpcs, getStationFaction } from '../../engine/npcgen.js';
import { generateStationQuests } from '../../engine/questgen.js';
import { validateAcceptQuest, getReputationTier, calculateLevel } from '../../engine/commands.js';
import {
  getPlayerReputations,
  getPlayerReputation,
  setPlayerReputation,
  getPlayerUpgrades,
  upsertPlayerUpgrade,
  getActiveQuests,
  getActiveQuestCount,
  insertQuest,
  updateQuestStatus,
  updateQuestObjectives,
  addPlayerXp,
  setPlayerLevel,
  addCredits,
  getPlayerCredits,
  getPlayerCargo,
  deductCargo,
} from '../../db/queries.js';

export class QuestService {
  constructor(private ctx: ServiceContext) {}

  async handleGetStationNpcs(client: Client, data: GetStationNpcsMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const npcs = generateStationNpcs(data.sectorX, data.sectorY);
    const reps = await getPlayerReputations(auth.userId);
    const faction = getStationFaction(data.sectorX, data.sectorY);
    const factionRep = reps.find((r) => r.faction_id === faction)?.reputation ?? 0;
    const tier = getReputationTier(factionRep) as ReputationTier;
    const dayOfYear = Math.floor(Date.now() / 86400000);
    const quests = generateStationQuests(data.sectorX, data.sectorY, dayOfYear, tier);
    this.ctx.send(client, 'stationNpcsResult', { npcs, quests });
  }

  async handleAcceptQuest(client: Client, data: AcceptQuestMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const count = await getActiveQuestCount(auth.userId);
    const validation = validateAcceptQuest(count);
    if (!validation.valid) {
      this.ctx.send(client, 'acceptQuestResult', { success: false, error: validation.error });
      return;
    }

    // Regenerate quest from template to validate it exists
    const reps = await getPlayerReputations(auth.userId);
    const faction = getStationFaction(data.stationX, data.stationY);
    const factionRep = reps.find((r) => r.faction_id === faction)?.reputation ?? 0;
    const tier = getReputationTier(factionRep) as ReputationTier;
    const dayOfYear = Math.floor(Date.now() / 86400000);
    const available = generateStationQuests(data.stationX, data.stationY, dayOfYear, tier);
    const questTemplate = available.find((q) => q.templateId === data.templateId);

    if (!questTemplate) {
      this.ctx.send(client, 'acceptQuestResult', { success: false, error: 'Quest not available' });
      return;
    }

    const expiresAt = new Date(Date.now() + QUEST_EXPIRY_DAYS * 86400000);
    const questId = await insertQuest(
      auth.userId,
      data.templateId,
      questTemplate.title,
      data.stationX,
      data.stationY,
      questTemplate.objectives,
      questTemplate.rewards,
      expiresAt,
    );

    const quest: Quest = {
      id: questId,
      templateId: data.templateId,
      npcName: questTemplate.npcName,
      npcFactionId: questTemplate.npcFactionId,
      title: questTemplate.title,
      description: questTemplate.description,
      stationX: data.stationX,
      stationY: data.stationY,
      objectives: questTemplate.objectives,
      rewards: questTemplate.rewards,
      status: 'active',
      acceptedAt: Date.now(),
      expiresAt: expiresAt.getTime(),
    };

    this.ctx.send(client, 'acceptQuestResult', { success: true, quest });
    this.ctx.send(client, 'logEntry', `Quest angenommen: ${quest.title}`);
  }

  async handleAbandonQuest(client: Client, data: AbandonQuestMessage): Promise<void> {
    const auth = client.auth as AuthPayload;
    const updated = await updateQuestStatus(data.questId, 'abandoned');
    this.ctx.send(client, 'abandonQuestResult', {
      success: updated,
      error: updated ? undefined : 'Quest not found',
    });
    if (updated) {
      await this.sendActiveQuests(client, auth.userId);
    }
  }

  async handleGetActiveQuests(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    await this.sendActiveQuests(client, auth.userId);
  }

  async handleGetReputation(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    await this.sendReputationUpdate(client, auth.userId);
  }

  async sendActiveQuests(client: Client, playerId: string): Promise<void> {
    const rows = await getActiveQuests(playerId);
    const quests: Quest[] = rows.map((r) => ({
      id: r.id,
      templateId: r.template_id,
      npcName: '',
      npcFactionId: 'independent' as NpcFactionId,
      title: r.title || r.template_id,
      description: '',
      stationX: r.station_x,
      stationY: r.station_y,
      objectives: r.objectives,
      rewards: r.rewards,
      status: r.status,
      acceptedAt: new Date(r.accepted_at).getTime(),
      expiresAt: new Date(r.expires_at).getTime(),
    }));
    this.ctx.send(client, 'activeQuests', { quests });
  }

  async sendReputationUpdate(client: Client, playerId: string): Promise<void> {
    const reps = await getPlayerReputations(playerId);
    const upgrades = await getPlayerUpgrades(playerId);

    const reputations: PlayerReputation[] = ['traders', 'scientists', 'pirates', 'ancients'].map(
      (fid) => {
        const rep = reps.find((r) => r.faction_id === fid)?.reputation ?? 0;
        return {
          factionId: fid as NpcFactionId,
          reputation: rep,
          tier: getReputationTier(rep) as ReputationTier,
        };
      },
    );

    const playerUpgrades: PlayerUpgrade[] = upgrades.map((u) => ({
      upgradeId: u.upgrade_id as any,
      active: u.active,
      unlockedAt: new Date(u.unlocked_at).getTime(),
    }));

    this.ctx.send(client, 'reputationUpdate', { reputations, upgrades: playerUpgrades });
  }

  async applyReputationChange(
    playerId: string,
    factionId: NpcFactionId,
    delta: number,
    client: Client,
  ): Promise<void> {
    const newRep = await setPlayerReputation(playerId, factionId, delta);
    const tier = getReputationTier(newRep);

    // Check upgrade unlock/deactivation
    for (const [upgradeId, upgrade] of Object.entries(FACTION_UPGRADES)) {
      if (upgrade.factionId === factionId) {
        const shouldBeActive = tier === 'honored';
        await upsertPlayerUpgrade(playerId, upgradeId, shouldBeActive);
      }
    }

    await this.sendReputationUpdate(client, playerId);
  }

  async applyXpGain(playerId: string, xp: number, client: Client): Promise<void> {
    const result = await addPlayerXp(playerId, xp);
    const newLevel = calculateLevel(result.xp);
    if (newLevel > result.level) {
      await setPlayerLevel(playerId, newLevel);
      this.ctx.send(client, 'logEntry', `LEVEL UP! Du bist jetzt Level ${newLevel}`);
    }
  }

  async checkQuestProgress(
    client: Client,
    playerId: string,
    action: string,
    context: Record<string, any>,
  ): Promise<void> {
    const rows = await getActiveQuests(playerId);
    const cargo = await getPlayerCargo(playerId);
    for (const row of rows) {
      const objectives = row.objectives as QuestObjective[];
      let updated = false;

      for (const obj of objectives) {
        if (obj.fulfilled) continue;

        if (
          obj.type === 'scan' &&
          action === 'scan' &&
          obj.targetX === context.sectorX &&
          obj.targetY === context.sectorY
        ) {
          obj.fulfilled = true;
          updated = true;
        }

        if (
          obj.type === 'fetch' &&
          action === 'arrive' &&
          context.sectorX === row.station_x &&
          context.sectorY === row.station_y
        ) {
          if (obj.resource && obj.amount && ((cargo as any)[obj.resource] ?? 0) >= obj.amount) {
            obj.fulfilled = true;
            updated = true;
          }
        }

        if (
          obj.type === 'delivery' &&
          action === 'arrive' &&
          obj.targetX === context.sectorX &&
          obj.targetY === context.sectorY
        ) {
          obj.fulfilled = true;
          updated = true;
        }

        if (
          obj.type === 'bounty' &&
          action === 'battle_won' &&
          obj.targetX === context.sectorX &&
          obj.targetY === context.sectorY
        ) {
          obj.fulfilled = true;
          updated = true;
        }
      }

      if (updated) {
        await updateQuestObjectives(row.id, objectives);
        this.ctx.send(client, 'questProgress', { questId: row.id, objectives });

        if (objectives.every((o) => o.fulfilled)) {
          await updateQuestStatus(row.id, 'completed');
          const rewards = row.rewards;

          if (rewards.credits) {
            await addCredits(playerId, rewards.credits);
            this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(playerId) });
          }
          if (rewards.xp) await this.applyXpGain(playerId, rewards.xp, client);
          if (rewards.reputation) {
            // Determine quest faction from template_id prefix
            const factionId = row.template_id.split('_')[0] as string;
            const validFactions = ['traders', 'scientists', 'pirates', 'ancients'];
            if (validFactions.includes(factionId)) {
              await this.applyReputationChange(
                playerId,
                factionId as NpcFactionId,
                rewards.reputation,
                client,
              );
            }
          }
          if (rewards.reputationPenalty && rewards.rivalFactionId) {
            await this.applyReputationChange(
              playerId,
              rewards.rivalFactionId as NpcFactionId,
              -rewards.reputationPenalty,
              client,
            );
          }

          // Deduct fetch resources from cargo
          for (const obj of objectives) {
            if (obj.type === 'fetch' && obj.resource && obj.amount) {
              await deductCargo(playerId, obj.resource, obj.amount);
            }
          }
          this.ctx.send(client, 'cargoUpdate', await getPlayerCargo(playerId));

          this.ctx.send(
            client,
            'logEntry',
            `Quest abgeschlossen: +${rewards.credits ?? 0} CR, +${rewards.xp ?? 0} XP`,
          );
          await this.sendActiveQuests(client, playerId);
        }
      }
    }
  }
}

// ─── Expansion & Warfare Quest Generators ────────────────────────────────────

export function generateDiplomacyQuest(
  targetFaction: string,
  borderQuadrant: { qx: number; qy: number },
) {
  return {
    type: 'diplomacy' as const,
    target_faction: targetFaction,
    border_qx: borderQuadrant.qx,
    border_qy: borderQuadrant.qy,
    description: `Build trust with the ${targetFaction} — deliver cultural artifacts to their border station`,
    rep_reward: 15,
    expires_hours: 48,
  };
}

export type WarSupportSubtype = 'logistics' | 'sabotage' | 'scanning' | 'salvage';

interface WarSupportConfig {
  defense_bonus: number;
  enemy_defense_reduction: number;
  attack_multiplier: number;
  description: string;
}

const WAR_SUPPORT_CONFIG: Record<WarSupportSubtype, WarSupportConfig> = {
  logistics: {
    defense_bonus: 200,
    enemy_defense_reduction: 0,
    attack_multiplier: 1.0,
    description: 'Deliver munitions and fuel to the front station',
  },
  sabotage: {
    defense_bonus: 0,
    enemy_defense_reduction: 150,
    attack_multiplier: 1.0,
    description: 'Hack enemy comm relays to lower their shields',
  },
  scanning: {
    defense_bonus: 0,
    enemy_defense_reduction: 0,
    attack_multiplier: 1.3,
    description: 'Deep-space scan to reveal enemy fleet positions',
  },
  salvage: {
    defense_bonus: 100,
    enemy_defense_reduction: 0,
    attack_multiplier: 1.1,
    description: 'Collect debris from the battle for tech bonuses',
  },
};

export function generateWarSupportQuest(
  subtype: WarSupportSubtype,
  targetQuadrant: { qx: number; qy: number },
) {
  const config = WAR_SUPPORT_CONFIG[subtype];
  return {
    type: 'war_support' as const,
    subtype,
    target_qx: targetQuadrant.qx,
    target_qy: targetQuadrant.qy,
    ...config,
    expires_hours: 24,
  };
}
