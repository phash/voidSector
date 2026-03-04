# Points of Interest — Wormholes

**Stand:** 2026-03-04
**Branch:** `claude/poi-design-documents-DHxCE`
**Bezug:** POI-System — Wormhole-System (permanent / temporär / Einbahn)
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick

Wormholes sind natürliche Raumzeitkrümmungen — instabiler und rätselhafter als JumpGates.
Sie werden zufällig platziert und können in drei Varianten auftreten:

```
  ╔══════════════════════════════════════════════════════════════════╗
  ║                   WORMHOLE-TYPEN                                ║
  ║                                                                  ║
  ║  ∞  PERMANENT         ∿  TEMPORÄR          ↝  EINBAHN           ║
  ║  ────────────────     ────────────────     ────────────────     ║
  ║  Beständig            Läuft ab             Nur eine Richtung    ║
  ║  Bidirektional        Bidirektional        Kein Rückweg         ║
  ║  Häufigkeit: 40%      Häufigkeit: 40%      Häufigkeit: 20%      ║
  ║  Erkennbar: JA        Erkennbar: JA*       Erkennbar: NEIN*     ║
  ║  Fuel-Kosten: 1       Fuel-Kosten: 1       Fuel-Kosten: 1       ║
  ║                                                                  ║
  ║  * Temporäre: Ablaufzeit erst nach Scan sichtbar                ║
  ║  * Einbahn: Richtung erst NACH dem Sprung klar                  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 2. Wormhole-Typen im Detail

### 2.1 Permanente Wormholes (`wormhole_permanent`)

Stabile, dauerhafte Raumzeitkrümmungen. Bidirektional — gibt eine Gegenseite im Ziel-Sektor.

```
  ╔══ PERMANENTES WORMHOLE ════════════════════════════════════════╗
  ║                                                                  ║
  ║   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·                   ║
  ║  · · · · · · · · · · ·   · · · · · · · · · ·                   ║
  ║   ·   ·   ·   ∞ ···· · ····∞  ·   ·   ·   ·                   ║
  ║  · · · · · · ·  ╔═══╗ ╔═══╗  · · · · · · ·                    ║
  ║   ·   ·   ·   ·║ ≈≈ ║ ║ ≈≈║·   ·   ·   ·                     ║
  ║  · · · · · · · ╚═══╝ ╚═══╝  · · · · · · ·                     ║
  ║   ·   ·   ·   ·   ∞    ∞  ·   ·   ·   ·                       ║
  ║                  ▲          ▲                                    ║
  ║              Eingang      Ausgang (Ziel-Sektor)                  ║
  ║                                                                  ║
  ║  ∞  WORMHOLE [1234:5678] ↔ [9876:5432]                         ║
  ║  Typ: PERMANENT  |  Distanz: 12.450 Sektoren                   ║
  ║  Zustand: STABIL  |  Fuel: 1                                    ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Eigenschaften:**
- Koordinaten-basiert deterministisch (`hashCoords`)
- Bidirektional: Gibt immer ein Gegenstück im Ziel-Sektor
- Ziel-Sektor nach Scan sichtbar
- Kein Ablaufen, kein Verschwinden
- Spawn-Chance: 0.06% (leerer Raum), bis zu 0.18% in Cluster-Umgebung

### 2.2 Temporäre Wormholes (`wormhole_temporary`)

Instabile Wormholes, die für eine begrenzte Zeit existieren und dann kollabieren.

```
  ╔══ TEMPORÄRES WORMHOLE ══════════════════════════════════════════╗
  ║                                                                  ║
  ║  ∿  WORMHOLE [0042:0777]                                        ║
  ║  Typ: TEMPORÄR | Bidirektional                                  ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Ziel: [3F2A:1B44]                                              ║
  ║  Distanz: 45.000 Sektoren                                       ║
  ║  Status: ████████████░░░░░░  62% STABIL                         ║
  ║  Verbleibend: 18:34:22                                          ║
  ║  Kollaps-Risiko: NIEDRIG                                        ║
  ║                                                                  ║
  ║  WARNUNG: Wormhole könnte kollabieren während du drin bist.     ║
  ║           Notfall-Protokoll: Zufalls-Exit innerhalb 500 Sek.   ║
  ║                                                                  ║
  ║  [SPRINGEN] [ZURÜCK]                                             ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Eigenschaften:**
- Zeitbasierter Seed: `hashCoords(x, y, WORLD_SEED + Math.floor(Date.now() / POI_TEMP_WINDOW))`
- Existiert für 6–48 Stunden (zufällig beim Entstehen gewürfelt)
- Bidirektional während der Existenz
- Ablaufzeit nach Scan sichtbar
- **Kollaps-Mechanik:** Wenn Wormhole kollabiert während Spieler durchfliegt → zufälliger Notfall-Exit
- Stabilität sinkt über Zeit: Starts mit 100%, endet bei 0%
- Unter 20% Stabilität: Flackern-Animation, Kollaps-Warnung

**Kollaps-Szenario:**

```
  ╔══ WORMHOLE-KOLLAPS ═════════════════════════════════════════════╗
  ║                                                                  ║
  ║  ██ WARNUNG: WORMHOLE DESTABILISIERT ██                         ║
  ║                                                                  ║
  ║  Das Wormhole kollabiert während des Durchflugs!                ║
  ║  Notfall-Sprung wird berechnet...                                ║
  ║                                                                  ║
  ║  Notfall-Exit: Sektor [1288:5441] (±234 vom Ziel)              ║
  ║  Fuel-Verlust: +1 extra (Notfall-Antrieb)                       ║
  ║  Schiffszustand: INTAKT                                         ║
  ║                                                                  ║
  ║  [OK]                                                            ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 2.3 Einbahn-Wormholes (`wormhole_oneway`)

Das gefährlichste und lukrativste Wormhole-Typ. Kein Rückweg durch das gleiche Wormhole.

```
  ╔══ EINBAHN-WORMHOLE ═════════════════════════════════════════════╗
  ║                                                                  ║
  ║  ↝  ANOMALES RAUMZEIT-PHÄNOMEN                                  ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Typ: UNBEKANNT                                                  ║
  ║  Ziel: ??? (nicht erkennbar vor dem Sprung)                     ║
  ║  Distanz: ???                                                    ║
  ║  Richtung: EINBAHN (kein Rückweg durch dieses Wormhole)         ║
  ║                                                                  ║
  ║  HINWEIS: Einbahn-Wormholes können dauerhaft oder               ║
  ║  temporär sein. Ziel erst nach dem Sprung bekannt.              ║
  ║                                                                  ║
  ║  ██ RISIKO: Kein direkter Rückweg garantiert ██                 ║
  ║                                                                  ║
  ║  [SPRINGEN — AUF EIGENES RISIKO] [ZURÜCK]                       ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Eigenschaften:**
- Kein Gegenstück im Ziel-Sektor
- Ziel-Koordinaten erst nach dem Sprung bekannt
- Kann permanent oder temporär sein (Untertyp)
- Höheres Reward-Potenzial: Einbahn führt häufiger zu seltenen Sektoren
- Kann durch Artefakt `wormhole_stabilizer` ein Rückkehr-Beacon setzen (Koordinaten merken)

---

## 3. Wormhole-Generierung

### 3.1 Deterministische Generierung (permanente)

```typescript
// Permanent: Rein koordinaten-basiert
function checkPermanentWormhole(x: number, y: number, worldSeed: number): boolean {
  const h = hashCoords(x, y, worldSeed + WORMHOLE_PERM_SALT);
  const zone = getPoiZone(x, y);
  const chance = WORMHOLE_CHANCE_PERMANENT * POI_ZONE_MULTIPLIERS[zone].wormhole;
  return ((h >>> 0) % 1_000_000) / 1_000_000 < chance;
}

function generateWormholeTarget(x: number, y: number, worldSeed: number): { targetX: number; targetY: number } {
  const h = hashCoords(x, y, worldSeed + WORMHOLE_TARGET_SALT);
  // Breite Distanzverteilung: 5.000–100.000 Sektoren möglich
  const dist = 5000 + ((h >>> 0) % 95000);
  const angle = ((h >>> 16) & 0xFFFF) / 65535 * Math.PI * 2;
  return {
    targetX: Math.round(x + Math.cos(angle) * dist),
    targetY: Math.round(y + Math.sin(angle) * dist),
  };
}
```

### 3.2 Zeit-basierte Generierung (temporäre)

```typescript
// Temporär: Koordinaten + Zeitfenster-Seed
const WORMHOLE_TEMP_WINDOW_MS = 3 * 60 * 60 * 1000; // 3-Stunden-Fenster

function checkTemporaryWormhole(x: number, y: number, worldSeed: number): TemporaryWormholeData | null {
  const timeSlot = Math.floor(Date.now() / WORMHOLE_TEMP_WINDOW_MS);
  const h = hashCoords(x, y, worldSeed + WORMHOLE_TEMP_SALT + timeSlot);

  const chance = WORMHOLE_CHANCE_TEMPORARY * POI_ZONE_MULTIPLIERS[getPoiZone(x, y)].wormhole;
  if (((h >>> 0) % 1_000_000) / 1_000_000 >= chance) return null;

  // Dauer: 6–48h
  const durationHours = 6 + ((h >>> 16) & 0xFF) % 42;
  const windowStart = timeSlot * WORMHOLE_TEMP_WINDOW_MS;
  const expiresAt = windowStart + durationHours * 3_600_000;

  return {
    expiresAt,
    stabilityPercent: Math.max(0, 100 - ((Date.now() - windowStart) / (expiresAt - windowStart)) * 100),
  };
}
```

### 3.3 Wormhole-Subtyp-Verteilung

```typescript
function getWormholeSubtype(x: number, y: number, worldSeed: number): WormholeSubtype {
  const h = hashCoords(x, y, worldSeed + WORMHOLE_TYPE_SALT);
  const roll = ((h >>> 0) % 100);
  if (roll < 40) return 'permanent';
  if (roll < 80) return 'temporary';
  return 'oneway';
}
```

---

## 4. Wormhole-Interaktion

### 4.1 Scan-Ergebnisse

```
  ╔══ SCAN-ERGEBNIS: WORMHOLE ══════════════════════════════════════╗
  ║                                                                  ║
  ║  SEKTOR [0042:0777]  Typ: LEER                                  ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  ► POI: ∞ WORMHOLE ERKANNT                                      ║
  ║    Subtyp:    TEMPORÄR                                           ║
  ║    Ziel:      [3F2A:1B44]                                       ║
  ║    Distanz:   45.234 Sektoren                                    ║
  ║    Stabilität: 62% | Verbleibend: ~18h                          ║
  ║    Richtung:  BIDIREKTIONAL                                      ║
  ║                                                                  ║
  ║  [ZUM WORMHOLE NAVIGIEREN] [DATA SLATE ERSTELLEN]               ║
  ╚══════════════════════════════════════════════════════════════════╝
```

Bei Einbahn-Wormholes:

```
  ╔══ SCAN-ERGEBNIS: WORMHOLE ══════════════════════════════════════╗
  ║                                                                  ║
  ║  ► POI: ↝ WORMHOLE ERKANNT                                      ║
  ║    Subtyp:    PERMANENT / EINBAHN                                ║
  ║    Ziel:      UNBEKANNT (Einbahn-Phänomen)                      ║
  ║    Distanz:   UNBEKANNT                                          ║
  ║    Stabilität: STABIL                                            ║
  ║    Richtung:  EINBAHN (kein Rückweg)                            ║
  ║                                                                  ║
  ║  ██ WARNUNG: Ziel erst nach dem Durchflug bekannt ██            ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 4.2 Wormhole-Beacon (Artefakt-System)

Das `wormhole_stabilizer`-Artefakt erlaubt es, einen Beacon zu setzen:

```
  ╔══ WORMHOLE-BEACON ══════════════════════════════════════════════╗
  ║                                                                  ║
  ║  WORMHOLE_STABILIZER — AKTIV                                     ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Funktionen:                                                     ║
  ║  ■ Einbahn-Wormhole: Ziel-Koordinaten werden gespeichert        ║
  ║    → Bookmark wird automatisch angelegt                         ║
  ║  ■ Temporäres Wormhole: Ablaufzeit +48h verlängert               ║
  ║    (einmalig pro Wormhole)                                       ║
  ║  ■ Stabilität: Kollaps-Chance während Durchflug um 90% reduziert ║
  ║                                                                  ║
  ║  Verbrauch: EINMALIG (Artefakt wird verbraucht)                  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 5. Wormhole-Reward-Struktur

Wormholes geben keine direkten Rewards beim Durchflug, sondern durch:

### 5.1 Ziel-Bonus

Wormholes führen bevorzugt zu seltenen Ziel-Sektoren:

| Wormhole-Typ | Ziel-Bias                                          |
|--------------|----------------------------------------------------|
| Permanent    | Bevorzugt unentdeckte Sektoren                     |
| Temporär     | Zufällig, aber oft weit entfernte Cluster          |
| Einbahn      | +50% Chance: Alien-Außenposten / Alien-JumpGate    |
|              | +25% Chance: Seltene Ressourcen-Ansammlung         |

### 5.2 Wormhole-Erkundungs-Bonus

Erstmaliges Durchqueren eines Wormholes (pro Spieler):

| Bonus                  | Wert                              |
|------------------------|-----------------------------------|
| Permanent (erstmalig)  | +100 XP, +50 Credits              |
| Temporär (erstmalig)   | +150 XP, +75 Credits              |
| Einbahn (erstmalig)    | +300 XP, +200 Credits, 1 Artefakt |

### 5.3 Data Slate: Wormhole-Karte

Wormhole-Koordinaten können als Data Slate verkauft/gehandelt werden
(bestehendes Slate-System):

```typescript
interface WormholeSlate extends DataSlate {
  slateType: 'wormhole_map';
  content: {
    sourceX: number;
    sourceY: number;
    wormholeSubtype: WormholeSubtype;
    targetX?: number;    // Nur wenn bekannt (nicht Einbahn)
    targetY?: number;
    expiresAt?: number;  // Nur temporär
    discoveredBy: string;
    discoveredAt: number;
  };
}
```

---

## 6. Radar-Darstellung

```
  ╔══ RADAR — WORMHOLES ════════════════════════════════════════════╗
  ║                                                                  ║
  ║   ·   ·   ·   ·   ·   ∞   ·   ·   ·   ·   ·                   ║
  ║  · · · · · · · · · · · · · · · · · · · · ·                     ║
  ║   ·   ·   ∿   ·   ·   ·   ·   ↝   ·   ·   ·                   ║
  ║  · · · · · · · · · · · · · · · · · · · · ·                     ║
  ║   ·   ·   ·   ·   ·   ·   ·   ·   ∞   ·   ·                   ║
  ║                                                                  ║
  ║  ∞  = Permanent  (Cyan-Grün #00FFCC)                            ║
  ║  ∿  = Temporär   (Hellblau #44AAFF, pulsiert bei <30% Stab.)   ║
  ║  ↝  = Einbahn    (Gelb-Weiß #FFFF88, rotiert langsam)          ║
  ║                                                                  ║
  ║  Farbverlauf temporal: Von #00FFCC (100%) → #FF4400 (0%)       ║
  ║  (Farbe zeigt Stabilität an)                                    ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Blink-Verhalten:**
- Permanente: Kein Blinken, stetig
- Temporäre: Pulsieren wenn Stabilität < 30%
- Einbahn: Langsame Rotation des Symbols (visuell)

---

## 7. Technische Implementierung

### 7.1 Typen

```typescript
export type WormholeSubtype = 'permanent' | 'temporary' | 'oneway';

export interface WormholeData {
  id: string;
  sectorX: number;
  sectorY: number;
  subtype: WormholeSubtype;
  targetX?: number;          // undefined für oneway (bis gesprungen)
  targetY?: number;
  stabilityPercent: number;  // 0–100
  expiresAt?: number;        // Unix-ms, nur für temporary
  isOnesided: boolean;       // true = oneway
}

export interface UseWormholeResultMessage {
  success: boolean;
  error?: string;
  targetX: number;
  targetY: number;
  wormholeSubtype: WormholeSubtype;
  collapsed?: boolean;       // true = Notfall-Exit
  explorationBonus?: { xp: number; credits: number; artifact?: Artifact };
}
```

### 7.2 Neue Konstanten

```typescript
// Wormhole Spawn-Chancen (separiert von JumpGates!)
export const WORMHOLE_CHANCE_PERMANENT  = 0.0006;  // 0.06 %
export const WORMHOLE_CHANCE_TEMPORARY  = 0.0006;  // 0.06 %
export const WORMHOLE_CHANCE_ONEWAY     = 0.0003;  // 0.03 %

export const WORMHOLE_PERM_SALT         = 7777;
export const WORMHOLE_TEMP_SALT         = 8888;
export const WORMHOLE_TARGET_SALT       = 9999;
export const WORMHOLE_TYPE_SALT         = 1111;

export const WORMHOLE_TEMP_WINDOW_MS    = 3 * 60 * 60 * 1000;  // 3h Fenster
export const WORMHOLE_MIN_DURATION_H    = 6;
export const WORMHOLE_MAX_DURATION_H    = 48;
export const WORMHOLE_MIN_RANGE         = 5_000;
export const WORMHOLE_MAX_RANGE         = 100_000;
export const WORMHOLE_COLLAPSE_RADIUS   = 500;  // Notfall-Exit max ±Sektoren

// Stabilität
export const WORMHOLE_COLLAPSE_THRESHOLD = 0.20;  // Unter 20%: Kollapsgefahr
export const WORMHOLE_COLLAPSE_CHANCE_PER_USE = 0.05;  // 5% wenn <20% stabil

// Fuel
export const WORMHOLE_FUEL_COST = 1;

// Erkundungs-Boni
export const WORMHOLE_XP_PERM    = 100;
export const WORMHOLE_XP_TEMP    = 150;
export const WORMHOLE_XP_ONEWAY  = 300;
export const WORMHOLE_CR_PERM    = 50;
export const WORMHOLE_CR_TEMP    = 75;
export const WORMHOLE_CR_ONEWAY  = 200;
```

### 7.3 DB-Tabelle (nur temporäre)

```sql
-- Permanente Wormholes: deterministisch, keine DB nötig
-- Temporäre: gecacht für Performance
CREATE TABLE IF NOT EXISTS wormhole_cache (
  id              TEXT PRIMARY KEY,
  sector_x        INTEGER NOT NULL,
  sector_y        INTEGER NOT NULL,
  subtype         TEXT NOT NULL CHECK (subtype IN ('permanent','temporary','oneway')),
  target_x        INTEGER,
  target_y        INTEGER,
  stability       INTEGER DEFAULT 100,
  expires_at      TIMESTAMPTZ,
  time_slot       BIGINT NOT NULL,
  UNIQUE(sector_x, sector_y, time_slot)
);

-- Wormhole-Erkundungs-Tracking (Erst-Bonus)
CREATE TABLE IF NOT EXISTS wormhole_discoveries (
  player_id  TEXT NOT NULL,
  sector_x   INTEGER NOT NULL,
  sector_y   INTEGER NOT NULL,
  time_slot  BIGINT NOT NULL,  -- 0 für permanente
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, sector_x, sector_y, time_slot)
);
```

---

*Dokument-Ende — voidSector POI: Wormholes*
