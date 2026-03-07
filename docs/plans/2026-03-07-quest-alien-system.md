# Quest- & Alien-System: Implementierungskonzept

**Datum:** 2026-03-07
**Abhängig von:** Phase 2 Sektor-Rebuild (#162) — braucht neue Sektortypen + Distanz-System
**Status:** READY FOR IMPLEMENTATION

---

## 1. Übersicht & Designprinzipien

### Kernidee

Das Quest- und Alien-System ist das Rückgrat der Spielnarrative. Spieler starten als selbstgefällige Spezies aus Quadrant 0:0 und begegnen nach und nach Alienrassen, die ihnen spiegeln, wie wenig bedeutsam die Menschheit eigentlich ist.

Die Begegnungen folgen einer klaren **Distanz-Progression**:

```
Q 0–50 (Bekannter Raum)
│  Nur menschliche NPCs. Propaganda-Boards überall.
│  "Willkommen im Zentrum des Universums."
│
Q 50–200 (Grenzraum)
│  Erste Alien-Signale. Die Archivare und das Konsortium.
│  "Eine neu entdeckte Spezies aus den Außenbereichen."
│
Q 200–500 (Frontier)
│  K'thari, Mycelianer, Scrappers.
│  "Sie haben unser Territorium betreten."
│
Q 500–2000 (Wildnis)
│  Touristengilde, Silent Swarm, Mirror Minds.
│  Menschheit wird zur Kuriosität.
│
Q 2000+ (Das Unbekannte)
│  Die Axiome. Helion Kollektiv.
│  Incomprehensible. Das "Ende" kommt näher.
```

### Designprinzipien

1. **Satire vor Ernsthaftigkeit** — Alien-Texte sind höflich herablassend, Mensch ist immer der Underdog
2. **Distanz = Fortschritt** — Keine harten Level-Gates, nur Koordinaten-Voraussetzungen
3. **Bestehende Architektur erweitern** — `questTemplates.ts` + `questgen.ts` bleiben Basis
4. **3 Reputations-Ebenen** — Spieler-Rep, Fraktions-Rep, Menschheits-Rep (kollektiv)

---

## 2. Alien-Spezies: Spielumsetzung

### 2.1 Die Archivare *(The Archivists)*

| Eigenschaft | Wert |
|------------|------|
| `alienFactionId` | `archivists` |
| Erste Begegnung ab | Q ~100:100 (Distanz ~140k Sektoren) |
| Erscheinung im Spiel | Seltene Scan-Events bei Relikte in dieser Zone |
| Sektor-Kontext | Bevorzugen leere Sektoren, nie bei Piraten |
| Ton | Akademisch, leicht herablassend |

**Erstkontakt-Flavor:**
> *"ARCHIVAR-SIGNAL EMPFANGEN — Übersetzung 94%
> 'Ah. Ein Vertreter der äußeren Spezies. Bemerkenswert dass Sie
>  bis hierher navigiert haben. Die meisten Ihrer Art tun das nicht.
>  Ihr Koordinatenursprung 0:0 — Sie glauben, das sei das Zentrum?
>  ... Faszinierend. Notiert.'"*

**Quest-Typen:**
- Sektoren scannen für die Archive (scan)
- Verlorene Daten-Sonden bergen (fetch)
- Stellarkartographie-Daten liefern (delivery)
- Forschungsexpedition begleiten (escort — neue Type)

**Reputation-Belohnungen:**
- `friendly`: Erweiterte Sternkarten (scannt mehr Sektoren auf einmal)
- `honored`: Archivar-Scan-Modul (5× Scan-Radius)

---

### 2.2 Das K'thari Dominion

| Eigenschaft | Wert |
|------------|------|
| `alienFactionId` | `kthari` |
| Erste Begegnung ab | Q ~200:200 (Distanz ~280k Sektoren) |
| Erscheinung | Kampf-Events, Grenzmarkierungen in Sektoren |
| Sektor-Kontext | Bevorzugen Asteroid-Felder, Stars-Nähe |
| Ton | Militärisch, respektvoll bei Stärke |

**Erstkontakt-Flavor:**
> *"K'THARI KAMPFRUF ÜBERSETZT:
> 'Unbekannte Einheit. Ihre Herkunftsregion 0:0 ist uns als
>  unbedeutende Randzone bekannt. Beweist eure Stärke
>  oder gebt Eure Route preis.'
> [Kampf oder Kapitulation]"*

**Quest-Typen:**
- Kampf-Trial: Besiege K'thari-Drohnen (bounty)
- Grenz-Patrouille: Eskorte K'thari-Konvoi (escort)
- Beute-Teilung: Liefere Kampfbeute (delivery)
- Ehrenkampf: 1v1 Simulationskampf (combat-trial — neue Type)

**Reputation-Belohnungen:**
- `friendly`: K'thari Waffenupgrade (erhöhter Angriff)
- `honored`: Schwere K'thari Panzerung (bestes Schild)

---

### 2.3 Die Mycelianer *(The Mycelians)*

| Eigenschaft | Wert |
|------------|------|
| `alienFactionId` | `mycelians` |
| Erste Begegnung ab | Q ~300:300 (Distanz ~420k Sektoren) |
| Erscheinung | Nur auf Planeten-Sektoren (terrestrial/water) |
| Sektor-Kontext | Ausschließlich Planeten-Sektoren |
| Ton | Langsam, symbolisch, rätselhaft |

**Erstkontakt-Flavor:**
> *"MYCELIANER-ÜBERTRAGUNG [Symbol-Sequenz #4471]:
> ▣ ○ ▣ ▣ ○
> Übersetzung: 'Kleines... helles... Wesen... aus... dem... Rand...
>  Ihr Planet... atmet nicht mehr... seit ihr kam.'"*

**Quest-Typen:**
- Sporen sammeln (fetch)
- Ökosystem-Entscheidung: Schützen oder Zerstören (branch-quest)
- Biologische Probe analyse (scan)
- Mycelian-Netz wiederherstellen (repair — neue Type)

**Reputation-Belohnungen:**
- `friendly`: Biologisches Schild (regeneriert HP langsam)
- `honored`: Mycelian-Tarnung (Piraten greifen seltener an)

---

### 2.4 Das Konsortium *(The Consortium)*

| Eigenschaft | Wert |
|------------|------|
| `alienFactionId` | `consortium` |
| Erste Begegnung ab | Q ~150:150 (Distanz ~210k Sektoren) |
| Erscheinung | Handels-Stationen in Frontier-Zone |
| Sektor-Kontext | Leere Sektoren mit hoher Handelsrouten-Dichte |
| Ton | Businessmäßig, neutral bis freundlich |

**Erstkontakt-Flavor:**
> *"KONSORTIUM MARKT-TERMINAL [VERBINDUNG HERGESTELLT]
> 'Spezies: Human (Randregion). Kreditwürdigkeit: Unbekannt.
>  Wir handeln mit allem. Auch mit Spezies aus... der Ecke.
>  Was haben Sie anzubieten?'"*

**Quest-Typen:**
- Handels-Lieferung (delivery)
- Markt-Arbitrage: Kaufe billig, verkaufe teuer (trade — neue Type)
- Piraten-Ablenkung für Konvoi (combat + delivery)
- Exklusiv-Kontrakt: Große Lieferung (elite delivery)

**Reputation-Belohnungen:**
- `friendly`: Konsortium-Handelskarte (5% bessere Preise überall)
- `honored`: Exklusiv-Markt (seltene Ressourcen verfügbar)

---

### 2.5 Die Touristengilde *(The Tourist Guild)*

| Eigenschaft | Wert |
|------------|------|
| `alienFactionId` | `tourist_guild` |
| Erste Begegnung ab | Q ~500:500 (Distanz ~700k Sektoren) |
| Erscheinung | Zufällige Encounters überall, luxury Schiffe |
| Sektor-Kontext | Folgen Spielern mit hoher Entfernung von 0:0 |
| Ton | Enthusiastisch-herablassend, Touristen-Klischee |

**Erstkontakt-Flavor:**
> *"TOURISTENGILDE LUXUSLINER 'GALACTIC WONDER' NÄHERT SICH
> 'Oh! Ein echter Menschlicher Pilot! Aus dem berühmten 0:0-Cluster!
>  Dürfen wir Fotos machen? Unsere Gäste LIEBEN echte Randspezies.
>  Wir haben 340 Touristen, die... na ja, hier auf Sie gewartet haben.'"*

**Quest-Typen:**
- Touristenschiff eskortieren (escort)
- Menschliche Kultur vorführen (performance — neue Type)
- Beschädigtes Beobachtungsgerät reparieren (repair)
- Touristen-Notfall: SOS mitten im Piratensektor (rescue + combat)

**Reputation-Belohnungen:**
- `friendly`: Galaktischer Reiseführer (enthüllt bekannte Alien-Positionen)
- `honored`: VIP-Status — Tourists zahlen Mautgebühren an Spieler

---

### 2.6 Die Axiome *(The Axioms)*

| Eigenschaft | Wert |
|------------|------|
| `alienFactionId` | `axioms` |
| Erste Begegnung ab | Q ~2000:2000 (Distanz ~2,8M Sektoren) |
| Erscheinung | Nur bei speziellen Axiom-Relikten (sehr selten) |
| Sektor-Kontext | Black Hole Nähe, Axiom-Strukturen |
| Ton | Keine Sprache. Nur mathematische Muster. |

**Erstkontakt-Flavor:**
> *"[UNBEKANNTES SIGNAL — KEINE ÜBERSETZUNG MÖGLICH]
> [PATTERN-ANALYSE: Geometrisch. Fraktal. Wiederholt.]
> [BEDEUTUNG UNKLAR]
> [SCANNER ÜBERHITZT]
> [VERBINDUNG GETRENNT]"*

**Quest-Typen:**
- Axiom-Artefakt analysieren (solve-puzzle — neue Type)
- Energiemuster dokumentieren (scan)
- Axiom-Struktur kartieren (scan + proximity)

**Kein direktes Reputations-System** — Aktionen beeinflussen ob sie beobachten, ignorieren oder intervenieren.

---

### 2.7 Sekundäre Spezies

| Spezies | `alienFactionId` | Distanz | Besonderheit |
|---------|-----------------|---------|-------------|
| Scrappers | `scrappers` | ab Q 50 | Asteroid-Felder, Black Market |
| Helion Kollektiv | `helions` | ab Q 1000, nur Stars | Energie-Stürme, Stellar-Forschung |
| Silent Swarm | `silent_swarm` | ab Q 800, Derelicts | Rogue AI, gefährliche Megastrukturen |
| Mirror Minds | `mirror_minds` | ab Q 400 | Telepathisch, Ehrlichkeit entscheidet |

---

## 3. Quest-System-Architektur

### 3.1 Neue Quest-Typen (Erweiterung bestehender QuestType)

```typescript
// packages/shared/src/types.ts — Erweiterung
export type QuestType =
  // Bestehend
  | 'fetch'
  | 'delivery'
  | 'scan'
  | 'bounty'
  // Neu
  | 'escort'         // Konvoi/Touristenschiff begleiten
  | 'combat_trial'   // K'thari Kampfprobe
  | 'repair'         // Beschädigtes Objekt reparieren
  | 'branch'         // Entscheidungs-Quest (mehrere Ausgänge)
  | 'trade'          // Markt-Arbitrage
  | 'solve_puzzle'   // Axiom-Rätsel
  | 'performance'    // Kultur vorführen (Tourist Guild)
  | 'story'          // Hauptstory-Quest (einmalig)
  | 'community';     // Server-weite Gemeinschaftsquest

export type AlienFactionId =
  | 'archivists'
  | 'kthari'
  | 'mycelians'
  | 'consortium'
  | 'tourist_guild'
  | 'axioms'
  | 'scrappers'
  | 'helions'
  | 'silent_swarm'
  | 'mirror_minds';

// Kombinierter Typ für alle Fraktionen (NPC + Alien)
export type AnyFactionId = NpcFactionId | AlienFactionId;
```

### 3.2 Erweitertes QuestTemplate Interface

```typescript
// packages/server/src/engine/questTemplates.ts — Erweiterung
export interface QuestTemplate {
  id: string;
  type: QuestType;
  factionId: AnyFactionId | 'any';

  // Bestehend
  title: string;
  descriptionTemplate: string;
  requiredTier: ReputationTier;
  rewardCreditsBase: number;
  rewardXpBase: number;
  rewardRepBase: number;

  // Neu: Alien-spezifisch
  alienFactionId?: AlienFactionId;        // Welche Alien-Fraktion gibt diesen Quest
  minDistanceFromOrigin?: number;         // Minimale Distanz von 0:0 (in Sektoren)
  maxDistanceFromOrigin?: number;         // Maximale Distanz
  requiredSectorType?: SectorEnvironmentType; // Nur in bestimmten Sektortypen
  isStoryQuest?: boolean;                 // Einmalig, Teil der Hauptstory
  storyChainId?: string;                  // z.B. 'first_contact_chain'
  storyChainStep?: number;               // Schritt in der Kette
  branchOptions?: BranchOption[];        // Für branch-Quests
  narrativeText?: string;                // Flavor-Text beim Abschluss
  communityTarget?: number;             // Für Community-Quests: Gesamt-Zielwert
  repPenaltyOtherFaction?: { faction: AlienFactionId; penalty: number };
}

export interface BranchOption {
  id: string;
  label: string;
  outcome: 'diplomatic' | 'scientific' | 'military';
  reputationEffect: Partial<Record<AlienFactionId, number>>;
  narrativeText: string;
}
```

### 3.3 Story-Quest-Chain: Die Hauptgeschichte

Die Story entfaltet sich über 9 Kapitel, jeweils ausgelöst durch Distanz-Meilensteine:

```
KAPITEL 0: "Das Aufbruch-Signal" (Start nahe 0:0)
  Voraussetzung: Spieler erkundet ersten Sektor außerhalb des Spawn-Bereichs
  Quest: Scan erstes unbekanntes Signal
  Belohnung: Erste Sternkarte, Hinweis auf "etwas weiter draußen"
  Flavor: "Das Zentralkomitee für Universumserkundung bestätigt:
           Ihr befindet euch im Zentrum. Bitte bestätigen."

KAPITEL 1: "Die Außenposten-Anomalie" (Q ~30:30, Dist ~42k)
  Voraussetzung: Erste Station weit genug von 0:0 entdeckt
  Quest: Mysteriöses Signal an Grenzstation untersuchen
  Flavor: "Das Signal ist... nicht menschlich. Bitte melden Sie sich
           beim Ministerium für Zentrumsbestätigung."

KAPITEL 2: "Erstkontakt — Die Archivare" (Q ~100:100, Dist ~140k)
  Voraussetzung: Distanz > 140.000 Sektoren von 0:0
  Quest: Archivar-Signal lokalisieren + Kommunikation aufbauen
  BRANCH:
    [A] Daten teilen → +30 Archivare Rep, Sternkarte erhalten
    [B] Daten verweigern → Archivare warten. Quest bleibt offen.
  Flavor: "Archivare haben Ihre Koordinaten-Erwartungen korrigiert.
           0:0 ist in unseren Aufzeichnungen als 'Randregion EX-7' verzeichnet."

KAPITEL 3: "Der erste Zweifel" (Q ~150:150, Dist ~210k)
  Voraussetzung: Kapitel 2 abgeschlossen
  Quest: Verlassene menschliche Forschungsstation finden
  Entdeckung: Logs einer früheren Expedition die dasselbe dachte
  Flavor: "Expeditions-Log 2381-03-14:
           'Die Archivare sagen, wir kommen aus einem Randsektor.
            Das ist natürlich Unsinn. Wir sind das Zentrum.
            Wir fahren morgen weiter nach außen. Zum Beweis.'
           [Weitere Einträge: nicht vorhanden]"

KAPITEL 4: "Der K'thari-Test" (Q ~200:200, Dist ~280k)
  Voraussetzung: Distanz > 280.000 Sektoren
  Quest: K'thari-Grenzmarkierung gefunden → Kampfprobe bestehen
  BRANCH:
    [Kämpfen] → K'thari-Kampftrial, bei Sieg: +50 K'thari Rep
    [Fliehen] → -20 K'thari Rep, Quest später wiederholen
  Flavor: "K'thari General Vrak'ath: 'Ihr habt bestanden.
           Für eine Randspezies. Unterhaltsam.'"

KAPITEL 5: "Die Lebende Welt" (Q ~300:300, Dist ~420k)
  Voraussetzung: Planeten-Sektor in dieser Distanzzone betreten
  Quest: Mycelian-Sporen-Ausbruch auf einem Planeten
  BRANCH:
    [Beschützen] → +40 Mycelianer Rep, -20 K'thari Rep
    [Zerstören] → -50 Mycelianer Rep, Ressourcen geerntet
    [Ignorieren] → Nichts, Quest nach 48h abgebrochen
  Flavor: "Das Netz... erinnert sich... an euch... kleines Randwesen."

KAPITEL 6: "Touristen-Invasion" (Q ~500:500, Dist ~700k)
  Voraussetzung: Distanz > 700.000 Sektoren
  Quest: Galaktischer Luxusliner nähert sich, will "echte Menschen beobachten"
  BRANCH:
    [Mitspiel] → +30 Touristengilde, Credits, aber Würde-Verlust
    [Ablehnen] → -10 Touristengilde, Quest weiter verfügbar
  Flavor: "Touristengilde Bewertung: ★★★★☆
           'Die Natives waren authentisch verwirrt über ihre Position
            im Universum. Sehr empfehlenswert für Grenzgebiet-Touren.'"

KAPITEL 7: "Das Unmögliche Artefakt" (Q ~1000:1000, Dist ~1,4M)
  Voraussetzung: Axiom-Relikt in Wildnis-Zone entdeckt
  Quest: Artefakt-Energie-Puzzle lösen (Minispiel)
  Outcome: Axiome wissen jetzt von eurer Existenz
  Flavor: "[AXIOM-PROTOKOLL 0000.7741.BETA]
           [EINHEIT REGISTRIERT]
           [EINHEIT: INTERESSANT — BEWERTUNG: AUSSTEHEND]"

KAPITEL 8: "Der Rand" (Q ~3000:3000+, Distanz sehr weit)
  Voraussetzung: Kapitel 1–7 abgeschlossen + weit genug
  Quest: Das "Ende des Universums" finden
  Outcome: Es gibt kein Ende. Oder: Es gibt eines. (TBD in späterem Update)
  Flavor: "Nach allem was ihr gesehen habt — den Archivaren die euch
           bemitleidet haben, den K'thari die euch getestet haben,
           den Touristen die euch fotografiert haben —
           seid ihr immer noch überzeugt, das Zentrum zu sein?
           [JA / NEIN / ICH BIN MIR NICHT SICHER]"
```

---

## 4. Reputations-System (3 Ebenen)

### 4.1 Spieler-Reputation (Individual)
Bestehend: `reputation` Tabelle mit NPC-Fraktionen (-100..+100).
**Neu:** Gleiche Tabelle erweitern für Alien-Fraktionen.

### 4.2 Fraktions-Reputation (Spieler-Gruppe)
Wenn viele Spieler einer Fraktion positiv begegnen, steigt die kollektive Fraktion-Rep.
Gespeichert in `faction_alien_rep` (faction_id + alien_faction_id + aggregate_rep).

### 4.3 Menschheits-Reputation (Server-weit)
**Neue Tabelle** `humanity_reputation`:
```sql
CREATE TABLE humanity_reputation (
  alien_faction_id VARCHAR(50) PRIMARY KEY,
  rep_value INT DEFAULT 0,     -- Aggregat aller Spieler-Aktionen (-1000..+1000)
  last_updated TIMESTAMP DEFAULT NOW()
);
```
Alien-NPCs reagieren global anders, wenn Menschheit-Rep hoch/niedrig ist.

**Beispiele:**
- Viele Spieler helfen Archivaren → Alle Archivare stationsweit freundlicher
- Viele Spieler zerstören Mycelian-Planeten → Mycelian-Aggression auf allen Planeten

---

## 5. Alien-Encounter-Events (spontan, distanzbasiert)

Neben quest-basierten Begegnungen gibt es spontane Events beim Betreten eines Sektors:

```typescript
interface AlienEncounterEvent {
  type: 'hail' | 'scan_player' | 'demand_toll' | 'offer_trade' | 'attack' | 'observe';
  factionId: AlienFactionId;
  triggerChance: number;         // 0–1
  minDistanceFromOrigin: number;
  requiredSectorType?: SectorEnvironmentType;
  humanityRepThreshold?: number; // Nur wenn Menschheits-Rep > X
  dialog: string[];              // Zufälliger Dialog aus Liste
}
```

**Beispiele:**

| Event | Fraktion | Distanz | Chance |
|-------|---------|---------|--------|
| Archivar-Sonde scannt Schiff | Archivare | >140k | 2% |
| K'thari fordert Mautgebühr | K'thari | >280k | 5% |
| Konsortium-Händler bietet Rabatt | Konsortium | >210k | 3% |
| Tourist fotografiert Schiff | Touristengilde | >700k | 8% |
| Scrapper bietet Schwarzmarkt an | Scrappers | >50k, Asteroid | 4% |
| Mirror Mind liest Emotionen | Mirror Minds | >400k | 1% |
| Silent Swarm Drohne folgt Schiff | Silent Swarm | >800k, Derelict | 2% |

---

## 6. Community-Quests (Server-weit)

Alle Spieler arbeiten zusammen an einem Ziel. Fortschritt aggregiert sich.

```typescript
interface CommunityQuest {
  id: string;
  title: string;
  description: string;
  targetValue: number;           // z.B. 10.000 Scan-Aufträge
  currentValue: number;          // Aggregat aller Spieler
  deadline: Date;
  rewardForAllParticipants: Reward;
  rewardForTopContributors: Reward;
  narrativeOutcome: string;      // Text bei Erfolg
  failureOutcome: string;        // Text bei Misserfolg
}
```

**Geplante Community-Quests:**

1. **"Interstellare Botschaft"** (Q ~300+)
   Ziel: 50.000 Alien-Interaktionen (positiv) server-weit
   Belohnung: Botschafts-Struktur freigeschaltet (baubar)
   Outcome: Alle Alien-Reputationen +10

2. **"Das Große Kartenprojekt"** (Q ~200+)
   Ziel: 100.000 Sektoren server-weit gescannt
   Belohnung: Galaktische Karte (zeigt alle Alien-Zonen grob)
   Outcome: Archivare teilen geheime Sternkarten

3. **"Stabilisiertes Wurmloch-Netz"** (Q ~500+)
   Ziel: 500 Jumpgates gebaut (alle Spieler zusammen)
   Belohnung: Konsortium eröffnet Exklusiv-Handelsroute

4. **"Erste Galaktische Olympiade"** (Satirisch)
   Ziel: Touristengilde-Quests 10.000× abgeschlossen
   Belohnung: Menschheit offiziell "tourist attraction" Status
   Outcome: Galaktische Medien berichten, Spieler erhalten "Famous" Badge

---

## 7. Datenbank-Schema

### Neue Tabellen

```sql
-- Alien-Reputation pro Spieler
CREATE TABLE IF NOT EXISTS alien_reputations (
  player_id VARCHAR(255) NOT NULL,
  alien_faction_id VARCHAR(50) NOT NULL,
  rep_value INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (player_id, alien_faction_id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);
CREATE INDEX IF NOT EXISTS idx_alien_rep_player ON alien_reputations(player_id);

-- Story-Quest-Fortschritt pro Spieler
CREATE TABLE IF NOT EXISTS story_quest_progress (
  player_id VARCHAR(255) NOT NULL,
  chain_id VARCHAR(100) NOT NULL,     -- z.B. 'main_story'
  current_step INT DEFAULT 0,
  completed_steps JSONB DEFAULT '[]', -- Array der abgeschlossenen Step-IDs
  branch_choices JSONB DEFAULT '{}',  -- {'kapitel_2': 'A', 'kapitel_5': 'beschützen'}
  started_at TIMESTAMP DEFAULT NOW(),
  last_progress TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (player_id, chain_id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Server-weite Menschheits-Reputation
CREATE TABLE IF NOT EXISTS humanity_reputation (
  alien_faction_id VARCHAR(50) PRIMARY KEY,
  rep_value INT DEFAULT 0,
  interaction_count INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Community-Quest-Status (server-weit)
CREATE TABLE IF NOT EXISTS community_quests (
  id VARCHAR(100) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  current_value INT DEFAULT 0,
  target_value INT NOT NULL,
  status VARCHAR(50) DEFAULT 'active',  -- active | completed | failed | upcoming
  deadline TIMESTAMP,
  started_at TIMESTAMP DEFAULT NOW()
);

-- Spieler-Beiträge zu Community-Quests
CREATE TABLE IF NOT EXISTS community_quest_contributions (
  quest_id VARCHAR(100) NOT NULL,
  player_id VARCHAR(255) NOT NULL,
  contribution INT DEFAULT 0,
  last_contributed TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (quest_id, player_id)
);

-- Alien-Encounter-Log (für Narrative + Analytics)
CREATE TABLE IF NOT EXISTS alien_encounters (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL,
  alien_faction_id VARCHAR(50) NOT NULL,
  encounter_type VARCHAR(50) NOT NULL,
  sector_x INT NOT NULL,
  sector_y INT NOT NULL,
  outcome VARCHAR(50),  -- 'positive' | 'negative' | 'neutral' | 'combat'
  encountered_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Services-Architektur

### 8.1 Neue/erweiterte Services

```
packages/server/src/
├─ engine/
│   ├─ questTemplates.ts         ← erweitern (alien templates)
│   ├─ questgen.ts               ← erweitern (distanz-check, story-quests)
│   ├─ alienEncounterGen.ts      ← NEU (spontane Encounter-Events)
│   └─ storyQuestChain.ts        ← NEU (Haupt-Story-Logik)
│
├─ rooms/services/
│   ├─ QuestService.ts           ← erweitern (story + community)
│   ├─ AlienReputationService.ts ← NEU
│   ├─ CommunityQuestService.ts  ← NEU
│   └─ AlienEncounterService.ts  ← NEU
│
└─ db/migrations/
    └─ 033_quest_alien_system.sql ← NEU
```

### 8.2 AlienReputationService

```typescript
export class AlienReputationService {
  // Spieler-Reputation
  async getAlienRep(playerId: string, alienFactionId: AlienFactionId): Promise<number>
  async updateAlienRep(playerId: string, alienFactionId: AlienFactionId, delta: number): Promise<void>
  async getAlienRepTier(playerId: string, alienFactionId: AlienFactionId): Promise<ReputationTier>

  // Menschheits-Reputation (aggregiert)
  async getHumanityRep(alienFactionId: AlienFactionId): Promise<number>
  async contributeToHumanityRep(alienFactionId: AlienFactionId, delta: number): Promise<void>

  // Welche Aliens sind in Reichweite?
  async getAvailableAlienFactions(distanceFromOrigin: number): Promise<AlienFactionId[]>
}
```

### 8.3 StoryQuestChainService

```typescript
export class StoryQuestChainService {
  // Spieler-Fortschritt
  async getProgress(playerId: string): Promise<StoryProgress>
  async canUnlockStep(playerId: string, step: number, distanceFromOrigin: number): Promise<boolean>
  async completeStep(playerId: string, stepId: string, branchChoice?: string): Promise<StoryStepResult>

  // Trigger-Check beim Sektor-Betreten
  async checkForStoryTrigger(playerId: string, sectorX: number, sectorY: number): Promise<StoryTrigger | null>
}
```

### 8.4 AlienEncounterService (Spontan-Events)

```typescript
export class AlienEncounterService {
  // Beim Betreten eines Sektors
  async rollForEncounter(
    playerId: string,
    sectorX: number,
    sectorY: number,
    sectorType: SectorEnvironmentType
  ): Promise<AlienEncounterEvent | null>

  async resolveEncounter(
    playerId: string,
    encounterId: string,
    playerChoice: string
  ): Promise<EncounterOutcome>
}
```

---

## 9. Implementierungs-Phasen

### Sprint 1 (2 Wochen): Fundament
- [ ] Migration 033 (alle neuen Tabellen)
- [ ] `AlienFactionId` Type + `alien_reputations` Queries
- [ ] `AlienReputationService` (get/set/tier)
- [ ] `questTemplates.ts` erweitern: Alien-Fraktion-Templates (Archivare + Konsortium)
- [ ] `questgen.ts` erweitern: Distanz-Filter + Alien-Faction-Awareness
- [ ] Tests: 20+ Unit-Tests

### Sprint 2 (2 Wochen): Story-Quest-Kette
- [ ] `storyQuestChain.ts` — Kapitel 0–4 implementieren
- [ ] `StoryQuestChainService` — Fortschritt, Branch-Choices, Trigger
- [ ] Branch-Quest-Mechanik (`branch` Quest-Typ)
- [ ] Narrative-Flavor-Texte (Kapitel 0–4)
- [ ] Tests: 15+ Unit-Tests + 5 Integration-Tests

### Sprint 3 (1 Woche): Alien-Encounters
- [ ] `alienEncounterGen.ts` — Encounter-Events-Tabelle
- [ ] `AlienEncounterService` — Roll + Resolve
- [ ] SectorRoom: Hook beim Betreten eines Sektors
- [ ] Client: Encounter-Dialog-Overlay
- [ ] Tests: 10+ Tests

### Sprint 4 (1 Woche): Community-Quests
- [ ] `CommunityQuestService`
- [ ] Community-Quest-Progress aggregieren
- [ ] 4 Community-Quests definieren + implementieren
- [ ] Client: Community-Quest-Anzeige im QUESTS-Monitor
- [ ] Tests: 10+ Tests

### Sprint 5 (1 Woche): Restliche Aliens + Story-Kapitel 5–8
- [ ] K'thari, Mycelianer, Touristengilde Templates + Encounters
- [ ] Story Kapitel 5–8 (Grundgerüst, ohne Axiome)
- [ ] Menschheits-Reputation-System live
- [ ] Balancing + Final Tests

**Gesamt: ~7 Wochen nach Phase 2 Rebuild**

---

## 10. Erfolgs-Kriterien

✅ 10 Alien-Fraktionen mit eigenem Reputations-System
✅ 9-Kapitel Story-Quest-Kette vollständig
✅ Branch-Quests mit unterschiedlichen Outcomes
✅ Spontane Alien-Encounter beim Sektor-Betreten
✅ 4 Community-Quests mit aggregiertem Fortschritt
✅ Distanz-basierte Alien-Encounter-Progression
✅ Menschheits-Reputation beeinflusst Aliens global
✅ 70+ Unit-Tests, 20+ Integration-Tests, 10+ E2E-Tests grün
✅ Narrative transportiert die Satire konsistent

---

**Dokument Status:** READY FOR REVIEW
**Autor:** Claude Sonnet 4.6
**Datum:** 2026-03-07
