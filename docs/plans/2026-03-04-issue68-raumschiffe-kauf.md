# Issue #68 — Raumschiffe: NPC-Kauf & Kosmetik: Design-Dokument

**Stand:** 2026-03-04
**Branch:** `claude/design-documents-sections-XnGFr`
**Bezug:** Issue #68 „Änderungen an Spielinhalten" — Sektion 7
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick & Designziele

### Ist-Zustand

Schiffe sind aktuell über `unlockLevel` + `unlockCost` definiert:

```typescript
scout:      { unlockLevel: 1, unlockCost: 0 }       // Startschiff (gratis)
freighter:  { unlockLevel: 3, unlockCost: 500 }
cruiser:    { unlockLevel: 4, unlockCost: 1000 }
explorer:   { unlockLevel: 5, unlockCost: 2000 }
battleship: { unlockLevel: 6, unlockCost: 3000 }
```

Das Kauf-System ist direkt aus dem Profil/Base-Menü ohne spezifischen NPC-Händler.
Es gibt keine kosmetischen Optionen — alle Schiffe gleichen Typs sind identisch.

### Kernprobleme

1. Schiffs-Kauf ohne narrative Einbettung (kein NPC-Händler-Kontext)
2. Keine Kosmetik — Spieler können ihr Schiff nicht individualisieren
3. Spieler-Bindung niedrig, da Schiffe generisch sind

### Ziele

1. **NPC-Händler** an Stationen verkaufen spezifische Schiffstypen
2. **Kosmetisches Customization-System:** Name, Farbschema, Emblem
3. **Schiffshändler-Typ** als neue NPC-Kategorie
4. **Narrative Einbettung:** Händler-Dialoge mit Schiffs-Lore
5. **Hull-Freischaltung** durch NPC-Kauf (statt Level-Gate allein)

---

## 2. Schiffshändler — NPC-Typ

### 2.1 Händler-Typen an Stationen

```
  ╔══ STATION: NEXUS-7 — DIENSTE ═══════════════════════════╗
  ║                                                         ║
  ║  NPC-HÄNDLER AN DIESER STATION:                         ║
  ║  ────────────────────────────────────────────────────  ║
  ║                                                         ║
  ║  [HÄNDLER] Varok-12       Ressourcen & Module           ║
  ║  [HÄNDLER] Elara-7        Rohstoffe & Treibstoff        ║
  ║  [SCHIFFSW.] Dornick      ██ SCHIFFSWERFT ██            ║
  ║                           Kaufe / Aufrüste / Modifiziere║
  ║                                                         ║
  ║  [QUESTS]   [HANDEL]   [SCHIFF]   [INFOS]               ║
  ╚═════════════════════════════════════════════════════════╝
```

**Schiffswerft-NPC** ist ein neuer NPC-Typ (`shipyard`), der:
- Schiffe zum Kauf anbietet (Hull-spezifisch nach Stations-Typ)
- Kosmetische Änderungen durchführt
- Schiffs-Umbenennung erlaubt

### 2.2 Schiffswerft-Verfügbarkeit

Nicht jede Station hat eine Schiffswerft. Die Verfügbarkeit ist seed-basiert:

| Stations-Typ     | Schiffswerft-Chance | Verfügbare Schiffstypen |
|------------------|--------------------|-----------------------|
| Normale Station  | 30 %               | Scout, Freighter       |
| Handelsposten    | 50 %               | Scout, Freighter, Cruiser |
| Militärbasis     | 70 %               | Cruiser, Battleship    |
| Ancient-Station  | 100 %              | Explorer + alle        |
| Home-Base        | 100 %              | Alle (mit Level-Gate)  |

---

## 3. Schiffs-Katalog

### 3.1 VOID SCOUT (Startschiff)

```
  ╔════════════════════════════════════════════════════════╗
  ║  SCHIFF: VOID SCOUT MK.I                              ║
  ║  ─────────────────────────────────────────────────── ║
  ║                                                        ║
  ║        ╱╲                                              ║
  ║       ╱██╲     Klasse: SCOUT — Erkunder               ║
  ║      ╱████╲    Größe: Klein                           ║
  ║      ╲████╱    Slots: 3 Modul-Slots                   ║
  ║       ╲██╱                                            ║
  ║        ╲╱                                             ║
  ║                                                        ║
  ║  STATS:                                               ║
  ║  HP:          50  │  Fracht:      3                   ║
  ║  Sprungweite:  5  │  Scan-Level:  1                   ║
  ║  Fuel max:    80  │  Fuel/Sprung: 1                   ║
  ║  AP/Sprung:    1  │  Komm:       50                   ║
  ║                                                        ║
  ║  Preis:       GRATIS (Startschiff)                     ║
  ║  Level-Gate:  Level 1                                  ║
  ║  Schiffsw.:   Überall verfügbar                        ║
  ║                                                        ║
  ║  „Dein erster Schritt ins Void. Billig. Verlässlich.  ║
  ║   Zerbrechlich."                      — Händler Dornick║
  ╚════════════════════════════════════════════════════════╝
```

### 3.2 VOID FREIGHTER

```
  ╔════════════════════════════════════════════════════════╗
  ║  SCHIFF: VOID FREIGHTER                               ║
  ║  ─────────────────────────────────────────────────── ║
  ║                                                        ║
  ║  ┌──────────────────┐                                  ║
  ║  │ ░░░░ CARGO ░░░░  │   Klasse: FRACHTER — Händler    ║
  ║══╡ ░░░░░░░░░░░░░░░  ╞══  Größe: Mittel                ║
  ║  │ ░░░░░░░░░░░░░░░  │   Slots: 4 Modul-Slots          ║
  ║  └─────────┬────────┘                                  ║
  ║            │                                           ║
  ║           ═╧═                                          ║
  ║                                                        ║
  ║  STATS:                                               ║
  ║  HP:          80  │  Fracht:     15                   ║
  ║  Sprungweite:  3  │  Scan-Level:  1                   ║
  ║  Fuel max:   120  │  Fuel/Sprung: 2                   ║
  ║  AP/Sprung:    2  │  Komm:       75                   ║
  ║                                                        ║
  ║  Preis:       500 Credits                              ║
  ║  Level-Gate:  Level 3                                  ║
  ║  Schiffsw.:   Handelsposten, Home-Base                 ║
  ║                                                        ║
  ║  „Nicht schnell. Nicht schön. Aber Frachtraum ist     ║
  ║   Geld, und das hat er reichlich."    — Händler Dornick║
  ╚════════════════════════════════════════════════════════╝
```

### 3.3 VOID CRUISER

```
  ╔════════════════════════════════════════════════════════╗
  ║  SCHIFF: VOID CRUISER                                 ║
  ║  ─────────────────────────────────────────────────── ║
  ║                                                        ║
  ║   ╱╲  ╱╲                                              ║
  ║  ╱██╲╱██╲    Klasse: KREUZER — Allrounder             ║
  ║ ╱████████╲   Größe: Mittel                            ║
  ║ ╲████████╱   Slots: 4 Modul-Slots                     ║
  ║  ╲██╱╲██╱                                             ║
  ║                                                        ║
  ║  STATS:                                               ║
  ║  HP:         100  │  Fracht:      8                   ║
  ║  Sprungweite:  4  │  Scan-Level:  1                   ║
  ║  Fuel max:   150  │  Fuel/Sprung: 1                   ║
  ║  AP/Sprung:    1  │  Komm:      100                   ║
  ║                                                        ║
  ║  Preis:       1000 Credits                             ║
  ║  Level-Gate:  Level 4                                  ║
  ║  Schiffsw.:   Handelsposten, Militär, Home-Base        ║
  ║                                                        ║
  ║  „Der Arbeitsesel des Void. Ausgewogen in allem,      ║
  ║   herausragend in nichts. Perfekt."   — Händler Dornick║
  ╚════════════════════════════════════════════════════════╝
```

### 3.4 VOID EXPLORER

```
  ╔════════════════════════════════════════════════════════╗
  ║  SCHIFF: VOID EXPLORER                                ║
  ║  ─────────────────────────────────────────────────── ║
  ║                                                        ║
  ║     ─────                                              ║
  ║    ╱─────╲    Klasse: ERKUNDER — Langstrecke          ║
  ║   ╱───────╲   Größe: Groß                             ║
  ║  │─────────│  Slots: 5 Modul-Slots                    ║
  ║   ╲───┬───╱                                           ║
  ║       │                                               ║
  ║      ═╧═  ═══                                         ║
  ║                                                        ║
  ║  STATS:                                               ║
  ║  HP:          70  │  Fracht:     10                   ║
  ║  Sprungweite:  6  │  Scan-Level:  2                   ║
  ║  Fuel max:   200  │  Fuel/Sprung: 1                   ║
  ║  AP/Sprung:    1  │  Komm:      150                   ║
  ║                                                        ║
  ║  Preis:       2000 Credits                             ║
  ║  Level-Gate:  Level 5                                  ║
  ║  Schiffsw.:   Ancient-Station, Home-Base               ║
  ║                                                        ║
  ║  „Mit diesem Schiff hast du noch unbekannte Sektoren  ║
  ║   in 300 Lichtjahren Entfernung. Für Träumer."        ║
  ║                                      — Händler Dornick║
  ╚════════════════════════════════════════════════════════╝
```

### 3.5 VOID BATTLESHIP

```
  ╔════════════════════════════════════════════════════════╗
  ║  SCHIFF: VOID BATTLESHIP                              ║
  ║  ─────────────────────────────────────────────────── ║
  ║                                                        ║
  ║  ████████████                                          ║
  ║ ╔════════════╗    Klasse: SCHLACHTSCHIFF — Kampf      ║
  ║ ║ ▓▓ [] ▓▓  ║    Größe: Groß                         ║
  ║═╣ ▓▓████▓▓  ╠═   Slots: 5 Modul-Slots                ║
  ║ ║ ▓▓ [] ▓▓  ║                                         ║
  ║ ╚════════════╝                                         ║
  ║  ████████████                                          ║
  ║                                                        ║
  ║  STATS:                                               ║
  ║  HP:         150  │  Fracht:      5                   ║
  ║  Sprungweite:  2  │  Scan-Level:  1                   ║
  ║  Fuel max:   180  │  Fuel/Sprung: 3                   ║
  ║  AP/Sprung:    2  │  Komm:       75                   ║
  ║                                                        ║
  ║  Preis:       3000 Credits                             ║
  ║  Level-Gate:  Level 6                                  ║
  ║  Schiffsw.:   Militärbasis, Home-Base                  ║
  ║                                                        ║
  ║  „Langsam. Teuer. Kaum Platz. Aber niemand schießt   ║
  ║   auf ein Battleship zweimal."        — Händler Dornick║
  ╚════════════════════════════════════════════════════════╝
```

---

## 4. Kauf-Dialog

### 4.1 Hauptmenü der Schiffswerft

```
  ╔══ SCHIFFSWERFT — HÄNDLER DORNICK ══════════════════════╗
  ║  Station: NEXUS-7  |  Sektor [12, -4]                  ║
  ║  ──────────────────────────────────────────────────   ║
  ║                                                        ║
  ║  „Willkommen. Ich habe die besten Schiffe im Void —   ║
  ║   zumindest in diesem Sektor."                         ║
  ║                                                        ║
  ║  DEINE FLOTTE:                                         ║
  ║  ► [AKTIV] VOID SCOUT MK.I  „AEGIS-7"                 ║
  ║  ► VOID CRUISER              „IRON PHANTOM"            ║
  ║                                                        ║
  ║  VERFÜGBAR ZUM KAUF:                                   ║
  ║  ──────────────────────────────────────────────────   ║
  ║  ► VOID SCOUT          Gratis       [BEREITS BESESSEN] ║
  ║  ► VOID FREIGHTER      500 CR       [Level: 3 ✓]       ║
  ║  ► VOID CRUISER        1000 CR      [KAUFEN]           ║
  ║                                                        ║
  ║  [KAUF]   [UMBENENNEN]   [LACKIERUNG]   [SCHLIESSEN]   ║
  ╚════════════════════════════════════════════════════════╝
```

### 4.2 Kauf-Bestätigung

```
  ╔══ SCHIFF KAUFEN: VOID CRUISER ══════════════════════════╗
  ║                                                         ║
  ║   ╱╲  ╱╲                                               ║
  ║  ╱██╲╱██╲                                              ║
  ║ ╱████████╲   VOID CRUISER                              ║
  ║ ╲████████╱   Slots: 4  │  HP: 100  │  Range: 4         ║
  ║  ╲██╱╲██╱                                              ║
  ║                                                         ║
  ║  ────────────────────────────────────────────────────  ║
  ║  Preis: 1000 Credits                                    ║
  ║  Dein Guthaben: 1240 CR  →  nach Kauf: 240 CR           ║
  ║                                                         ║
  ║  Schiffsname: [VOID CRUISER-3    ]  (änderbar)          ║
  ║                                                         ║
  ║  Das Schiff wird deiner Flotte hinzugefügt.             ║
  ║  Du kannst es in der Home-Base aktivieren.              ║
  ║                                                         ║
  ║  [KAUFEN BESTÄTIGEN]              [ABBRECHEN]           ║
  ╚═════════════════════════════════════════════════════════╝
```

---

## 5. Kosmetisches Customization-System

### 5.1 Kosmetik-Optionen

```
  ╔══ SCHIFF ANPASSEN — HÄNDLER DORNICK ═════════════════════╗
  ║  Schiff: VOID CRUISER  „IRON PHANTOM"                    ║
  ║  ────────────────────────────────────────────────────   ║
  ║                                                          ║
  ║  [TAB: NAME]  [TAB: FARBSCHEMA]  [TAB: EMBLEM]           ║
  ║                                                          ║
  ║  ── NAME ────────────────────────────────────────────   ║
  ║  Aktueller Name: IRON PHANTOM                            ║
  ║  Neuer Name:    [SHADOW CRUISER         ]                ║
  ║  Kosten:        50 CR  (Umbenennung)                     ║
  ║                                                          ║
  ║  ── FARBSCHEMA ──────────────────────────────────────   ║
  ║  Aktuell: STANDARD (Amber)                               ║
  ║                                                          ║
  ║  ○ STANDARD   [amber]   Gratis                          ║
  ║  ● PHANTOM    [dunkelviolett]  100 CR                    ║
  ║  ○ SOLAR      [gold/rot]  100 CR                         ║
  ║  ○ GHOST      [hellblau]  100 CR                         ║
  ║  ○ VOID-DARK  [grauschwarz]  150 CR                      ║
  ║  ○ NEBULA     [cyanblau]  150 CR  (NPC-exklusiv)         ║
  ║                                                          ║
  ║  ── EMBLEM ──────────────────────────────────────────   ║
  ║  Aktuell: KEIN EMBLEM                                    ║
  ║  ○ KEIN EMBLEM        Gratis                             ║
  ║  ○ [★] STERN          80 CR                             ║
  ║  ○ [◆] KRISTALL       80 CR                             ║
  ║  ○ [⚡] BLITZ         80 CR                             ║
  ║  ○ [☠] TOTENKOPF     80 CR                              ║
  ║  ○ [∞] UNENDLICH     100 CR  (Ancient-Fraktion Friendly+)║
  ║                                                          ║
  ║  Gesamtkosten: 250 CR     Dein Guthaben: 1240 CR         ║
  ║                                                          ║
  ║  [VORSCHAU]    [ANWENDEN]    [ABBRECHEN]                 ║
  ╚══════════════════════════════════════════════════════════╝
```

### 5.2 Farbschemata — Radar-Darstellung

Farbschemata ändern die Farbe des Schiff-Symbols auf dem Radar anderer Spieler:

| Schema    | Farbe (hex) | Kosten | Voraussetzung         |
|-----------|-------------|--------|-----------------------|
| STANDARD  | `#FFB000`   | 0 CR   | —                     |
| PHANTOM   | `#8A2BE2`   | 100 CR | —                     |
| SOLAR     | `#FF4500`   | 100 CR | —                     |
| GHOST     | `#87CEEB`   | 100 CR | —                     |
| VOID-DARK | `#444444`   | 150 CR | —                     |
| NEBULA    | `#00BFFF`   | 150 CR | Ancient: Friendly+    |
| FACTION   | Frak.-Farbe | 200 CR | Fraktion: Honored+    |

### 5.3 Embleme

Embleme erscheinen als kleines Symbol hinter dem Schiffsnamen in der Radar-Ansicht
und im Kommunikations-System.

| Emblem    | Symbol | Kosten | Voraussetzung         |
|-----------|--------|--------|-----------------------|
| Kein      | —      | 0 CR   | —                     |
| Stern     | `★`   | 80 CR  | —                     |
| Kristall  | `◆`   | 80 CR  | —                     |
| Blitz     | `⚡`  | 80 CR  | —                     |
| Totenkopf | `☠`   | 80 CR  | —                     |
| Unendlich | `∞`   | 100 CR | Ancient: Friendly+    |
| Fraktions | (Frak.)| 0 CR  | Fraktion beigetreten  |

---

## 6. Händler-Dialoge

### 6.1 Erster Besuch

```
  ╔══ HÄNDLER DORNICK ═══════════════════════════════════════╗
  ║                                                          ║
  ║  ┌──┐                                                    ║
  ║  │NPC│  „Ah, ein neues Gesicht. Ich bin Dornick,        ║
  ║  └──┘   Schiffshändler der alten Schule. Seit 30        ║
  ║         Jahren verkaufe ich Schiffe in diesem Sektor.   ║
  ║                                                          ║
  ║         Dein Scout sieht... benutzt aus. Bereit für     ║
  ║         ein Upgrade? Ich habe genau das Richtige."      ║
  ║                                                          ║
  ║  [SCHIFFE ANSEHEN]   [MEIN SCHIFF ANPASSEN]   [TSCHÜSS] ║
  ╚══════════════════════════════════════════════════════════╝
```

### 6.2 Kein Level für Schiff

```
  ╔══ HÄNDLER DORNICK ═══════════════════════════════════════╗
  ║                                                          ║
  ║  ┌──┐  „Das Battleship? Respektable Wahl. Aber          ║
  ║  │NPC│  ehrlich gesagt — du bist noch nicht bereit.     ║
  ║  └──┘   Komm wieder, wenn du mehr Erfahrung hast.       ║
  ║                                                          ║
  ║         Level 6 erforderlich. Du bist Level 4."         ║
  ║                                                          ║
  ║  [ANDERE SCHIFFE]   [SCHLIESSEN]                         ║
  ╚══════════════════════════════════════════════════════════╝
```

---

## 7. Flotten-Management

### 7.1 Flotten-Übersicht

Spieler können mehrere Schiffe besitzen. Nur eines ist aktiv.

```
  ╔══ MEINE FLOTTE ══════════════════════════════════════════╗
  ║                                                          ║
  ║  [AKTIV]  ─────────────────────────────────────────   ║
  ║  ► VOID SCOUT  „AEGIS-7"                               ║
  ║    Farbe: STANDARD  |  Emblem: ★                        ║
  ║    HP: 100/100  |  Fuel: 45/80                          ║
  ║    [ANPASSEN]                                           ║
  ║                                                          ║
  ║  IN HANGAR ────────────────────────────────────────   ║
  ║  ► VOID CRUISER  „IRON PHANTOM"                         ║
  ║    Farbe: PHANTOM  |  Emblem: ☠                         ║
  ║    HP: 100/100  |  Fuel: 150/150                        ║
  ║    [AKTIVIEREN]   [ANPASSEN]                            ║
  ║                                                          ║
  ║  ► VOID FREIGHTER  „CARGO-1"                            ║
  ║    Farbe: STANDARD  |  Emblem: —                        ║
  ║    HP: 80/80  |  Fuel: 120/120                          ║
  ║    [AKTIVIEREN]   [ANPASSEN]   [VERKAUFEN: 250 CR]      ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
```

### 7.2 Schiff-Verkauf

Spieler können nicht aktive Schiffe verkaufen (50 % des Kaufpreises).

| Schiff     | Kaufpreis | Rückkauf-Preis |
|------------|-----------|----------------|
| Scout      | 0 CR      | 0 CR           |
| Freighter  | 500 CR    | 250 CR         |
| Cruiser    | 1000 CR   | 500 CR         |
| Explorer   | 2000 CR   | 1000 CR        |
| Battleship | 3000 CR   | 1500 CR        |

---

## 8. Technische Implementierung

### 8.1 Neue Typen (`packages/shared/src/types.ts`)

```typescript
// Kosmetik-Daten
export interface ShipCosmetics {
  colorScheme: ShipColorScheme;
  emblem: ShipEmblem | null;
  displayName: string;
}

export type ShipColorScheme = 'standard' | 'phantom' | 'solar' | 'ghost' | 'void_dark'
                            | 'nebula' | 'faction';
export type ShipEmblem = 'star' | 'crystal' | 'lightning' | 'skull' | 'infinity' | 'faction';

// Erweiterung ShipRecord
export interface ShipRecord {
  id: string;
  ownerId: string;
  hullType: HullType;
  name: string;                     // Display-Name (für Kosmetik)
  internalName: string;             // System-Name (generiert)
  modules: ShipModule[];
  active: boolean;
  cosmetics: ShipCosmetics;         // NEU
  createdAt: string;
}

// NPC-Schiffshändler
export interface ShipyardNpc {
  id: string;
  name: string;
  stationX: number;
  stationY: number;
  availableHulls: HullType[];
  dialogLines: string[];
}

// Nachrichten-Typen
export interface BuyShipMessage {
  hullType: HullType;
  customName?: string;
}
export interface BuyShipResultMessage {
  success: boolean;
  error?: 'INSUFFICIENT_FUNDS' | 'LEVEL_REQUIRED' | 'HULL_NOT_AVAILABLE' | 'ALREADY_OWNED';
  newShipId?: string;
  creditsRemaining?: number;
}

export interface UpdateShipCosmeticsMessage {
  shipId: string;
  cosmetics: Partial<ShipCosmetics>;
}
export interface UpdateShipCosmeticsResultMessage {
  success: boolean;
  error?: 'SHIP_NOT_FOUND' | 'INSUFFICIENT_FUNDS' | 'REQUIREMENT_NOT_MET';
  creditsRemaining?: number;
}

export interface RenameShipMessage {
  shipId: string;
  newName: string;
}

export interface SellShipMessage {
  shipId: string;
}
export interface SellShipResultMessage {
  success: boolean;
  error?: 'SHIP_NOT_FOUND' | 'CANNOT_SELL_ACTIVE' | 'CANNOT_SELL_SCOUT';
  creditsEarned?: number;
}
```

### 8.2 Konstanten (`packages/shared/src/constants.ts`)

```typescript
// Kosmetik-Preise
export const COSMETIC_PRICES: Record<ShipColorScheme | ShipEmblem, number> = {
  standard:   0,
  phantom:    100,
  solar:      100,
  ghost:      100,
  void_dark:  150,
  nebula:     150,
  faction:    200,
  star:       80,
  crystal:    80,
  lightning:  80,
  skull:      80,
  infinity:   100,
};

// Kosmetik-Farben für Radar
export const COSMETIC_COLORS: Record<ShipColorScheme, string> = {
  standard:   '#FFB000',
  phantom:    '#8A2BE2',
  solar:      '#FF4500',
  ghost:      '#87CEEB',
  void_dark:  '#444444',
  nebula:     '#00BFFF',
  faction:    '#FFFFFF',  // wird durch Fraktionsfarbe ersetzt
};

// Schiffs-Umbenennung
export const SHIP_RENAME_COST = 50;

// Schiff-Verkauf
export const SHIP_SELL_FRACTION = 0.5;

// Schiffswerft-Spawn-Wahrscheinlichkeit nach Stations-Typ
export const SHIPYARD_SPAWN_CHANCES: Record<string, number> = {
  normal:    0.30,
  trade:     0.50,
  military:  0.70,
  ancient:   1.00,
  home_base: 1.00,
};
```

### 8.3 DB-Änderungen

```sql
-- Migration 013: Schiffs-Kosmetik
ALTER TABLE ships ADD COLUMN IF NOT EXISTS display_name    TEXT;
ALTER TABLE ships ADD COLUMN IF NOT EXISTS color_scheme    TEXT DEFAULT 'standard';
ALTER TABLE ships ADD COLUMN IF NOT EXISTS emblem          TEXT;

-- Schiffswerft-Transaktionen (Optional: Logging)
CREATE TABLE IF NOT EXISTS ship_purchases (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  hull_type   TEXT    NOT NULL,
  price       INTEGER NOT NULL,
  purchased_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
);
```

### 8.4 Server-Handler

Neue Message-Handler in `SectorRoom.ts`:

```typescript
'buyShip'              → handleBuyShip(client, data)
'sellShip'             → handleSellShip(client, data)
'renameShip'           → handleRenameShip(client, data)
'updateShipCosmetics'  → handleUpdateShipCosmetics(client, data)
'activateShip'         → handleActivateShip(client, data)  // bereits vorhanden, prüfen
'getShipyardInventory' → handleGetShipyardInventory(client, data)
```

**Kern-Logik `handleBuyShip`:**
```typescript
async handleBuyShip(client: Client, data: BuyShipMessage) {
  const { hullType, customName } = data;
  const player = this.state.players.get(client.sessionId);
  const hull = HULLS[hullType];

  // Level-Gate-Check
  if (player.level < hull.unlockLevel) {
    return send(client, 'buyShipResult', { success: false, error: 'LEVEL_REQUIRED' });
  }

  // Credits-Check
  if (player.credits < hull.unlockCost) {
    return send(client, 'buyShipResult', { success: false, error: 'INSUFFICIENT_FUNDS' });
  }

  // Schiffswerft verfügbar?
  const station = await getSectorStation(player.sectorX, player.sectorY);
  if (!station?.shipyard || !station.shipyard.availableHulls.includes(hullType)) {
    return send(client, 'buyShipResult', { success: false, error: 'HULL_NOT_AVAILABLE' });
  }

  // Kauf durchführen
  await deductCredits(player.userId, hull.unlockCost);
  const newShip = await createShip(player.userId, hullType, customName ?? generateShipName(hullType));
  return send(client, 'buyShipResult', { success: true, newShipId: newShip.id, creditsRemaining: player.credits });
}
```

### 8.5 Client-Komponenten

| Komponente             | Beschreibung                                  |
|------------------------|-----------------------------------------------|
| `ShipyardPanel.tsx`    | Haupt-Schiffswerft-Panel (Liste + Kauf)       |
| `ShipCard.tsx`         | Einzelne Schiffs-Karte mit Stats + ASCII-Art  |
| `ShipCosmeticsPanel.tsx` | Anpass-Panel (Name, Farbe, Emblem)          |
| `FleetPanel.tsx`       | Flotten-Übersicht (alle Schiffe)              |

---

## 9. Balance-Überlegungen

### 9.1 Progression-Kurve

```
  Level 1:  Scout (Gratis) — Einstieg, erkunden
  Level 3:  Freighter (500 CR) — Handel beginnt
  Level 4:  Cruiser (1000 CR) — Allrounder für Kampf
  Level 5:  Explorer (2000 CR) — Langstrecke, Entdeckung
  Level 6:  Battleship (3000 CR) — Endgame-Kampf

  Kosmetik: Optional, Credits-Sink ohne Gameplay-Vorteil
  → Spieler können Credits in Anpassung investieren
  → Kein Pay-to-Win, rein ästhetisch
```

### 9.2 Credits-Sink

Kosmetik bietet einen wichtigen Credits-Sink:
- Aktive Spieler akkumulieren viele Credits
- Kosmetik gibt einen Grund, Credits auszugeben ohne Vorteil
- Farbschemata mit Fraktions-Anforderung motivieren Fraktions-Spiel

---

## 10. Phasen-Plan

### Phase 1 — Datenmodell (0.5 Tage)

- [ ] `ShipCosmetics`, `ShipColorScheme`, `ShipEmblem` in `types.ts`
- [ ] `ShipRecord` erweitern
- [ ] `COSMETIC_PRICES`, `COSMETIC_COLORS` in `constants.ts`
- [ ] Migration 013 (DB)
- [ ] Neue Message-Typen

### Phase 2 — Schiffswerft-NPC (1 Tag)

- [ ] Schiffswerft-Spawn-Logik (seed-basiert, je nach Stations-Typ)
- [ ] `handleBuyShip` Handler + Tests
- [ ] `handleSellShip` Handler + Tests
- [ ] `getShipyardInventory` Handler
- [ ] Level-Gate-Prüfung

### Phase 3 — Kosmetik-System (1 Tag)

- [ ] `handleRenameShip` Handler
- [ ] `handleUpdateShipCosmetics` Handler
- [ ] Kosmetik-Voraussetzungen (Fraktions-Check)
- [ ] Radar-Farbe nach Kosmetik rendern
- [ ] Tests

### Phase 4 — UI (1 Tag)

- [ ] `ShipyardPanel.tsx` mit Schiffs-Katalog
- [ ] `ShipCard.tsx` mit ASCII-Schiffs-Darstellung
- [ ] `ShipCosmeticsPanel.tsx`
- [ ] `FleetPanel.tsx` Verbesserungen
- [ ] Händler-Dialog-System

---

*Dokument-Ende — voidSector Issue #68 / Sektion 7: Raumschiffe — NPC-Kauf & Kosmetik*
