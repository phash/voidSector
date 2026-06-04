# Station Rework — two deferred #548 sub-effects

**Datum:** 2026-06-04 · **Branch:** `feat/station-subeffects` · **Status:** Design genehmigt

## Ziel

Die zwei beim #548-Phase-1-Launch zurückgestellten Erweiterungs-Sub-Effekte fertig
umsetzen:

1. **Raffinerie gas→fuel** + Auftanken an der eigenen Station.
2. **Sensor** Piraten-Reduktion (`pirate_ambush`-Scan-Event).

## Hintergrund (warum zurückgestellt)

Die wörtliche Spec-Formulierung aus P1.3 passte nicht sauber auf die echten Mechaniken:
- Spieler-Stationen haben **kein Treibstofflager**; „an Station auftanken" liest nur
  NPC-Bestände (`npc_station_inventory` via `getStationFuelAndGas`). gas→fuel brauchte
  ein Ziel + Konsumenten.
- Piraten sind **deterministische** `pirate_zone`-Worldgen-Inhalte, und eine Spieler-
  Station steht nur in `empty`-Sektoren → „Piraten-Chance im Stationssektor senken" greift
  nicht. Realer Zufalls-Hook: der `pirate_ambush`-Scan-Event (`scanEvents.ts`, weight 0.4,
  immediate; geprüft in `ScanService`).

Der Sensor-Scan-Reichweiten-Bonus wurde bereits in Phase 1 umgesetzt (`stationPassiveEffects.sensorScanBonus` + `ScanService.handleAreaScan`).

## Entscheidungen (Brainstorming)

- Raffinerie: **Gas→Fuel + Auftanken an eigener Station** (Besitzer, kostenlos; Besucher-
  zahlen-Credits zurückgestellt).
- Sensor: **`pirate_ambush`-Chance senken** (zusätzlich zum bestehenden Scan-Bonus).
- Conversion-Raten + Reduktion wie unten (genehmigt).

---

## Teil 1 — Raffinerie gas→fuel + Auftanken

### 1.1 Konstanten (`packages/shared/src/constants.ts`)
```typescript
export const REFINERY_GAS_PER_TICK = 1;     // Gas pro Tick je Raffinerie-Stufe
export const REFINERY_FUEL_PER_GAS = 100;   // Fuel je verbrauchtem Gas
export const REFINERY_FUEL_MAX = 20000;     // Cap für cargo_contents.fuel an einer Station
```

### 1.2 Pure Helper (`packages/server/src/engine/stationPassiveEffects.ts`)
`refineGasToFuel(cargo: Record<string, number>, refineryLevel: number)` → neues Cargo-Objekt:
- `gasToConsume = min(cargo.gas ?? 0, REFINERY_GAS_PER_TICK * refineryLevel)`
- begrenzt durch verbleibenden Fuel-Cap: `fuelRoom = REFINERY_FUEL_MAX - (cargo.fuel ?? 0)`,
  `actualFuel = min(gasToConsume * REFINERY_FUEL_PER_GAS, fuelRoom)`,
  `actualGas = ceil(actualFuel / REFINERY_FUEL_PER_GAS)` (nie mehr Gas als nötig).
- Liefert `{ ...cargo, gas: gas - actualGas, fuel: (cargo.fuel ?? 0) + actualFuel }`.
- `refineryLevel === 0` oder kein Gas → unverändertes (kopiertes) Cargo.
- Pure, kein DB, immutable Kopie.

### 1.3 Tick-Integration (`packages/server/src/engine/stationBuildTick.ts`)
Die Phase-1-Raffinerie-Schleife (Credits-Trickle, `getAllPlayerStationsWithRefinery`) bleibt.
Zusätzlich: eine Query liefert Stationen mit `refinery_level > 0` inkl. `id` + `cargo_contents`;
für jede `refineGasToFuel(cargo, level)` berechnen und bei Änderung `updateStationCargo(id, newCargo)`.
Neue Query in `stationQueries.ts`:
`getRefineryStationsWithCargo()` → `{ id, refinery_level, cargo_contents }[]` WHERE refinery_level > 0.
(Der bestehende `getAllPlayerStationsWithRefinery` für den Credits-Trickle kann durch diese
erweiterte Query ersetzt werden, um eine doppelte Abfrage zu vermeiden — beide laufen über
dieselbe Stationsmenge.)

### 1.4 Auftanken an eigener Station (`EconomyService`, Refuel-Handler)
Der bestehende Refuel-Handler (`EconomyService.handleRefuel`) liest `getStationFuelAndGas(sx, sy)`
(NPC-Bestand) und **blockiert vorher per Gate `_pst(sid) === 'station'`**. Spieler-Stations-Sektoren
haben aber **nicht** den Typ `'station'` (nichts setzt `sectors.type='station'` beim Spieler-Stationsbau).
Daher muss das Gate erweitert werden: Refuel auch zulassen, wenn am Sektor eine **eigene** Station steht.
Erweitern:
- Zuerst prüfen, ob am aktuellen Sektor eine **Spieler-Station des Anfragenden** steht
  (`getPlayerStationAt(sx, sy)` mit `owner_id === auth.userId`) und `cargo_contents.fuel > 0`.
  Das Gate `_pst === 'station'` so anpassen, dass es ODER „eigene Station hier" akzeptiert.
- Wenn ja: Schiff aus dem Stations-Fuel auftanken — `amount = min(tankSpace, station.cargo_contents.fuel)`,
  Schiff-Fuel erhöhen (`saveFuelState`), `cargo_contents.fuel -= amount` (`updateStationCargo`),
  **keine Credits**. Ergebnis an Client (`refuelResult { success, ... }`) + cargo/fuel-Updates.
- Wenn keine eigene Station mit Fuel: unveränderter Fallback auf die bestehende
  NPC-Stations-Auftank-Logik.
- Pure Helfer wo sinnvoll (`stationRefuelAmount(tankSpace, stationFuel)` = `min`), Rest im Handler.

### 1.5 Tests
- `refineGasToFuel`: Stufe-0 no-op; konvertiert `level*1` Gas → `*100` Fuel; respektiert
  vorhandenes Gas (weniger Gas als Rate); respektiert Fuel-Cap (kein Überlauf, kein Gas-Verbrauch
  über Bedarf); immutable.
- Refuel-Handler-Entscheidung (pure `stationRefuelAmount` + ein Handler-Pfad-Test mit Mocks):
  Besitzer mit Stations-Fuel tankt kostenlos und reduziert Stations-Fuel; ohne eigene Station /
  ohne Fuel → Fallback (kein Stations-Fuel-Abzug).

---

## Teil 2 — Sensor: pirate_zone-Kampf optional machen

**Korrektur (in der Planung entdeckt):** Der `pirate_ambush`-Scan-Event ist nur eine
**Warnmeldung** (`ScanService.ts:408-411`, „combat V3 triggers on sector entry"). Der echte
Piratenkampf ist der **Auto-Kampf beim Betreten eines `pirate_zone`-Sektors**
(`SectorRoom` moveSector/jump, ~Z. 427/481: `if contents.includes('pirate_zone') → combatV3Start`).
Den richtigen, spürbaren Sensor-Nutzen liefert daher: im **Quadranten der eigenen Sensor-Station**
wird der Auto-Kampf beim Betreten einer pirate_zone mit Wahrscheinlichkeit
`min(MAX, PER_LEVEL·level)` **nicht erzwungen** — der Spieler wird gewarnt und darf **selbst
entscheiden**: angreifen (bestehender `combatV3Start`) oder ausweichen (weiterfliegen). Ohne Sensor
bzw. wenn der Roll nicht greift, startet der Kampf wie bisher automatisch.

### 2.1 Konstanten (`packages/shared/src/constants.ts`)
```typescript
export const SENSOR_PIRATE_REDUCTION_PER_LEVEL = 0.15; // 15 % je Sensor-Stufe
export const SENSOR_PIRATE_REDUCTION_MAX = 0.9;        // max 90 %
```

### 2.2 Pure Helper (`packages/server/src/engine/stationPassiveEffects.ts`)
`pirateCombatAvoidable(sensorLevel: number, roll: number): boolean`:
- `chance = Math.min(SENSOR_PIRATE_REDUCTION_MAX, SENSOR_PIRATE_REDUCTION_PER_LEVEL * sensorLevel)`
- liefert `roll < chance` (true = Auto-Kampf wird übersprungen, Spieler entscheidet). `sensorLevel <= 0` → immer false.

### 2.3 Query (`packages/server/src/db/stationQueries.ts`)
`getPlayerSensorLevelInQuadrant(ownerId, qx, qy)` → höchstes `sensor_level` einer eigenen Station,
deren Sektor in Quadrant (qx,qy) liegt (`sector_x/sector_y` → `sectorToQuadrant`); 0 wenn keine.

### 2.4 Hook (`packages/server/src/rooms/SectorRoom.ts`)
An den beiden Stellen, wo bei pirate_zone-Eintritt der Auto-Kampf gestartet wird (moveSector ~Z.427,
jump ~Z.481): vor `combatV3Start` prüfen, ob der Spieler eine Sensor-Station (`sensor_level>0`) im
aktuellen Quadranten besitzt; wenn ja und `pirateCombatAvoidable(level, Math.random())` true →
**Auto-Kampf NICHT starten**, stattdessen Hinweis senden (`logEntry`: „Sensor-Array hat die
Piratenzone früh erkannt — du kannst angreifen oder ausweichen."). Der Spieler kann weiterhin per
bestehendem `combatV3Start` selbst angreifen. Sonst: Auto-Kampf wie bisher.

### 2.5 Tests
- `pirateCombatAvoidable`: Stufe 0 → nie; skaliert mit Stufe; Cap 0.9; deterministisch je `roll`
  (level 3 → chance 0.45: roll 0.4 → true, roll 0.5 → false).
- Der SectorRoom-Hook wird pragmatisch über den pure Helper + die Query abgedeckt; der genaue
  Auto-Kampf-Einsprungpunkt wird in der Umsetzung verifiziert (zwei Call-Sites).

---

## Build & Rollout
1. Nach `shared`-Änderung: `cd packages/shared && npm run build` (Pflicht).
2. `cd packages/server && npx vitest run` · `cd packages/shared && npx vitest run`.
3. Keine Migration nötig (Fuel liegt in bestehendem `cargo_contents` JSONB; Sensor nutzt
   bestehende Spalten).

## Risiken / Offene Punkte
- **Refuel-Handler-Struktur**: genaue Einbindung des Eigene-Station-Pfads in der Umsetzung
  am realen Handler verifizieren (Reihenfolge ggü. NPC-Pfad, Schiff-Tank-Berechnung,
  `saveFuelState`-Signatur).
- **Scan-Event-Hook**: exakter Punkt der `pirate_ambush`-Auslösung in `ScanService` in der
  Umsetzung verifizieren (immediate vs. completeScanEvent); nur den Spieler-eigenen Scan betreffen,
  keine Remote-/Area-Scan-Pfade, die ohnehin keinen physischen Ambush auslösen.
- **Besucher-Auftanken** (zahlen Credits an Besitzer) ist bewusst zurückgestellt.
