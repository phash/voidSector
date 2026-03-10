import type { QuestType, NpcFactionId, ReputationTier, ResourceType } from '@void-sector/shared';

export interface QuestTemplate {
  id: string;
  type: QuestType;
  factionId: NpcFactionId | 'any';
  title: string;
  descriptionTemplate: string;
  requiredTier: ReputationTier;
  rewardCreditsBase: number;
  rewardXpBase: number;
  rewardRepBase: number;
  rewardWissenBase?: number;
  rivalFactionId?: NpcFactionId;
  rivalRepPenalty?: number;
  resourceOptions?: ResourceType[];
  amountRange?: [number, number];
  distanceRange?: [number, number];
  /** For multi-objective scan quests: scan N adjacent sectors around a seed-placed target */
  scanAdjacentCount?: number;
}

export const QUEST_TEMPLATES: QuestTemplate[] = [
  // Trader quests
  {
    id: 'traders_fetch_ore',
    type: 'fetch',
    factionId: 'traders',
    title: 'Erz-Lieferung',
    descriptionTemplate: 'Bringe {amount} {resource} zu dieser Station.',
    requiredTier: 'neutral',
    rewardCreditsBase: 30,
    rewardXpBase: 10,
    rewardRepBase: 5,
    rewardWissenBase: 2,
    resourceOptions: ['ore'],
    amountRange: [2, 5],
  },
  {
    id: 'traders_fetch_gas',
    type: 'fetch',
    factionId: 'traders',
    title: 'Gas-Beschaffung',
    descriptionTemplate: 'Bringe {amount} {resource} zu dieser Station.',
    requiredTier: 'neutral',
    rewardCreditsBase: 40,
    rewardXpBase: 12,
    rewardRepBase: 5,
    rewardWissenBase: 2,
    resourceOptions: ['gas'],
    amountRange: [2, 4],
  },
  {
    id: 'traders_delivery',
    type: 'delivery',
    factionId: 'traders',
    title: 'Handelsroute',
    descriptionTemplate: 'Liefere Cargo zu Station bei ({targetX}, {targetY}).',
    requiredTier: 'friendly',
    rewardCreditsBase: 80,
    rewardXpBase: 20,
    rewardRepBase: 10,
    rewardWissenBase: 2,
    distanceRange: [5, 20],
  },
  {
    id: 'traders_elite_delivery',
    type: 'delivery',
    factionId: 'traders',
    title: 'Elite-Transport',
    descriptionTemplate: 'Dringend: Lieferung zu ({targetX}, {targetY}).',
    requiredTier: 'honored',
    rewardCreditsBase: 200,
    rewardXpBase: 50,
    rewardRepBase: 20,
    rewardWissenBase: 2,
    distanceRange: [10, 40],
  },
  // Scientist quests
  {
    id: 'scientists_scan',
    type: 'scan',
    factionId: 'scientists',
    title: 'Sektor-Analyse',
    descriptionTemplate: 'Scanne Sektor ({targetX}, {targetY}).',
    requiredTier: 'neutral',
    rewardCreditsBase: 20,
    rewardXpBase: 15,
    rewardRepBase: 5,
    rewardWissenBase: 3,
    distanceRange: [3, 15],
  },
  {
    id: 'scientists_deep_scan',
    type: 'scan',
    factionId: 'scientists',
    title: 'Tiefen-Analyse',
    descriptionTemplate: 'Scanne den Anomalie-Sektor ({targetX}, {targetY}).',
    requiredTier: 'friendly',
    rewardCreditsBase: 60,
    rewardXpBase: 30,
    rewardRepBase: 10,
    rewardWissenBase: 3,
    distanceRange: [10, 30],
  },
  {
    id: 'scientists_elite_scan',
    type: 'scan',
    factionId: 'scientists',
    title: 'Forschungsexpedition',
    descriptionTemplate: 'Expedition zu ({targetX}, {targetY}). Sektor scannen.',
    requiredTier: 'honored',
    rewardCreditsBase: 150,
    rewardXpBase: 60,
    rewardRepBase: 20,
    rewardWissenBase: 3,
    distanceRange: [20, 50],
    rivalFactionId: 'pirates',
    rivalRepPenalty: 5,
  },
  // Pirate quests
  {
    id: 'pirates_bounty',
    type: 'bounty',
    factionId: 'pirates',
    title: 'Kopfgeld',
    descriptionTemplate: 'Eliminiere Piraten bei ({targetX}, {targetY}).',
    requiredTier: 'neutral',
    rewardCreditsBase: 50,
    rewardXpBase: 20,
    rewardRepBase: 8,
    rewardWissenBase: 2,
    distanceRange: [3, 15],
  },
  {
    id: 'pirates_elite_bounty',
    type: 'bounty',
    factionId: 'pirates',
    title: 'Hohes Kopfgeld',
    descriptionTemplate: 'Gefährliche Piraten bei ({targetX}, {targetY}) eliminieren.',
    requiredTier: 'friendly',
    rewardCreditsBase: 150,
    rewardXpBase: 40,
    rewardRepBase: 15,
    rewardWissenBase: 2,
    distanceRange: [10, 30],
    rivalFactionId: 'traders',
    rivalRepPenalty: 5,
  },
  // Ancient quests (rare)
  {
    id: 'ancients_artifact',
    type: 'scan',
    factionId: 'ancients',
    title: 'Void-Artefakt',
    descriptionTemplate: 'Signal bei ({targetX}, {targetY}) untersuchen.',
    requiredTier: 'friendly',
    rewardCreditsBase: 300,
    rewardXpBase: 80,
    rewardRepBase: 25,
    rewardWissenBase: 3,
    distanceRange: [15, 50],
  },
  // Black hole cartography (scientists, rare)
  {
    id: 'scientists_black_hole_cartography',
    type: 'scan',
    factionId: 'scientists',
    title: 'Schwarzes Loch kartografieren',
    descriptionTemplate:
      'Scanne die 4 Nachbar-Sektoren des Schwarzen Lochs. Wichtige Forschungsdaten für die Akademie.',
    requiredTier: 'friendly',
    rewardCreditsBase: 500,
    rewardXpBase: 200,
    rewardRepBase: 30,
    rewardWissenBase: 3,
    distanceRange: [5, 20],
    scanAdjacentCount: 4,
  },
  // Resource delivery quests (bring resources to issuing station, partial OK)
  {
    id: 'traders_ore_delivery',
    type: 'delivery',
    factionId: 'traders',
    title: 'Erz-Transport',
    descriptionTemplate: 'Liefere {amount} {resource} zu dieser Station. Teillieferungen möglich.',
    requiredTier: 'neutral',
    rewardCreditsBase: 60,
    rewardXpBase: 18,
    rewardRepBase: 8,
    rewardWissenBase: 2,
    resourceOptions: ['ore'],
    amountRange: [15, 40],
  },
  {
    id: 'traders_mixed_delivery',
    type: 'delivery',
    factionId: 'traders',
    title: 'Rohstoff-Kontrakt',
    descriptionTemplate: 'Kontrakt: {amount} {resource} an diese Station.',
    requiredTier: 'friendly',
    rewardCreditsBase: 100,
    rewardXpBase: 30,
    rewardRepBase: 12,
    rewardWissenBase: 2,
    resourceOptions: ['ore', 'gas', 'crystal'],
    amountRange: [20, 50],
  },
  // Independent quests (generic)
  {
    id: 'indie_fetch',
    type: 'fetch',
    factionId: 'any',
    title: 'Vorräte beschaffen',
    descriptionTemplate: 'Bringe {amount} {resource}.',
    requiredTier: 'neutral',
    rewardCreditsBase: 20,
    rewardXpBase: 8,
    rewardRepBase: 0,
    rewardWissenBase: 2,
    resourceOptions: ['ore', 'gas', 'crystal'],
    amountRange: [1, 3],
  },
  {
    id: 'indie_scan',
    type: 'scan',
    factionId: 'any',
    title: 'Kartierung',
    descriptionTemplate: 'Scanne Sektor ({targetX}, {targetY}).',
    requiredTier: 'neutral',
    rewardCreditsBase: 15,
    rewardXpBase: 10,
    rewardRepBase: 0,
    rewardWissenBase: 3,
    distanceRange: [2, 10],
  },
];
