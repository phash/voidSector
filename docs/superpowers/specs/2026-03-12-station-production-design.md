# Station Production System — Design

**Date:** 2026-03-12
**Scope:** Player-Station trade overhaul + Station production queue
**Status:** Approved

---

## Zusammenfassung

Stationen werden zu autonomen Produzenten: sie konsumieren Rohstoffe und erzeugen Waren (Treibstoff, Munition, Module), die Spieler nach dem Andocken kaufen können. Spieler können Rohstoffe an Stationen liefern und erhalten dafür Credits (dynamisch nach Lagerstand). Blueprint-Crafting verlässt die Station und ist nur noch an Bord des Schiffes möglich. Der NPC-Handel ist nur noch nach dem Andocken verfügbar (nicht mehr aus dem Schiff-UI).

---

## Änderungen am bestehenden System

### Ship-seitiges TradeScreen
- **NPC-Tab wird entfernt** — Stationshandel nur noch nach Andocken
- Verbleibende Tabs: MARKET, ROUTES, KONTOR (alles Spieler-zu-Spieler)

### StationTerminalOverlay — FABRIK-Programm
- **Blueprint-Crafting entfernt** (wandert ins Schiff: Cargo/Inventory-UI)
- FABRIK wird zur **Stations-Produktionsansicht** (war bisher ungenutzt)
- Neue Funktionen: Produktionsqueue, Lager kaufen, Rohstoffe liefern

---

## Produktionssystem Backend

### Kernprinzip: Lazy Evaluation
Kein Background-Tick. Produktionsfortschritt wird on-demand berechnet wenn ein Spieler andockt. Konsistent mit AP/Fuel-Pattern im Codebase.

### DB-Migration 049: `station_production`

```sql
CREATE TABLE IF NOT EXISTS station_production (
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  resource_stockpile JSONB NOT NULL DEFAULT '{}',
  passive_gen_last_tick TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  queue JSONB NOT NULL DEFAULT '[]',
  current_item_started_at TIMESTAMPTZ,
  finished_goods JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (sector_x, sector_y)
);
```

**Felder:**
- `resource_stockpile`: `{ ore: N, gas: N, crystal: N }` — Rohstoffe im Stationslager
- `passive_gen_last_tick`: Zeitstempel für passive Rohstoffgenerierung
- `queue`: Array von `QueueItem` — was als nächstes produziert wird
- `current_item_started_at`: Wann aktuelles Item gestartet wurde (null = pausiert)
- `finished_goods`: `{ fuel: N, ammo_basic: N, module_drive_mk2: N, ... }` — kaufbar

### Lazy Calculation beim Andocken

```
1. Lade station_production Row (INSERT IF NOT EXISTS mit Defaults)
2. Berechne passive Rohstoff-Generierung seit passive_gen_last_tick
3. Füge passive Rohstoffe zum resource_stockpile hinzu (up to max)
4. Simuliere Queue-Fortschritt:
   LOOP:
     - Aktuelles Item: genug Zeit vergangen seit current_item_started_at?
     - Genug Rohstoffe im stockpile?
     - Wenn ja: Item fertig → finished_goods[itemId]++ (up to maxStock)
     - Starte nächstes Item in Queue (zyklisch)
     - Wiederhole bis Zeitbudget erschöpft oder Rohstoffe fehlen
5. Speichere aktualisierte Row
6. Sende StationProductionState an Client
```

### Produktions-Queue (statische Konfiguration)

Queue-Zusammensetzung und Ressourcenkosten werden durch **Distanz vom Ursprung (0,0)** bestimmt:

```typescript
const STATION_DISTANCE_TIER = (dist: number): 1 | 2 | 3 | 4 => {
  if (dist < 15)  return 1;
  if (dist < 40)  return 2;
  if (dist < 100) return 3;
  return 4;
};
```

**Tier 1 (dist 0–14) — Basiswaren:**
- fuel ×10 · gas×3 + crystal×1 · 60s/Einheit
- ammo_basic ×5 · ore×5 · 30s/Einheit
- module_cargo_mk1 · ore×20 + gas×10 · 180s

**Tier 2 (dist 15–39):**
- fuel ×8, ammo_basic ×3, rocket_basic ×2
- module_cargo_mk2, module_scanner_mk2, module_drive_mk2
- Kosten ×2–3 vs Tier 1

**Tier 3 (dist 40–99):**
- fuel ×5, rocket_basic ×3
- module_cargo_mk3, module_scanner_mk3, module_drive_mk3, module_shield_mk3
- Kosten ×5–8 vs Tier 1

**Tier 4 (dist 100+):**
- fuel ×3, rocket_basic ×5
- mk4-Module (alle verfügbaren)
- Kosten ×10–15 vs Tier 1, artefact-Anteil

Queue ist **zyklisch** — nach dem letzten Item beginnt Tier-Liste von vorne.
**Produktion pausiert** wenn Rohstoffe fehlen — kein Überspringen.

### Ressourcen-Flow

**Passive Generierung:** Jede Station erzeugt pro Stunde (level-abhängig):
- Level 1: ore×2, gas×1
- Level 2: ore×4, gas×2, crystal×1
- Level 3+: ore×6, gas×3, crystal×2

**Spieler-Lieferung:** Spieler verkauft Rohstoffe → direkt ins `resource_stockpile` (up to max_capacity).
Max-Kapazität: Level × 100 pro Rohstofftyp.

---

## Dynamische Preise (Rohstoff-Ankauf)

```
stockpile_ratio = current_stock / max_capacity

ratio < 0.25  →  × 1.5  (★★ Station dringend)
ratio < 0.50  →  × 1.2  (★ erhöhter Ankaufspreis)
ratio < 0.75  →  × 1.0  (Normal)
ratio ≥ 0.75  →  × 0.8  (Station gesättigt)
```

Basis-Ankaufspreise: `NPC_PRICES` Konstanten (identisch mit bisherigem NPC-System).
**Fertigwaren-Preise** (Spieler kauft): Fixpreise per Konstante — keine dynamische Anpassung.

---

## Produkte (initiales Set)

| Item ID | Kategorie | Beschreibung |
|---------|-----------|--------------|
| `fuel` | RESSOURCEN | Treibstoff, Verbrauchsgut |
| `ammo_basic` | AMMO | Basis-Munition, Verbrauchsgut im Kampf (Platzhalter) |
| `rocket_basic` | AMMO | Einweg-Rakete, Kampfitem (Platzhalter) |
| `module_cargo_mkN` | MODULE | Frachtraum-Upgrade, Tier N |
| `module_scanner_mkN` | MODULE | Scanner-Upgrade, Tier N |
| `module_drive_mkN` | MODULE | Antrieb-Upgrade, Tier N |
| `module_shield_mkN` | MODULE | Schild-Upgrade, ab Tier 3 |

---

## FABRIK-UI (StationTerminalOverlay)

```
┌─ FABRIK ─────────────────────────────────────────────────────┐
│  STATION LVL 3 · SEKTOR 47,23 · MODUL-TIER: MK2             │
├──────────────────────┬───────────────────────────────────────┤
│  PRODUKTION          │  LAGER                                │
│                      │  [RESSOURCEN] [MODULE] [AMMO]         │
│  ▶ drive_mk2         │  ─────────────────────────────────    │
│    ████░░░░  38s     │  fuel          12/50  [KAUFEN]  80cr  │
│                      │                                       │
│  QUEUE:              │                                       │
│  1. ammo_basic ×5    │                                       │
│  2. fuel ×10         │                                       │
│  3. drive_mk2        │                                       │
│                      │                                       │
├──────────────────────┴───────────────────────────────────────┤
│  ROHSTOFFE (LIEFERN)                                         │
│  ore    ████████░░  82%   Ankauf:  8cr  [VERKAUFEN]          │
│  gas    ███░░░░░░░  28%   Ankauf: 14cr  ★ [VERKAUFEN]        │
│  crystal██░░░░░░░░  18%   Ankauf: 18cr  ★★[VERKAUFEN]        │
└──────────────────────────────────────────────────────────────┘
  ★ = erhöhter Ankaufspreis · ★★ = Station dringend
```

**LAGER-Tabs:**
- **RESSOURCEN** — fuel und zukünftige Ressourcen-Fertigwaren
- **MODULE** — distanz-tier-abhängige Module (mk1–mk4)
- **AMMO** — ammo_basic, rocket_basic (Platzhalter)

**Interaktionen:**
- `[KAUFEN]` — 1 Einheit aus Lager (disabled wenn leer oder Credits fehlen)
- `[VERKAUFEN]` — Mengenauswahl aus Cargo → transferiert an Station, Credits sofort
- Fortschrittsbalken: Stand beim Andocken (kein Live-Tick — Idle-Rhythmus)
- Queue: max. 5 nächste Items sichtbar

---

## Blueprint-Crafting (verschoben)

Blueprint-Crafting (Blueprint → Modul bauen) verlässt `FabrikPanel.tsx` und wird ins Schiff-UI verschoben (CargoScreen oder eigener Tab). Stationen bauen Module selbst — Spieler nutzen Blueprints nur noch an Bord.

*Scope dieser Implementierung: Crafting-UI-Verschiebung ist Out-of-Scope — FABRIK-Panel wird ersetzt, bisheriger Code entfernt.*

---

## Neue Server-Nachrichten

| Client → Server | Handler | Response |
|-----------------|---------|----------|
| `getStationProduction` | Lazy-calc + DB-update | `stationProductionUpdate` |
| `buyFromStation` | `{ itemId, quantity }` | `stationProductionUpdate`, `creditsUpdate`, `cargoUpdate` |
| `sellToStation` | `{ itemType, itemId, quantity }` | `stationProductionUpdate`, `creditsUpdate`, `cargoUpdate` |

---

## Out of Scope (heute)

- Kontor/Auktionshaus auf Stationen (kommt später)
- Spieler-zu-Spieler-Direkthandel (bleibt Schiff-UI)
- Stations-XP / Level-Up-Mechanik (nutzt bestehendes System)
- Munitions-Verbrauch im Kampf (Platzhalter — kommt mit Waffensystem)
- Blueprint-Crafting-UI-Verschiebung ins Schiff
