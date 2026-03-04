# Points of Interest — Alien-Zonen

**Stand:** 2026-03-04
**Branch:** `claude/poi-design-documents-DHxCE`
**Bezug:** POI-System — Alien Außenposten & Alien Raumschiffe
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick

Alien-Zonen sind die rätselhaftesten und gefährlichsten POIs im Spiel. Sie repräsentieren
die uralte Zivilisation der `ancients`-Fraktion — weit über menschliche Technologie hinaus.

Zwei Typen:
- **Alien Außenposten** (`alien_outpost`): Permanente Strukturen, groß, erforschbar
- **Alien Raumschiff** (`alien_ship`): Temporäre Erscheinungen, kleiner, aggressiver

```
  ╔══════════════════════════════════════════════════════════════════╗
  ║                   ALIEN-SYSTEM — ÜBERBLICK                      ║
  ║                                                                  ║
  ║  ⊛  ALIEN AUSSENPOSTEN         ≋  ALIEN RAUMSCHIFF               ║
  ║  ───────────────────────────  ──────────────────────────────    ║
  ║  Typ:      permanent          Typ:     temporär (24h–72h)       ║
  ║  Seltenheit: ★☆☆☆☆           Seltenheit: ★★☆☆☆                ║
  ║  Gefahr:   ★★★★☆              Gefahr:  ★★★☆☆                   ║
  ║  Reward:   ★★★★★              Reward:  ★★★☆☆                   ║
  ║  Interaktion: Forschung       Interaktion: Kommunikation/Kampf  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 2. Alien Außenposten (`alien_outpost`)

### 2.1 Beschreibung

Massige, geometrisch perfekte Strukturen aus unbekanntem Material. Die `ancients`-Fraktion
baute sie vor Jahrtausenden. Manche sind verlassen, manche aktiv (zufällig, seed-basiert).

```
  ╔══ ALIEN AUSSENPOSTEN — VISUELLES KONZEPT ════════════════════════╗
  ║                                                                  ║
  ║        ╔══╗   ╔══╗                                              ║
  ║    ════╬══╬═══╬══╬════                                          ║
  ║   ╔════╬◈◈╬═══╬◈◈╬════╗         ⊛ ALIEN OUTPOST               ║
  ║   ║    ╚══╝   ╚══╝    ║         Typ: VERLASSEN                 ║
  ║   ║  ┌────────────┐   ║         Zustand: AKTIV (32%)           ║
  ║   ║  │ ████████   │   ║         Fraktion: ANCIENTS             ║
  ║   ║  │ ██ KERN ██ │   ║         Energie:  DETEKTOR SCHLÄGT AN  ║
  ║   ║  └────────────┘   ║                                        ║
  ║   ╚═══════════════════╝                                        ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 2.2 Spawn-Logik

```typescript
// Deterministisch, koordinaten-basiert
function hasAlienOutpost(sectorX: number, sectorY: number, worldSeed: number): boolean {
  const hash = hashCoords(sectorX, sectorY, worldSeed + ALIEN_OUTPOST_SALT);
  const zone = getPoiZone(sectorX, sectorY);
  const chance = POI_CHANCE_ALIEN_OUTPOST * POI_ZONE_MULTIPLIERS[zone].alien;
  return ((hash >>> 0) % 100000) / 100000 < chance;
}

// Zustand (verlassen vs. aktiv) — 32% aktiv
function isAlienOutpostActive(sectorX: number, sectorY: number, worldSeed: number): boolean {
  const hash = hashCoords(sectorX, sectorY, worldSeed + ALIEN_OUTPOST_ACTIVE_SALT);
  return ((hash >>> 0) % 100) < 32;
}
```

### 2.3 Zustände

| Zustand      | Chance | Beschreibung                                 | Interaktion          |
|--------------|--------|----------------------------------------------|----------------------|
| `dormant`    | 68 %   | Verlassen, Systeme offline                   | Nur Erkundung        |
| `active`     | 32 %   | Systeme aktiv, Wächter-Drohnen vorhanden     | Erkundung + Kampf    |

### 2.4 Encounter-Ablauf

```
  ╔══ ALIEN AUSSENPOSTEN — ENCOUNTER-BAUM ═══════════════════════════╗
  ║                                                                  ║
  ║  [ANKUNFT IM SEKTOR]                                             ║
  ║        │                                                         ║
  ║        ▼                                                         ║
  ║  Zustand: DORMANT ──────────────────────────────────────────    ║
  ║        │                                                         ║
  ║        ├─► [ERKUNDEN] ──► Erkundungs-Minigame                   ║
  ║        │      └─► Erfolg: Artefakt + XP + Bauplan               ║
  ║        │          Misserfolg: Wächter aktiviert (Kampf)         ║
  ║        │                                                         ║
  ║        └─► [SCANNEN] ──► Artefakt-Fragment (geringere Qualität) ║
  ║                                                                  ║
  ║  Zustand: ACTIVE ───────────────────────────────────────────    ║
  ║        │                                                         ║
  ║        ├─► [ERKUNDEN] ──► Wächter-Kampf (auto-battle)           ║
  ║        │      └─► Sieg: Zugang zum Kern, Erkundungs-Minigame    ║
  ║        │          Niederlage: Flucht, 0 Rewards                  ║
  ║        │                                                         ║
  ║        ├─► [KOMMUNIZIEREN] ──► Signal-Minigame                  ║
  ║        │      └─► Erfolg (≥90%): Friedlicher Zugang             ║
  ║        │          Misserfolg: Wächter aktiviert                  ║
  ║        │                                                         ║
  ║        └─► [FLIEHEN] ──► Keine Rewards, kein Schaden            ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 2.5 Forschungs-Minigame: KERN-ANALYSE

Das Forschungs-Minigame läuft im Canvas — ähnlich dem Frequenz-Minigame.

```
  ╔══ KERN-ANALYSE ════════════════════════════════════════════════╗
  ║                                                                 ║
  ║  ALIEN DATA CORE — ENTSCHLÜSSELUNG                             ║
  ║  Zeit: 30 Sekunden                                             ║
  ║                                                                 ║
  ║  Zeile 1:  ▓ ▒ ░ █ ░ ▒ ▓ █ ░ ░ ░ ▒ ▓ █ ▒                    ║
  ║  Muster:   [   ░ ░ ▒ █ ░ ▒ ░ ░   ]  ◄── verschiebe            ║
  ║                                                                 ║
  ║  Übereinstimmung:  ████████████░░░  78%                        ║
  ║                                                                 ║
  ║  Schwellenwert: 85% für Erfolg                                  ║
  ║  ANALYSE LÄUFT... [STOP] [ABBRECHEN]                           ║
  ╚═════════════════════════════════════════════════════════════════╝
```

**Mechanik:**
- Fließendes Alien-Muster scrollt über Zeile 1
- Spieler hält ein Teilmuster (Zeile 2) durch Verschieben (←/→) am Laufen
- Ziel: Muster in Zeile 2 übereinstimmend halten → Übereinstimmungs-% steigt
- Bei Halt > 85% für 5 Sekunden: Erfolg
- Alien `resonance_fragment`-Artefakt erhöht Toleranz auf 75% (leichter)

### 2.6 Forschungs-Stufen

Ein Alien Außenposten kann mehrfach erforscht werden (Cooldown: 24h pro Spieler):

| Stufe  | Bedingung                  | Reward                                         |
|--------|----------------------------|------------------------------------------------|
| 1      | Erst-Erkundung             | 1 Artefakt (common/uncommon), 50–200 Credits   |
| 2      | 2. Besuch (nach 24h)       | 1 Artefakt (uncommon/rare), Bauplan-Fragment   |
| 3      | Ancient-Rep ≥ 50 (honored) | 1 Artefakt (rare/legendary), vollst. Bauplan   |
| 4+     | Jeder weitere Besuch       | Ressourcen + Credits (kein weiterer Bauplan)   |

### 2.7 Wächter-Kampf

Aktive Außenposten haben `2–4` Wächter-Drohnen. Kampf via bestehendem Auto-Battle-System.

```typescript
interface AlienGuardian {
  id: string;
  hp: 150 | 300 | 600;    // Nach Outpost-Tier
  damage: 20 | 40 | 80;
  fleeThreshold: 0;         // Fliehen nie
  negotiable: false;        // Alien — kein Verhandeln
}
```

---

## 3. Alien Raumschiff (`alien_ship`)

### 3.1 Beschreibung

Schnelle, mysteriöse Schiffe der Aliens. Erscheinen zufällig in Sektoren, bleiben 24–72h,
dann verschwinden sie. Kommunikation ist möglich — aber schwierig.

```
  ╔══ ALIEN RAUMSCHIFF — VISUELLES KONZEPT ═════════════════════════╗
  ║                                                                  ║
  ║         ╱▔▔▔╲                                                   ║
  ║        ╱ ◈◈◈ ╲        ≋  ALIEN RAUMSCHIFF                      ║
  ║       ╱───────╲       Typ: SCOUT-KLASSE                         ║
  ║      ╱ ≋≋≋≋≋≋≋ ╲      Zustand: BEOBACHTEND                     ║
  ║     ╱           ╲     Verweildauer: ~36h verbleibend            ║
  ║    ╲_____________╱     Reaktion: UNBEKANNT                      ║
  ║                                                                  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 3.2 Schiff-Klassen

| Klasse      | HP   | Aggression | Reward-Potenzial | Häufigkeit |
|-------------|------|------------|------------------|------------|
| `scout`     | 200  | 20 %       | Niedrig          | 50 %       |
| `raider`    | 400  | 60 %       | Mittel           | 30 %       |
| `destroyer` | 800  | 80 %       | Hoch             | 15 %       |
| `mothership`| 2000 | 40 %       | Sehr hoch        | 5 %        |

### 3.3 Encounter-Ablauf

```
  ╔══ ALIEN RAUMSCHIFF — ENCOUNTER-BAUM ════════════════════════════╗
  ║                                                                  ║
  ║  [ANKUNFT IM SEKTOR]                                             ║
  ║        │                                                         ║
  ║        ▼                                                         ║
  ║  Aggression-Check (Klassen-basiert)                              ║
  ║        │                                                         ║
  ║        ├─ AGGRESSIV ──► Automatischer Angriff (Auto-Battle)     ║
  ║        │      ├─► Sieg:  Wrack scannen → Artefakt + Ressourcen  ║
  ║        │      └─► Flucht: Schaden → Repair-Kosten               ║
  ║        │                                                         ║
  ║        └─ NEUTRAL/PASSIV ──► Auswahl:                           ║
  ║               │                                                  ║
  ║               ├─► [KOMMUNIZIEREN] ──► Kommunikations-Minigame   ║
  ║               │      ├─► Erfolg: Handel angeboten, Artefakt     ║
  ║               │      └─► Misserfolg: Schiff flieht, 0 Reward   ║
  ║               │                                                  ║
  ║               ├─► [ANGREIFEN] ──► Auto-Battle                   ║
  ║               │      ├─► Sieg:  Artefakt + Ressourcen           ║
  ║               │      └─► Flucht: ggf. Schaden                   ║
  ║               │                                                  ║
  ║               └─► [IGNORIEREN] ──► Schiff bleibt im Sektor      ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 3.4 Kommunikations-Minigame: SIGNAL-HARMONISIERUNG

```
  ╔══ ALIEN-KOMMUNIKATION ═════════════════════════════════════════╗
  ║                                                                 ║
  ║  SIGNAL-HARMONISIERUNG  |  Frequenz-Anpassung                  ║
  ║  Zeit: 20 Sekunden                                              ║
  ║                                                                 ║
  ║  Alien-Signal:    ─╱╲──╱╲╱──╱╱╲──╱╲╱╱──╲─                    ║
  ║  Dein Signal:     ─────────────────────── ◄── steuere Kurve    ║
  ║                                                                 ║
  ║  Phasen-Offset:   [  ← ─────────────── →  ]   +12Hz           ║
  ║  Amplituden:      [  ← ─────────────── →  ]   80%             ║
  ║                                                                 ║
  ║  Synchron:  ████████████░░░  83%                               ║
  ║  Schwelle:  90% für Erfolg                                      ║
  ╚═════════════════════════════════════════════════════════════════╝
```

**Mechanik:**
- Zwei Schieberegler: Phasen-Offset (−30..+30 Hz) und Amplitude (50..150%)
- Alien-Signal fluktuiert kontinuierlich (zufällige Bewegung)
- Spieler passt seine Werte an, um mit dem Alien-Signal synchron zu bleiben
- Synchronie-% steigt bei gutem Match
- 90% Synchronie für 3 Sekunden halten → Erfolg
- Schwerer als Frequenz-Minigame (2 Regler statt 1)

### 3.5 Alien-Handel (nach erfolgreicher Kommunikation)

Nach Kommunikation bietet das Alien-Schiff einen Einzelhandel an:

```
  ╔══ ALIEN-HANDEL ════════════════════════════════════════════════╗
  ║                                                                 ║
  ║  ALIEN-HÄNDLER — ANGEBOT (einmalig)                            ║
  ║  ─────────────────────────────────────────────────────────    ║
  ║                                                                 ║
  ║  SIE BIETEN:    150 Crystal + 3.000 Credits                    ║
  ║  ALIEN BIETET:  [NAVIGATION_CRYSTAL — SELTEN]                  ║
  ║                 Effekt: JumpGate-Reichweite +2.000 Sektoren    ║
  ║                                                                 ║
  ║  [ANNEHMEN] [ABLEHNEN]                                         ║
  ║                                                                 ║
  ║  Hinweis: Angebot verfällt wenn Schiff den Sektor verlässt     ║
  ╚═════════════════════════════════════════════════════════════════╝
```

Alien-Handel bietet immer ein Artefakt gegen eine Kombination aus Ressourcen/Credits.
Die Preise sind hoch, die Artefakte selten und wertvoll.

### 3.6 Wrack-Scan (nach Kampfsieg)

Beim Sieg über ein Alien-Schiff entsteht ein Wrack (temporär, 1h im Sektor):

```typescript
interface AlienWreck {
  shipClass: 'scout' | 'raider' | 'destroyer' | 'mothership';
  loot: {
    ore: number;         // 10–100 abhängig von Klasse
    gas: number;         // 5–50
    crystal: number;     // 5–50
    credits: number;     // 200–5000
    artifacts: Artifact[]; // 1–3 Artefakte (höhere Klasse = bessere Rarität)
  };
  scanned: boolean;      // Einmal scanbar
  expiresAt: number;     // Unix-Timestamp
}
```

---

## 4. Alien-Sektoren — Radar-Darstellung

```
  ╔══ RADAR — ALIEN-ZONEN ═════════════════════════════════════════╗
  ║                                                                 ║
  ║   ·   ·   ·   ·   ·   ⊛   ·   ·   ·   ·   ·                  ║
  ║  · · · · · · · · · · · · · · · · · · · · ·                    ║
  ║   ·   ·   ≋   ·   ·   ·   ·   ⊛   ·   ·   ·                  ║
  ║  · · · · · · · · · · · · · · · · · · · · ·                    ║
  ║   ·   ·   ·   ·   ·   ·   ·   ·   ≋   ·   ·                  ║
  ║                                                                 ║
  ║  ⊛  = Alien Außenposten  (Violett #AA00FF)                     ║
  ║  ≋  = Alien Raumschiff   (Helles Violett #CC44FF, blinkt)      ║
  ║                                                                 ║
  ║  Blink-Rhythmus Alien-Schiff: 1s an / 0.5s aus (pulsierend)   ║
  ╚═════════════════════════════════════════════════════════════════╝
```

---

## 5. Alien-Reputation

Alien-Interaktionen beeinflussen die `ancients`-Fraktions-Reputation:

| Aktion                                  | Rep-Delta |
|-----------------------------------------|-----------|
| Alien Außenposten erkunden (Erfolg)     | +5        |
| Alien Raumschiff Kommunikation (Erfolg) | +10       |
| Alien Raumschiff Handel                 | +5        |
| Alien Raumschiff angreifen/töten        | -20       |
| Wächter-Drohne zerstören               | -5        |
| Alien-Außenposten ohne Kommunikation   | -3        |

Mit steigender Ancient-Reputation werden Minigames leichter und Rewards besser:

| Rep-Tier   | Bereich    | Bonus                                         |
|------------|------------|-----------------------------------------------|
| `hostile`  | -100..-51  | +20% Wächter-HP, −10% Minigame-Toleranz       |
| `neutral`  | -50..+50   | Standard                                      |
| `friendly` | +51..+100  | Friedliche Schiffe greifen nie an,            |
|            |            | Handel: +10% bessere Items, Minigame +5% Tol. |

---

## 6. Alien-Baupläne (Unlock-System)

Alien Außenposten können über mehrere Besuche und mit `ancient`-Reputation Baupläne liefern:

| Bauplan                     | Voraussetzung              | Effekt                                     |
|-----------------------------|----------------------------|--------------------------------------------|
| `alien_sensor`              | Stufe 2 + Artefakt         | Scan-Radius +2 Sektoren                    |
| `alien_hull_plating`        | Stufe 2 + Ancient-Rep ≥ 20 | Schiffs-HP +50%                            |
| `alien_drive`               | Stufe 3 + Ancient-Rep ≥ 50 | Fuel-Verbrauch −30%                        |
| `alien_jumpgate_module`     | Stufe 3 + Legendary Artef. | JumpGate-Reichweite +5.000 Sektoren        |
| `alien_wormhole_stabilizer` | Stufe 3 + Ancient-Rep ≥ 75 | Temporäre Wormholes +48h verlängern        |

Baupläne werden als `DataSlate`-Einträge gespeichert (bestehendes System).

---

## 7. Technische Implementierung

### 7.1 Neue DB-Tabellen

```sql
-- Alien POI Begegnungshistorie (für Stufen-Tracking)
CREATE TABLE IF NOT EXISTS alien_outpost_visits (
  player_id   TEXT NOT NULL,
  sector_x    INTEGER NOT NULL,
  sector_y    INTEGER NOT NULL,
  visit_count INTEGER DEFAULT 1,
  last_visit  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, sector_x, sector_y)
);

-- Alien Wracks (temporär)
CREATE TABLE IF NOT EXISTS alien_wrecks (
  id         TEXT PRIMARY KEY,
  sector_x   INTEGER NOT NULL,
  sector_y   INTEGER NOT NULL,
  ship_class TEXT NOT NULL,
  loot       JSONB NOT NULL,
  scanned    BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Artefakt-Inventar (im Cargo oder extra Slot)
CREATE TABLE IF NOT EXISTS artifacts (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL,
  type         TEXT NOT NULL,
  rarity       TEXT NOT NULL,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL,
  effect       JSONB,
  acquired_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 Server-Engine (`packages/server/src/engine/aliengen.ts`)

```typescript
export function checkAlienOutpost(x: number, y: number): boolean { ... }
export function generateAlienShip(x: number, y: number, timeSlot: number): AlienShipData | null { ... }
export function handleAlienOutpostInteract(playerId: string, x: number, y: number, action: AlienAction): Promise<PoiInteractResult> { ... }
export function handleAlienShipInteract(playerId: string, x: number, y: number, action: AlienAction): Promise<PoiInteractResult> { ... }
export function generateAlienLoot(tier: number, rarity: ArtifactRarity): Loot { ... }
```

### 7.3 Neue Message-Typen

```typescript
// Client → Server
export interface AlienInteractMessage {
  sectorX: number;
  sectorY: number;
  action: 'explore' | 'communicate' | 'attack' | 'flee' | 'trade' | 'scan_wreck';
  minigameScore?: number;  // Score aus Canvas-Minigame
  tradeAccept?: boolean;
}

// Server → Client
export interface AlienInteractResultMessage {
  success: boolean;
  encounterType: 'outpost' | 'ship';
  shipClass?: AlienShipClass;
  outpostState?: 'dormant' | 'active';
  requiresMinigame?: 'kern_analyse' | 'signal_harmonisierung';
  rewards?: PoiRewards;
  tradeOffer?: AlienTradeOffer;
  error?: string;
}
```

---

*Dokument-Ende — voidSector POI: Alien-Zonen*
