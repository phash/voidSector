import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import type {
  GetStationNpcsMessage,
  AcceptQuestMessage,
  AbandonQuestMessage,
  Quest,
  QuestObjective,
  QuestRewards,
  PlayerReputation,
  PlayerUpgrade,
  ReputationTier,
  NpcFactionId,
} from '@void-sector/shared';
import { QUEST_EXPIRY_DAYS, FACTION_UPGRADES, UNIVERSE_TICK_MS } from '@void-sector/shared';
import { redis } from './RedisAPStore.js';
import { generateStationNpcs, getStationFaction } from '../../engine/npcgen.js';
import { generateStationQuests } from '../../engine/questgen.js';
import { awardWissen } from '../../engine/wissenService.js';
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
  trackQuest,
  getTrackedQuests,
  getAcceptedQuestTemplateIds,
  addWissen,
  getQuestById,
  getCargoCapForPlayer,
} from '../../db/queries.js';
import {
  getCargoState,
  addToInventory,
  removeFromInventory,
  getInventoryItem,
} from '../../engine/inventoryService.js';
import { generateBountyTrail } from '../../engine/bountyQuestGen.js';
import { hashCoords } from '../../engine/worldgen.js';
import { QUEST_TEMPLATES } from '../../engine/questTemplates.js';

// Douglas Adams-style jettison messages
const JETTISON_MESSAGES = [
  "So long, and thanks for all the cargo.",
  "The universe is a big place. Your cargo just became someone else's problem.",
  "Don't panic. Your cargo did.",
  "This is Earth. Mostly harmless. Your cargo: definitely being harmful if dropped.",
  "42 reasons why you shouldn't abandon quests. This wasn't one of them.",
  "Your cargo has been jettisoned into the vast emptiness of space. Mostly harmless.",
  "The Answer to Life, the Universe, and Everything is 42. Your cargo? Gone.",
  "Space is big. Really big. Your cargo is now part of it.",
  "You have just destroyed a perfectly good cargo. Well done.",
  "The cargo was incinerated. Don't ask what's for dinner.",
  "Goodbye, cargo. It was nice knowing you. Mostly.",
  "Your cargo has entered the infinite improbability of being lost forever.",
  "So this is it. We're really doing it. Jettisoning cargo. Brilliant.",
];

function getRandomJettisonMessage(): string {
  return JETTISON_MESSAGES[Math.floor(Math.random() * JETTISON_MESSAGES.length)];
}

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
    const allQuests = generateStationQuests(data.sectorX, data.sectorY, dayOfYear, tier);
    const acceptedIds = await getAcceptedQuestTemplateIds(auth.userId, data.sectorX, data.sectorY);
    const afterAccepted =
      acceptedIds.length > 0 ? allQuests.filter((q) => !acceptedIds.includes(q.templateId)) : allQuests;

    // Filter out quests with an active Redis cooldown
    const cooldownFiltered = await Promise.all(
      afterAccepted.map(async (q) => {
        const key = `quest_cooldown:${auth.userId}:${data.sectorX}:${data.sectorY}:${q.templateId}`;
        const exists = await redis.get(key);
        return exists ? null : q;
      }),
    );
    const quests = cooldownFiltered.filter(Boolean) as typeof afterAccepted;

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

    let objectives = questTemplate.objectives;
    let title = questTemplate.title;
    let description = questTemplate.description;

    // Fetch quest: check cargo capacity before accepting
    const fetchObj = objectives.find((o) => o.type === 'fetch');
    if (fetchObj?.amount) {
      const [cargoState, cargoCap] = await Promise.all([
        getCargoState(auth.userId),
        getCargoCapForPlayer(auth.userId),
      ]);
      const currentUsed =
        cargoState.ore + cargoState.gas + cargoState.crystal + cargoState.slates + cargoState.artefact;
      if (currentUsed + fetchObj.amount > cargoCap) {
        this.ctx.send(client, 'acceptQuestResult', {
          success: false,
          error: 'Zu wenig Laderaum für diese Quest',
        });
        return;
      }
    }

    // Bounty chase: generate trail at accept time
    if (objectives[0]?.type === 'bounty_trail') {
      const origTemplate = QUEST_TEMPLATES.find((t) => t.id === data.templateId);
      const [minLvl, maxLvl] = origTemplate?.targetLevelRange ?? [1, 3];
      const levelSeed = hashCoords(data.stationX, data.stationY, dayOfYear);
      const targetLevel = minLvl + (Math.abs(levelSeed) % (maxLvl - minLvl + 1));

      const trail = generateBountyTrail(
        data.stationX,
        data.stationY,
        targetLevel,
        dayOfYear,
      );

      objectives = [
        {
          type: 'bounty_trail' as const,
          description: 'Verfolge die Spur des Ziels',
          fulfilled: false,
          trail: trail.steps,
          currentStep: 0,
          targetName: trail.targetName,
          targetLevel: trail.targetLevel,
          currentHint: trail.steps[0]?.hint ?? '',
        },
        {
          type: 'bounty_combat' as const,
          description: `Schalte ${trail.targetName} aus`,
          fulfilled: false,
          sectorX: trail.combatX,
          sectorY: trail.combatY,
          targetName: trail.targetName,
          targetLevel: trail.targetLevel,
        },
        {
          type: 'bounty_deliver' as const,
          description: 'Liefere den Gefangenen zur Auftrags-Station',
          fulfilled: false,
          stationX: data.stationX,
          stationY: data.stationY,
        },
      ];

      title = `Kopfgeld: ${trail.targetName}`;
      description = description.replace('???', trail.targetName);
    }

    const expiresAt = new Date(Date.now() + QUEST_EXPIRY_DAYS * 86400000);
    const questId = await insertQuest(
      auth.userId,
      data.templateId,
      title,
      description,
      data.stationX,
      data.stationY,
      objectives,
      questTemplate.rewards,
      expiresAt,
    );

    const quest: Quest = {
      id: questId,
      templateId: data.templateId,
      npcName: questTemplate.npcName,
      npcFactionId: questTemplate.npcFactionId,
      title,
      description,
      stationX: data.stationX,
      stationY: data.stationY,
      objectives,
      rewards: questTemplate.rewards,
      status: 'active',
      acceptedAt: Date.now(),
      expiresAt: expiresAt.getTime(),
    };

    // Set Redis cooldown so this template won't reappear for 10 universe ticks
    const cooldownKey = `quest_cooldown:${auth.userId}:${data.stationX}:${data.stationY}:${data.templateId}`;
    const ttlSeconds = Math.ceil(UNIVERSE_TICK_MS * 10 / 1000);
    redis.set(cooldownKey, '1', 'EX', ttlSeconds).catch(() => {});

    this.ctx.send(client, 'acceptQuestResult', { success: true, quest });
    this.ctx.send(client, 'logEntry', `Quest angenommen: ${quest.title}`);
  }

  async handleAbandonQuest(client: Client, data: AbandonQuestMessage): Promise<void> {
    const auth = client.auth as AuthPayload;

    // Cleanup inventory items tied to this quest & track jettisoned items
    const quest = await getQuestById(data.questId, auth.userId);
    const jettisoned: string[] = [];

    if (quest) {
      const objectives = quest.objectives as any[];
      // Bounty chase: remove prisoner if combat objective was fulfilled
      const combatObj = objectives?.find((o: any) => o.type === 'bounty_combat');
      if (combatObj?.fulfilled) {
        await removeFromInventory(auth.userId, 'prisoner', quest.id, 1);
        jettisoned.push('prisoner');
      }
      // Scan quest: remove data slate if scan is done but not yet delivered
      const scanDone = objectives?.some((o: any) => o.type === 'scan' && o.fulfilled);
      const deliverDone = objectives?.some((o: any) => o.type === 'scan_deliver' && o.fulfilled);
      if (scanDone && !deliverDone) {
        await removeFromInventory(auth.userId, 'data_slate', quest.id, 1);
        jettisoned.push('data_slate');
      }
    }

    const updated = await updateQuestStatus(data.questId, 'abandoned');
    this.ctx.send(client, 'abandonQuestResult', {
      success: updated,
      error: updated ? undefined : 'Quest not found',
    });
    if (updated) {
      // Send jettison notification if items were removed
      if (jettisoned.length > 0) {
        const jettisonMsg = getRandomJettisonMessage();
        this.ctx.send(client, 'logEntry',
          `QUEST ABGEBROCHEN — Ladung abgeworfen: ${jettisoned.join(', ')} • "${jettisonMsg}"`);
      }
      await this.sendActiveQuests(client, auth.userId);
    }
  }

  async handleGetActiveQuests(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    await this.sendActiveQuests(client, auth.userId);
  }

  async handleTrackQuest(
    client: Client,
    data: { questId: string; tracked: boolean },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    // Enforce max 5 tracked quests
    if (data.tracked) {
      const currentTracked = await getTrackedQuests(auth.userId);
      if (currentTracked.length >= 5) {
        this.ctx.send(client, 'trackQuestResult', {
          success: false,
          error: 'MAX_TRACKED_REACHED',
        });
        return;
      }
    }
    await trackQuest(auth.userId, data.questId, data.tracked);
    const trackedQuests = await getTrackedQuests(auth.userId);
    this.ctx.send(client, 'trackedQuestsUpdate', { quests: trackedQuests });
    this.ctx.send(client, 'trackQuestResult', { success: true });
  }

  async handleGetTrackedQuests(client: Client): Promise<void> {
    const auth = client.auth as AuthPayload;
    const trackedQuests = await getTrackedQuests(auth.userId);
    this.ctx.send(client, 'trackedQuestsUpdate', { quests: trackedQuests });
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

  async handleDeliverQuestResources(
    client: Client,
    data: { questId: string; sectorX: number; sectorY: number },
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const row = await getQuestById(data.questId, auth.userId);

    if (!row) {
      this.ctx.send(client, 'actionError', 'Quest nicht gefunden');
      return;
    }
    if (row.status !== 'active') {
      this.ctx.send(client, 'actionError', 'Quest nicht aktiv');
      return;
    }
    if (data.sectorX !== row.station_x || data.sectorY !== row.station_y) {
      this.ctx.send(client, 'actionError', 'Nicht an der richtigen Station');
      return;
    }

    const objectives = row.objectives as QuestObjective[];
    const cargo = await getCargoState(auth.userId);
    let anythingDelivered = false;

    for (const obj of objectives) {
      if (obj.type !== 'delivery' || !obj.resource || obj.amount == null || obj.fulfilled) continue;
      const currentProgress = obj.progress ?? 0;
      const remaining = obj.amount - currentProgress;
      const available = (cargo as Record<string, number>)[obj.resource] ?? 0;
      const toDeliver = Math.min(remaining, available);
      if (toDeliver <= 0) continue;

      await removeFromInventory(auth.userId, 'resource', obj.resource, toDeliver);
      obj.progress = currentProgress + toDeliver;
      if (obj.progress >= obj.amount) obj.fulfilled = true;
      anythingDelivered = true;
    }

    if (!anythingDelivered) {
      this.ctx.send(client, 'actionError', 'Keine Ressourcen zum Abliefern');
      return;
    }

    await updateQuestObjectives(row.id, objectives);
    this.ctx.send(client, 'questProgress', { questId: row.id, objectives });
    this.ctx.send(client, 'cargoUpdate', await getCargoState(auth.userId));

    if (objectives.every((o) => o.fulfilled)) {
      await updateQuestStatus(row.id, 'completed');
      const rewards = row.rewards as QuestRewards;

      if (rewards.credits) {
        await addCredits(auth.userId, rewards.credits);
        this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
      }
      if (rewards.xp) await this.applyXpGain(auth.userId, rewards.xp, client);
      if (rewards.reputation) {
        const factionId = row.template_id.split('_')[0] as string;
        const validFactions = ['traders', 'scientists', 'pirates', 'ancients'];
        if (validFactions.includes(factionId)) {
          await this.applyReputationChange(
            auth.userId,
            factionId as NpcFactionId,
            rewards.reputation,
            client,
          );
        }
      }
      if (rewards.wissen) await addWissen(auth.userId, rewards.wissen);

      // Wissen from quest completion, scaled by reward value
      const questWissen = (rewards.credits ?? 0) > 500 ? 10 : 5;
      awardWissen(auth.userId, questWissen).catch(() => {});

      this.ctx.send(client, 'questComplete', {
        id: row.id,
        title: row.title,
        rewards,
      });
      this.ctx.send(
        client,
        'logEntry',
        `Quest abgeschlossen: +${rewards.credits ?? 0} CR, +${rewards.xp ?? 0} XP`,
      );
      await this.sendActiveQuests(client, auth.userId);
    }
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
    const cargo = await getCargoState(playerId);
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
          // When all scan objectives in this quest are now fulfilled, issue a data slate
          const allScansDone = objectives
            .filter((o) => o.type === 'scan')
            .every((o) => o.fulfilled);
          if (allScansDone) {
            await addToInventory(playerId, 'data_slate', row.id, 1);
          }
        }

        // scan_deliver: player returns data slate to quest station
        if (
          obj.type === 'scan_deliver' &&
          action === 'arrive' &&
          obj.stationX === context.sectorX &&
          obj.stationY === context.sectorY
        ) {
          const hasSlate = await getInventoryItem(playerId, 'data_slate', row.id);
          if (hasSlate > 0) {
            await removeFromInventory(playerId, 'data_slate', row.id, 1);
            obj.fulfilled = true;
            updated = true;
          }
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

        // bounty_trail: advance trail step on matching scan
        if (
          obj.type === 'bounty_trail' &&
          action === 'scan' &&
          Array.isArray(obj.trail) &&
          obj.currentStep !== undefined
        ) {
          const currentTrailStep = obj.trail[obj.currentStep];
          if (
            currentTrailStep &&
            currentTrailStep.x === context.sectorX &&
            currentTrailStep.y === context.sectorY
          ) {
            obj.currentStep += 1;
            const nextStep = obj.trail[obj.currentStep];
            obj.currentHint = nextStep?.hint ?? `Das Ziel wartet auf dich!`;
            if (obj.currentStep >= obj.trail.length) {
              obj.fulfilled = true;
            }
            updated = true;
            this.ctx.send(client, 'questProgress', {
              questId: row.id,
              objectives,
              hint: obj.currentHint,
            });
          }
        }

        // bounty_combat: add prisoner to inventory on battle_won at combat sector
        if (
          obj.type === 'bounty_combat' &&
          action === 'battle_won' &&
          obj.sectorX === context.sectorX &&
          obj.sectorY === context.sectorY
        ) {
          obj.fulfilled = true;
          updated = true;
          await addToInventory(playerId, 'prisoner', row.id, 1);
        }

        // bounty_deliver: check prisoner in inventory on arrive at station
        if (
          obj.type === 'bounty_deliver' &&
          action === 'arrive' &&
          obj.stationX === context.sectorX &&
          obj.stationY === context.sectorY
        ) {
          const hasPrisoner = await getInventoryItem(playerId, 'prisoner', row.id);
          if (hasPrisoner > 0) {
            await removeFromInventory(playerId, 'prisoner', row.id, 1);
            obj.fulfilled = true;
            updated = true;
          }
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
          if (rewards.wissen) {
            await addWissen(playerId, rewards.wissen);
          }

          // Wissen from quest completion, scaled by reward value
          const questWissen = (rewards.credits ?? 0) > 500 ? 10 : 5;
          awardWissen(playerId, questWissen).catch(() => {});

          // Deduct fetch resources from cargo
          for (const obj of objectives) {
            if (obj.type === 'fetch' && obj.resource && obj.amount) {
              await removeFromInventory(playerId, 'resource', obj.resource, obj.amount);
            }
          }
          this.ctx.send(client, 'cargoUpdate', await getCargoState(playerId));

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

export function generateWarSupportQuest(
  subtype: WarSupportSubtype,
  targetQuadrant: { qx: number; qy: number },
) {
  const base = {
    type: 'war_support' as const,
    subtype,
    target_qx: targetQuadrant.qx,
    target_qy: targetQuadrant.qy,
    expires_hours: 24,
  };

  switch (subtype) {
    case 'logistics':
      return {
        ...base,
        defense_bonus: 200,
        description: 'Deliver munitions and fuel to the front station',
      };
    case 'sabotage':
      return {
        ...base,
        enemy_defense_reduction: 150,
        description: 'Hack enemy comm relays to lower their shields',
      };
    case 'scanning':
      return {
        ...base,
        attack_multiplier: 1.3,
        description: 'Deep-space scan to reveal enemy fleet positions',
      };
    case 'salvage':
      return {
        ...base,
        defense_bonus: 100,
        attack_multiplier: 1.1,
        description: 'Collect debris from the battle for tech bonuses',
      };
  }
}
