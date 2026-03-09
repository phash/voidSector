// packages/server/src/rooms/services/CommunityQuestService.ts
import {
  getActiveCommunityAlienQuest,
  insertCommunityAlienQuest,
  addCommunityQuestContribution,
  expireOldCommunityQuests,
  completeCommunityQuest,
  contributeHumanityRep,
  type CommunityAlienQuestRow,
} from '../../db/queries.js';

const QUEST_ROTATION: Array<{
  factionId: string;
  questType: string;
  title: string;
  description: string;
  targetCount: number;
  rewardType: string;
}> = [
  {
    factionId: 'archivists',
    questType: 'community_scan',
    title: 'Das Große Kartenprojekt',
    description: 'Alle Piloten: Scannt gemeinsam 100.000 Sektoren. Die Archivare teilen ihr Archiv.',
    targetCount: 100000,
    rewardType: 'archivist_star_charts',
  },
  {
    factionId: 'consortium',
    questType: 'community_delivery',
    title: 'Stabilisiertes Wurmloch-Netz',
    description: 'Baut gemeinsam 500 Jumpgates. Das Konsortium eröffnet eine Exklusivhandelsroute.',
    targetCount: 500,
    rewardType: 'consortium_trade_route',
  },
  {
    factionId: 'tourist_guild',
    questType: 'community_interaction',
    title: 'Erste Galaktische Olympiade',
    description:
      'Schließt gemeinsam 10.000 Touristengilde-Quests ab. Menschheit wird offizielle Touristenattraktion.',
    targetCount: 10000,
    rewardType: 'tourist_attraction_badge',
  },
  {
    factionId: 'archivists',
    questType: 'community_alien_interaction',
    title: 'Interstellare Botschaft',
    description: 'Führt gemeinsam 50.000 positive Alien-Interaktionen durch. Alle Alien-Reps +10.',
    targetCount: 50000,
    rewardType: 'all_alien_rep_bonus',
  },
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export class CommunityQuestService {
  private rotationIndex = 0;

  async seedInitialIfEmpty(): Promise<void> {
    const active = await getActiveCommunityAlienQuest();
    if (active) return;
    await this.createNext();
  }

  async getActive(): Promise<CommunityAlienQuestRow | null> {
    return getActiveCommunityAlienQuest();
  }

  async contribute(playerId: string, amount: number): Promise<void> {
    const quest = await getActiveCommunityAlienQuest();
    if (!quest) return;
    await addCommunityQuestContribution(quest.id, playerId, amount);
    if (quest.current_count + amount >= quest.target_count) {
      await completeCommunityQuest(quest.id);
      await contributeHumanityRep(quest.alien_faction_id, 50).catch(() => {});
      await this.createNext();
    }
  }

  async checkAndAdvanceRotation(): Promise<void> {
    await expireOldCommunityQuests();
    const active = await getActiveCommunityAlienQuest();
    if (!active) await this.createNext();
  }

  private async createNext(): Promise<void> {
    const template = QUEST_ROTATION[this.rotationIndex % QUEST_ROTATION.length];
    this.rotationIndex++;
    await insertCommunityAlienQuest(
      template.factionId,
      template.questType,
      template.title,
      template.description,
      template.targetCount,
      template.rewardType,
      Date.now() + SEVEN_DAYS_MS,
    );
  }
}
