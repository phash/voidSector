# AQ Story Quest System — Design Dokument

**Datum:** 2026-03-09
**Status:** APPROVED
**Branch:** feat/aq-story-community
**Abhängig von:** alien_reputation DB (Migration 035), AlienReputationService, AlienInteractionService — alle vorhanden

---

## Übersicht

Implementierung der fehlenden AQ-Komponenten auf Basis der bestehenden Alien-Infrastruktur:

1. **Story-Quest-Kette** — 9 Kapitel, distanzbasiert, Branch-Choices, satirische Hauptnarrative
2. **Community-Quests** — Server-weite kollektive Ziele, 7-Tage-Rotation
3. **Spontane Encounter-Events** — Distanzbasierte Random-Events beim Sektor-Betreten
4. **Gemini-generierte First-Contact-NEWS** — KI-generierte Eilmeldungen bei Erstkontakt
5. **Client UI** — Story-Overlay, Encounter-Toast, QUESTS-Monitor Story+Community-Tabs

---

## Ansatz: Service-First, UI-Second (2 PRs)

**PR 1:** Server-Services + DB + Tests
**PR 2:** Client UI

---

## Datenbank (Migration 042)

Zwei neue Tabellen (alle anderen alien-Tabellen existieren bereits in Migration 035):

```sql
-- Story-Fortschritt pro Spieler
CREATE TABLE IF NOT EXISTS story_quest_progress (
  player_id          VARCHAR(255) PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_chapter    INT NOT NULL DEFAULT 0,
  completed_chapters JSONB NOT NULL DEFAULT '[]',
  branch_choices     JSONB NOT NULL DEFAULT '{}',
  last_progress      BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Server-weite Menschheits-Reputation (aggregiert aus allen Spieler-Aktionen)
CREATE TABLE IF NOT EXISTS humanity_reputation (
  alien_faction_id  VARCHAR(50) PRIMARY KEY,
  rep_value         INT NOT NULL DEFAULT 0,
  interaction_count INT NOT NULL DEFAULT 0,
  last_updated      BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
```

---

## Story-Quest-Kette

### Kapitel-Tabelle

| Kap. | Q-Dist | Titel | Branch |
|------|--------|-------|--------|
| 0 | 6 | "Das Aufbruch-Signal" | — |
| 1 | 40 | "Die Außenposten-Anomalie" | — |
| 2 | 100 | "Erstkontakt — Die Archivare" | A: Daten teilen / B: verweigern |
| 3 | 150 | "Der erste Zweifel" | — |
| 4 | 200 | "Der K'thari-Test" | A: kämpfen / B: fliehen |
| 5 | 300 | "Die Lebende Welt" | A: schützen / B: zerstören / C: ignorieren |
| 6 | 500 | "Touristen-Invasion" | A: mitspielen / B: ablehnen |
| 7 | 1000 | "Das Unmögliche Artefakt" | — (Axiom-Puzzle) |
| 8 | 3000 | "Der Rand" | A: Ja / B: Nein / C: Unsicher |

**Trigger-Regel:** Kapitel N triggert beim nächsten `moveSector` sobald:
- Chebyshev-Quadrant-Distanz von 0:0 ≥ Kapitel-Distanz
- Alle vorherigen Kapitel abgeschlossen (oder übersprungen nach 48h Timeout)
- Kapitel 0 und 1: Distanz > 5 (außerhalb 5×5-Spawn-Cluster)

**Story-Events** werden als `storyEvent`-Message gesendet (analog zu `scanEvent`).
Branch-Choices in `branch_choices` JSONB gespeichert. Kein Blocking: Spieler kann ignorieren.

### Branch-Reputationseffekte (Beispiele)

```typescript
kapitel_2_branch_A: { archivists: +30 }
kapitel_2_branch_B: { archivists: -5 }
kapitel_4_branch_A: { kthari: +50 }
kapitel_4_branch_B: { kthari: -20 }
kapitel_5_branch_A: { mycelians: +40, kthari: -20 }
kapitel_5_branch_B: { mycelians: -50 }  // Ressourcen als Bonus
kapitel_5_branch_C: {}
kapitel_6_branch_A: { tourist_guild: +30 }
kapitel_6_branch_B: { tourist_guild: -10 }
```

---

## Community-Quests

4 Quests, rotierend (eine aktiv gleichzeitig, 7-Tage-Deadline):

| ID | Titel | Ziel | Belohnung |
|----|-------|------|-----------|
| `interstellar_message` | "Interstellare Botschaft" | 50.000 positive Alien-Interaktionen | Alle Alien-Reps +10 |
| `great_survey` | "Das Große Kartenprojekt" | 100.000 gescannte Sektoren | Archivare teilen Sternkarten |
| `jumpgate_network` | "Stabilisiertes Wurmloch-Netz" | 500 gebaute Jumpgates | Konsortium-Exklusivroute |
| `galactic_olympics` | "Erste Galaktische Olympiade" | 10.000 Touristengilde-Quests | "Tourist Attraction"-Badge |

**CommunityQuestService:**
```typescript
getActiveCommunityQuest(): Promise<CommunityAlienQuest | null>
contribute(playerId: string, questId: number, amount: number): Promise<void>
checkAndAdvanceRotation(): Promise<void>  // im Universe-Tick aufgerufen
seedInitialQuests(): Promise<void>         // beim Server-Start wenn leer
```

---

## Spontane Encounter-Events

Roll beim jedem `moveSector`, max 1 Event pro 10 Sektoren (Cooldown in Redis/Memory).

| Event | Fraktion | Min Q-Dist | Chance |
|-------|---------|------------|--------|
| Archivar-Sonde scannt Schiff | archivists | 100 | 2% |
| K'thari fordert Mautgebühr | kthari | 200 | 5% |
| Konsortium-Händler bietet Rabatt | consortium | 150 | 3% |
| Tourist fotografiert Schiff | tourist_guild | 500 | 8% |
| Scrapper bietet Schwarzmarkt | scrappers | 50 | 4% |
| Mirror Mind liest Emotionen | mirror_minds | 400 | 1% |
| Silent Swarm Drohne folgt | silent_swarm | 800 | 2% |

Outcome: `alienEncounterEvent`-Message an Client. Spieler kann reagieren oder ignorieren.
Rep-Effekt je nach Wahl (+5 bis +15 oder -5 bis -15).

---

## Gemini-generierte First-Contact-NEWS

Wenn Spieler erstmaligen Kontakt mit einer Alien-Fraktion herstellt (global — erste Person auf dem Server):

1. Server erkennt `isServerFirstContact = true` (kein Eintrag in `alien_encounters` mit dieser Fraktion)
2. Server ruft Gemini CLI auf (async, non-blocking):

```bash
echo "<prompt>" | gemini --model gemini-2.0-flash
```

**Prompt-Template:**
```
Du schreibst eine Eilmeldung für einen CRT-Terminal-Nachrichtendienst im Stil eines
retro Sci-Fi Spiels. Ton: sachlich, leicht alarmiert, schwarzer Humor.
Pilot [PLAYERNAME] hat bei Koordinaten [QX]:[QY] Erstkontakt mit [FACTION_LABEL] hergestellt.
[FACTION_DESCRIPTION in 1 Satz].
Schreibe eine Eilmeldung in 2-3 Sätzen, max 200 Zeichen. Nur den Text, keine Anführungszeichen.
```

3. Generierter Text → server-weite `newsEvent`-Message (bestehende NewsService-Pipeline)
4. NEWS-Monitor zeigt Eilmeldung mit Fraktions-Farbe als Highlight

**Fallback** (Timeout >3s oder Fehler): Vordefinierte Flavor-Texte pro Fraktion (hardcoded Fallback-Map).

**Faction Labels & Descriptions** (für Prompt):
```typescript
const FACTION_PROMPT_DATA: Record<AlienFactionId, { label: string; description: string }> = {
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
```

---

## Neue Services

```
packages/server/src/
├─ engine/
│   ├─ storyQuestChain.ts          ← Kapitel-Definitionen, Branch-Logic, Trigger-Check
│   ├─ alienEncounterGen.ts        ← Encounter-Tabelle, Roll-Funktion, Cooldown-Check
│   └─ geminiNewsService.ts        ← Gemini CLI Call, Fallback-Texte, First-Contact-Flow
│
└─ rooms/services/
    ├─ StoryQuestChainService.ts   ← getProgress, checkTrigger, completeChapter, applyBranch
    └─ CommunityQuestService.ts    ← getActive, contribute, checkRotation, seedInitial
```

**SectorRoom-Integration** (in `moveSector`-Handler):
```typescript
// Nach erfolgreichem Sektorwechsel:
const storyTrigger = await this.storyChain.checkTrigger(playerId, qx, qy);
if (storyTrigger) client.send('storyEvent', storyTrigger);

const encounter = await this.alienEncounterGen.roll(playerId, sectorX, sectorY, qx, qy);
if (encounter) client.send('alienEncounterEvent', encounter);
```

**Neue Message-Handler:**
- `storyChoice` — Spieler wählt Branch in Story-Kapitel
- `getStoryProgress` — aktuellen Story-Fortschritt abrufen
- `contributeToQuest` — Beitrag zu Community-Quest
- `getActiveCommunityQuest` — aktive Community-Quest abrufen
- `resolveAlienEncounter` — Spieler reagiert auf spontanen Encounter

---

## Client UI (PR 2)

### Story-Event-Overlay (modal, wie BattleDialog)
- Triggert bei `storyEvent`-Message
- Zeigt: Kapitel-Nummer, Titel, Flavor-Text, optional 2–3 Branch-Buttons
- Nach Wahl: Rep-Änderungen kurz einblenden ("+30 ARCHIVARE REP"), dann schließen
- State: `storyEvent: StoryEventPayload | null` in `gameSlice`

### Alien-Encounter-Toast (non-modal, 8s auto-dismiss)
- Kleines Panel unten rechts bei `alienEncounterEvent`
- Fraktions-Farbe als Akzent, Name + Event-Text + optionale Aktion
- State: `alienEncounterEvent: AlienEncounterPayload | null`

### QUESTS-Monitor: Neue Tabs
**Tab "STORY":**
- Kapitel 0–8 als Liste: abgeschlossen (grün), aktuell (blinkend), gesperrt (grau + benötigte Distanz)
- Branch-Choices der abgeschlossenen Kapitel als Journal-Einträge

**Tab "COMMUNITY":**
- Aktive Quest: Titel, Beschreibung, Fortschrittsbalken (server-weit), eigener Beitrag, Deadline-Countdown
- Bisherige abgeschlossene Community-Quests (Historie)

---

## Erfolgskriterien

- [ ] Story-Kette Kapitel 0–8 vollständig implementiert mit Branch-Choices
- [ ] Community-Quests rotieren, Beiträge aggregieren korrekt
- [ ] Spontane Encounter-Events triggern distanzabhängig
- [ ] Gemini CLI generiert First-Contact-NEWS, Fallback funktioniert
- [ ] 40+ Unit-Tests (Services), 10+ Integration-Tests (SectorRoom-Hooks)
- [ ] Client UI: Story-Overlay, Encounter-Toast, QUESTS-Monitor Tabs
