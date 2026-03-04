# Points of Interest — NPC-Begegnungen

**Stand:** 2026-03-04
**Branch:** `claude/poi-design-documents-DHxCE`
**Bezug:** POI-System — NPC-Raumschiffe & NPC-Außenposten
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick

NPC-POIs sind die häufigsten Points of Interest und bilden das Rückgrat des
lebendigen Universums. Sie integrieren sich nahtlos in das bestehende Fraktionssystem.

```
  ╔══════════════════════════════════════════════════════════════════╗
  ║                   NPC POI — ÜBERBLICK                           ║
  ║                                                                  ║
  ║  ◁  NPC RAUMSCHIFF           ◈  NPC AUSSENPOSTEN                ║
  ║  ──────────────────────────  ──────────────────────────────     ║
  ║  Typ: Temporär               Typ: Permanent oder Temporär       ║
  ║  Dauer: 2–12 Stunden         Perm: Coord-basiert deterministisch ║
  ║  Fraktion: Alle 5            Temp: Zeit-basiert                  ║
  ║  Häufigkeit: ★★★★☆          Häufigkeit: ★★★☆☆                ║
  ║  Interaktion: Handel/Kampf/  Interaktion: Handel/Quest/Kampf    ║
  ║               Quest/Reparatur                                    ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Fraktionen:** `traders`, `scientists`, `pirates`, `ancients`, `independent`
(Bestehend aus `feat/npc-ecosystem`)

---

## 2. NPC-Raumschiffe (`npc_ship`)

### 2.1 Beschreibung

Einzelne NPC-Schiffe patrouillieren das Universum. Je nach Fraktion und Persönlichkeit
können sie Händler, Forscher, Piraten oder unabhängige Reisende sein.

```
  ╔══ NPC RAUMSCHIFF — RADAR ════════════════════════════════════════╗
  ║                                                                  ║
  ║   ·   ·   ·   ·   ·   ◁   ·   ·   ·   ·   ·                   ║
  ║  · · · · · · · · · · · T · · · · · · · · ·                     ║
  ║                         ▲                                        ║
  ║                    Fraktion-Kürzel                               ║
  ║                    T = Traders                                   ║
  ║                    S = Scientists                                ║
  ║                    P = Pirates                                   ║
  ║                    A = Ancients                                  ║
  ║                    I = Independent                               ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 2.2 Schiff-Typen nach Fraktion

| Fraktion      | Schiff-Name-Schema     | HP    | Aggression | Stärken              |
|---------------|------------------------|-------|------------|----------------------|
| `traders`     | [Name]-MERCHANT        | 150   | 5 %        | Handel, Repair       |
| `scientists`  | [Name]-RESEARCH        | 120   | 10 %       | Quests, Scan-Boni    |
| `pirates`     | [Name]-RAIDER          | 250   | 75 %       | Kampf, Loot          |
| `ancients`    | ANCIENT VESSEL         | 500   | 30 %       | Artefakte, selten    |
| `independent` | [Name]-FREIGHTER       | 200   | 20 %       | Handel, Gerüchte     |

### 2.3 Encounter-Typen nach Fraktion

#### Händler-Schiff

```
  ╔══ NPC RAUMSCHIFF — HÄNDLER ═════════════════════════════════════╗
  ║                                                                  ║
  ║  ◁  CARAVELLA-MERCHANT  [Fraktion: TRADERS]                     ║
  ║  Zustand: HANDELSWILLIG                                          ║
  ║  Rep mit Händlern: +42 (FREUNDLICH)                             ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  "Grüße, Pilot. Ich habe Waren übrig. Interesse?"               ║
  ║                                                                  ║
  ║  Angebote:                                                       ║
  ║  ► 50 Ore      →  450 Credits    [KAUFEN]                       ║
  ║  ► 30 Gas      →  600 Credits    [KAUFEN]                       ║
  ║  ► Quest:  Lieferung nach [8F2A:1B3C] — Belohnung: 500 Cr      ║
  ║                                                                  ║
  ║  Reparatur-Service: 50 HP für 200 Credits [REPARIEREN]          ║
  ║                                                                  ║
  ║  [HANDELN] [QUEST ANNEHMEN] [REPARATUR] [ABFLIEGEN]             ║
  ╚══════════════════════════════════════════════════════════════════╝
```

#### Forscher-Schiff

```
  ╔══ NPC RAUMSCHIFF — FORSCHER ════════════════════════════════════╗
  ║                                                                  ║
  ║  ◁  DR.NOVALINE-RESEARCH  [Fraktion: SCIENTISTS]               ║
  ║  Zustand: FORSCHEND                                              ║
  ║  Rep mit Wissenschaftlern: +15 (NEUTRAL)                        ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  "Pilot! Wir untersuchen Anomalie-Daten. Helfen Sie uns?"       ║
  ║                                                                  ║
  ║  ► Quest: SCAN-MISSION — 3 Anomalie-Sektoren scannen            ║
  ║    Belohnung: 1.500 Credits + Scan-Reichweite +1 (temp. 24h)   ║
  ║                                                                  ║
  ║  ► Datenaustausch: Deine Discoveries → Koordinaten eines        ║
  ║    seltenen POIs (Tausch von 10 neuen Sektor-Entdeckungen)      ║
  ║                                                                  ║
  ║  [QUEST ANNEHMEN] [DATEN TAUSCHEN] [ABFLIEGEN]                  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

#### Piraten-Schiff

```
  ╔══ NPC RAUMSCHIFF — PIRAT ═══════════════════════════════════════╗
  ║                                                                  ║
  ║  ◁  BLACKTHORN-RAIDER  [Fraktion: PIRATES]                      ║
  ║  Zustand: FEINDLICH                                              ║
  ║  Rep mit Piraten: -20 (UNFREUNDLICH)                            ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  ██ PIRAT GREIFT AN ██                                          ║
  ║                                                                  ║
  ║  "Cargo oder Leben, Pilot!"                                      ║
  ║                                                                  ║
  ║  [KÄMPFEN] [FLIEHEN] [VERHANDELN (-50 Cr Schutzgeld)]          ║
  ║                                                                  ║
  ║  Hinweis: Pirat rep ≥ +20 → Begegnung wird NEUTRAL              ║
  ║           (bestehende Piraten-Mechanik aus feat/npc-ecosystem)  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

#### Ancient-Schiff

```
  ╔══ NPC RAUMSCHIFF — ANCIENT ═════════════════════════════════════╗
  ║                                                                  ║
  ║  ◁  ANCIENT VESSEL [Fraktion: ANCIENTS]                         ║
  ║  Zustand: OBSERVIEREND                                           ║
  ║  Rep mit Ancients: 0 (NEUTRAL)                                  ║
  ║  Seltenheit: SEHR SELTEN (1% der NPC-Ships)                     ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Das Schiff sendet unbekannte Signale.                           ║
  ║  Eine Kommunikation ist möglich — aber schwierig.               ║
  ║                                                                  ║
  ║  → Mechanik identisch mit Alien Raumschiff (POI: alien_ship)   ║
  ║    (Ancient-Ships sind die bekannten Alien-Schiffe aus          ║
  ║     dem Fraktionssystem — gleicher Encounter-Typ)               ║
  ║                                                                  ║
  ║  [KOMMUNIZIEREN] [ANGREIFEN] [IGNORIEREN]                        ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 2.4 NPC-Schiff-Quests

NPC-Schiffe können **1–2 Quests** anbieten (neben dem normalen Handel):

| Fraktion     | Quest-Typen                              | Reward-Fokus            |
|--------------|------------------------------------------|-------------------------|
| `traders`    | `delivery` — Waren transportieren       | Credits + Rep           |
| `scientists` | `scan` — Anomalien/Sektoren scannen     | XP + Credits + Scan-Boni|
| `pirates`    | `bounty` — Feind-Schiff eliminieren     | Credits + Pirate-Rep    |
| `ancients`   | `fetch` — Artefakt-Fragmente sammeln    | Artefakte + Ancient-Rep |
| `independent`| `delivery` + `fetch`                    | Credits + Rep           |

Quests von NPC-Schiffen nutzen das **bestehende Quest-System** (`feat/npc-ecosystem`).
Max. 3 aktive Quests gleichzeitig.

---

## 3. NPC-Außenposten (`npc_outpost_permanent` & `npc_outpost_temp`)

### 3.1 Unterschied zu Stationen

| Eigenschaft      | NPC-Station (bestehend)   | NPC-Außenposten (neu)          |
|------------------|---------------------------|--------------------------------|
| Typ              | `station` Sektor           | POI in beliebigem Sektor       |
| Häufigkeit       | 0.22% der Sektoren         | 0.20–0.50% (je Zone)           |
| Größe            | Groß, viele NPCs          | Klein–mittel, 1–3 NPCs         |
| Reparatur        | Immer verfügbar            | Nur permanente, nicht immer    |
| Permanenz        | Permanent                  | Permanent oder temporär        |
| Typ-Variety      | Einheitlich                | Fraktion-spezifisch            |

### 3.2 Permanente NPC-Außenposten

Kleine, dauerhafte Strukturen verschiedener Fraktionen. Deterministisch generiert.

```
  ╔══ NPC AUSSENPOSTEN — TYPEN ══════════════════════════════════════╗
  ║                                                                  ║
  ║  HÄNDLER-DEPOT          FORSCHUNGSSTATION         PIRATEN-NEST   ║
  ║  ─────────────────────  ─────────────────────     ─────────────  ║
  ║     ┌──────────┐            ┌──────────┐           ┌──────────┐  ║
  ║  ───┤ CARGO    ├───      ───┤ SCAN     ├───     ───┤☠ HIDEOUT ├─ ║
  ║     │ DEPOT    │           │ OUTPOST  │           │ BASE     │  ║
  ║     └──────────┘           └──────────┘           └──────────┘  ║
  ║                                                                  ║
  ║  Fraktion: TRADERS      Fraktion: SCIENTISTS    Fraktion: PIRATES║
  ║  NPC: 1–2 Händler       NPC: 1–2 Forscher       NPC: 1–3 Piraten║
  ║  Service: Handel         Service: Quests          Service: Schwarzmarkt║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Händler-Depot:**
- NPC-Handel (Ressourcen kaufen/verkaufen)
- Repair-Service (teurer als Stationen: +20%)
- Manchmal: Lieferungs-Quest
- Rep-Bonus: +2 bei ersten Besuch

**Forschungs-Außenposten:**
- 1–2 Forscher-NPCs mit Scan-Quests
- Datenaustausch: Scan-Daten gegen Credits/Koordinaten
- Manchmal: Artefakt-Quest (seltene Fundstücke bringen)
- Spezialität: **Scan-Assist** — temporärer Scan-Bonus nach Quest-Abschluss

**Piraten-Nest:**
- Schwarzmarkt: Günstige Ressourcen, aber Rep-Verlust mit Anderen
- Pirate-Quests: Bounty-Missionen, Schutz-Quests
- Gefährlich für neutrale/feindliche Spieler (Auto-Angriff wenn Rep < -20)
- Unique: **Piraten-JumpGate-Code** kaufbar (Zugang zu gesperrten Gates)

**Ancient-Ruine:**
- Sehr selten (0.01% permanente Außenposten)
- Verlassene Ancient-Struktur, teils aktiv
- Mechanik wie Alien Außenposten (Erforschungs-Stufen)
- Hat immer ein `alien_data_core`-Artefakt auf Stufe 1

### 3.3 Temporäre NPC-Außenposten

Provisorische Lager, die für 4–24h existieren:

```
  ╔══ TEMPORÄRER AUSSENPOSTEN ══════════════════════════════════════╗
  ║                                                                  ║
  ║  ◉  HÄNDLER-KARAWANE [Fraktion: TRADERS]                        ║
  ║  Typ: TEMPORÄRES LAGER                                           ║
  ║  Verbleibend: 03:14:22                                           ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Eine fahrende Händler-Karawane macht hier Rast.                ║
  ║  Sonderangebote verfügbar (zeitlich begrenzt)!                  ║
  ║                                                                  ║
  ║  ► 80 Ore für 640 Credits   (-20% Rabatt!)     [KAUFEN]         ║
  ║  ► 50 Gas für 750 Credits   (-25% Rabatt!)     [KAUFEN]         ║
  ║  ► BONUS-QUEST: Zeitkritische Lieferung                         ║
  ║    Belohnung: 2.000 Cr (3h Zeitlimit)          [ANNEHMEN]       ║
  ║                                                                  ║
  ║  [HANDELN] [ABFLIEGEN]                                           ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Temporäre Außenposten-Varianten:**

| Variante               | Fraktion     | Besonderheit                            | Dauer   |
|------------------------|--------------|-----------------------------------------|---------|
| Händler-Karawane        | traders      | −15–25% Rabatt auf Ressourcen           | 4–12h   |
| Wissenschafts-Expedition| scientists   | Selten verfügbare Scan-Quests           | 8–24h   |
| Piraten-Raubzug-Lager   | pirates      | Geraubte Waren verkaufen + Quests       | 2–6h    |
| Freie Händler-Station   | independent  | Gemischte Quests + normaler Handel      | 6–18h   |
| Ancient-Sonde           | ancients     | Einmaliger Artefakt-Fund (Minigame)     | 1–4h    |

---

## 4. Encounter-Mechanik: NPC-Schiff vs. NPC-Außenposten

### 4.1 Encounter-Auslösung

| Situation                     | Trigger                              |
|-------------------------------|--------------------------------------|
| NPC-Schiff (aggressiv)        | Automatisch bei Sektor-Betreten      |
| NPC-Schiff (neutral)          | Spieler entscheidet ob Kontakt       |
| NPC-Außenposten               | Spieler entscheidet ob Kontakt       |
| Feindlicher Pirat-Außenposten | Automatisch wenn Rep < -20           |

### 4.2 Reputations-Auswirkungen

Interaktionen mit NPC-POIs beeinflussen Fraktions-Reputation:

| Aktion                              | Rep-Delta (Fraktion)          | Rival-Rep |
|-------------------------------------|-------------------------------|-----------|
| NPC-Quest abschliessen              | +5..+15 (je Typ)              | −2..−5    |
| NPC-Handel                          | +2                            | —         |
| NPC-Schiff töten (aggressiv)        | +5 (Piraten)                  | —         |
| NPC-Schiff töten (neutral)          | -15 (dessen Fraktion)         | +3 Rivals |
| Pirate-Quest (Bounty)               | +10 (Pirates)                 | -5 Target |
| Händler-Karawane Sonderangebot      | +3 (Traders)                  | —         |
| Ancient-Sonde Minigame Erfolg       | +5 (Ancients)                 | —         |

### 4.3 Fraktions-Rivalitäten (Rival-Rep)

Bestehend aus `feat/npc-ecosystem`: Aktionen für eine Fraktion können
Reputation bei Rival-Fraktionen senken:

```typescript
const NPC_FACTION_RIVALS: Record<NpcFactionId, NpcFactionId[]> = {
  traders:     ['pirates'],
  scientists:  ['pirates'],
  pirates:     ['traders', 'scientists'],
  ancients:    [],
  independent: [],
};
```

---

## 5. Minigames bei NPC-Außenposten

NPC-Außenposten bieten spezifische Minigames:

### 5.1 Forscher-Außenposten: DATEN-RELAY

Daten aus dem Forscher-Netz entschlüsseln (neue Minigame-Variante):

```
  ╔══ DATEN-RELAY — ENTSCHLÜSSELUNG ════════════════════════════════╗
  ║                                                                  ║
  ║  FORSCHUNGS-DATEN EMPFANGEN — DECODIERUNG ERFORDERLICH          ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Stream:  ► ► ► [01101011] [00110100] [11001001] ► ► ►         ║
  ║                                                                  ║
  ║  Dekodier-Schlüssel:  [0110] [1011] [0011] [0100]               ║
  ║  Reihenfolge:  3 → 1 → 4 → 2  (Drag & Drop)                    ║
  ║                                                                  ║
  ║  Zeit: 15 Sekunden | Versuche: 2                                ║
  ║                                                                  ║
  ║  Belohnung bei Erfolg: Quest freigeschaltet + 500 Credits       ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 5.2 Piraten-Nest: SCHWARZMARKT-VERHANDLUNG

Verhandlungs-Minigame (Zahl-basiert, keine Canvas):

```
  ╔══ SCHWARZMARKT — VERHANDLUNG ═══════════════════════════════════╗
  ║                                                                  ║
  ║  PIRATEN-HÄNDLER: "Was bietest du, Fremder?"                    ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Artikel: GESTOHLENES ALIEN-ARTEFAKT                             ║
  ║  Pirat fordert: 3.000 Credits                                    ║
  ║                                                                  ║
  ║  Dein Gegenangebot: [__2.000__]                                  ║
  ║                                                                  ║
  ║  Pirat-Persönlichkeit: GIERIG (hart zu verhandeln)              ║
  ║  Erfolgs-Chance: 35 %   [ANGEBOT MACHEN]                        ║
  ║                                                                  ║
  ║  Pirat-Rep-Bonus: +5% Erfolgs-Chance je +10 Rep                 ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 6. NPC-Außenposten — Radar-Darstellung

```
  ╔══ RADAR — NPC POIS ═════════════════════════════════════════════╗
  ║                                                                  ║
  ║   ·   ·   ◈   ·   ·   ◁   ·   ·   ◉   ·   ·                   ║
  ║  · · · T · · · · · · P · · · · · I · · · ·                     ║
  ║                                                                  ║
  ║  ◈  = NPC Außenposten permanent  (Grün #00FF88)                 ║
  ║  ◉  = NPC Außenposten temporär   (Hellgrün #88FF88, pulsiert)  ║
  ║  ◁  = NPC Raumschiff             (Hellgrün #AAFFAA, bewegt sich)║
  ║                                                                  ║
  ║  Fraktion-Kürzel unter Symbol:                                  ║
  ║  T = Traders  S = Scientists  P = Pirates  A = Ancients         ║
  ║  I = Independent                                                 ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Bewegung NPC-Schiffe:** NPC-Schiffe "wandern" auf dem Radar (cosmetisch).
Tatsächliche Server-Position ist statisch bis zur Ablaufzeit.

---

## 7. Technische Implementierung

### 7.1 Neue Typen

```typescript
export type NpcPoiType = 'npc_outpost_permanent' | 'npc_outpost_temp' | 'npc_ship';

export interface NpcPoiData {
  id: string;
  type: NpcPoiType;
  sectorX: number;
  sectorY: number;
  factionId: NpcFactionId;
  npcs: StationNpc[];         // Bestehender Typ (1–3 NPCs)
  services: NpcPoiService[];
  quests: Quest[];            // Bestehender Quest-Typ
  expiresAt?: number;         // Nur für temporäre
  isAggressive?: boolean;     // Für Piraten-NPC
}

export type NpcPoiService =
  | 'trade'
  | 'repair'
  | 'quest'
  | 'black_market'
  | 'scan_assist'
  | 'data_relay'
  | 'negotiation';
```

### 7.2 Neue Konstanten

```typescript
// NPC-Schiff Spawn-Chance
export const NPC_SHIP_CHANCE_DEEP_SPACE    = 0.005;  // 0.5%
export const NPC_SHIP_CHANCE_CLUSTER_VIC   = 0.020;  // 2.0%
export const NPC_SHIP_CHANCE_CLUSTER_CORE  = 0.050;  // 5.0%

// NPC-Schiff Fraktions-Gewichte (angepasst an Distanz)
export const NPC_SHIP_FACTION_WEIGHTS_CLUSTER: Record<NpcFactionId, number> = {
  traders:     0.30,
  scientists:  0.25,
  pirates:     0.28,
  ancients:    0.01,
  independent: 0.16,
};

export const NPC_SHIP_FACTION_WEIGHTS_DEEP_SPACE: Record<NpcFactionId, number> = {
  traders:     0.20,
  scientists:  0.20,
  pirates:     0.40,  // Tiefer Raum = mehr Piraten
  ancients:    0.05,  // Ancients häufiger in Tiefen Raum
  independent: 0.15,
};

// NPC-Schiff Verweildauer
export const NPC_SHIP_DURATION_MIN_H = 2;
export const NPC_SHIP_DURATION_MAX_H = 12;

// NPC-Außenposten Spawn-Chancen
export const NPC_OUTPOST_PERM_CHANCE_DEEP = 0.002;
export const NPC_OUTPOST_PERM_CHANCE_VIC  = 0.005;
export const NPC_OUTPOST_PERM_CHANCE_CORE = 0.010;
export const NPC_OUTPOST_TEMP_CHANCE_DEEP = 0.003;
export const NPC_OUTPOST_TEMP_CHANCE_VIC  = 0.008;
export const NPC_OUTPOST_TEMP_CHANCE_CORE = 0.020;

// Temporary Durations
export const NPC_OUTPOST_TEMP_DURATION_MIN_H = 4;
export const NPC_OUTPOST_TEMP_DURATION_MAX_H = 24;
```

### 7.3 DB-Tabellen

```sql
-- NPC POI Events (temporäre + gecachte permanente)
CREATE TABLE IF NOT EXISTS npc_poi_events (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('npc_ship','npc_outpost_permanent','npc_outpost_temp')),
  sector_x   INTEGER NOT NULL,
  sector_y   INTEGER NOT NULL,
  faction_id TEXT NOT NULL,
  npcs       JSONB NOT NULL DEFAULT '[]',
  services   TEXT[] DEFAULT '{}',
  is_aggressive BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  time_slot  BIGINT,
  UNIQUE(sector_x, sector_y, time_slot)
);

-- NPC POI Quest-Zuordnung (re-verwendet bestehende quests-Tabelle)
-- npc_poi_id -> quest_id Mapping (m:n)
CREATE TABLE IF NOT EXISTS npc_poi_quests (
  npc_poi_id TEXT NOT NULL,
  quest_id   TEXT NOT NULL,
  PRIMARY KEY (npc_poi_id, quest_id)
);
```

### 7.4 Neue Message-Typen

```typescript
// Client → Server
export interface NpcPoiInteractMessage {
  sectorX: number;
  sectorY: number;
  poiId: string;
  action: 'trade' | 'repair' | 'accept_quest' | 'black_market' | 'scan_assist' | 'negotiate';
  questId?: string;
  tradeOffer?: { credits: number };
  minigameScore?: number;
}

// Server → Client
export interface NpcPoiInteractResultMessage {
  success: boolean;
  poiType: NpcPoiType;
  factionId: NpcFactionId;
  services: NpcPoiService[];
  quests: Quest[];
  tradeOffers?: NpcTradeOffer[];
  repDelta?: { factionId: NpcFactionId; delta: number }[];
  rewards?: PoiRewards;
  minigameRequired?: 'data_relay' | 'negotiation';
  error?: string;
}
```

---

*Dokument-Ende — voidSector POI: NPC-Begegnungen*
