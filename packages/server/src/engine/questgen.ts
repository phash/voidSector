import { hashCoords } from './worldgen.js';
import { WORLD_SEED } from '@void-sector/shared';
import type { NpcFactionId, ReputationTier, AvailableQuest, QuestObjective } from '@void-sector/shared';
import { QUEST_TEMPLATES } from './questTemplates.js';
import type { QuestTemplate } from './questTemplates.js';
import { generateStationNpcs, getStationFaction } from './npcgen.js';

const QUEST_SEED_SALT = 9999;

function getReputationTierValue(tier: ReputationTier): number {
  const map: Record<ReputationTier, number> = {
    hostile: 0, unfriendly: 1, neutral: 2, friendly: 3, honored: 4,
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

  for (let i = 0; i < Math.min(questCount, eligible.length); i++) {
    const templateIdx = ((baseSeed >>> (i * 4)) >>> 0) % eligible.length;
    const template = eligible[templateIdx];
    const npc = npcs[i % npcs.length];
    const questSeed = hashCoords(stationX + i, stationY + dayOfYear, WORLD_SEED + QUEST_SEED_SALT);

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
    const amount = minAmt + (unsignedSeed >>> 8) % (maxAmt - minAmt + 1);
    description = description.replace('{resource}', resource.toUpperCase()).replace('{amount}', String(amount));
    objectives.push({
      type: 'fetch', description: `${amount} ${resource}`,
      resource, amount, progress: 0, fulfilled: false,
    });
  }

  if ((template.type === 'delivery' || template.type === 'scan' || template.type === 'bounty') && template.distanceRange) {
    const [minDist, maxDist] = template.distanceRange;
    const dist = minDist + (unsignedSeed >>> 12) % (maxDist - minDist + 1);
    const angle = ((unsignedSeed >>> 4) % 360) * (Math.PI / 180);
    const targetX = stationX + Math.round(dist * Math.cos(angle));
    const targetY = stationY + Math.round(dist * Math.sin(angle));
    description = description.replace('{targetX}', String(targetX)).replace('{targetY}', String(targetY));
    objectives.push({
      type: template.type, description: `Ziel: (${targetX}, ${targetY})`,
      targetX, targetY, fulfilled: false,
    });
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
    },
    requiredTier: template.requiredTier,
  };
}
