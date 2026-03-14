import { hashCoords } from './worldgen.js';
import { WORLD_SEED } from '@void-sector/shared';
import type {
  NpcFactionId,
  ReputationTier,
  AvailableQuest,
  QuestObjective,
} from '@void-sector/shared';
import { QUEST_TEMPLATES } from './questTemplates.js';
import type { QuestTemplate } from './questTemplates.js';
import { generateStationNpcs, getStationFaction } from './npcgen.js';

const QUEST_SEED_SALT = 9999;

function getReputationTierValue(tier: ReputationTier): number {
  const map: Record<ReputationTier, number> = {
    hostile: 0,
    unfriendly: 1,
    neutral: 2,
    friendly: 3,
    honored: 4,
  };
  return map[tier];
}

export function generateStationQuests(
  stationX: number,
  stationY: number,
  dayOfYear: number,
  playerRepTier: ReputationTier = 'neutral',
): AvailableQuest[] {
  const faction = getStationFaction(stationX, stationY);
  const npcs = generateStationNpcs(stationX, stationY);
  const baseSeed = hashCoords(stationX, stationY, WORLD_SEED + QUEST_SEED_SALT + dayOfYear);

  const eligible = QUEST_TEMPLATES.filter((t) => {
    if (t.factionId !== faction && t.factionId !== 'any') return false;
    return getReputationTierValue(playerRepTier) >= getReputationTierValue(t.requiredTier);
  });

  if (eligible.length === 0) return [];

  const questCount = 2 + ((baseSeed >>> 0) % 3);
  const quests: AvailableQuest[] = [];

  const usedTemplateIds = new Set<string>();
  const maxAttempts = eligible.length * 2;
  for (let i = 0; quests.length < questCount && i < maxAttempts; i++) {
    const templateIdx = ((baseSeed >>> (i * 4)) >>> 0) % eligible.length;
    const template = eligible[templateIdx];
    if (usedTemplateIds.has(template.id)) continue;
    usedTemplateIds.add(template.id);
    const npc = npcs[quests.length % npcs.length];
    const questSeed = hashCoords(stationX + quests.length, stationY + dayOfYear, WORLD_SEED + QUEST_SEED_SALT);

    const quest = fillQuestTemplate(template, questSeed, stationX, stationY, npc.name, faction);
    if (quest) quests.push(quest);
  }

  return quests;
}

function fillQuestTemplate(
  template: QuestTemplate,
  seed: number,
  stationX: number,
  stationY: number,
  npcName: string,
  factionId: NpcFactionId,
): AvailableQuest {
  const unsignedSeed = seed >>> 0;
  let description = template.descriptionTemplate;
  const objectives: QuestObjective[] = [];

  if (template.type === 'fetch' && template.resourceOptions && template.amountRange) {
    const resIdx = unsignedSeed % template.resourceOptions.length;
    const resource = template.resourceOptions[resIdx];
    const [minAmt, maxAmt] = template.amountRange;
    const amount = minAmt + ((unsignedSeed >>> 8) % (maxAmt - minAmt + 1));
    description = description
      .replace('{resource}', resource.toUpperCase())
      .replace('{amount}', String(amount));
    objectives.push({
      type: 'fetch',
      description: `${amount} ${resource} zur Station (${stationX}:${stationY}) liefern`,
      resource,
      amount,
      progress: 0,
      fulfilled: false,
    });
  }

  if (template.type === 'delivery' && template.resourceOptions && template.amountRange) {
    const resIdx = unsignedSeed % template.resourceOptions.length;
    const resource = template.resourceOptions[resIdx];
    const [minAmt, maxAmt] = template.amountRange;
    const amount = minAmt + ((unsignedSeed >>> 8) % (maxAmt - minAmt + 1));
    description = description
      .replace('{resource}', resource.toUpperCase())
      .replace('{amount}', String(amount));
    objectives.push({
      type: 'delivery',
      description: `${amount} ${resource} an Station liefern`,
      resource,
      amount,
      progress: 0,
      fulfilled: false,
    });
  }

  if (template.type === 'bounty_chase') {
    // Placeholder — real objectives generated at accept time in QuestService
    description = description.replace('{targetName}', '???');
    objectives.push(
      {
        type: 'bounty_trail',
        description: 'Verfolge die Spur des Ziels',
        fulfilled: false,
      },
      {
        type: 'bounty_combat',
        description: 'Schalte das Ziel aus',
        fulfilled: false,
      },
      {
        type: 'bounty_deliver',
        description: 'Liefere den Gefangenen ab',
        fulfilled: false,
      },
    );
  }

  if (
    (template.type === 'delivery' || template.type === 'scan' || template.type === 'bounty_chase') &&
    template.distanceRange
  ) {
    const [minDist, maxDist] = template.distanceRange;
    const dist = minDist + ((unsignedSeed >>> 12) % (maxDist - minDist + 1));
    const angle = ((unsignedSeed >>> 4) % 360) * (Math.PI / 180);
    const targetX = stationX + Math.round(dist * Math.cos(angle));
    const targetY = stationY + Math.round(dist * Math.sin(angle));
    description = description
      .replace('{targetX}', String(targetX))
      .replace('{targetY}', String(targetY));

    if (template.scanAdjacentCount) {
      // Multi-objective: scan N adjacent sectors around the target (virtual black hole center)
      const adjacent = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
      ].slice(0, template.scanAdjacentCount);
      for (const { dx, dy } of adjacent) {
        objectives.push({
          type: 'scan',
          description: `Scan (${targetX + dx}, ${targetY + dy})`,
          targetX: targetX + dx,
          targetY: targetY + dy,
          fulfilled: false,
        });
      }
    } else {
      objectives.push({
        type: template.type,
        description: `Ziel: (${targetX}, ${targetY})`,
        targetX,
        targetY,
        fulfilled: false,
      });
    }

    // Scan quests: add delivery objective — player must return data slate to station
    if (template.type === 'scan') {
      objectives.push({
        type: 'scan_deliver',
        description: `Data Slate zur Station (${stationX}:${stationY}) abliefern`,
        stationX,
        stationY,
        fulfilled: false,
      });
    }
  }

  const difficultyMultiplier = 1 + (unsignedSeed % 50) / 100;

  return {
    templateId: template.id,
    npcName,
    npcFactionId: factionId,
    title: template.title,
    description,
    objectives,
    rewards: {
      credits: Math.round(template.rewardCreditsBase * difficultyMultiplier),
      xp: Math.round(template.rewardXpBase * difficultyMultiplier),
      reputation: template.rewardRepBase,
      reputationPenalty: template.rivalRepPenalty,
      rivalFactionId: template.rivalFactionId,
      wissen: template.rewardWissenBase,
    },
    requiredTier: template.requiredTier,
  };
}
