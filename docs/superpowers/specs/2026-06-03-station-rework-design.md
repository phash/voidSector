# Station Rework (#548) + Stations-Minenschiffe (#549)

**Datum:** 2026-06-03 · **Branch:** `feat/station-rework` · **Status:** Design genehmigt

## Ziel

Spieler-Stationen sollen durch **Betrieb (Handel) automatisch wachsen** und über
vom Spieler gebrachte **Rohstoffe** neue, sinnvolle **Erweiterungen** selbst bauen
(#548). Stationen mit **Werft + Markt** bauen eigene **Minenschiffe**, die sichtbar
zu Abbau-Sektoren fliegen, ernten, ins Stationslager liefern und automatisch für
Credits verkaufen (#549).

Umsetzung in **zwei Phasen, ein Spec**: Phase 1 = #548 (Erweiterungssystem,
Betrieb-Wachstum, Kosten-Review). Phase 2 = #549 (Stations-Minenschiffe).

## Quelle (Issues)

- **#548:** Review der Bau- und Ausbaukosten; Handel schaltet Erweiterungen frei;
  mehr Betrieb → grössere Station; sinnvolle Erweiterungen; Station baut selbst,
  Spieler bringen Rohstoffe.
- **#549:** Station baut nach Werft+Markt eigene Minenschiffe, die visuell zu
  Abbau-Locations fliegen und Rohstoffe ernten.

## Entscheidungen (aus Brainstorming)

- Ein Spec, zwei Phasen, beide diese Session.
- Erweiterungen: **Markt, Werft, Raffinerie, Sensor/Abwehr** (neu) zusätzlich zu
  **Fabrik + Lager** (existieren).
- Wachstum: **Handelsvolumen → Stations-Stufe** (wie NPC-Stationen); Stufe deckelt
  Erweiterungen; Rohstoffe = Baukosten der Erweiterungen.
- Minenschiffe: **liefern ins Lager + Markt verkauft automatisch** (passives
  Einkommen); wenige je Werft-Stufe; nur Spieler-Stationen ticken (OOM-sicher).

## Bestandsaufnahme (verifiziert)

- `player_stations`: `level` (1–5), `factory_level`, `cargo_level` (0–5),
  `cargo_contents` JSONB (**bisher ungenutzt**). Bau via Construction-Site
  (`WorldService.ts` Build/Upgrade-Handler), Tick `constructionTickService.ts`.
- Stufen-Upgrade kostet aktuell `STATION_BUILD_COSTS` (cr/Kristall/Artefakt);
  Modul-Upgrade `STATION_MODULE_UPGRADE_COST(level)=200·level²`.
- **Kein** Betrieb/Trade-Tracking für Spieler-Stationen (NPC-Stationen haben
  `trade_volume`/`xp`/Level — Muster wird übernommen).
- Minenschiff-Zustandsmaschine existiert komplett (`civShipService.ts`:
  idle→exploring→traveling→mining→returning, Spiralsuche, Lieferung) — aber
  **global deaktiviert wegen OOM** (8 000 Alien-Stationen, 24k+ Schiffe/Tick,
  #512/#513). Radar-Rendering der Drohnen (`○`) existiert
  (`RadarRenderer.ts`, `civ_ships_tick`-Channel).
- `SECTOR_RESOURCE_YIELDS`: asteroid_field→ore, nebula→gas, anomaly→crystal;
  Mining depletet Sektoren nicht.

---

# Phase 1 — Erweiterungssystem (#548)

## P1.1 Datenmodell — Migration 087

`player_stations` erhält:

```sql
ALTER TABLE player_stations
  ADD COLUMN IF NOT EXISTS trade_volume   BIGINT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markt_level    INTEGER NOT NULL DEFAULT 0 CHECK (markt_level    BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS werft_level    INTEGER NOT NULL DEFAULT 0 CHECK (werft_level    BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS refinery_level INTEGER NOT NULL DEFAULT 0 CHECK (refinery_level BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS sensor_level   INTEGER NOT NULL DEFAULT 0 CHECK (sensor_level   BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS building_expansion TEXT,            -- one of STATION_EXPANSION_TYPES, NULL = idle
  ADD COLUMN IF NOT EXISTS build_complete_at  TIMESTAMPTZ;     -- when the current build finishes
```

`factory_level`/`cargo_level` bleiben (Bestandscode). Alle sechs Erweiterungen
heissen einheitlich über `STATION_EXPANSION_TYPES`.

## P1.2 Betrieb → Stufe (automatisches Wachstum)

- Neue Konstante `STATION_TIER_THRESHOLDS = [0, 1000, 4000, 12000, 30000]`
  (Index = Stufe−1; benötigtes `trade_volume`).
- Pure Funktion `stationTierForVolume(volume) → 1..5` (höchste Stufe, deren
  Schwelle ≤ Volumen).
- Nach **jedem Markt-Handel** und nach **Auto-Verkauf** (Phase 2) wird
  `level = max(level, stationTierForVolume(trade_volume))` neu gesetzt
  (Stufe sinkt nie). Kein Credits-Kostenupgrade mehr → der bisherige
  „Stufe-kaufen"-Handler entfällt.
- `STATION_BUILD_COSTS[1]` (500 cr / 5 Kristall / 1 Artefakt) bleibt für den
  **initialen Bau**. `STATION_BUILD_COSTS[2..5]` werden für Upgrades nicht mehr
  genutzt (bleiben als Referenz, oder entfernt).

## P1.3 Erweiterungen & Effekte

| Typ (`STATION_EXPANSION_TYPES`) | Effekt |
|---|---|
| `factory` (existiert) | Modul-/Item-Produktion (FABRIK), unverändert |
| `cargo` (existiert) | Lagerkapazität für `cargo_contents`; jetzt aktiv genutzt (Deposit/Mining/Markt). Kapazität `CARGO_BASE + cargo_level·CARGO_PER_LEVEL` |
| `markt` (neu) | Kauf/Verkauf von Rohstoffen an der eigenen Station; jede Transaktion erhöht `trade_volume`. Höhere Stufe → besserer Spread (`MARKT_SPREAD_PER_LEVEL`) |
| `werft` (neu) | Schaltet Phase 2 frei; Cap Minenschiffe = `werft_level` (1 je Stufe, max 5) |
| `refinery` (neu) | Erweitert `gas→fuel` (Faktor je Stufe) **und** wandelt gelagertes Erz/Kristall pro Tick in Credits-Trickle (`REFINERY_CREDITS_PER_TICK·level`) an den Besitzer |
| `sensor` (neu) | +`sensor_level` Scan-Reichweite im Stationsquadranten (deckt nahe Sektoren auf) und −`SENSOR_PIRATE_REDUCTION·level` Piraten-Chance im Stationssektor |

## P1.4 Kosten-Review (rohstoff-zentriert)

`STATION_EXPANSION_COSTS: Record<ExpansionType, BaseCost>` mit
`expansionCost(type, targetLevel)` = jedes Feld × `targetLevel`:

| Typ | Erz | Gas | Kristall | Credits | Artefakt |
|---|---|---|---|---|---|
| factory | 20 | 10 | 15 | 200 | 0 |
| cargo | 30 | 5 | 5 | 100 | 0 |
| markt | 15 | 20 | 10 | 300 | 0 |
| werft | 40 | 20 | 25 | 400 | 2 |
| refinery | 25 | 30 | 10 | 250 | 0 |
| sensor | 20 | 15 | 20 | 250 | 1 |

(× Zielstufe). `STATION_EXPANSION_BUILD_TIME_MS(targetLevel) = 60_000 · targetLevel`.

## P1.5 Bau-Mechanik (Station baut selbst, Spieler bringt Rohstoffe)

- Server-Message `buildStationExpansion { stationId, expansionType }`:
  1. Spieler muss am Stationssektor sein und Besitzer.
  2. Zielstufe = aktuelle Stufe der Erweiterung + 1; muss ≤ Stations-Stufe sein
     (Tier-Gate) und ≤ 5.
  3. Station darf nicht bereits bauen (`building_expansion IS NULL`).
  4. Kosten `expansionCost(type, ziel)` werden vom **Spieler** abgezogen (Credits
     vom Konto; Erz/Gas/Kristall/Artefakt aus Schiffs-Cargo/Inventar). Fehlt etwas
     → `{ code, message }` Fehler.
  5. `building_expansion = type`, `build_complete_at = now + BUILD_TIME`.
- `constructionTickService` (läuft je Universe-Tick) schliesst fällige Builds ab:
  `<type>_level += 1`, `building_expansion = NULL`, `build_complete_at = NULL`.
- Eine Erweiterung gleichzeitig pro Station (Sequenzierung, einfach & überschaubar).

## P1.6 Markt-Handel

- Server-Message `stationMarketTrade { stationId, action: 'buy'|'sell', resource, amount }`:
  - Voraussetzung: `markt_level ≥ 1`, Spieler am Sektor.
  - Preise: `NPC_PRICES[resource]` mit Spread, der sich je `markt_level` zugunsten
    des Spielers verbessert (`MARKT_SPREAD_PER_LEVEL`).
  - `sell`: Rohstoff aus Schiffs-Cargo → Stationslager (Cap durch `cargo_level`),
    Credits an Spieler. `buy`: Stationslager → Schiff, Credits vom Spieler.
  - `trade_volume += round(amount · NPC_PRICES[resource])`; danach Stufe neu
    berechnen (P1.2).

## P1.7 Server-Struktur (neue/erweiterte Units)

- `engine/stationExpansionService.ts` (neu): pure Helfer — `stationTierForVolume`,
  `expansionCost`, `canBuildExpansion`, `cargoCapacity(cargo_level)`.
- `db/stationQueries.ts`: Queries für neue Spalten, Build-Setzen/-Abschluss,
  `trade_volume`-Update, Lager-Mutation.
- `rooms/services/WorldService.ts` (oder neues `StationService`): Handler
  `buildStationExpansion`, `stationMarketTrade`. Bestehenden „Stufe kaufen"-Handler
  entfernen.
- `engine/constructionTickService.ts`: Erweiterungs-Build-Abschluss.
- Raffinerie-Tick: in `stationFuelEngine.ts` / Stationsproduktion integrieren.
- Sensor: Lesen von `sensor_level` in Scan-/Piraten-Logik.

## P1.8 UI

`StationManagePanel.tsx`: Stufe + **Betrieb-Balken** (`trade_volume` vs nächste
Schwelle); Erweiterungs-Liste (Stufe, „Bauen (Rohstoffe)"-Button mit Kostenanzeige,
laufender Bau-Timer, Tier-Gate-Hinweis). Neuer **Markt-Tab** (Kauf/Verkauf,
Lagerbestand, Preise). Werft-Tab zeigt Minenschiff-Status (Phase 2).
**HelpSlice** `first_station_expansions` + `[?]`-Button (Pflicht laut CLAUDE.md).

## P1.9 Tests (TDD)

- `stationTierForVolume`: Schwellen-Grenzfälle.
- `expansionCost`: Skalierung je Stufe/Typ.
- Build-Handler: Tier-Gate (Zielstufe > Stufe → Fehler), Rohstoff-Abzug, „baut
  bereits"-Sperre, Bau-Timer gesetzt; Tick schliesst ab und erhöht Stufe.
- Markt: Verkauf erhöht `trade_volume` und (bei Schwelle) die Stufe; Lager-Cap;
  Credits-Bewegung.
- `cargoCapacity` skaliert mit `cargo_level`.

---

# Phase 2 — Stations-Minenschiffe (#549)

## P2.1 Voraussetzung & Cap

- Benötigt `werft_level ≥ 1` (Bauen) und `markt_level ≥ 1` (Auto-Verkauf).
- Schiff-Cap je Station = `werft_level` (1 je Stufe, max 5),
  `STATION_MINING_SHIPS_PER_WERFT_LEVEL = 1`.

## P2.2 Datenmodell — Tabelle `station_mining_ships`

```sql
CREATE TABLE IF NOT EXISTS station_mining_ships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id        UUID NOT NULL REFERENCES player_stations(id) ON DELETE CASCADE,
  owner_id          UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  x                 INTEGER NOT NULL,
  y                 INTEGER NOT NULL,
  home_x            INTEGER NOT NULL,
  home_y            INTEGER NOT NULL,
  state             TEXT NOT NULL DEFAULT 'idle',
  target_x          INTEGER,
  target_y          INTEGER,
  spiral_step       INTEGER NOT NULL DEFAULT 0,
  resources_carried INTEGER NOT NULL DEFAULT 0,
  mined_resource    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_station_mining_ships_station ON station_mining_ships(station_id);
```

`resetWorld.ts` → `WORLD_RESET_TABLES` um `station_mining_ships` ergänzen
(zusätzlich greift bereits der `player_stations`-CASCADE).

## P2.3 Engine — `engine/stationMiningService.ts` (neu)

- Zustandsmaschine analog `civShipService` (idle→exploring→traveling→mining→
  returning), adaptiert auf `station_mining_ships`:
  - Zielwahl: Spiralsuche ab Station nach Sektor mit `SECTOR_RESOURCE_YIELDS > 0`
    (Erz/Gas/Kristall je Sektortyp), `CIV_SPIRAL_MAX_STEPS` Limit.
  - Ernte: `resources_carried` bis `STATION_MINING_TICKS_TO_FULL`, dann `returning`.
  - Lieferung daheim (eindeutige Regel):
    - **Mit `markt_level ≥ 1`**: geerntete Rohstoffe werden **sofort auto-verkauft**
      → Credits an Besitzer + `trade_volume += wert` + Stufe neu (P1.2). Passives
      Einkommen ist das Kernfeature von #549.
    - **Ohne Markt**: Rohstoffe gehen ins Stationslager (`cargo_contents`, Cap durch
      `cargo_level`); bei vollem Lager geht der Überschuss verloren (kein Verkauf).
- `spawnMissingStationMiningShips()`: pro Station bis `werft_level` Schiffe anlegen.
- `processStationMiningTick()`: lädt **nur** `station_mining_ships` (wenige Dutzend),
  Spawn + ein Zustandsschritt je Schiff. **Kein** Laden der NPC-civ-Schiffe.

## P2.4 OOM-Sicherheit

- Getrennte Tabelle/Service nur für Spieler-Stationen; Anzahl ≈ Stationen ×
  Werft-Stufe (≤ wenige Dutzend bei wenigen Spielern). Globaler Tick bleibt
  beschränkt. Der deaktivierte NPC-`processCivTick`/`spawnMissingDrones` bleibt
  deaktiviert (#512/#513 unverändert).
- Verdrahtung in `universeBootstrap.ts` Engine-Callback: `processStationMiningTick()`
  je Tick (leichtgewichtig).

## P2.5 Client-Rendering

- Minenschiffe pro Quadrant an den Client senden (bestehender `civ_ships_tick`-
  Channel oder neuer `station_ships_tick`), Rendering als Drohne (`○`) im
  `RadarRenderer` wiederverwenden. Nur Quadranten mit aktivem Raum erhalten Updates.

## P2.6 Tests (TDD)

- Zustandsmaschine: Zielwahl findet Rohstoff-Sektor; Ernte füllt bis Voll; Lieferung
  erhöht Stationslager; Auto-Verkauf erhöht Credits + `trade_volume`.
- Cap: nicht mehr Schiffe als `werft_level`.
- OOM: `processStationMiningTick` lädt ausschliesslich Spieler-Stations-Schiffe.

---

## Build & Rollout

1. Nach `shared`-Änderung: `cd packages/shared && npm run build` (Pflicht).
2. `cd packages/server && npx vitest run` · `cd packages/shared && npx vitest run`.
3. Migration 087 läuft automatisch beim Server-Start.

## Risiken / Offene Punkte

- **Sensor-Scan-Integration**: genaue Einbindung von `sensor_level` in die
  bestehende Scan-Reichweite in der Implementierung verifizieren.
- **Raffinerie**: exakte Verzahnung mit `stationFuelEngine` in der Umsetzung prüfen.
- **Markt-„Betrieb" bei wenigen Spielern**: Schwellen ggf. nachjustieren, falls
  Wachstum zu langsam/schnell (Konstanten zentral, leicht änderbar).
- **Client-Channel** für Minenschiffe: `civ_ships_tick` wiederverwenden vs. neuer
  Channel — in der Umsetzung anhand des bestehenden Bus festlegen.
