# Design Spec: Fuel-Rebalance, Hyperjump-Aktivierung & Hull-Legacy-Cleanup

**Issue:** #291 Long-Distance-Movement (Teil A+C)
**Datum:** 2026-03-13
**Status:** Approved

---

## Übersicht

Drei zusammenhängende Änderungen:

1. **Hyperjump permanent aktivieren** — `FEATURE_HYPERDRIVE_V2`-Flag entfernen
2. **Hull-Legacy-System entfernen** — ~35 Dateien, neue DB-Migration
3. **Fuel-UI verbessern** — Fuel-Bar + COST/SEKTOR-Anzeige im ShipStatusPanel

Die Konstanten (`baseFuel: 10_000`, `baseFuelPerJump: 100`) sind bereits korrekt. Keine Balancing-Änderungen an Kerndaten nötig.

---

## 1. Datenmodell & Fuel-Berechnung

### Fuel-Kapazität (ohne Hull)

```
totalFuelMax = BASE_FUEL_CAPACITY (10_000)
             + drive.fuelMax         // z.B. +7_000 für ION MK.III
             + acepTraits.fuelMax    // z.B. +1_000 pro Trait
             + techBoni.fuelMax      // flexibel
```

`BASE_FUEL_CAPACITY = 10_000` als neue Konstante in `constants.ts`.

### Fuel-Kosten pro Hyperjump

```
fuelCost = ceil(
  baseFuelPerJump (100)
  * distance
  * (1 - hyperdriveFuelEfficiency)   // Drive-Stat, 0.0–0.5
  - fuelPerJump                       // fixe Reduktion (negativ), aus Traits/Modulen
)
// minimum: 1
```

`calcHyperjumpFuelV2()` verliert den `hullMultiplier`-Parameter (fest 1.0).

### ACEP Explorer-Traits (neu)

Zwei neue Einträge in der ACEP-Explorer-Pfad-Konstante:

| ID | Effekt | Stat | Delta |
|----|--------|------|-------|
| `fuel_efficiency_1` | Fuel/Sprung -10 | `fuelPerJump` | -10 |
| `fuel_efficiency_2` | Fuel/Sprung -25 | `fuelPerJump` | -25 |

Werte sind als normale Trait-Einträge in `constants.ts` definiert — jederzeit anpassbar ohne Logik-Änderung.

---

## 2. Hyperjump-Aktivierung

- `FEATURE_HYPERDRIVE_V2 = false` in `constants.ts` **löschen**
- Alle `if (FEATURE_HYPERDRIVE_V2)` Branches in `NavigationService.ts` als permanenten Code übernehmen (kein If-Branch mehr)
- Auto-Refuel-Logik bei Station bleibt aktiv
- Charge-System bleibt aktiv (taktischer Aspekt des Hyperdrive)

---

## 3. Hull-Legacy-Entfernung

### Zu löschende Konstanten (`constants.ts`)
- `HULLS: Record<HullType, HullDefinition>` (~106 Zeilen)
- `HULL_PRICES: Record<HullType, number>`
- `HULL_FUEL_MULTIPLIER: Record<HullType, number>`

### Zu löschende Types (`types.ts`)
- `HullType`
- `HullSize`
- `HullDefinition`
- `hullType: HullType` aus `ShipRecord`

### Neue Basis-Konstanten (Ersatz für `HULLS.scout.*`)

```typescript
export const BASE_FUEL_CAPACITY = 10_000;
export const BASE_FUEL_PER_JUMP = 100;
export const BASE_CARGO = 3;
export const BASE_MODULE_SLOTS = 3;
export const BASE_HP = 100;
export const BASE_JUMP_RANGE = 5;
export const BASE_ENGINE_SPEED = 2;
export const BASE_COMM_RANGE = 100;
export const BASE_SCANNER_LEVEL = 1;
```

### `shipCalculator.ts`
- `HULLS[hullType]`-Lookup durch obige Basis-Konstanten ersetzen
- `hullType`-Parameter aus `calculateShipStats()` entfernen

### `calcHyperjumpFuelV2()` (`jumpCalc.ts`)
- `hullMultiplier`-Parameter entfernen
- Intern immer `1.0` verwenden

### DB-Migration `060_drop_hull_type.sql`

```sql
ALTER TABLE ships DROP COLUMN IF EXISTS hull_type;
```

### Betroffene Server-Dateien

| Datei | Änderung |
|-------|----------|
| `SectorRoom.ts` | `clientHullTypes`-Map entfernen, `createShip()` ohne hullType |
| `ServiceContext.ts` | `clientHullTypes`-Feld entfernen |
| `NavigationService.ts` | `HULL_FUEL_MULTIPLIER`-Import + `hullMult`-Variable entfernen |
| `ShipService.ts` | `calculateShipStats()`-Aufrufe ohne hullType |
| `CombatService.ts` | `clientHullTypes.set()` entfernen |
| `autopilot.ts` | `getHullTypeFromStats()` löschen |
| `permadeathService.ts` | `hull_type` aus INSERT entfernen |
| `queries.ts` | `hull_type` aus allen SELECT/INSERT entfernen, `hullType`-Param aus `createShip()` |
| `adminQueries.ts` | `hull_type` aus Query + Rückgabe entfernen |

### Betroffene Client-Dateien

| Datei | Änderung |
|-------|----------|
| `gameSlice.ts` | `hullType`-Feld aus `ClientShipData` entfernen |
| `ShipBlock.tsx` | `HULLS`-Import + Hull-Info-Anzeige entfernen |
| `ShipDetailPanel.tsx` | `HULLS[ship.hullType]?.slots` → `BASE_MODULE_SLOTS` |
| `ShipStatusPanel.tsx` | Hull-Name-Anzeige entfernen |
| `NavTargetPanel.tsx` | `HULLS.scout.baseFuelPerJump` → `BASE_FUEL_PER_JUMP` |

### Test-Anpassungen

| Datei | Änderung |
|-------|----------|
| `fuelRework.test.ts` | `HULL_FUEL_MULTIPLIER` → hardcoded `1.0` |
| `jumpCalc.test.ts` | Hull-`baseEngineSpeed`-Tests löschen |
| `shipCalculatorAcep.test.ts` | `HULLS['scout'].baseCargo` → `3` |
| `shipLookup.test.ts` | Datei löschen (testet nur Hull-Definitionen) |
| `farNav.test.ts` | `HULLS.scout/freighter` → Konstanten |
| `fuel.test.ts` | `HULLS.scout/explorer` → Konstanten |
| Server-Test-Mocks | `clientHullTypes: new Map()` aus allen Mock-ServiceContexts entfernen |

---

## 4. Fuel-UI

### ShipStatusPanel — Stats-Tab

**Vorher:** `FUEL: 6432/17000` als Text-Row

**Nachher:**

```
FUEL
TANK    6.432 / 17.000
[████████░░░░░░░░░░░░░]   ← orangener Gradient, 4px hoch
COST/SEKTOR   75  (100 -25)
```

- Bar-Farbe: Orange-Gradient (`#f97316` → `#fb923c`)
- `COST/SEKTOR` zeigt effektiven Wert + Reduktions-Delta in Klammern (nur wenn Reduktion > 0)
- Wert kommt aus `ship.stats.fuelPerJump` (bereits im Stats-Objekt vorhanden)

### NavTargetPanel

- `HULLS.scout.baseFuelPerJump` → `ship?.stats?.fuelPerJump ?? BASE_FUEL_PER_JUMP`
- Fuel-Kosten-Anzeige: grün wenn `fuel.current >= estimatedFuel`, rot wenn nicht

### Modul-Detail (Drive)

Keine Änderung nötig. `fuelMax`-Stat wird bereits als `secondaryEffect` mit Label `'Fuel-Tank +X.XXX'` angezeigt.

---

## Nicht in diesem Scope

- FACTORY-Schiffs-Modul → eigenes Issue/Spec
- S-Bahn-Plan-UI für Jumpgates → eigenes Issue
- Stationsproduktion GAS → Playtest-Issue #299, dann ggf. Fixes
- Hull-System komplett aus UI entfernen (ShipDesigner-Legacy-Screens) → Issue #297

---

## Abhängigkeiten

- `packages/shared` nach Änderungen neu builden: `cd packages/shared && npm run build`
- Migration 060 läuft automatisch beim Server-Start

---

## Akzeptanzkriterien

- [ ] Hyperjump funktioniert ohne Feature-Flag (immer aktiv)
- [ ] Fuel-Kapazität = 10.000 + Drive-Bonus (kein Hull-Multiplier)
- [ ] `hull_type`-Spalte in DB weg (Migration 060 erfolgreich)
- [ ] Keine Referenzen auf `HullType`, `HULLS`, `HULL_FUEL_MULTIPLIER` im Code
- [ ] Fuel-Bar im ShipStatusPanel sichtbar
- [ ] COST/SEKTOR zeigt effektiven Wert
- [ ] NavTargetPanel zeigt Fuel-Kosten farbig (grün/rot)
- [ ] Alle Tests grün (~973 Server, ~499 Client, ~205 Shared)
