/**
 * Alien Quest Templates
 * Quest types specific to alien factions. These expand the existing
 * questTemplates.ts with alien-specific quest logic.
 */

import type { AlienFactionId } from './alienReputationService.js';

export type AlienQuestType =
  | 'alien_scan'         // Scan sectors for alien faction data
  | 'alien_delivery'     // Deliver goods to alien station
  | 'alien_bounty'       // Defeat specified enemies for faction
  | 'alien_escort'       // Escort NPC convoy
  | 'alien_branch'       // Choice-based quest with branching outcomes
  | 'alien_community';   // Server-wide collective goal

export interface AlienQuestTemplate {
  id: string;
  factionId: AlienFactionId;
  type: AlienQuestType;
  title: string;
  descriptionTemplate: string;
  /** Minimum quadrant Chebyshev distance from origin to receive this quest */
  minQuadrantDistance: number;
  /** Minimum reputation required to receive this quest */
  minReputation: number;
  rewardCreditsBase: number;
  rewardRepBase: number;
  rewardXpBase: number;
  /** For branch quests: array of outcomes with their effects */
  branches?: AlienQuestBranch[];
  /** For community quests: target contribution count */
  communityTarget?: number;
}

export interface AlienQuestBranch {
  id: string;
  label: string;
  description: string;
  repChange: number;
  creditBonus: number;
  consequence: string; // flavor text for outcome
}

export const ALIEN_QUEST_TEMPLATES: AlienQuestTemplate[] = [
  // Archivists
  {
    id: 'archivists_stellar_cartography',
    factionId: 'archivists',
    type: 'alien_scan',
    title: 'Stellarkartographie für die Archivare',
    descriptionTemplate: 'Die Archivare benötigen Scan-Daten aus 5 unerforschten Sektoren in Ihrer Nähe.',
    minQuadrantDistance: 90,
    minReputation: -10,
    rewardCreditsBase: 300,
    rewardRepBase: 15,
    rewardXpBase: 150,
  },
  {
    id: 'archivists_data_probe',
    factionId: 'archivists',
    type: 'alien_delivery',
    title: 'Verlorene Datensonde bergen',
    descriptionTemplate: 'Eine Archivar-Datensonde ist in Sektor [{targetX}:{targetY}] abgestürzt. Bergung und Lieferung erforderlich.',
    minQuadrantDistance: 90,
    minReputation: 10,
    rewardCreditsBase: 500,
    rewardRepBase: 20,
    rewardXpBase: 200,
  },

  // Consortium
  {
    id: 'consortium_trade_route',
    factionId: 'consortium',
    type: 'alien_delivery',
    title: 'Konsortium-Handelslieferung',
    descriptionTemplate: 'Das Konsortium möchte 100 Einheiten Erz an Station [{targetX}:{targetY}] geliefert bekommen.',
    minQuadrantDistance: 150,
    minReputation: -10,
    rewardCreditsBase: 800,
    rewardRepBase: 10,
    rewardXpBase: 100,
  },

  // K'thari
  {
    id: 'kthari_prove_strength',
    factionId: 'kthari',
    type: 'alien_bounty',
    title: 'K\'thari Ehrenbounty',
    descriptionTemplate: 'Bezwinge 3 Piraten-Schiffe zur Demonstration deiner Stärke für das K\'thari Dominion.',
    minQuadrantDistance: 200,
    minReputation: -10,
    rewardCreditsBase: 600,
    rewardRepBase: 20,
    rewardXpBase: 250,
  },

  // Mycelians
  {
    id: 'mycelians_ecosystem_choice',
    factionId: 'mycelians',
    type: 'alien_branch',
    title: 'Mycelian Ökosystem-Entscheidung',
    descriptionTemplate: 'Die Mycelianer haben eine Kolonie auf einem Planeten in Ihrem Gebiet entdeckt. Sie müssen eine Entscheidung treffen.',
    minQuadrantDistance: 300,
    minReputation: 0,
    rewardCreditsBase: 0,
    rewardRepBase: 0,
    rewardXpBase: 300,
    branches: [
      {
        id: 'protect',
        label: '[SCHÜTZEN]',
        description: 'Die Mycelian-Kolonie schützen und fördern.',
        repChange: 30,
        creditBonus: 0,
        consequence: 'Die Mycelianer sind tief bewegt. "Du... verstehst... das Wachstum."',
      },
      {
        id: 'ignore',
        label: '[IGNORIEREN]',
        description: 'Den Planeten in Ruhe lassen und weiterziehen.',
        repChange: 0,
        creditBonus: 200,
        consequence: 'Die Mycelianer notieren Ihre Neutralität.',
      },
      {
        id: 'harvest',
        label: '[ABBAUEN]',
        description: 'Den Planeten für Ressourcen ausbeuten.',
        repChange: -40,
        creditBonus: 500,
        consequence: 'Die Mycelianer werden für 48 Stunden feindlich.',
      },
    ],
  },

  // Community quest
  {
    id: 'archivists_great_survey',
    factionId: 'archivists',
    type: 'alien_community',
    title: 'Die Große Kartierung',
    descriptionTemplate: 'Die Archivare bitten alle Piloten, 10.000 neue Sektoren zu kartieren. Kollektives Ziel.',
    minQuadrantDistance: 90,
    minReputation: -10,
    rewardCreditsBase: 1000,
    rewardRepBase: 25,
    rewardXpBase: 500,
    communityTarget: 10000,
  },

  // Tourist Guild
  {
    id: 'tourist_guild_selfie',
    factionId: 'tourist_guild',
    type: 'alien_scan',
    title: 'Touristengilde: Galaktische Sehenswürdigkeiten',
    descriptionTemplate: 'Die Touristengilde möchte Bilder von 5 Schwarzen Löchern für ihren Reiseführer.',
    minQuadrantDistance: 700,
    minReputation: -10,
    rewardCreditsBase: 1500,
    rewardRepBase: 15,
    rewardXpBase: 300,
  },
];

/**
 * Returns quest templates available to a player based on their quadrant distance and reputation.
 */
export function getAvailableAlienQuests(
  playerQx: number,
  playerQy: number,
  alienReputation: Record<AlienFactionId, number>,
): AlienQuestTemplate[] {
  const chebyshev = Math.max(Math.abs(playerQx), Math.abs(playerQy));
  return ALIEN_QUEST_TEMPLATES.filter((template) => {
    if (chebyshev < template.minQuadrantDistance) return false;
    const rep = alienReputation[template.factionId] ?? 0;
    return rep >= template.minReputation;
  });
}

/**
 * Returns the branch outcome for a branch quest.
 */
export function resolveBranchQuest(
  template: AlienQuestTemplate,
  branchId: string,
): AlienQuestBranch | null {
  if (!template.branches) return null;
  return template.branches.find((b) => b.id === branchId) ?? null;
}
