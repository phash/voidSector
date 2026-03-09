# AQ Story Quest System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the missing AQ components: 9-chapter story quest chain, community quests, spontaneous alien encounter events, Gemini-generated first-contact news with TV greenscreen overlay.

**Architecture:** Two PRs — PR 1 server services + DB + tests, PR 2 client UI. All server logic as new services registered in SectorRoom (same pattern as existing 12 services). Gemini CLI generates news text for first-contact events; a React overlay plays a greenscreen anchor video with the text composited in.

**Tech Stack:** TypeScript, Colyseus, PostgreSQL (queries.ts), Vitest, React + Zustand, Gemini CLI (`gemini` binary available), HTML5 video + CSS overlay for greenscreen compositing.

---

## Context: What Already Exists

- `packages/server/src/engine/alienReputationService.ts` — rep system, `ALIEN_FIRST_CONTACT_FLAVOR`, `isInFirstContactRange`
- `packages/server/src/rooms/services/AlienInteractionService.ts` — all 10 factions, `recordNewsEvent()` already called on first contact
- `packages/server/src/db/migrations/035_alien_reputation.sql` — `alien_reputation`, `alien_encounters`, `community_alien_quests`, `community_quest_contributions` tables
- `packages/server/src/db/queries.ts` — `recordNewsEvent()`, `recordAlienEncounter()`, `setAlienFirstContact()`
- `packages/server/src/rooms/SectorRoom.ts` — service pattern at lines 140–290; `moveSector` handler at line 299
- `planung/Inhalte/TV/` — two anchor videos with greenscreen: `Green_Screen_Video_Generation_Request.mp4`, `Neues_Video_mit_anderem_Anchorman.mp4`

---

## PR 1: Server Services

### Task 1: DB Migration 042

**Files:**
- Create: `packages/server/src/db/migrations/042_story_quest_progress.sql`

**Step 1: Write migration**

```sql
-- Story quest chain progress per player
CREATE TABLE IF NOT EXISTS story_quest_progress (
  player_id          VARCHAR(255) PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_chapter    INT NOT NULL DEFAULT 0,
  completed_chapters JSONB NOT NULL DEFAULT '[]',
  branch_choices     JSONB NOT NULL DEFAULT '{}',
  last_progress      BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Server-wide humanity reputation aggregated across all player actions
CREATE TABLE IF NOT EXISTS humanity_reputation (
  alien_faction_id  VARCHAR(50) PRIMARY KEY,
  rep_value         INT NOT NULL DEFAULT 0,
  interaction_count INT NOT NULL DEFAULT 0,
  last_updated      BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
```

**Step 2: Verify migration runs**

```bash
cd packages/server && npx vitest run src/__tests__/migrations.test.ts
```
Expected: PASS (or no migration tests — migrations run on server startup, verify manually if needed)

**Step 3: Commit**

```bash
git add packages/server/src/db/migrations/042_story_quest_progress.sql
git commit -m "feat: migration 042 — story_quest_progress + humanity_reputation tables"
```

---

### Task 2: DB Queries for Story + Community

**Files:**
- Modify: `packages/server/src/db/queries.ts` (append to end of file)

**Step 1: Add story quest queries**

Append to `packages/server/src/db/queries.ts`:

```typescript
// ── Story Quest Progress ──────────────────────────────────────────────────────

export interface StoryQuestProgressRow {
  player_id: string;
  current_chapter: number;
  completed_chapters: number[];
  branch_choices: Record<string, string>;
  last_progress: number;
}

export async function getStoryProgress(playerId: string): Promise<StoryQuestProgressRow> {
  const res = await query<StoryQuestProgressRow>(
    `INSERT INTO story_quest_progress (player_id)
     VALUES ($1)
     ON CONFLICT (player_id) DO NOTHING;
     SELECT * FROM story_quest_progress WHERE player_id = $1`,
    [playerId],
  );
  return res.rows[0] ?? { player_id: playerId, current_chapter: 0, completed_chapters: [], branch_choices: {}, last_progress: Date.now() };
}

export async function upsertStoryProgress(
  playerId: string,
  chapter: number,
  completedChapters: number[],
  branchChoices: Record<string, string>,
): Promise<void> {
  await query(
    `INSERT INTO story_quest_progress (player_id, current_chapter, completed_chapters, branch_choices, last_progress)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (player_id) DO UPDATE
     SET current_chapter = $2, completed_chapters = $3, branch_choices = $4, last_progress = $5`,
    [playerId, chapter, JSON.stringify(completedChapters), JSON.stringify(branchChoices), Date.now()],
  );
}

// ── Humanity Reputation ───────────────────────────────────────────────────────

export async function contributeHumanityRep(alienFactionId: string, delta: number): Promise<void> {
  await query(
    `INSERT INTO humanity_reputation (alien_faction_id, rep_value, interaction_count, last_updated)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (alien_faction_id) DO UPDATE
     SET rep_value = humanity_reputation.rep_value + $2,
         interaction_count = humanity_reputation.interaction_count + 1,
         last_updated = $3`,
    [alienFactionId, delta, Date.now()],
  );
}

export async function getHumanityRep(alienFactionId: string): Promise<number> {
  const res = await query<{ rep_value: number }>(
    'SELECT rep_value FROM humanity_reputation WHERE alien_faction_id = $1',
    [alienFactionId],
  );
  return res.rows[0]?.rep_value ?? 0;
}

// ── Community Alien Quests ────────────────────────────────────────────────────

export interface CommunityAlienQuestRow {
  id: number;
  alien_faction_id: string;
  quest_type: string;
  title: string;
  description: string | null;
  target_count: number;
  current_count: number;
  reward_type: string | null;
  started_at: number;
  expires_at: number | null;
  completed_at: number | null;
  status: string;
}

export async function getActiveCommunityAlienQuest(): Promise<CommunityAlienQuestRow | null> {
  const res = await query<CommunityAlienQuestRow>(
    `SELECT * FROM community_alien_quests WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`,
  );
  return res.rows[0] ?? null;
}

export async function insertCommunityAlienQuest(
  factionId: string,
  questType: string,
  title: string,
  description: string,
  targetCount: number,
  rewardType: string,
  expiresAt: number,
): Promise<CommunityAlienQuestRow> {
  const res = await query<CommunityAlienQuestRow>(
    `INSERT INTO community_alien_quests (alien_faction_id, quest_type, title, description, target_count, reward_type, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [factionId, questType, title, description, targetCount, rewardType, expiresAt],
  );
  return res.rows[0];
}

export async function addCommunityQuestContribution(
  questId: number,
  playerId: string,
  amount: number,
): Promise<void> {
  await query(
    `INSERT INTO community_quest_contributions (quest_id, player_id, contribution)
     VALUES ($1, $2, $3)
     ON CONFLICT (quest_id, player_id) DO UPDATE
     SET contribution = community_quest_contributions.contribution + $3,
         contributed_at = $4`,
    [questId, playerId, amount, Date.now()],
  );
  await query(
    `UPDATE community_alien_quests SET current_count = current_count + $1 WHERE id = $2`,
    [amount, questId],
  );
}

export async function expireOldCommunityQuests(): Promise<void> {
  await query(
    `UPDATE community_alien_quests SET status = 'expired'
     WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < $1`,
    [Date.now()],
  );
}

export async function completeCommunityQuest(questId: number): Promise<void> {
  await query(
    `UPDATE community_alien_quests SET status = 'completed', completed_at = $1 WHERE id = $2`,
    [Date.now(), questId],
  );
}
```

**Step 2: Commit**

```bash
git add packages/server/src/db/queries.ts
git commit -m "feat: DB queries for story_quest_progress, humanity_reputation, community_alien_quests"
```

---

### Task 3: storyQuestChain.ts (Pure Functions)

**Files:**
- Create: `packages/server/src/engine/storyQuestChain.ts`
- Create: `packages/server/src/__tests__/storyQuestChain.test.ts`

**Step 1: Write failing tests first**

```typescript
// packages/server/src/__tests__/storyQuestChain.test.ts
import { describe, it, expect } from 'vitest';
import {
  STORY_CHAPTERS,
  canUnlockChapter,
  getChapterForDistance,
  applyBranchEffects,
  type StoryProgress,
} from '../engine/storyQuestChain.js';

describe('storyQuestChain', () => {
  it('has 9 chapters (0–8)', () => {
    expect(STORY_CHAPTERS).toHaveLength(9);
    expect(STORY_CHAPTERS[0].id).toBe(0);
    expect(STORY_CHAPTERS[8].id).toBe(8);
  });

  it('chapter 0 requires qDist >= 6', () => {
    expect(STORY_CHAPTERS[0].minQDist).toBe(6);
  });

  it('chapter 1 requires qDist >= 40', () => {
    expect(STORY_CHAPTERS[1].minQDist).toBe(40);
  });

  it('canUnlockChapter returns false if distance too low', () => {
    const progress: StoryProgress = { currentChapter: 0, completedChapters: [], branchChoices: {} };
    expect(canUnlockChapter(0, 5, progress)).toBe(false);
  });

  it('canUnlockChapter returns true if distance sufficient and previous complete', () => {
    const progress: StoryProgress = { currentChapter: 0, completedChapters: [], branchChoices: {} };
    expect(canUnlockChapter(0, 6, progress)).toBe(true);
  });

  it('canUnlockChapter requires previous chapter completed for chapter > 0', () => {
    const noProgress: StoryProgress = { currentChapter: 0, completedChapters: [], branchChoices: {} };
    expect(canUnlockChapter(1, 50, noProgress)).toBe(false);

    const withCh0: StoryProgress = { currentChapter: 1, completedChapters: [0], branchChoices: {} };
    expect(canUnlockChapter(1, 50, withCh0)).toBe(true);
  });

  it('getChapterForDistance returns correct chapter', () => {
    expect(getChapterForDistance(5)).toBe(null);   // below ch0
    expect(getChapterForDistance(6)).toBe(0);
    expect(getChapterForDistance(40)).toBe(1);
    expect(getChapterForDistance(100)).toBe(2);
  });

  it('applyBranchEffects returns rep deltas for chapter 2 choice A', () => {
    const effects = applyBranchEffects(2, 'A');
    expect(effects.archivists).toBe(30);
  });

  it('applyBranchEffects returns rep deltas for chapter 4 choice B', () => {
    const effects = applyBranchEffects(4, 'B');
    expect(effects.kthari).toBe(-20);
  });

  it('applyBranchEffects returns empty object for non-branch chapter', () => {
    const effects = applyBranchEffects(0, 'none');
    expect(Object.keys(effects)).toHaveLength(0);
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
cd packages/server && npx vitest run src/__tests__/storyQuestChain.test.ts
```
Expected: FAIL with "Cannot find module"

**Step 3: Implement storyQuestChain.ts**

```typescript
// packages/server/src/engine/storyQuestChain.ts
import type { AlienFactionId } from './alienReputationService.js';

export interface StoryChapter {
  id: number;
  minQDist: number;    // Chebyshev quadrant distance from 0:0
  title: string;
  flavorText: string;
  branches?: StoryBranch[];
}

export interface StoryBranch {
  id: string;          // 'A' | 'B' | 'C'
  label: string;
  repEffects: Partial<Record<AlienFactionId, number>>;
  outcomeText: string;
}

export interface StoryProgress {
  currentChapter: number;
  completedChapters: number[];
  branchChoices: Record<string, string>;   // { "2": "A", "4": "B" }
}

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 0,
    minQDist: 6,
    title: 'DAS AUFBRUCH-SIGNAL',
    flavorText:
      'Das Zentralkomitee für Universumserkundung bestätigt: Ihr befindet euch im Zentrum. ' +
      'Ein schwaches Signal aus unbekannter Richtung — vermutlich Interferenz. Bitte ignorieren.',
  },
  {
    id: 1,
    minQDist: 40,
    title: 'DIE AUSSENPOSTEN-ANOMALIE',
    flavorText:
      'Das Signal ist... nicht menschlich. Das Ministerium für Zentrumsbestätigung wurde informiert. ' +
      'Bitte senden Sie keine Antwort. Bitte senden Sie eine Antwort.',
  },
  {
    id: 2,
    minQDist: 100,
    title: 'ERSTKONTAKT — DIE ARCHIVARE',
    flavorText:
      '"Ah. Ein Vertreter der äußeren Spezies. Ihre Koordinate 0:0 — Sie glauben das ist das Zentrum? ' +
      '...Faszinierend. Notiert." — Archivar-Sonde, Sektor unbekannt',
    branches: [
      {
        id: 'A',
        label: 'Sternkarten-Daten teilen',
        repEffects: { archivists: 30 },
        outcomeText: 'Die Archivare nehmen Ihre Daten. Sie notieren: "Randregion EX-7 kooperiert. Unerwartet."',
      },
      {
        id: 'B',
        label: 'Daten verweigern',
        repEffects: { archivists: -5 },
        outcomeText: 'Die Archivare notieren: "Defensive Reaktion. Typisch für Randspezies."',
      },
    ],
  },
  {
    id: 3,
    minQDist: 150,
    title: 'DER ERSTE ZWEIFEL',
    flavorText:
      'Expeditions-Log 2381-03-14: "Die Archivare sagen, wir kommen aus einem Randsektor. ' +
      'Das ist natürlich Unsinn. Wir sind das Zentrum. Wir fahren morgen weiter. Zum Beweis." ' +
      '[Weitere Einträge: nicht vorhanden]',
  },
  {
    id: 4,
    minQDist: 200,
    title: 'DER K\'THARI-TEST',
    flavorText:
      '"Unbekannte Einheit. Eure Herkunftsregion 0:0 ist uns als unbedeutende Randzone bekannt. ' +
      'Beweist eure Stärke." — K\'thari General Vrak\'ath',
    branches: [
      {
        id: 'A',
        label: 'Kampfprobe annehmen',
        repEffects: { kthari: 50 },
        outcomeText: '"Ihr habt bestanden. Für eine Randspezies. Unterhaltsam." — Vrak\'ath',
      },
      {
        id: 'B',
        label: 'Zurückweichen',
        repEffects: { kthari: -20 },
        outcomeText: '"Wie erwartet." — K\'thari Aufzeichnung, Kategorie: Randspezies',
      },
    ],
  },
  {
    id: 5,
    minQDist: 300,
    title: 'DIE LEBENDE WELT',
    flavorText:
      '"Das Netz... erinnert sich... an euch... kleines Randwesen. Ihr Planet... atmet nicht mehr... seit ihr kamt." ' +
      '— Mycelianer-Übertragung [Symbol-Sequenz #4471]',
    branches: [
      {
        id: 'A',
        label: 'Mycelian-Ökosystem schützen',
        repEffects: { mycelians: 40, kthari: -20 },
        outcomeText: '"Das Netz... erinnert... Güte." Mycelianer reagieren. Das dauert Tage.',
      },
      {
        id: 'B',
        label: 'Ressourcen ernten',
        repEffects: { mycelians: -50 },
        outcomeText: 'Reiche Ernte. Das Netz schweigt.',
      },
      {
        id: 'C',
        label: 'Ignorieren',
        repEffects: {},
        outcomeText: 'Ihr fliegt weiter. Das Netz schweigt.',
      },
    ],
  },
  {
    id: 6,
    minQDist: 500,
    title: 'TOURISTEN-INVASION',
    flavorText:
      '"Oh! Ein echter menschlicher Pilot! Aus dem berühmten 0:0-Cluster! Dürfen wir Fotos machen? ' +
      'Unsere 340 Gäste haben LANGE auf so einen Moment gewartet." — Galactic Wonder Luxusliner',
    branches: [
      {
        id: 'A',
        label: 'Mitspielen (Credits + Würdeverlust)',
        repEffects: { tourist_guild: 30 },
        outcomeText:
          'Touristengilde Bewertung: ★★★★☆ — "Die Natives waren authentisch verwirrt. Sehr empfehlenswert."',
      },
      {
        id: 'B',
        label: 'Ablehnen',
        repEffects: { tourist_guild: -10 },
        outcomeText:
          'Touristengilde Bewertung: ★★☆☆☆ — "Wenig kooperativ. Trotzdem exotisch."',
      },
    ],
  },
  {
    id: 7,
    minQDist: 1000,
    title: 'DAS UNMÖGLICHE ARTEFAKT',
    flavorText:
      '[AXIOM-PROTOKOLL 0000.7741.BETA] [EINHEIT REGISTRIERT] [EINHEIT: INTERESSANT — BEWERTUNG: AUSSTEHEND] ' +
      '[SCANNER ÜBERHITZT] [VERBINDUNG GETRENNT]',
  },
  {
    id: 8,
    minQDist: 3000,
    title: 'DER RAND',
    flavorText:
      'Nach allem was ihr gesehen habt — den Archivaren die euch bemitleidet haben, den K\'thari die euch getestet haben, ' +
      'den Touristen die euch fotografiert haben — seid ihr immer noch überzeugt, das Zentrum zu sein?',
    branches: [
      { id: 'A', label: 'JA', repEffects: {}, outcomeText: 'Das Universum schweigt.' },
      {
        id: 'B',
        label: 'NEIN',
        repEffects: { archivists: 10, mycelians: 5 },
        outcomeText: 'Irgendwo in einem Archiv: "Einheit EX-7-047 zeigt Einsicht. Notiert."',
      },
      {
        id: 'C',
        label: 'ICH BIN MIR NICHT SICHER',
        repEffects: { archivists: 5 },
        outcomeText: '"Die ehrlichste Antwort die wir von dieser Spezies erhalten haben." — Archivar',
      },
    ],
  },
];

/** Chebyshev distance of quadrant coords from origin */
export function quadrantDistance(qx: number, qy: number): number {
  return Math.max(Math.abs(qx), Math.abs(qy));
}

export function canUnlockChapter(chapterId: number, currentQDist: number, progress: StoryProgress): boolean {
  const chapter = STORY_CHAPTERS[chapterId];
  if (!chapter) return false;
  if (currentQDist < chapter.minQDist) return false;
  if (chapterId === 0) return !progress.completedChapters.includes(0);
  // Previous chapter must be completed
  return progress.completedChapters.includes(chapterId - 1) && !progress.completedChapters.includes(chapterId);
}

/** Returns chapter id to unlock at this distance, or null if none available. */
export function getChapterForDistance(qDist: number): number | null {
  // Find the lowest chapter that has minQDist <= qDist
  for (const ch of STORY_CHAPTERS) {
    if (qDist >= ch.minQDist) return ch.id;
  }
  return null;
}

export function applyBranchEffects(chapterId: number, branchId: string): Partial<Record<AlienFactionId, number>> {
  const chapter = STORY_CHAPTERS[chapterId];
  if (!chapter?.branches) return {};
  const branch = chapter.branches.find((b) => b.id === branchId);
  return branch?.repEffects ?? {};
}
```

**Step 4: Run tests — expect PASS**

```bash
cd packages/server && npx vitest run src/__tests__/storyQuestChain.test.ts
```
Expected: All 9 tests PASS

**Step 5: Commit**

```bash
git add packages/server/src/engine/storyQuestChain.ts packages/server/src/__tests__/storyQuestChain.test.ts
git commit -m "feat: storyQuestChain engine — 9 chapters, branch logic, distance triggers"
```

---

### Task 4: alienEncounterGen.ts

**Files:**
- Create: `packages/server/src/engine/alienEncounterGen.ts`
- Create: `packages/server/src/__tests__/alienEncounterGen.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/alienEncounterGen.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  ALIEN_ENCOUNTER_TABLE,
  rollForEncounter,
  type AlienEncounterEvent,
} from '../engine/alienEncounterGen.js';

describe('alienEncounterGen', () => {
  it('encounter table has entries for multiple factions', () => {
    const factions = new Set(ALIEN_ENCOUNTER_TABLE.map((e) => e.factionId));
    expect(factions.size).toBeGreaterThan(4);
  });

  it('rollForEncounter returns null when distance too low', () => {
    const result = rollForEncounter('player1', 100, 100, 3, 3, 0); // qDist=3
    expect(result).toBeNull();
  });

  it('rollForEncounter returns null when cooldown active (stepsSinceLast < 10)', () => {
    // Even with correct distance, 5 steps since last encounter = cooldown
    const result = rollForEncounter('player1', 1000, 1000, 100, 100, 5);
    expect(result).toBeNull();
  });

  it('rollForEncounter can return an encounter with forced roll', () => {
    // Force roll by mocking Math.random
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);  // 0 < any positive chance
    const result = rollForEncounter('player1', 1000, 1000, 500, 500, 20); // qDist=500, 20 steps
    spy.mockRestore();
    // Should return some event (tourist_guild has 8% chance, always hits with random=0)
    expect(result).not.toBeNull();
    expect(result?.factionId).toBeDefined();
  });

  it('encounter events have required fields', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = rollForEncounter('player1', 500, 500, 500, 500, 20);
    spy.mockRestore();
    if (result) {
      expect(result).toHaveProperty('factionId');
      expect(result).toHaveProperty('eventText');
      expect(result).toHaveProperty('canRespond');
    }
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
cd packages/server && npx vitest run src/__tests__/alienEncounterGen.test.ts
```

**Step 3: Implement alienEncounterGen.ts**

```typescript
// packages/server/src/engine/alienEncounterGen.ts
import type { AlienFactionId } from './alienReputationService.js';

export interface AlienEncounterEvent {
  factionId: AlienFactionId;
  eventType: string;
  eventText: string;
  canRespond: boolean;         // Whether player can react (+rep / -rep choice)
  acceptLabel?: string;
  declineLabel?: string;
  repOnAccept: number;
  repOnDecline: number;
}

interface EncounterTableEntry {
  factionId: AlienFactionId;
  minQDist: number;
  chance: number;              // 0.0–1.0 per sector movement
  eventType: string;
  eventText: string;
  canRespond: boolean;
  acceptLabel?: string;
  declineLabel?: string;
  repOnAccept: number;
  repOnDecline: number;
}

export const ALIEN_ENCOUNTER_TABLE: EncounterTableEntry[] = [
  {
    factionId: 'archivists', minQDist: 100, chance: 0.02,
    eventType: 'scan_probe',
    eventText: 'ARCHIVAR-SONDE SCANNT EUER SCHIFF — "Daten akzeptabel. Randspezies verhalten sich berechenbar."',
    canRespond: true, acceptLabel: 'Scan erlauben', declineLabel: 'Abschirmen',
    repOnAccept: 8, repOnDecline: -3,
  },
  {
    factionId: 'kthari', minQDist: 200, chance: 0.05,
    eventType: 'toll_demand',
    eventText: 'K\'THARI PATROUILLE — "Mautgebühr für Durchquerung unseres Grenzgebiets: 50 Credits oder Rückzug."',
    canRespond: true, acceptLabel: 'Zahlen', declineLabel: 'Verweigern',
    repOnAccept: 10, repOnDecline: -15,
  },
  {
    factionId: 'consortium', minQDist: 150, chance: 0.03,
    eventType: 'trade_offer',
    eventText: 'KONSORTIUM-HÄNDLER NÄHERT SICH — "Sonderrabatt 15% auf nächsten Handel. Zeitlich begrenzt."',
    canRespond: true, acceptLabel: 'Angebot annehmen', declineLabel: 'Ablehnen',
    repOnAccept: 5, repOnDecline: -2,
  },
  {
    factionId: 'tourist_guild', minQDist: 500, chance: 0.08,
    eventType: 'photo_op',
    eventText: 'TOURISTENGILDE LUXUSLINER — "Dürfen wir Fotos machen? Sie sind SO authentisch menschlich!"',
    canRespond: true, acceptLabel: 'Für Fotos posieren', declineLabel: 'Ablehnen',
    repOnAccept: 12, repOnDecline: -5,
  },
  {
    factionId: 'scrappers', minQDist: 50, chance: 0.04,
    eventType: 'black_market',
    eventText: 'SCRAPPER-SCHWARZMARKT — "Psst. Haben was Interessantes. Nur Tausch, keine Credits."',
    canRespond: true, acceptLabel: 'Anschauen', declineLabel: 'Ignorieren',
    repOnAccept: 7, repOnDecline: 0,
  },
  {
    factionId: 'mirror_minds', minQDist: 400, chance: 0.01,
    eventType: 'emotion_read',
    eventText: 'MIRROR MIND KONTAKT — Sie zeigen euch euer eigenes Gesicht. Keine Worte. Nur ein Spiegel.',
    canRespond: false,
    repOnAccept: 0, repOnDecline: 0,
  },
  {
    factionId: 'silent_swarm', minQDist: 800, chance: 0.02,
    eventType: 'drone_follow',
    eventText: 'SILENT SWARM DROHNE FOLGT EUREM SCHIFF — Keine Kommunikation. Nur Beobachtung.',
    canRespond: false,
    repOnAccept: 0, repOnDecline: 0,
  },
];

const COOLDOWN_STEPS = 10;

/**
 * Roll for a spontaneous alien encounter.
 * @param stepsSinceLastEncounter — how many moveSector calls since last encounter (tracked by caller)
 */
export function rollForEncounter(
  _playerId: string,
  _sectorX: number,
  _sectorY: number,
  qx: number,
  qy: number,
  stepsSinceLastEncounter: number,
): AlienEncounterEvent | null {
  if (stepsSinceLastEncounter < COOLDOWN_STEPS) return null;

  const qDist = Math.max(Math.abs(qx), Math.abs(qy));
  const eligible = ALIEN_ENCOUNTER_TABLE.filter((e) => qDist >= e.minQDist);
  if (eligible.length === 0) return null;

  for (const entry of eligible) {
    if (Math.random() < entry.chance) {
      return {
        factionId: entry.factionId,
        eventType: entry.eventType,
        eventText: entry.eventText,
        canRespond: entry.canRespond,
        acceptLabel: entry.acceptLabel,
        declineLabel: entry.declineLabel,
        repOnAccept: entry.repOnAccept,
        repOnDecline: entry.repOnDecline,
      };
    }
  }
  return null;
}
```

**Step 4: Run tests — expect PASS**

```bash
cd packages/server && npx vitest run src/__tests__/alienEncounterGen.test.ts
```

**Step 5: Commit**

```bash
git add packages/server/src/engine/alienEncounterGen.ts packages/server/src/__tests__/alienEncounterGen.test.ts
git commit -m "feat: alienEncounterGen — spontaneous encounter events with faction/distance/cooldown"
```

---

### Task 5: geminiNewsService.ts

**Files:**
- Create: `packages/server/src/engine/geminiNewsService.ts`
- Create: `packages/server/src/__tests__/geminiNewsService.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/geminiNewsService.test.ts
import { describe, it, expect, vi } from 'vitest';
import { generateFirstContactNews, FALLBACK_NEWS } from '../engine/geminiNewsService.js';

describe('geminiNewsService', () => {
  it('FALLBACK_NEWS covers all 10 alien factions', () => {
    const factions = [
      'archivists', 'consortium', 'kthari', 'mycelians', 'mirror_minds',
      'tourist_guild', 'silent_swarm', 'helions', 'axioms', 'scrappers',
    ];
    for (const f of factions) {
      expect(FALLBACK_NEWS[f]).toBeDefined();
      expect(typeof FALLBACK_NEWS[f]).toBe('string');
    }
  });

  it('generateFirstContactNews returns fallback on timeout', async () => {
    // Mock execFile to simulate timeout
    vi.mock('node:child_process', () => ({
      execFile: (_bin: string, _args: string[], _opts: unknown, cb: Function) => {
        setTimeout(() => cb(new Error('timeout'), '', ''), 10);
      },
    }));
    const result = await generateFirstContactNews('archivists', 'TestPilot', 100, 200);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
cd packages/server && npx vitest run src/__tests__/geminiNewsService.test.ts
```

**Step 3: Implement geminiNewsService.ts**

```typescript
// packages/server/src/engine/geminiNewsService.ts
import { execFile } from 'node:child_process';
import type { AlienFactionId } from './alienReputationService.js';

interface FactionPromptData {
  label: string;
  description: string;
}

const FACTION_PROMPT_DATA: Record<AlienFactionId, FactionPromptData> = {
  archivists: { label: 'Die Archivare', description: 'Akademische Alien-Rasse die Menschen als Forschungsobjekt betrachtet.' },
  kthari: { label: 'Das K\'thari Dominion', description: 'Militärische Alien-Rasse die nur Stärke respektiert.' },
  mycelians: { label: 'Die Mycelianer', description: 'Pilzartige Alien-Rasse die in anderen Zeitdimensionen lebt.' },
  consortium: { label: 'Das Konsortium', description: 'Businessorientierte Alien-Händler die Menschen als Randregions-Kunden sehen.' },
  tourist_guild: { label: 'Die Touristengilde', description: 'Alien-Touristen die Menschen als exotische Attraktion behandeln.' },
  scrappers: { label: 'Die Scrappers', description: 'Pragmatische Schrotthändler die nur Nützlichkeit respektieren.' },
  mirror_minds: { label: 'Die Mirror Minds', description: 'Telepathische Aliens die absolute Ehrlichkeit erwarten.' },
  silent_swarm: { label: 'Der Silent Swarm', description: 'Maschinelle Schwarm-Intelligenz ohne Kommunikationsfähigkeit.' },
  helions: { label: 'Das Helion Kollektiv', description: 'Aliens die in Sternen leben und nur über Energie kommunizieren.' },
  axioms: { label: 'Die Axiome', description: 'Die fortgeschrittenste bekannte Rasse, kommuniziert nur in Mathematik.' },
};

export const FALLBACK_NEWS: Record<string, string> = {
  archivists: 'EILMELDUNG: Erstkontakt mit den Archivaren. Sie nennen Quadrant 0:0 "Randregion EX-7". Kein Kommentar der Regierung.',
  kthari: 'EILMELDUNG: K\'thari Dominion kontaktiert. Sie wollten kämpfen. Erstaunlicherweise nicht sofort.',
  mycelians: 'EILMELDUNG: Mycelian-Kontakt hergestellt. Kommunikation dauert mehrere Stunden. Wir warten.',
  consortium: 'EILMELDUNG: Konsortium meldet sich. Kreditwürdigkeit unbekannt. Handel trotzdem angeboten.',
  tourist_guild: 'EILMELDUNG: Touristengilde erreicht Menschheit. Wir sind jetzt eine Sehenswürdigkeit.',
  scrappers: 'EILMELDUNG: Scrappers kontaktiert. Sie akzeptieren keine Credits. Nur Schrott.',
  mirror_minds: 'EILMELDUNG: Mirror Minds Kontakt. Sie zeigen uns uns selbst. Sehr unangenehm.',
  silent_swarm: 'EILMELDUNG: Silent Swarm beobachtet uns seit Tagen. Sie haben nie mit uns gesprochen.',
  helions: 'EILMELDUNG: Helion Kollektiv entdeckt. Sie leben in Sternen. Wir verstehen das nicht vollständig.',
  axioms: 'EILMELDUNG: Erstkontakt mit den Axiomen. Kommunikation besteht aus Primzahlen. Bedeutung unklar.',
};

const TIMEOUT_MS = 3000;

export async function generateFirstContactNews(
  factionId: AlienFactionId,
  pilotName: string,
  quadrantX: number,
  quadrantY: number,
): Promise<string> {
  const factionData = FACTION_PROMPT_DATA[factionId];
  if (!factionData) return FALLBACK_NEWS[factionId] ?? 'EILMELDUNG: Erstkontakt mit unbekannter Spezies.';

  const prompt =
    `Du schreibst eine Eilmeldung für einen CRT-Terminal-Nachrichtendienst im Stil eines retro Sci-Fi Spiels. ` +
    `Ton: sachlich, leicht alarmiert, schwarzer Humor. ` +
    `Pilot ${pilotName} hat bei Koordinaten ${quadrantX}:${quadrantY} Erstkontakt mit ${factionData.label} hergestellt. ` +
    `${factionData.description} ` +
    `Schreibe eine Eilmeldung in 2-3 Sätzen, max 200 Zeichen. Nur den Text, keine Anführungszeichen.`;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.');
    }, TIMEOUT_MS);

    execFile('gemini', ['--model', 'gemini-2.0-flash'], { timeout: TIMEOUT_MS }, (err, stdout) => {
      clearTimeout(timeout);
      if (err || !stdout.trim()) {
        resolve(FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.');
        return;
      }
      resolve(stdout.trim().slice(0, 300));
    });
  });
}
```

Note: `execFile` takes a separate `input` parameter for stdin — the prompt needs to be passed via stdin. Update to use `spawn` with stdin write:

```typescript
// Replace execFile section with:
import { spawn } from 'node:child_process';

// ... inside generateFirstContactNews:
return new Promise((resolve) => {
  const timeout = setTimeout(() => {
    resolve(FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.');
  }, TIMEOUT_MS);

  try {
    const proc = spawn('gemini', ['--model', 'gemini-2.0-flash'], { timeout: TIMEOUT_MS });
    let output = '';
    proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    proc.on('close', () => {
      clearTimeout(timeout);
      resolve(output.trim().slice(0, 300) || (FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.'));
    });
    proc.on('error', () => {
      clearTimeout(timeout);
      resolve(FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.');
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  } catch {
    clearTimeout(timeout);
    resolve(FALLBACK_NEWS[factionId] ?? 'ERSTKONTAKT BESTÄTIGT.');
  }
});
```

**Step 4: Run tests — expect PASS**

```bash
cd packages/server && npx vitest run src/__tests__/geminiNewsService.test.ts
```

**Step 5: Commit**

```bash
git add packages/server/src/engine/geminiNewsService.ts packages/server/src/__tests__/geminiNewsService.test.ts
git commit -m "feat: geminiNewsService — AI-generated first-contact news with fallback texts"
```

---

### Task 6: StoryQuestChainService.ts

**Files:**
- Create: `packages/server/src/rooms/services/StoryQuestChainService.ts`
- Create: `packages/server/src/__tests__/StoryQuestChainService.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/StoryQuestChainService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB queries
vi.mock('../db/queries.js', () => ({
  getStoryProgress: vi.fn().mockResolvedValue({
    player_id: 'p1',
    current_chapter: 0,
    completed_chapters: [],
    branch_choices: {},
    last_progress: Date.now(),
  }),
  upsertStoryProgress: vi.fn().mockResolvedValue(undefined),
  addAlienReputation: vi.fn().mockResolvedValue(undefined),
}));

import { StoryQuestChainService } from '../rooms/services/StoryQuestChainService.js';

describe('StoryQuestChainService', () => {
  let service: StoryQuestChainService;

  beforeEach(() => {
    service = new StoryQuestChainService();
    vi.clearAllMocks();
  });

  it('checkTrigger returns null when distance too low', async () => {
    const result = await service.checkTrigger('p1', 3, 3);
    expect(result).toBeNull();
  });

  it('checkTrigger returns chapter 0 event at qDist 6', async () => {
    const result = await service.checkTrigger('p1', 6, 0);  // qDist = 6
    expect(result).not.toBeNull();
    expect(result?.chapterId).toBe(0);
  });

  it('completeChapter marks chapter as completed', async () => {
    const { upsertStoryProgress } = await import('../db/queries.js');
    await service.completeChapter('p1', 0, null);
    expect(upsertStoryProgress).toHaveBeenCalledWith('p1', 1, [0], {});
  });

  it('completeChapter with branch saves branch choice', async () => {
    const { upsertStoryProgress } = await import('../db/queries.js');
    // First get progress (mocked as chapter 2 in progress)
    const { getStoryProgress } = await import('../db/queries.js');
    vi.mocked(getStoryProgress).mockResolvedValueOnce({
      player_id: 'p1',
      current_chapter: 2,
      completed_chapters: [0, 1],
      branch_choices: {},
      last_progress: Date.now(),
    });
    await service.completeChapter('p1', 2, 'A');
    expect(upsertStoryProgress).toHaveBeenCalledWith('p1', 3, [0, 1, 2], { '2': 'A' });
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
cd packages/server && npx vitest run src/__tests__/StoryQuestChainService.test.ts
```

**Step 3: Implement StoryQuestChainService.ts**

```typescript
// packages/server/src/rooms/services/StoryQuestChainService.ts
import {
  STORY_CHAPTERS,
  canUnlockChapter,
  applyBranchEffects,
  quadrantDistance,
  type StoryProgress,
} from '../../engine/storyQuestChain.js';
import {
  getStoryProgress,
  upsertStoryProgress,
} from '../../db/queries.js';
import { addAlienReputation } from '../../db/queries.js';

export interface StoryTriggerEvent {
  chapterId: number;
  title: string;
  flavorText: string;
  branches?: Array<{ id: string; label: string }>;
}

export class StoryQuestChainService {
  async checkTrigger(playerId: string, qx: number, qy: number): Promise<StoryTriggerEvent | null> {
    const qDist = quadrantDistance(qx, qy);
    const row = await getStoryProgress(playerId);
    const progress: StoryProgress = {
      currentChapter: row.current_chapter,
      completedChapters: row.completed_chapters,
      branchChoices: row.branch_choices,
    };

    // Find the next chapter to unlock
    const nextChapter = row.current_chapter;
    if (!canUnlockChapter(nextChapter, qDist, progress)) return null;

    const chapter = STORY_CHAPTERS[nextChapter];
    if (!chapter) return null;

    return {
      chapterId: chapter.id,
      title: chapter.title,
      flavorText: chapter.flavorText,
      branches: chapter.branches?.map((b) => ({ id: b.id, label: b.label })),
    };
  }

  async completeChapter(playerId: string, chapterId: number, branchChoice: string | null): Promise<void> {
    const row = await getStoryProgress(playerId);
    const completedChapters = [...row.completed_chapters, chapterId];
    const branchChoices = { ...row.branch_choices };
    if (branchChoice) branchChoices[String(chapterId)] = branchChoice;

    await upsertStoryProgress(playerId, chapterId + 1, completedChapters, branchChoices);

    // Apply reputation effects from branch choice
    if (branchChoice) {
      const effects = applyBranchEffects(chapterId, branchChoice);
      for (const [factionId, delta] of Object.entries(effects)) {
        if (delta) {
          await addAlienReputation(playerId, factionId, delta).catch(() => {});
        }
      }
    }
  }

  async getProgress(playerId: string): Promise<{
    currentChapter: number;
    completedChapters: number[];
    branchChoices: Record<string, string>;
    chapters: Array<{ id: number; title: string; minQDist: number; hasBranch: boolean }>;
  }> {
    const row = await getStoryProgress(playerId);
    return {
      currentChapter: row.current_chapter,
      completedChapters: row.completed_chapters,
      branchChoices: row.branch_choices,
      chapters: STORY_CHAPTERS.map((ch) => ({
        id: ch.id,
        title: ch.title,
        minQDist: ch.minQDist,
        hasBranch: !!ch.branches,
      })),
    };
  }
}
```

**Step 4: Run tests — expect PASS**

```bash
cd packages/server && npx vitest run src/__tests__/StoryQuestChainService.test.ts
```

**Step 5: Commit**

```bash
git add packages/server/src/rooms/services/StoryQuestChainService.ts packages/server/src/__tests__/StoryQuestChainService.test.ts
git commit -m "feat: StoryQuestChainService — progress tracking, trigger detection, branch effects"
```

---

### Task 7: CommunityQuestService.ts

**Files:**
- Create: `packages/server/src/rooms/services/CommunityQuestService.ts`
- Create: `packages/server/src/__tests__/CommunityQuestService.test.ts`

**Step 1: Write failing tests**

```typescript
// packages/server/src/__tests__/CommunityQuestService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/queries.js', () => ({
  getActiveCommunityAlienQuest: vi.fn().mockResolvedValue(null),
  insertCommunityAlienQuest: vi.fn().mockResolvedValue({ id: 1, title: 'Test', current_count: 0, target_count: 100, status: 'active' }),
  addCommunityQuestContribution: vi.fn().mockResolvedValue(undefined),
  expireOldCommunityQuests: vi.fn().mockResolvedValue(undefined),
  completeCommunityQuest: vi.fn().mockResolvedValue(undefined),
}));

import { CommunityQuestService } from '../rooms/services/CommunityQuestService.js';

describe('CommunityQuestService', () => {
  let service: CommunityQuestService;

  beforeEach(() => {
    service = new CommunityQuestService();
    vi.clearAllMocks();
  });

  it('seedInitial creates quest when none active', async () => {
    const { insertCommunityAlienQuest } = await import('../db/queries.js');
    await service.seedInitialIfEmpty();
    expect(insertCommunityAlienQuest).toHaveBeenCalled();
  });

  it('seedInitial does not create quest when one is active', async () => {
    const { getActiveCommunityAlienQuest, insertCommunityAlienQuest } = await import('../db/queries.js');
    vi.mocked(getActiveCommunityAlienQuest).mockResolvedValueOnce({ id: 1, status: 'active' } as any);
    await service.seedInitialIfEmpty();
    expect(insertCommunityAlienQuest).not.toHaveBeenCalled();
  });

  it('contribute calls addCommunityQuestContribution', async () => {
    const { addCommunityQuestContribution, getActiveCommunityAlienQuest } = await import('../db/queries.js');
    vi.mocked(getActiveCommunityAlienQuest).mockResolvedValueOnce({ id: 42, status: 'active', current_count: 5, target_count: 100 } as any);
    await service.contribute('player1', 3);
    expect(addCommunityQuestContribution).toHaveBeenCalledWith(42, 'player1', 3);
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
cd packages/server && npx vitest run src/__tests__/CommunityQuestService.test.ts
```

**Step 3: Implement CommunityQuestService.ts**

```typescript
// packages/server/src/rooms/services/CommunityQuestService.ts
import {
  getActiveCommunityAlienQuest,
  insertCommunityAlienQuest,
  addCommunityQuestContribution,
  expireOldCommunityQuests,
  completeCommunityQuest,
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
    factionId: 'archivists', questType: 'community_scan',
    title: 'Das Große Kartenprojekt',
    description: 'Alle Piloten: Scannt gemeinsam 100.000 Sektoren. Die Archivare teilen ihr Archiv.',
    targetCount: 100000, rewardType: 'archivist_star_charts',
  },
  {
    factionId: 'consortium', questType: 'community_delivery',
    title: 'Stabilisiertes Wurmloch-Netz',
    description: 'Baut gemeinsam 500 Jumpgates. Das Konsortium eröffnet eine Exklusivhandelsroute.',
    targetCount: 500, rewardType: 'consortium_trade_route',
  },
  {
    factionId: 'tourist_guild', questType: 'community_interaction',
    title: 'Erste Galaktische Olympiade',
    description: 'Schließt gemeinsam 10.000 Touristengilde-Quests ab. Menschheit wird offizielle Touristenattraktion.',
    targetCount: 10000, rewardType: 'tourist_attraction_badge',
  },
  {
    factionId: 'archivists', questType: 'community_alien_interaction',
    title: 'Interstellare Botschaft',
    description: 'Führt gemeinsam 50.000 positive Alien-Interaktionen durch. Alle Alien-Reps +10.',
    targetCount: 50000, rewardType: 'all_alien_rep_bonus',
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
```

**Step 4: Run tests — expect PASS**

```bash
cd packages/server && npx vitest run src/__tests__/CommunityQuestService.test.ts
```

**Step 5: Commit**

```bash
git add packages/server/src/rooms/services/CommunityQuestService.ts packages/server/src/__tests__/CommunityQuestService.test.ts
git commit -m "feat: CommunityQuestService — rotating server-wide alien quests with contribution tracking"
```

---

### Task 8: SectorRoom Integration

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`

**Step 1: Add imports (top of file, with other service imports)**

Find the block of service imports (around line 100–110) and add:

```typescript
import { StoryQuestChainService } from './services/StoryQuestChainService.js';
import { CommunityQuestService } from './services/CommunityQuestService.js';
import { rollForEncounter } from '../engine/alienEncounterGen.js';
import { generateFirstContactNews } from '../engine/geminiNewsService.js';
import { recordNewsEvent } from '../db/queries.js';
```

**Step 2: Add private fields (with other private service fields ~line 140–152)**

```typescript
private storyChain!: StoryQuestChainService;
private communityQuests!: CommunityQuestService;
private encounterSteps = new Map<string, number>();  // playerId -> steps since last encounter
```

**Step 3: Instantiate in onCreate (with other services ~line 276–290)**

```typescript
this.storyChain = new StoryQuestChainService();
this.communityQuests = new CommunityQuestService();
await this.communityQuests.seedInitialIfEmpty();
```

**Step 4: Add story/encounter hooks to moveSector handler (after existing pirate check, ~line 307)**

```typescript
// After: await this.scanning.checkAndEmitScanEvents(...)
// Add:
const auth = client.auth as { userId: string; username?: string };
if (auth?.userId) {
  // Story trigger check
  const storyTrigger = await this.storyChain.checkTrigger(
    auth.userId, this.serviceCtx.quadrantX, this.serviceCtx.quadrantY,
  ).catch(() => null);
  if (storyTrigger) client.send('storyEvent', storyTrigger);

  // Spontaneous alien encounter
  const steps = (this.encounterSteps.get(auth.userId) ?? 0) + 1;
  this.encounterSteps.set(auth.userId, steps);
  const encounter = rollForEncounter(
    auth.userId, data.sectorX, data.sectorY,
    this.serviceCtx.quadrantX, this.serviceCtx.quadrantY, steps,
  );
  if (encounter) {
    this.encounterSteps.set(auth.userId, 0);
    client.send('alienEncounterEvent', encounter);
  }
}
```

**Step 5: Add new message handlers (after existing `getAllTerritories` handler)**

```typescript
this.onMessage('storyChoice', async (client, data: { chapterId: number; branchChoice: string | null }) => {
  const auth = client.auth as { userId: string };
  if (!auth?.userId) return;
  await this.storyChain.completeChapter(auth.userId, data.chapterId, data.branchChoice ?? null);
  client.send('storyChoiceResult', { success: true, chapterId: data.chapterId });
});

this.onMessage('getStoryProgress', async (client) => {
  const auth = client.auth as { userId: string };
  if (!auth?.userId) return;
  const progress = await this.storyChain.getProgress(auth.userId);
  client.send('storyProgress', progress);
});

this.onMessage('getActiveCommunityQuest', async (client) => {
  const quest = await this.communityQuests.getActive();
  client.send('activeCommunityQuest', { quest });
});

this.onMessage('contributeToQuest', async (client, data: { amount: number }) => {
  const auth = client.auth as { userId: string };
  if (!auth?.userId) return;
  await this.communityQuests.contribute(auth.userId, data.amount ?? 1);
  const quest = await this.communityQuests.getActive();
  client.send('activeCommunityQuest', { quest });
});

this.onMessage('resolveAlienEncounter', async (client, data: { factionId: string; accepted: boolean; repOnAccept: number; repOnDecline: number }) => {
  const auth = client.auth as { userId: string };
  if (!auth?.userId) return;
  const delta = data.accepted ? data.repOnAccept : data.repOnDecline;
  if (delta !== 0) {
    const { addAlienReputation } = await import('../db/queries.js');
    await addAlienReputation(auth.userId, data.factionId, delta).catch(() => {});
  }
  client.send('alienEncounterResolved', { factionId: data.factionId, repDelta: delta });
});
```

**Step 6: Wire Gemini first-contact news into AlienInteractionService**

In `packages/server/src/rooms/services/AlienInteractionService.ts`, find the `recordNewsEvent` call for `alien_first_contact` (~line 135). Replace the static headline/summary with Gemini-generated text:

```typescript
// Replace:
recordNewsEvent({
  eventType: 'alien_first_contact',
  headline: `${auth.username} — Erstkontakt mit ${factionId.toUpperCase()}`,
  summary: flavor,
  ...
}).catch(() => {});

// With:
generateFirstContactNews(factionId, auth.username ?? auth.userId, this.ctx.quadrantX, this.ctx.quadrantY)
  .then((aiText) => {
    recordNewsEvent({
      eventType: 'alien_first_contact',
      headline: `ERSTKONTAKT: ${factionId.toUpperCase()}`,
      summary: aiText,
      playerId: auth.userId,
      playerName: auth.username,
      quadrantX: this.ctx.quadrantX,
      quadrantY: this.ctx.quadrantY,
      eventData: { factionId, pilotName: auth.username ?? auth.userId },
    });
  })
  .catch(() => {});
```

Also add import at top of AlienInteractionService.ts:
```typescript
import { generateFirstContactNews } from '../../engine/geminiNewsService.js';
```

**Step 7: Run all server tests**

```bash
cd packages/server && npx vitest run
```
Expected: All tests PASS (pre-existing pino failures are acceptable if they were already failing)

**Step 8: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts packages/server/src/rooms/services/AlienInteractionService.ts
git commit -m "feat: SectorRoom — story triggers + encounter rolls on moveSector, 5 new message handlers, Gemini first-contact news"
```

---

### Task 9: Copy TV Assets

**Files:**
- Copy TV videos to client public directory

**Step 1: Copy assets**

```bash
cp "E:/claude/voidSector/planung/Inhalte/TV/Green_Screen_Video_Generation_Request.mp4" packages/client/public/tv/anchor-green.mp4
cp "E:/claude/voidSector/planung/Inhalte/TV/Neues_Video_mit_anderem_Anchorman.mp4" packages/client/public/tv/anchor-alt.mp4
mkdir -p packages/client/public/tv
cp "E:/claude/voidSector/planung/Inhalte/TV/Green_Screen_Video_Generation_Request.mp4" packages/client/public/tv/anchor-green.mp4
cp "E:/claude/voidSector/planung/Inhalte/TV/Neues_Video_mit_anderem_Anchorman.mp4" packages/client/public/tv/anchor-alt.mp4
```

**Step 2: Verify files exist**

```bash
ls packages/client/public/tv/
```
Expected: `anchor-green.mp4`, `anchor-alt.mp4`

**Step 3: Commit**

```bash
git add packages/client/public/tv/
git commit -m "feat: add TV anchor videos for first-contact news overlay"
```

---

## PR 2: Client UI

### Task 10: Client State (gameSlice additions)

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`

**Step 1: Add new state fields and setters**

Find the existing state interface and `initialState`. Add:

```typescript
// In the state interface (after existing fields):
storyEvent: StoryEventPayload | null;
alienEncounterEvent: AlienEncounterEventPayload | null;
storyProgress: StoryProgressPayload | null;
activeCommunityQuest: CommunityQuestPayload | null;
```

Add type definitions near the top of gameSlice.ts:

```typescript
export interface StoryEventPayload {
  chapterId: number;
  title: string;
  flavorText: string;
  branches?: Array<{ id: string; label: string }>;
}

export interface AlienEncounterEventPayload {
  factionId: string;
  eventType: string;
  eventText: string;
  canRespond: boolean;
  acceptLabel?: string;
  declineLabel?: string;
  repOnAccept: number;
  repOnDecline: number;
}

export interface StoryProgressPayload {
  currentChapter: number;
  completedChapters: number[];
  branchChoices: Record<string, string>;
  chapters: Array<{ id: number; title: string; minQDist: number; hasBranch: boolean }>;
}

export interface CommunityQuestPayload {
  id: number;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  rewardType: string;
  expiresAt: number | null;
  status: string;
}
```

In `initialState`:
```typescript
storyEvent: null,
alienEncounterEvent: null,
storyProgress: null,
activeCommunityQuest: null,
```

In the actions/setters:
```typescript
setStoryEvent: (e: StoryEventPayload | null) => set({ storyEvent: e }),
setAlienEncounterEvent: (e: AlienEncounterEventPayload | null) => set({ alienEncounterEvent: e }),
setStoryProgress: (p: StoryProgressPayload | null) => set({ storyProgress: p }),
setActiveCommunityQuest: (q: CommunityQuestPayload | null) => set({ activeCommunityQuest: q }),
```

**Step 2: Run client tests**

```bash
cd packages/client && npx vitest run
```
Expected: PASS

**Step 3: Commit**

```bash
git add packages/client/src/state/gameSlice.ts
git commit -m "feat: gameSlice — storyEvent, alienEncounterEvent, storyProgress, activeCommunityQuest state"
```

---

### Task 11: Network Client Message Handlers

**Files:**
- Modify: `packages/client/src/network/client.ts`

**Step 1: Add message handlers and request methods**

Find the `room.onMessage` block and add handlers. Find the exported `network` object and add request methods.

Add handlers (in the room.onMessage section):

```typescript
room.onMessage('storyEvent', (data: StoryEventPayload) => {
  useStore.getState().setStoryEvent(data);
});

room.onMessage('storyProgress', (data: StoryProgressPayload) => {
  useStore.getState().setStoryProgress(data);
});

room.onMessage('storyChoiceResult', () => {
  useStore.getState().setStoryEvent(null);
  network.requestStoryProgress();
});

room.onMessage('alienEncounterEvent', (data: AlienEncounterEventPayload) => {
  useStore.getState().setAlienEncounterEvent(data);
});

room.onMessage('alienEncounterResolved', () => {
  useStore.getState().setAlienEncounterEvent(null);
});

room.onMessage('activeCommunityQuest', (data: { quest: CommunityQuestPayload | null }) => {
  useStore.getState().setActiveCommunityQuest(data.quest);
});
```

Add to network object:

```typescript
sendStoryChoice: (chapterId: number, branchChoice: string | null) => {
  room?.send('storyChoice', { chapterId, branchChoice });
},
requestStoryProgress: () => {
  room?.send('getStoryProgress', {});
},
requestActiveCommunityQuest: () => {
  room?.send('getActiveCommunityQuest', {});
},
contributeToQuest: (amount: number) => {
  room?.send('contributeToQuest', { amount });
},
resolveAlienEncounter: (factionId: string, accepted: boolean, repOnAccept: number, repOnDecline: number) => {
  room?.send('resolveAlienEncounter', { factionId, accepted, repOnAccept, repOnDecline });
},
```

Also add imports at top:
```typescript
import type {
  StoryEventPayload, AlienEncounterEventPayload, StoryProgressPayload, CommunityQuestPayload
} from '../state/gameSlice';
```

**Step 2: Run client tests**

```bash
cd packages/client && npx vitest run
```

**Step 3: Commit**

```bash
git add packages/client/src/network/client.ts
git commit -m "feat: network client — story/encounter/community message handlers and request methods"
```

---

### Task 12: StoryEventOverlay Component

**Files:**
- Create: `packages/client/src/components/overlays/StoryEventOverlay.tsx`
- Create: `packages/client/src/__tests__/StoryEventOverlay.test.tsx`

**Step 1: Write failing tests**

```typescript
// packages/client/src/__tests__/StoryEventOverlay.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StoryEventOverlay } from '../components/overlays/StoryEventOverlay';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: { sendStoryChoice: vi.fn(), requestStoryProgress: vi.fn() },
}));

describe('StoryEventOverlay', () => {
  it('renders nothing when no storyEvent', () => {
    mockStoreState({ storyEvent: null });
    const { container } = render(<StoryEventOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders chapter title and flavor text', () => {
    mockStoreState({
      storyEvent: {
        chapterId: 0,
        title: 'DAS AUFBRUCH-SIGNAL',
        flavorText: 'Ein schwaches Signal aus unbekannter Richtung.',
        branches: undefined,
      },
    });
    render(<StoryEventOverlay />);
    expect(screen.getByText('DAS AUFBRUCH-SIGNAL')).toBeTruthy();
    expect(screen.getByText(/schwaches Signal/)).toBeTruthy();
  });

  it('renders branch buttons when branches exist', () => {
    mockStoreState({
      storyEvent: {
        chapterId: 2,
        title: 'ERSTKONTAKT',
        flavorText: 'Die Archivare.',
        branches: [
          { id: 'A', label: 'Daten teilen' },
          { id: 'B', label: 'Verweigern' },
        ],
      },
    });
    render(<StoryEventOverlay />);
    expect(screen.getByText('Daten teilen')).toBeTruthy();
    expect(screen.getByText('Verweigern')).toBeTruthy();
  });

  it('calls sendStoryChoice on branch selection', () => {
    const { network } = require('../network/client');
    mockStoreState({
      storyEvent: {
        chapterId: 2,
        title: 'ERSTKONTAKT',
        flavorText: 'Test',
        branches: [{ id: 'A', label: 'Daten teilen' }],
      },
    });
    render(<StoryEventOverlay />);
    fireEvent.click(screen.getByText('Daten teilen'));
    expect(network.sendStoryChoice).toHaveBeenCalledWith(2, 'A');
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
cd packages/client && npx vitest run src/__tests__/StoryEventOverlay.test.tsx
```

**Step 3: Implement StoryEventOverlay.tsx**

```typescript
// packages/client/src/components/overlays/StoryEventOverlay.tsx
import { useStore } from '../../state/store';
import { network } from '../../network/client';

export function StoryEventOverlay() {
  const storyEvent = useStore((s) => s.storyEvent);
  const setStoryEvent = useStore((s) => s.setStoryEvent);

  if (!storyEvent) return null;

  const handleChoice = (branchId: string | null) => {
    network.sendStoryChoice(storyEvent.chapterId, branchId);
    setStoryEvent(null);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200,
    }}>
      <div style={{
        border: '2px solid var(--color-primary)',
        background: '#040404',
        padding: '24px 32px',
        maxWidth: 520,
        width: '90%',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-primary)',
      }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '0.3em', color: 'var(--color-dim)', marginBottom: 8 }}>
          KAPITEL {storyEvent.chapterId}
        </div>
        <div style={{ fontSize: '1.1rem', letterSpacing: '0.2em', marginBottom: 16 }}>
          {storyEvent.title}
        </div>
        <div style={{
          fontSize: '0.8rem', lineHeight: 1.7,
          color: 'var(--color-dim)', marginBottom: 20,
          borderLeft: '2px solid var(--color-primary)',
          paddingLeft: 12,
        }}>
          {storyEvent.flavorText}
        </div>

        {storyEvent.branches ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {storyEvent.branches.map((b) => (
              <button
                key={b.id}
                onClick={() => handleChoice(b.id)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  letterSpacing: '0.05em',
                }}
              >
                [{b.id}] {b.label}
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => handleChoice(null)}
            style={{
              background: 'var(--color-primary)',
              border: 'none',
              color: '#000',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              padding: '8px 24px',
              cursor: 'pointer',
              letterSpacing: '0.1em',
            }}
          >
            VERSTANDEN
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run tests — expect PASS**

```bash
cd packages/client && npx vitest run src/__tests__/StoryEventOverlay.test.tsx
```

**Step 5: Commit**

```bash
git add packages/client/src/components/overlays/StoryEventOverlay.tsx packages/client/src/__tests__/StoryEventOverlay.test.tsx
git commit -m "feat: StoryEventOverlay — modal chapter display with branch selection buttons"
```

---

### Task 13: FirstContactNewsOverlay (TV Greenscreen)

**Files:**
- Create: `packages/client/src/components/overlays/FirstContactNewsOverlay.tsx`

**Step 1: Implement component**

The TV anchor videos have a greenscreen. We display the video + overlay the Gemini-generated news text on the greenscreen area using CSS positioning. No chroma key needed — just position the text box in front of the green region.

```typescript
// packages/client/src/components/overlays/FirstContactNewsOverlay.tsx
import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../state/store';

interface Props {
  newsText: string;
  factionColor: string;
  onDone: () => void;
}

function NewsOverlay({ newsText, factionColor, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
    video.onended = () => {
      setVisible(false);
      onDone();
    };
    // Fallback: hide after 15s
    const t = setTimeout(() => { setVisible(false); onDone(); }, 15000);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#000',
      zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Anchor video */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 800 }}>
        <video
          ref={videoRef}
          src="/tv/anchor-green.mp4"
          style={{ width: '100%', display: 'block' }}
          muted={false}
        />
        {/* News text overlaid on greenscreen area — adjust top/left/width based on actual video layout */}
        <div style={{
          position: 'absolute',
          top: '18%', left: '38%',
          width: '58%', height: '55%',
          background: '#000',
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'center',
          padding: '12px 16px',
          fontFamily: 'var(--font-mono)',
          overflow: 'hidden',
        }}>
          <div style={{
            fontSize: '0.55rem', letterSpacing: '0.3em',
            color: factionColor, marginBottom: 8,
            animation: 'pulse 1s infinite',
          }}>
            ⚠ EILMELDUNG — ERSTKONTAKT
          </div>
          <div style={{
            fontSize: '0.8rem', color: '#fff',
            lineHeight: 1.5,
          }}>
            {newsText}
          </div>
        </div>
      </div>

      <button
        onClick={() => { setVisible(false); onDone(); }}
        style={{
          position: 'absolute', bottom: 32, right: 32,
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.3)',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          padding: '4px 12px',
          cursor: 'pointer',
        }}
      >
        ÜBERSPRINGEN
      </button>
    </div>
  );
}

/** Listens for alien_first_contact news events and shows the TV overlay */
export function FirstContactNewsOverlay() {
  const [pending, setPending] = useState<{ newsText: string; factionColor: string } | null>(null);

  // Listen for news events via the newsEvents list in store
  // The server broadcasts alien_first_contact as a newsEvent — the NEWS monitor already handles it
  // Here we intercept it for the TV overlay by watching recentNewsEvents
  const recentNews = useStore((s) => s.recentNewsEvents);

  useEffect(() => {
    if (!recentNews?.length) return;
    const latest = recentNews[0];
    if (latest?.eventType === 'alien_first_contact' && latest?.eventData?.showTvOverlay) {
      setPending({
        newsText: latest.summary ?? 'ERSTKONTAKT BESTÄTIGT.',
        factionColor: latest.eventData?.factionColor ?? '#00ff88',
      });
    }
  }, [recentNews]);

  if (!pending) return null;

  return (
    <NewsOverlay
      newsText={pending.newsText}
      factionColor={pending.factionColor}
      onDone={() => setPending(null)}
    />
  );
}
```

Note: The `recentNewsEvents` field needs to exist in gameSlice. Check if it's there — if not, add it. The NEWS monitor already pulls news — reuse that data.

**Step 2: Check if recentNewsEvents exists in gameSlice**

```bash
grep -n "recentNews\|newsEvents" packages/client/src/state/gameSlice.ts | head -10
```

If missing, add to gameSlice (same pattern as Task 10).

**Step 3: Mount overlay in CockpitLayout or App.tsx**

Find where `BattleDialog` or other overlays are mounted (likely `CockpitLayout.tsx` or a top-level component), and add:

```typescript
import { FirstContactNewsOverlay } from './overlays/FirstContactNewsOverlay';
import { StoryEventOverlay } from './overlays/StoryEventOverlay';
// ...in JSX:
<StoryEventOverlay />
<FirstContactNewsOverlay />
```

**Step 4: Commit**

```bash
git add packages/client/src/components/overlays/
git commit -m "feat: FirstContactNewsOverlay — TV greenscreen anchor video with Gemini news text overlay"
```

---

### Task 14: AlienEncounterToast Component

**Files:**
- Create: `packages/client/src/components/overlays/AlienEncounterToast.tsx`

**Step 1: Implement**

```typescript
// packages/client/src/components/overlays/AlienEncounterToast.tsx
import { useEffect } from 'react';
import { useStore } from '../../state/store';
import { network } from '../../network/client';

const FACTION_COLORS: Record<string, string> = {
  archivists: '#88ffcc',
  kthari: '#ff4444',
  mycelians: '#44ff88',
  consortium: '#ffaa44',
  tourist_guild: '#ffff44',
  scrappers: '#aaaaaa',
  mirror_minds: '#cc88ff',
  silent_swarm: '#ff8844',
  helions: '#ff44ff',
  axioms: '#ffffff',
};

export function AlienEncounterToast() {
  const encounter = useStore((s) => s.alienEncounterEvent);
  const setEncounter = useStore((s) => s.setAlienEncounterEvent);

  useEffect(() => {
    if (!encounter || encounter.canRespond) return;
    // Auto-dismiss non-interactive encounters after 8s
    const t = setTimeout(() => setEncounter(null), 8000);
    return () => clearTimeout(t);
  }, [encounter, setEncounter]);

  if (!encounter) return null;

  const color = FACTION_COLORS[encounter.factionId] ?? 'var(--color-primary)';

  const handleAccept = () => {
    network.resolveAlienEncounter(encounter.factionId, true, encounter.repOnAccept, encounter.repOnDecline);
  };
  const handleDecline = () => {
    network.resolveAlienEncounter(encounter.factionId, false, encounter.repOnAccept, encounter.repOnDecline);
  };

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 16,
      width: 280,
      border: `1px solid ${color}`,
      background: '#050505',
      padding: '10px 14px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.7rem',
      zIndex: 150,
    }}>
      <div style={{ color, fontSize: '0.6rem', letterSpacing: '0.2em', marginBottom: 6 }}>
        {encounter.factionId.toUpperCase().replace('_', ' ')} — KONTAKT
      </div>
      <div style={{ color: 'var(--color-dim)', lineHeight: 1.5, marginBottom: encounter.canRespond ? 10 : 0 }}>
        {encounter.eventText}
      </div>
      {encounter.canRespond && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={handleDecline} style={{
            background: 'transparent', border: '1px solid var(--color-dim)',
            color: 'var(--color-dim)', fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem', padding: '3px 10px', cursor: 'pointer',
          }}>
            {encounter.declineLabel ?? 'ABLEHNEN'}
          </button>
          <button onClick={handleAccept} style={{
            background: color, border: 'none',
            color: '#000', fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem', padding: '3px 10px', cursor: 'pointer',
          }}>
            {encounter.acceptLabel ?? 'ANNEHMEN'}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Mount in CockpitLayout (same location as StoryEventOverlay)**

```typescript
import { AlienEncounterToast } from './overlays/AlienEncounterToast';
// In JSX: <AlienEncounterToast />
```

**Step 3: Commit**

```bash
git add packages/client/src/components/overlays/AlienEncounterToast.tsx
git commit -m "feat: AlienEncounterToast — bottom-right encounter notification with accept/decline"
```

---

### Task 15: QUESTS Monitor — Story + Community Tabs

**Files:**
- Modify: `packages/client/src/components/programs/QuestsProgram.tsx` (or equivalent quests component)

**Step 1: Find quests component**

```bash
find packages/client/src -name "*Quest*" -o -name "*quest*" | grep -v test | grep -v node_modules
```

**Step 2: Add Story tab**

In the quests component, add a tab selector at the top. When "STORY" tab is selected, show:

```typescript
function StoryTab() {
  const progress = useStore((s) => s.storyProgress);

  useEffect(() => {
    network.requestStoryProgress();
  }, []);

  if (!progress) return <div style={{ color: 'var(--color-dim)', fontSize: '0.7rem' }}>LADE...</div>;

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
      {progress.chapters.map((ch) => {
        const completed = progress.completedChapters.includes(ch.id);
        const current = progress.currentChapter === ch.id;
        const locked = !completed && !current;
        return (
          <div key={ch.id} style={{
            padding: '6px 8px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            color: completed ? '#00ff88' : current ? 'var(--color-primary)' : 'rgba(255,255,255,0.2)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>
              {completed ? '✓' : current ? '▶' : '○'} KAP.{ch.id} — {ch.title}
            </span>
            {locked && (
              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.15)' }}>
                Q-DIST {ch.minQDist}
              </span>
            )}
            {completed && progress.branchChoices[String(ch.id)] && (
              <span style={{ color: '#00ff88', fontSize: '0.6rem' }}>
                [{progress.branchChoices[String(ch.id)]}]
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 3: Add Community tab**

```typescript
function CommunityTab() {
  const quest = useStore((s) => s.activeCommunityQuest);

  useEffect(() => {
    network.requestActiveCommunityQuest();
  }, []);

  if (!quest) return (
    <div style={{ color: 'var(--color-dim)', fontSize: '0.7rem', padding: 8 }}>
      KEINE AKTIVE COMMUNITY-QUEST
    </div>
  );

  const progress = Math.min(quest.currentCount / quest.targetCount, 1);
  const deadline = quest.expiresAt ? new Date(quest.expiresAt).toLocaleDateString() : '—';

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: 8 }}>
      <div style={{ color: 'var(--color-primary)', marginBottom: 8, letterSpacing: '0.1em' }}>
        {quest.title}
      </div>
      <div style={{ color: 'var(--color-dim)', marginBottom: 12, lineHeight: 1.5 }}>
        {quest.description}
      </div>
      {/* Progress bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: 'var(--color-dim)' }}>FORTSCHRITT</span>
          <span style={{ color: 'var(--color-primary)' }}>
            {quest.currentCount.toLocaleString()} / {quest.targetCount.toLocaleString()}
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--color-primary)' }} />
        </div>
      </div>
      <div style={{ color: 'var(--color-dim)', fontSize: '0.6rem' }}>
        DEADLINE: {deadline}
      </div>
    </div>
  );
}
```

**Step 4: Wire tabs into existing QuestsProgram**

Add tab state and render StoryTab / CommunityTab based on selection. Existing quest list becomes tab "AKTIV".

**Step 5: Run client tests**

```bash
cd packages/client && npx vitest run
```

**Step 6: Commit**

```bash
git add packages/client/src/components/programs/
git commit -m "feat: QUESTS monitor — Story (9 chapters) + Community tabs with progress display"
```

---

### Task 16: Final Integration Test

**Step 1: Run all tests**

```bash
npm test
```
Expected: All tests pass (server: ~660+, client: ~510+, shared: 191)

**Step 2: Push PR 1 (all server commits)**

```bash
git push origin feat/aq-story-community
```

Create PR: "feat: AQ Story Quest System — story chain, community quests, encounter events, Gemini first-contact news"

---

## Summary

| PR | Branch | Key Files |
|----|--------|-----------|
| 1 Server | feat/aq-story-community | migration 042, storyQuestChain.ts, StoryQuestChainService, CommunityQuestService, alienEncounterGen, geminiNewsService, SectorRoom hooks |
| 2 Client | feat/aq-story-community-ui | StoryEventOverlay, FirstContactNewsOverlay, AlienEncounterToast, QUESTS tabs, gameSlice, network client |
