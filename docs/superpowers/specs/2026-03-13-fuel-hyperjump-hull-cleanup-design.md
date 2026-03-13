# Design Spec: Fuel-Rebalance, Hyperjump-Aktivierung & Hull-Legacy-Cleanup

**Issue:** #291 Long-Distance-Movement (Teil A+C)
**Datum:** 2026-03-13
**Status:** Approved

---

## Übersicht

Drei zusammenhängende Änderungen:

1. **Hyperjump permanent aktivieren** — `FEATURE_HYPERDRIVE_V2`-Flag entfernen
2. **Hull-Legacy-System entfernen** — ~35 Dateien, neue DB-Migration 060
3. **Fuel-UI verbessern** — Fuel-Bar + COST/SEKTOR-Anzeige im ShipStatusPanel

Die Konstanten (`baseFuel: 10_000`, `baseFuelPerJump: 100`) sind in den HULLS-Definitionen bereits korrekt — die neuen Basis-Konstanten spiegeln diese Werte.

**ACEP Explorer-Fuel-Traits** (im Issue erwähnt) werden **auf später verschoben** — die notwendige Stat-Pipeline in `calculateShipStats` existiert noch nicht. Sie kommen in einem separaten ACEP-Rework.

**Nach jeder Änderung an `packages/shared/`:** `cd packages/shared && npm run build`

---

## 1. Neue Basis-Konstanten (`constants.ts`)

Diese Konstanten ersetzen alle `HULLS[x].baseFoo`-Lookups:

```typescript
export const BASE_FUEL_CAPACITY = 10_000;   // neu, ersetzt HULLS[x].baseFuel
export const BASE_FUEL_PER_JUMP = 100;       // neu, ersetzt HULLS[x].baseFuelPerJump
export const BASE_CARGO = 3;                 // neu, ersetzt HULLS[x].baseCargo
export const BASE_MODULE_SLOTS = 3;          // neu, ersetzt HULLS[x].slots
export const BASE_HP = 100;                  // neu, ersetzt HULLS[x].baseHp
export const BASE_JUMP_RANGE = 5;            // neu, ersetzt HULLS[x].baseJumpRange
export const BASE_ENGINE_SPEED = 2;          // neu, ersetzt HULLS[x].baseEngineSpeed
export const BASE_COMM_RANGE = 100;          // neu, ersetzt HULLS[x].baseCommRange
export const BASE_SCANNER_LEVEL = 1;         // neu, ersetzt HULLS[x].baseScannerLevel
```

---

## 2. Fuel-Kapazität

Fuel-Kapazität läuft vollständig durch `calculateShipStats()` in `shipCalculator.ts`:

```
totalFuelMax = BASE_FUEL_CAPACITY          // 10_000 (neue Basis-Konstante)
             + sum(installedModules[].fuelMax)   // Drive- und Cargo-Module
```

Kein gesonderter `acepTraits.fuelMax` oder `techBoni.fuelMax` — diese kommen später
als Module-Effekte wenn ACEP-Traits implementiert werden.

---

## 3. Fuel-Kosten pro Hyperjump

Die Formel in `calcHyperjumpFuelV2()` (`packages/shared/src/jumpCalc.ts`):

```
// Aktuell:
fuelCost = max(1, ceil(baseFuelPerSector * distance * hullMultiplier * (1 - driveEfficiency)))

// Nach Änderung (hullMultiplier entfernt, fest 1.0):
fuelCost = max(1, ceil(BASE_FUEL_PER_JUMP * distance * (1 - driveEfficiency)))
```

- `BASE_FUEL_PER_JUMP = 100` (neue Konstante)
- `driveEfficiency` = `hyperdriveFuelEfficiency` aus dem eingebauten Drive-Modul (0.0 – 0.5)
- `hullMultiplier`-Parameter wird aus der Funktionssignatur entfernt

---

## 4. Hyperjump-Aktivierung

- `FEATURE_HYPERDRIVE_V2 = false` in `constants.ts` **löschen**
- In `NavigationService.ts` **und `SectorRoom.ts`**: alle `if (FEATURE_HYPERDRIVE_V2)` Branches — den V2-Branch als einzigen Code übernehmen, kein If mehr
- Auto-Refuel-Logik bei Station bleibt aktiv
- Charge-System bleibt aktiv (taktischer Aspekt)

---

## 5. Hull-Legacy-Entfernung

### Zu löschende Konstanten (`constants.ts`)

| Konstante | Zeilen ca. |
|-----------|-----------|
| `HULLS: Record<HullType, HullDefinition>` | ~106 |
| `HULL_PRICES: Record<HullType, number>` | ~6 |
| `HULL_FUEL_MULTIPLIER: Record<HullType, number>` | ~7 |

### Zu löschende Types (`types.ts`)

- `HullType` (union type)
- `HullSize` (union type)
- `HullDefinition` (interface)
- `hullType: HullType` Feld aus `ShipRecord` entfernen

### DB-Migration `060_drop_hull_type.sql`

Letzter existierender Stand: `059_drop_legacy_columns.sql`. Migration 060 ist korrekt.

```sql
ALTER TABLE ships DROP COLUMN IF EXISTS hull_type;
```

### `shipCalculator.ts` — `calculateShipStats()`

- `hullType`-Parameter aus Signatur entfernen
- `HULLS[hullType]`-Lookup durch neue Basis-Konstanten ersetzen
- Basis-Fuel-Wert: `BASE_FUEL_CAPACITY` statt `hull.baseFuel`

### `shipCalculator.ts` — `validateModuleInstall()`

- `hullType`-Parameter aus Signatur entfernen
- `HULLS[hullType].slots` → `BASE_MODULE_SLOTS` (3)
- Aufrufer in `ShipService.ts` und Client-Komponenten anpassen

### Betroffene Server-Dateien

| Datei | Änderung |
|-------|----------|
| `queries.ts` | `hull_type` aus allen SELECT/INSERT entfernen; `hullType`-Param aus `createShip()` entfernen; `hullType`-Feld aus allen Return-Mappings entfernen |
| `adminQueries.ts` | `hull_type` aus Query-Selektion + Rückgabe-Mapping entfernen |
| `SectorRoom.ts` | `clientHullTypes: Map<string, HullType>` entfernen; `createShip()`-Aufruf ohne hullType; `HULLS.scout.baseFuel` → `BASE_FUEL_CAPACITY` |
| `ServiceContext.ts` | `clientHullTypes: Map<string, HullType>` Feld entfernen |
| `NavigationService.ts` | `HULL_FUEL_MULTIPLIER`-Import entfernen; `hullMult`-Variable entfernen; `calcHyperjumpFuelV2()` ohne hullMultiplier aufrufen; `FEATURE_HYPERDRIVE_V2`-Branch auflösen |
| `ShipService.ts` | `calculateShipStats()`- und `validateModuleInstall()`-Aufrufe ohne `hullType` |
| `CombatService.ts` | `clientHullTypes.set()` nach Permadeath entfernen |
| `autopilot.ts` | `getHullTypeFromStats()`-Funktion löschen; `HULL_FUEL_MULTIPLIER`-Lookup entfernen |
| `permadeathService.ts` | `hull_type` aus INSERT-Statement entfernen |

### Betroffene Client-Dateien

| Datei | Änderung |
|-------|----------|
| `gameSlice.ts` | `hullType: HullType` Feld aus `ClientShipData` entfernen |
| `ShipBlock.tsx` | `HULLS`-Import + Hull-Info-Anzeige entfernen |
| `ShipDetailPanel.tsx` | `HULLS[ship.hullType]?.slots` → `BASE_MODULE_SLOTS` (3); `validateModuleInstall()` ohne hullType aufrufen |
| `ShipStatusPanel.tsx` | Hull-Name-Anzeige entfernen (Schiff heißt immer AEGIS bzw. ACEP-Name) |
| `NavTargetPanel.tsx` | `HULLS.scout.baseFuelPerJump` → `ship?.stats?.fuelPerJump ?? BASE_FUEL_PER_JUMP` |

### Test-Anpassungen

| Datei | Änderung |
|-------|----------|
| `fuelRework.test.ts` | Datei komplett auf 3-Argument-Signatur umschreiben: `calcHyperjumpFuelV2(baseFuelPerSector, distance, driveEfficiency)` — alle `HULL_FUEL_MULTIPLIER`-Assertions löschen |
| `jumpCalc.test.ts` | Hull-`baseEngineSpeed`-Tests löschen (ENGINE_SPEED-Tests bleiben, die sind modul-basiert) |
| `shipCalculatorAcep.test.ts` | `HULLS['scout'].baseCargo` → `3` |
| `shipLookup.test.ts` | Datei löschen (testet ausschließlich Hull-Definitionen) |
| `farNav.test.ts` | `HULLS.scout/freighter`-Referenzen → Basis-Konstanten |
| `fuel.test.ts` | `HULLS.scout/explorer` → Basis-Konstanten |
| `hyperdriveV2.test.ts` | `hullMultiplier`-Parameter aus `calcHyperjumpFuelV2()`-Aufrufen entfernen |
| Server-Test-Mocks | `clientHullTypes: new Map()` aus allen `ServiceContext`-Mocks entfernen |

---

## 6. Fuel-UI

### ShipStatusPanel — Stats-Tab

**Vorher:** `FUEL: 6432/17000` als einfache Text-Row

**Nachher:** Eigene FUEL-Sektion (nach den Stats-Rows, vor HYPERDRIVE):

```
FUEL
TANK    6.432 / 17.000
[████████░░░░░░░░░░░░░]   ← orangener Gradient (#f97316→#fb923c), 4px hoch, border-radius 2px
COST/SEKTOR   75
```

- `COST/SEKTOR`-Wert = `ship.stats.fuelPerJump` (bereits im Stats-Objekt vorhanden)
- Bar-Füllstand = `fuel.current / fuel.max`
- Keine Reduktions-Klammer-Anzeige (vereinfacht)

### NavTargetPanel

- `HULLS.scout.baseFuelPerJump` → `ship?.stats?.fuelPerJump ?? BASE_FUEL_PER_JUMP`
- Fuel-Kosten-Text: `color: estimatedFuel <= (fuel?.current ?? 0) ? '#4ade80' : '#f87171'`

### Modul-Detail (Drive)

Keine Änderung nötig. `fuelMax`-Stat wird bereits als secondaryEffect mit Label `'Fuel-Tank +X.XXX'` angezeigt.

---

## Nicht in diesem Scope

- ACEP Explorer-Fuel-Traits (brauchen neue Stat-Pipeline)
- FACTORY-Schiffs-Modul → eigenes Issue/Spec
- S-Bahn-Plan-UI für Jumpgates
- Station GAS-Produktion → Playtest-Issue #299

---

## Build-Hinweis

Nach Änderungen an `packages/shared/` immer:
```bash
cd packages/shared && npm run build
```

---

## Akzeptanzkriterien

- [ ] Hyperjump funktioniert ohne Feature-Flag (immer aktiv), Charge-System aktiv
- [ ] Fuel-Kapazität = `BASE_FUEL_CAPACITY (10_000)` + Drive-`fuelMax`-Bonus (kein hullMultiplier)
- [ ] `hull_type`-Spalte in DB weg (Migration 060 läuft erfolgreich durch)
- [ ] Keine Referenzen auf `HullType`, `HULLS`, `HULL_FUEL_MULTIPLIER`, `FEATURE_HYPERDRIVE_V2` im Code
- [ ] `validateModuleInstall()` und `calculateShipStats()` funktionieren ohne `hullType`-Parameter
- [ ] Fuel-Bar im ShipStatusPanel sichtbar (orange)
- [ ] `COST/SEKTOR` zeigt `ship.stats.fuelPerJump`
- [ ] NavTargetPanel zeigt Fuel-Kosten farbig (grün/rot je nach Verfügbarkeit)
- [ ] Alle Tests grün: Server (~973), Client (~499), Shared (~205)
