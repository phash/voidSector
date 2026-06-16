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
import { QUEST_EXPIRY_DAYS, FACTION_UPGRADES, UNIVERSE_TICK_MS, MAX_TRACKED_QUESTS } from '@void-sector/shared';
import { logger } from '../../utils/logger.js';
import { redis } from './RedisAPStore.js';
import { generateStationNpcs, getStationFaction } from '../../engine/npcgen.js';
import { generateStationQuests } from '../../engine/questgen.js';
import { awardWissenAndNotify } from '../../engine/wissenService.js';
import { recordCivContribution } from '../../engine/civilizationMeter.js';
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
  getInventory,
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
import { getConfig } from '../../engine/gameConfigApply.js';

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

    const expiresAt = new Date(Date.now() + ((getConfig('QUEST_EXPIRY_DAYS') as typeof QUEST_EXPIRY_DAYS) ?? QUEST_EXPIRY_DAYS) * 86400000);
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
    // Enforce max tracked quests
    if (data.tracked) {
      const currentTracked = await getTrackedQuests(auth.userId);
      if (currentTracked.length >= MAX_TRACKED_QUESTS) {
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

  async handleDeliverQuest(
    client: Client,
    questId: string,
    playerX: number,
    playerY: number,
  ): Promise<void> {
    const auth = client.auth as AuthPayload;
    const rows = await getActiveQuests(auth.userId);
    const row = rows.find((r) => r.id === questId);
    if (!row) {
      this.ctx.send(client, 'error', { code: 'QUEST_NOT_FOUND', message: 'Quest not found' });
      return;
    }
    const objectives = row.objectives as QuestObjective[];

    // Find a deliverable objective at current position
    const deliverObj = objectives.find(
      (o) =>
        !o.fulfilled &&
        ((o.type === 'scan_deliver' && o.stationX === playerX && o.stationY === playerY) ||
         (o.type === 'fetch' && row.station_x === playerX && row.station_y === playerY) ||
         (o.type === 'bounty_deliver' && o.stationX === playerX && o.stationY === playerY)),
    );
    if (!deliverObj) {
      this.ctx.send(client, 'error', { code: 'DELIVER_FAIL', message: 'Abgabe hier nicht möglich' });
      return;
    }

    // For scan_deliver: check that all scan objectives are done
    if (deliverObj.type === 'scan_deliver') {
      const allScansDone = objectives.filter((o) => o.type === 'scan').every((o) => o.fulfilled);
      if (!allScansDone) {
        this.ctx.send(client, 'error', { code: 'DELIVER_FAIL', message: 'Scans noch nicht abgeschlossen' });
        return;
      }
      // Remove data_slate from inventory if it exists (may not exist due to earlier bugs)
      try {
        const hasSlate = await getInventoryItem(auth.userId, 'data_slate', questId);
        if (hasSlate > 0) {
          await removeFromInventory(auth.userId, 'data_slate', questId, 1);
        }
      } catch { /* ignore — slate may not exist */ }
    }

    // For fetch: check cargo
    if (deliverObj.type === 'fetch' && deliverObj.resource && deliverObj.amount) {
      const cargo = await getCargoState(auth.userId);
      if (((cargo as any)[deliverObj.resource] ?? 0) < deliverObj.amount) {
        this.ctx.send(client, 'error', { code: 'DELIVER_FAIL', message: 'Nicht genug Ressourcen' });
        return;
      }
    }

    // For bounty_deliver: check prisoner
    if (deliverObj.type === 'bounty_deliver') {
      const hasPrisoner = await getInventoryItem(auth.userId, 'prisoner', questId);
      if (hasPrisoner <= 0) {
        this.ctx.send(client, 'error', { code: 'DELIVER_FAIL', message: 'Kein Gefangener' });
        return;
      }
      await removeFromInventory(auth.userId, 'prisoner', questId, 1);
    }

    deliverObj.fulfilled = true;
    await updateQuestObjectives(questId, objectives);
    this.ctx.send(client, 'questProgress', { questId, objectives });

    // Re-send tracked quests for bookmark update
    const updatedTracked = await getTrackedQuests(auth.userId);
    this.ctx.send(client, 'trackedQuestsUpdate', { quests: updatedTracked });

    // Check if all objectives are now fulfilled → complete quest
    if (objectives.every((o) => o.fulfilled)) {
      await this.completeQuest(client, auth.userId, row);
    }

    // Refresh active quests list
    await this.sendActiveQuests(client, auth.userId);
  }

  // Player confirmed the turn-in offer (questTurnInOffer → turnInQuest). Verify
  // the player is at the giver station with all scans done, robustly consume the
  // data slate, and complete the quest via the shared completion path.
  async handleTurnInQuest(client: Client, data: { questId: string }): Promise<void> {
    const auth = client.auth as AuthPayload;
    const row = await getQuestById(data.questId, auth.userId);

    if (!row) {
      this.ctx.send(client, 'error', { code: 'TURNIN_FAIL', message: 'Quest nicht gefunden' });
      return;
    }
    if (row.status !== 'active') {
      this.ctx.send(client, 'error', { code: 'TURNIN_FAIL', message: 'Quest nicht aktiv' });
      return;
    }

    const objectives = row.objectives as QuestObjective[];
    const deliverObj = objectives.find((o) => o.type === 'scan_deliver');
    if (!deliverObj) {
      this.ctx.send(client, 'error', { code: 'TURNIN_FAIL', message: 'Keine Abgabe für diese Quest' });
      return;
    }
    if (deliverObj.fulfilled) {
      this.ctx.send(client, 'error', { code: 'TURNIN_FAIL', message: 'Quest bereits abgeschlossen' });
      return;
    }

    // Must be physically at the giver station.
    const playerX = this.ctx._px(client.sessionId);
    const playerY = this.ctx._py(client.sessionId);
    if (deliverObj.stationX !== playerX || deliverObj.stationY !== playerY) {
      this.ctx.send(client, 'error', { code: 'TURNIN_FAIL', message: 'Nicht an der Auftrags-Station' });
      return;
    }

    // All non-(scan_deliver) objectives (i.e. the scan(s)) must be fulfilled.
    const scansDone = objectives.filter((o) => o.type !== 'scan_deliver').every((o) => o.fulfilled);
    if (!scansDone) {
      this.ctx.send(client, 'error', { code: 'TURNIN_FAIL', message: 'Quest noch nicht abgeschlossen' });
      return;
    }

    // Robustly consume the data slate — do NOT block completion if it is missing.
    try {
      const hasSlate = await getInventoryItem(auth.userId, 'data_slate', row.id);
      if (hasSlate > 0) {
        await removeFromInventory(auth.userId, 'data_slate', row.id, 1);
      }
    } catch {
      /* ignore — slate may not exist */
    }

    deliverObj.fulfilled = true;
    await updateQuestObjectives(row.id, objectives);
    this.ctx.send(client, 'questProgress', { questId: row.id, objectives });

    // Complete via the shared path (rewards granted + questComplete sent).
    await this.completeQuest(client, auth.userId, row);
    const updatedTracked = await getTrackedQuests(auth.userId);
    this.ctx.send(client, 'trackedQuestsUpdate', { quests: updatedTracked });
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
      const available = (cargo as unknown as Record<string, number>)[obj.resource] ?? 0;
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
      // Community quest: each completed quest counts toward the interaction goal (#531)
      this.ctx.contributeToCommunityQuest(auth.userId, 1, 'community_interaction').catch(() => {});
      // SP8: advance the global civilization meter and push the new state.
      recordCivContribution('quest_completed')
        .then((s) => this.ctx.broadcast('civMeterUpdate', s))
        .catch(() => {});
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

      // Blueprint reward
      if (rewards.rewardBlueprint) {
        const hasBlueprint = await getInventoryItem(auth.userId, 'blueprint', rewards.rewardBlueprint);
        if (hasBlueprint > 0) {
          // Player already has this blueprint — give alternative reward (credits + wissen)
          const altCredits = 200;
          const altWissen = 15;
          await addCredits(auth.userId, altCredits);
          await addWissen(auth.userId, altWissen);
          this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(auth.userId) });
        } else {
          await addToInventory(auth.userId, 'blueprint', rewards.rewardBlueprint, 1);
        }
        const items = await getInventory(auth.userId);
        this.ctx.send(client, 'inventoryState', { items });
      }

      // Wissen from quest completion, scaled by reward value
      const questWissen = (rewards.credits ?? 0) > 500 ? 10 : 5;
      awardWissenAndNotify(client, auth.userId, questWissen);

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

  // Called automatically after a successful NPC sell — credits delivery objectives
  // without removing cargo (trade already did that).
  async onResourceSoldAtStation(
    client: Client,
    playerId: string,
    sectorX: number,
    sectorY: number,
    resource: string,
    amount: number,
  ): Promise<void> {
    const quests = await getActiveQuests(playerId);
    for (const row of quests) {
      if (row.station_x !== sectorX || row.station_y !== sectorY) continue;
      const objectives = row.objectives as QuestObjective[];
      let changed = false;
      let remaining = amount;
      for (const obj of objectives) {
        if (obj.type !== 'delivery' || obj.resource !== resource || obj.fulfilled || remaining <= 0) continue;
        const progress = obj.progress ?? 0;
        const toCredit = Math.min(remaining, (obj.amount ?? 0) - progress);
        if (toCredit <= 0) continue;
        obj.progress = progress + toCredit;
        if (obj.progress >= (obj.amount ?? 0)) obj.fulfilled = true;
        remaining -= toCredit;
        changed = true;
      }
      if (!changed) continue;
      await updateQuestObjectives(row.id, objectives);
      this.ctx.send(client, 'questProgress', { questId: row.id, objectives });
      if (objectives.every((o) => o.fulfilled)) {
        await updateQuestStatus(row.id, 'completed');
        const rewards = row.rewards as QuestRewards;
        if (rewards.credits) {
          await addCredits(playerId, rewards.credits);
          this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(playerId) });
        }
        if (rewards.xp) await this.applyXpGain(playerId, rewards.xp, client);
        if (rewards.reputation) {
          const factionId = row.template_id.split('_')[0] as string;
          const validFactions = ['traders', 'scientists', 'pirates', 'ancients'];
          if (validFactions.includes(factionId)) {
            await this.applyReputationChange(playerId, factionId as NpcFactionId, rewards.reputation, client);
          }
        }
        if (rewards.wissen) await addWissen(playerId, rewards.wissen);

        // Blueprint reward
        if (rewards.rewardBlueprint) {
          const hasBlueprint = await getInventoryItem(playerId, 'blueprint', rewards.rewardBlueprint);
          if (hasBlueprint > 0) {
            const altCredits = 200;
            const altWissen = 15;
            await addCredits(playerId, altCredits);
            await addWissen(playerId, altWissen);
            this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(playerId) });
          } else {
            await addToInventory(playerId, 'blueprint', rewards.rewardBlueprint, 1);
          }
          const items = await getInventory(playerId);
          this.ctx.send(client, 'inventoryState', { items });
        }

        const questWissen = (rewards.credits ?? 0) > 500 ? 10 : 5;
        awardWissenAndNotify(client, playerId, questWissen);
        this.ctx.send(client, 'questComplete', { id: row.id, title: row.title, rewards });
        this.ctx.send(client, 'logEntry', `Quest abgeschlossen: +${rewards.credits ?? 0} CR, +${rewards.xp ?? 0} XP`);
        await this.sendActiveQuests(client, playerId);
      }
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
    logger.info({ action, context, playerId }, 'QUEST-DEBUG checkQuestProgress called');
    const rows = await getActiveQuests(playerId);
    logger.info({ questCount: rows.length }, 'QUEST-DEBUG active quests found');
    const cargo = await getCargoState(playerId);
    for (const row of rows) {
      const objectives = row.objectives as QuestObjective[];
      let updated = false;

      for (const obj of objectives) {
        if (obj.fulfilled) continue;

        if (obj.type === 'scan' && action === 'scan') {
          logger.info({
            objTargetX: obj.targetX, objTargetY: obj.targetY,
            ctxSectorX: context.sectorX, ctxSectorY: context.sectorY,
            typeObj: typeof obj.targetX, typeCtx: typeof context.sectorX,
            equal: obj.targetX === context.sectorX && obj.targetY === context.sectorY,
          }, 'QUEST-DEBUG scan check');
        }

        if (
          obj.type === 'scan' &&
          action === 'scan' &&
          obj.targetX === context.sectorX &&
          obj.targetY === context.sectorY
        ) {
          logger.info({ questId: row.id }, 'QUEST-DEBUG scan objective matched — setting fulfilled');
          obj.fulfilled = true;
          updated = true;
          // When all scan objectives in this quest are now fulfilled, issue a data slate
          const allScansDone = objectives
            .filter((o) => o.type === 'scan')
            .every((o) => o.fulfilled);
          if (allScansDone) {
            try {
              await addToInventory(playerId, 'data_slate', row.id, 1);
              logger.info({ questId: row.id }, 'QUEST-DEBUG data_slate added');
            } catch (err) {
              logger.error({ err, questId: row.id }, 'QUEST-DEBUG addToInventory FAILED');
            }
          }
        }

        // scan_deliver: player returns to quest station with scans done →
        // OFFER turn-in instead of silently auto-completing. The client shows a
        // popup; only when the player confirms (turnInQuest) does the quest
        // complete via handleTurnInQuest. "Später" → re-offered on next arrival.
        if (
          obj.type === 'scan_deliver' &&
          action === 'arrive' &&
          obj.stationX === context.sectorX &&
          obj.stationY === context.sectorY
        ) {
          // Ready only when every OTHER objective (i.e. the scan(s)) is fulfilled.
          const otherObjectivesDone = objectives
            .filter((o) => o !== obj)
            .every((o) => o.fulfilled);
          if (otherObjectivesDone) {
            const rewardCredits = (row.rewards as QuestRewards | undefined)?.credits;
            this.ctx.send(client, 'questTurnInOffer', {
              questId: row.id,
              title: row.title ?? row.template_id,
              ...(rewardCredits != null ? { rewardCredits } : {}),
            });
          }
          // Do NOT consume the slate, mark fulfilled, or complete here.
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
          (obj.type === 'bounty_chase' || obj.type === 'bounty_combat') &&
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
          try {
            await addToInventory(playerId, 'prisoner', row.id, 1);
            logger.info({ questId: row.id }, 'QUEST-DEBUG prisoner added');
          } catch (err) {
            logger.error({ err, questId: row.id }, 'QUEST-DEBUG addToInventory FAILED');
          }
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

        // NPC communication: find_npc and deliver_to_npc
        if (
          (obj.type === 'find_npc' || obj.type === 'deliver_to_npc') &&
          action === 'communicate_npc' &&
          obj.targetNpcId === context.npcId
        ) {
          if (obj.type === 'deliver_to_npc' && obj.cargoItem) {
            const hasItem = await getInventoryItem(playerId, 'prisoner', obj.cargoItem);
            if (hasItem <= 0) continue;
            await removeFromInventory(playerId, 'prisoner', obj.cargoItem, 1);
          }
          obj.fulfilled = true;
          updated = true;
        }
      }

      if (updated) {
        try {
          await updateQuestObjectives(row.id, objectives);
          logger.info({ questId: row.id, objectives }, 'QUEST-DEBUG objectives saved');
        } catch (err) {
          logger.error({ err, questId: row.id }, 'QUEST-DEBUG updateQuestObjectives FAILED');
        }
        this.ctx.send(client, 'questProgress', { questId: row.id, objectives });
        // Re-send tracked quests so bookmark labels update with current objective
        const updatedTracked = await getTrackedQuests(playerId);
        this.ctx.send(client, 'trackedQuestsUpdate', { quests: updatedTracked });

        if (objectives.every((o) => o.fulfilled)) {
          await this.completeQuest(client, playerId, row);
          // Clear from tracking after quest completion
          const updatedTracked = await getTrackedQuests(playerId);
          this.ctx.send(client, 'trackedQuestsUpdate', { quests: updatedTracked });
        }
      }
    }
  }

  private async completeQuest(client: Client, playerId: string, row: any): Promise<void> {
    await updateQuestStatus(row.id, 'completed');
    const rewards = row.rewards;
    const objectives = row.objectives as QuestObjective[];

    if (rewards.credits) {
      await addCredits(playerId, rewards.credits);
      this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(playerId) });
    }
    if (rewards.xp) await this.applyXpGain(playerId, rewards.xp, client);
    if (rewards.reputation) {
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

    // Blueprint reward
    if (rewards.rewardBlueprint) {
      const hasBlueprint = await getInventoryItem(playerId, 'blueprint', rewards.rewardBlueprint);
      if (hasBlueprint > 0) {
        const altCredits = 200;
        const altWissen = 15;
        await addCredits(playerId, altCredits);
        await addWissen(playerId, altWissen);
        this.ctx.send(client, 'creditsUpdate', { credits: await getPlayerCredits(playerId) });
      } else {
        await addToInventory(playerId, 'blueprint', rewards.rewardBlueprint, 1);
      }
      const items = await getInventory(playerId);
      this.ctx.send(client, 'inventoryState', { items });
    }

    // Wissen from quest completion, scaled by reward value
    const questWissen = (rewards.credits ?? 0) > 500 ? 10 : 5;
    awardWissenAndNotify(client, playerId, questWissen);

    // Deduct fetch resources from cargo
    for (const obj of objectives) {
      if (obj.type === 'fetch' && obj.resource && obj.amount) {
        await removeFromInventory(playerId, 'resource', obj.resource, obj.amount);
      }
    }
    this.ctx.send(client, 'cargoUpdate', await getCargoState(playerId));

    this.ctx.send(client, 'questComplete', { id: row.id, title: row.title ?? row.template_id, rewards });
    this.ctx.send(
      client,
      'logEntry',
      `Quest abgeschlossen: +${rewards.credits ?? 0} CR, +${rewards.xp ?? 0} XP`,
    );
    await this.sendActiveQuests(client, playerId);
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
