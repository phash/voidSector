# Economy Overhaul — Design Document

**Datum:** 2026-03-04
**Status:** Entwurf
**Phase:** Economy 2.0 — Spielergetriebene Wirtschaft

---

## 0. Vision & Ziele

Das bestehende Wirtschaftssystem ist zu simpel: NPC-Stationen kaufen und verkaufen zu fixen Preisen ohne Lagerlogik, Spielerhandel existiert als Rohstoff-Marktplatz, aber Produktion und automatisierter Handel sind rudimentär.

**Ziel:** Eine mehrstufige, spielergetriebene Wirtschaft, die:
- **Credits primär durch Spielerhandel zirkulieren lässt**
- Credits durch NPC-Handel und Quests ins Spiel einspeist (Quelle)
- Credits durch Upgrades, Bauten und Forschung aus dem Spiel abzieht (Senke)
- NPC-Stationen als realistische Marktakteure mit begrenztem Lagerbestand modelliert
- Spielerproduktion an Basen als alternativen Einkommensweg ermöglicht
- Automatisierten Handel über Frachtschiffe und Handelsnetzwerke unterstützt

---

## 1. Kreditsystem — Geldfluss

### 1.1 Credit-Quellen (Geld kommt ins Spiel)

| Quelle | Menge | Anmerkung |
|---|---|---|
| NPC-Station kauft Ressourcen vom Spieler | mittel | Begrenzt durch Stationslager |
| NPC-Station kauft produzierte Güter | hoch | Nur höherstufige Stationen |
| Quests abschließen | mittel | Bestehend, bereits implementiert |
| NPC-Slate-Buyback | gering | Bestehend |
| Survivor-Lieferung | gering | Bestehend |
| Piraten-Loot | gering | Bestehend |

### 1.2 Credit-Senken (Geld verlässt das Spiel)

| Senke | Menge | Anmerkung |
|---|---|---|
| NPC-Station: Ressourcen kaufen | mittel | Spieler kauft von NPC |
| Strukturen bauen & upgraden | hoch | Bestehend + neue Strukturen |
| Forschung (Research Lab) | hoch | Neu |
| Schiff-Upgrades / Module | mittel | Bestehend |
| Kraftstoff | gering | Bestehend, 2 cr/unit |
| Stationsreparatur | gering | Bestehend |
| Kontor-Kaufaufträge | mittel | Neu — Spieler deponiert Budget |
| Automatisierte Handelsschiffe | hoch | Neu — Betriebskosten |

### 1.3 Inflationsschutz

- NPC-Stationen haben **begrenzte Kaufkapazität** pro Zyklus (verhindert Credit-Farming durch Massen-Dumps)
- Produzierte Güter haben sinkende NPC-Preise je mehr Spieler sie anbieten (dynamische NPC-Preise, optional Phase 2)
- Hochwertige Forschungsrezepte sind teuer (dauerhafte Credit-Senke)

---

## 2. NPC-Stationen — Lagerbestand & Wachstum

### 2.1 Konzept

NPC-Stationen sind keine unbegrenzten Händler mehr. Jede Station hat:
- Einen **begrenzten Lagerbestand** pro Ressourcentyp
- Eine **Verbrauchsrate** (Station "nutzt" Ressourcen simuliert)
- Eine **Auffüllrate** (organische Nachlieferung)
- Ein **Stationslevel**, das durch Spielerinteraktionen wächst

### 2.2 Stationslevel

| Level | Name | Max-Lager | XP-Schwelle | Besonderheiten |
|---|---|---|---|---|
| 1 | Outpost | 200 units | 0 | Nur Rohstoffe (ore/gas/crystal) |
| 2 | Station | 500 units | 500 XP | + kauft einfache Verarbeitungsgüter |
| 3 | Hub | 1.200 units | 2.000 XP | + verkauft Schiffsmodule Tier 1–2, kauft alle Verarbeitungsgüter |
| 4 | Port | 3.000 units | 6.000 XP | + verkauft Module Tier 3, spezielle Güter |
| 5 | Megastation | 8.000 units | 15.000 XP | Alles verfügbar, beste Preise, Marktpreisbonus |

**XP-Quellen:**
- Spieler dockt an Station: +5 XP
- Spieler kauft/verkauft an Station: +1 XP pro gehandelter Einheit
- Spieler übergibt Quest an Station: +15 XP

**XP-Decay:** Stationen verlieren 1 XP/Stunde wenn keine Aktivität (bis Mindest-XP des aktuellen Levels). Verhindert Level-Farming ohne nachhaltige Nutzung.

### 2.3 Lagerbestand-Modell

Jede Station hat pro Ressource:
- `stock`: Aktueller Bestand (0 .. `max_stock`)
- `max_stock`: Bestimmt durch Stationslevel + Ressourcentyp-Gewichtung
- `consumption_rate`: Einheiten pro Stunde, die die Station "verbraucht" (simuliert NPC-Nachfrage)
- `restock_rate`: Einheiten pro Stunde, die organisch nachkommen
- `last_updated`: Zeitstempel der letzten Berechnung

**Berechnung ist lazy** (wie das AP-System): Stock wird on-demand berechnet, nicht durch Server-Tick:

```
elapsed_hours = (now - last_updated) / 3_600_000
raw_stock = stock - (consumption_rate * elapsed_hours) + (restock_rate * elapsed_hours)
current_stock = clamp(raw_stock, 0, max_stock)
```

**Ressourcen-Gewichtungen pro Stationslevel (Beispiel):**

| Ressource | Level 1 max | Level 3 max | Level 5 max |
|---|---|---|---|
| ore | 80 | 400 | 2.500 |
| gas | 60 | 350 | 2.000 |
| crystal | 40 | 200 | 1.500 |
| fuel_cell | — | 150 | 800 |
| circuit_board | — | 100 | 600 |
| alloy_plate | — | 120 | 700 |
| void_shard | — | — | 200 |

### 2.4 Preissystem

NPC kauft Ressourcen vom Spieler (Spieler verkauft): NPC zahlt `base_price * NPC_SELL_SPREAD * station_modifier`
NPC verkauft an Spieler (Spieler kauft): Spieler zahlt `base_price * NPC_BUY_SPREAD * station_modifier`

**station_modifier:** Senkt Preise (Gunst) oder erhöht sie (Knappheit):
- Stock > 70% max: Kaufpreis −10% (Station ist gut gefüllt, zahlt weniger)
- Stock < 20% max: Kaufpreis +20% (Knappheit, Station zahlt mehr beim Einkauf)
- Stock = 0: Station kauft gar nicht mehr (kein Platz für weiteres Selling)
- Stock = 0 beim NPC-Verkauf: nicht verfügbar ("OUT OF STOCK")

**Ruf-Modifikatoren** bleiben wie bestehend (`REP_PRICE_MODIFIERS`).

### 2.5 DB-Schema

```sql
-- Migration 011
CREATE TABLE IF NOT EXISTS npc_station_data (
  station_x       INTEGER NOT NULL,
  station_y       INTEGER NOT NULL,
  level           INTEGER NOT NULL DEFAULT 1,
  xp              INTEGER NOT NULL DEFAULT 0,
  visit_count     INTEGER NOT NULL DEFAULT 0,
  trade_volume    INTEGER NOT NULL DEFAULT 0,
  last_xp_decay   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (station_x, station_y)
);

CREATE TABLE IF NOT EXISTS npc_station_inventory (
  station_x         INTEGER NOT NULL,
  station_y         INTEGER NOT NULL,
  item_type         VARCHAR(32) NOT NULL,  -- ResourceType | ProcessedItemType
  stock             INTEGER NOT NULL DEFAULT 0,
  max_stock         INTEGER NOT NULL DEFAULT 0,
  consumption_rate  REAL NOT NULL DEFAULT 0,  -- units/hour
  restock_rate      REAL NOT NULL DEFAULT 0,  -- units/hour
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (station_x, station_y, item_type)
);

CREATE INDEX IF NOT EXISTS idx_npc_station_inv_coords
  ON npc_station_inventory (station_x, station_y);
```

---

## 3. Spielerproduktion — Fabrik & Forschung

### 3.1 Neue Strukturtypen

Zwei neue `StructureType`-Werte:

```typescript
// Erweiterung von StructureType:
'factory'       // Produziert Verarbeitungsgüter aus Rohstoffen
'research_lab'  // Erforscht neue Rezepte und verbessert Produktion
```

### 3.2 Verarbeitungsgüter (ProcessedItemType)

```typescript
export type ProcessedItemType =
  | 'fuel_cell'      // ore(2) + gas(3)  → Treibstoffzellen, für NPC-Stationen / Refueling
  | 'circuit_board'  // crystal(2) + gas(2) → Schaltkreise, für Module / Stationen
  | 'alloy_plate'    // ore(3) + crystal(1) → Legierungsplatten, universal einsetzbar
  | 'void_shard'     // crystal(5) + gas(2) → Seltene Kristalle, hoher Wert
  | 'bio_extract'    // gas(4) + crystal(1) → Bioextrakt, Wissenschaftler-Fraktion
```

### 3.3 Fabrik-Mechanik

- **Baukosten:** `ore: 40, gas: 20, crystal: 15` + 20 AP
- **Betrieb:** Fabrik produziert automatisch wenn Ressourcen im Storage vorhanden
- Spieler wählt **aktives Rezept** (eines zur Zeit, später mehrere mit Fabrik-Upgrades)
- Produktion ist **kontinuierlich** — lazy berechnet wie AP/Mining
- **Lagerung:** produzierte Güter in neuem `factory_output` Pool (nicht Cargo, nicht Storage)
- Spieler muss Güter manuell oder per Handelsschiff abtransportieren

**Rezept-Datenstruktur:**

```typescript
export interface ProductionRecipe {
  id: string;
  outputItem: ProcessedItemType;
  outputAmount: number;
  inputs: Array<{ resource: ResourceType; amount: number }>;
  cycleSeconds: number;      // Produktionsdauer pro Batch
  researchRequired: string | null;  // null = Basis-Rezept, string = Research-ID
}
```

**Basis-Rezepte (sofort verfügbar):**

| Rezept | Input | Output | Zyklus |
|---|---|---|---|
| `fuel_cell_basic` | 2 ore + 3 gas | 1 fuel_cell | 120s |
| `alloy_plate_basic` | 3 ore + 1 crystal | 1 alloy_plate | 180s |

**Erforschbare Rezepte:**

| Rezept | Kosten | Input | Output | Zyklus |
|---|---|---|---|---|
| `circuit_board_t1` | 300 cr | 2 crystal + 2 gas | 1 circuit_board | 240s |
| `fuel_cell_efficient` | 500 cr | 2 ore + 2 gas | 1 fuel_cell | 90s |
| `alloy_plate_refined` | 800 cr | 2 ore + 1 crystal | 1 alloy_plate | 120s |
| `void_shard_t1` | 2.000 cr | 5 crystal + 2 gas | 1 void_shard | 600s |
| `bio_extract_t1` | 1.500 cr | 4 gas + 1 crystal | 1 bio_extract | 360s |
| `circuit_board_t2` | 3.000 cr | 1 circuit_board + 2 crystal | 3 circuit_board | 180s |

### 3.4 Research Lab — Forschungssystem

- **Baukosten:** `ore: 30, gas: 25, crystal: 30` + 25 AP
- Ohne Research Lab: nur Basis-Rezepte verfügbar
- Mit Research Lab: Spieler kann Credits investieren und nach N Minuten ist Rezept freigeschaltet
- Forschung ist **permanent** (pro Spieler, nicht pro Struktur)
- Forschungen bauen aufeinander auf (Technologiebaum, flach gehalten)

**Forschungsbaum (vereinfacht):**
```
[Basis-Fabrik]
  └─ circuit_board_t1 (300 cr, 30 min)
       └─ circuit_board_t2 (3.000 cr, 120 min)
  └─ fuel_cell_efficient (500 cr, 45 min)
  └─ alloy_plate_refined (800 cr, 60 min)
  └─ void_shard_t1 (2.000 cr, 180 min) [Req: circuit_board_t1]
  └─ bio_extract_t1 (1.500 cr, 90 min)
```

### 3.5 DB-Schema

```sql
-- Erweiterte Strukturen für Fabrik-Zustand
CREATE TABLE IF NOT EXISTS factory_state (
  structure_id      VARCHAR(64) PRIMARY KEY,
  owner_id          VARCHAR(64) NOT NULL,
  active_recipe_id  VARCHAR(64),
  cycle_started_at  TIMESTAMPTZ,
  -- Produzierte Güter (Output-Lager)
  fuel_cell         INTEGER NOT NULL DEFAULT 0,
  circuit_board     INTEGER NOT NULL DEFAULT 0,
  alloy_plate       INTEGER NOT NULL DEFAULT 0,
  void_shard        INTEGER NOT NULL DEFAULT 0,
  bio_extract       INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (structure_id) REFERENCES structures(id) ON DELETE CASCADE
);

-- Spieler-Forschungsfortschritt
CREATE TABLE IF NOT EXISTS player_research (
  player_id     VARCHAR(64) NOT NULL,
  recipe_id     VARCHAR(64) NOT NULL,
  unlocked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, recipe_id)
);

-- Aktive Forschung (läuft gerade)
CREATE TABLE IF NOT EXISTS active_research (
  player_id       VARCHAR(64) PRIMARY KEY,
  recipe_id       VARCHAR(64) NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completes_at    TIMESTAMPTZ NOT NULL,
  credits_spent   INTEGER NOT NULL
);
```

---

## 4. Handelssystem — Kontor & Marktplatz

### 4.1 Konzept-Unterschied

| | Kontor (Base) | Marktplatz (Faction) |
|---|---|---|
| Wer legt Aufträge an? | Nur Basis-Besitzer | Alle Fraktionsmitglieder |
| Auftragstypen | Nur Kaufaufträge | Kauf- und Verkaufaufträge |
| Waren-Deposit | Budget (Credits) wird hinterlegt | Waren werden hinterlegt (für Verkauf) oder Credits (für Kauf) |
| Zweck | Automatische Ressourcenbeschaffung für Produktion | P2P-Handel innerhalb der Fraktion |
| Zugang | Jeder Spieler kann verkaufen (wenn in Reichweite) | Nur Fraktionsmitglieder |
| Struktur | Neue: `kontor` | Trading Post Tier 2 (`trading_post`, bestehend) |

### 4.2 Kontor (Neue Struktur an Basis)

**Baukosten:** `ore: 20, gas: 10, crystal: 10` + 15 AP
**Voraussetzung:** Muss an einer Basis (Base-Struktur im selben Sektor) gebaut werden

**Funktionsweise:**
- Besitzer legt Kaufaufträge an: Ressource, Menge, Preis-pro-Einheit, Budget-Limit
- Budget wird sofort aus Besitzer-Konto abgezogen und reserviert
- Andere Spieler, die sich im selben Sektor befinden, können an das Kontor verkaufen
- Automatische Ausführung: Spieler A kommt in Sektor → kann offene Kaufaufträge sehen und bedienen
- Fraktion: Fraktionsmitglieder sehen Kontore der Fraktion (ohne hinfahren zu müssen?)

**Beispiel-Auftrag:**
```
[KONTOR: KAUFAUFTRAG]
Ressource:  ORE
Menge:      500 units
Max-Preis:  2 cr/unit
Budget:     1.000 cr (reserviert)
Gesammelt:  210 / 500 units
```

**Auftrag-Typen:**
- `BUY`: Kaufe X Units einer Ressource/eines verarbeiteten Guts zu max. P cr/unit

**Keine Verkaufsaufträge im Kontor** — dafür gibt es den Marktplatz.

### 4.3 Marktplatz (Trading Post Tier 2 — erweitert)

Der bestehende Marktplatz wird ausgebaut:

**Bestehend:** Kauf/Verkauf von ore/gas/crystal + Data Slates
**Neu:** Auch verarbeitete Güter (ProcessedItemType) können gelistet werden

**Auftragstypen:**
- `SELL`: Spieler hinterlegt Waren → "Verkaufe 100 alloy_plate für 15 cr/unit"
- `BUY`: Spieler hinterlegt Budget → "Kaufe bis zu 50 circuit_board für 25 cr/unit"

**Wichtig:** Waren beim Sell-Auftrag werden aus Cargo/Factory-Output entnommen und im Marktplatz eingelagert (Escrow). Credits beim Buy-Auftrag werden reserviert.

**Matching:** Manuell durch Gegenpartei (bestehend — kein automatisches Matching). Spieler sieht Liste, klickt "Kaufen".

**Sichtbarkeit:** Marktplatz ist fraktionsweit — alle Mitglieder der Fraktion können auf jeden Marktplatz der Fraktion zugreifen (via TRADE-Monitor, ohne physisch hinzufahren). Interstellare Kommunikation über Comm-Relay-Netz.

### 4.4 DB-Schema Erweiterungen

```sql
-- Kontor-Aufträge (neue Tabelle)
CREATE TABLE IF NOT EXISTS kontor_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        VARCHAR(64) NOT NULL,
  sector_x        INTEGER NOT NULL,
  sector_y        INTEGER NOT NULL,
  item_type       VARCHAR(32) NOT NULL,  -- ResourceType | ProcessedItemType
  amount_wanted   INTEGER NOT NULL,
  amount_filled   INTEGER NOT NULL DEFAULT 0,
  price_per_unit  INTEGER NOT NULL,
  budget_reserved INTEGER NOT NULL,  -- Credits gesperrt
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_kontor_sector
  ON kontor_orders (sector_x, sector_y, active);

-- Marktplatz: trade_orders erweitern um ProcessedItemType
-- Neue Spalte item_type (VARCHAR) ergänzt bestehende resource-Spalte
-- Migration: item_type = resource für bestehende Einträge
ALTER TABLE trade_orders
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS item_amount INTEGER DEFAULT 0;

-- item_type = NULL → bestehende resource-Logik
-- item_type != NULL → verarbeitetes Gut, resource ignoriert

-- Marktplatz-Escrow (Waren-Depot beim Sell-Auftrag)
CREATE TABLE IF NOT EXISTS marketplace_escrow (
  order_id   UUID PRIMARY KEY REFERENCES trade_orders(id) ON DELETE CASCADE,
  item_type  VARCHAR(32) NOT NULL,
  amount     INTEGER NOT NULL
);
```

---

## 5. Automatisierte Handelsschiffe

### 5.1 Erweiterung bestehender Trade Routes

Das bestehende `trade_routes`-System (`MAX_TRADE_ROUTES = 3`, Cycle 15–120 min) wird erweitert:

**Bestehend:** Route transportiert ore/gas/crystal zwischen Trading Post und Zielsektor
**Neu:**
- Routen können auch verarbeitete Güter transportieren
- Routen können Waren an Kontor-Aufträge liefern (automatische Kontor-Bedienung)
- Routen können Waren von NPC-Stationen kaufen und zur Basis bringen
- Mehrere Handelsschiffe pro Spieler (limit steigt mit Ruf/Fraktion)

### 5.2 Neues: Frachtschiff-Klasse

Handelsrouten benötigen ein **Frachtschiff** (nicht das Spieler-Schiff):
- Spieler kauft Frachtschiff-Slot für X Credits (sink)
- Frachtschiff hat eigene Cargo-Kapazität, Reichweite, Geschwindigkeit (in Minuten/Sektor)
- Frachtschiff kann zerstört werden (Piratenereignis bei Route durch Piratensektor)
- Versicherung (optionale Credit-Ausgabe pro Zyklus)

| Frachtschiff | Cargo | Reichweite | Zyklusmod | Kosten |
|---|---|---|---|---|
| Hauler Mk.I | 30 units | 50 Sektoren | ×1.0 | 800 cr |
| Hauler Mk.II | 80 units | 150 Sektoren | ×0.85 | 2.500 cr |
| Hauler Mk.III | 200 units | unbegrenzt | ×0.70 | 8.000 cr |

**Frachtschiff-Typen** können durch Fraktion-Upgrades verbessert werden (Händler-Fraktion).

### 5.3 Handelsrouten-Konfiguration (erweitert)

```typescript
export interface TradeRouteV2 extends TradeRoute {
  freighterSlot: number;       // Welches Frachtschiff
  itemType: ResourceType | ProcessedItemType;
  action: 'buy_npc' | 'sell_npc' | 'buy_kontor' | 'sell_kontor' | 'transfer';
  targetKontorOrderId?: string;
  maxPricePerUnit?: number;    // Für buy_npc/buy_kontor
  minPricePerUnit?: number;    // Für sell_npc/sell_kontor
}
```

---

## 6. Neue Struktur-Übersicht

| Struktur | Typ | Voraussetzung | Funktion |
|---|---|---|---|
| Factory | `factory` | Base im Sektor | Produziert Verarbeitungsgüter |
| Research Lab | `research_lab` | Factory + Base | Erforscht neue Rezepte |
| Kontor | `kontor` | Base im Sektor | Automatische Kaufaufträge |
| Trading Post | `trading_post` | — | Marktplatz (Tier 2), Trade-Routen (Tier 3) |

**Baukosten-Ergänzungen:**

```typescript
// Ergänzung zu STRUCTURE_COSTS:
factory:      { ore: 40, gas: 20, crystal: 15 },
research_lab: { ore: 30, gas: 25, crystal: 30 },
kontor:       { ore: 20, gas: 10, crystal: 10 },

// Ergänzung zu STRUCTURE_AP_COSTS:
factory:      20,
research_lab: 25,
kontor:       15,
```

---

## 7. Cargo-Erweiterung (CargoState)

Das bestehende `CargoState` muss um Verarbeitungsgüter erweitert werden:

```typescript
// Bestehend:
export interface CargoState {
  ore: number;
  gas: number;
  crystal: number;
  slates: number;
}

// Neu (rückwärtskompatibel, alle neu optional):
export interface CargoState {
  ore: number;
  gas: number;
  crystal: number;
  slates: number;
  // Verarbeitungsgüter (optional, default 0):
  fuel_cell?: number;
  circuit_board?: number;
  alloy_plate?: number;
  void_shard?: number;
  bio_extract?: number;
}
```

Cargo-Cap gilt für alle Items zusammen (total units). Verarbeitungsgüter können aus dem Fabrik-Output ins Cargo geladen werden (manueller Transfer oder per Handelschiff).

---

## 8. Monitor-Integration

### 8.1 TRADE-Monitor (bestehend, erweitert)

Neue Tabs/Sektionen:

```
[TRADE MONITOR]
─────────────────────────────────────
▶ NPC-MARKT    ← bestehend, erweitert um Lagerstand-Anzeige
▶ MARKTPLATZ   ← bestehend, erweitert um ProcessedItems
▶ KONTOR       ← neu: eigene Kaufaufträge verwalten
▶ FRACHTSCHIFF ← neu: Handelsrouten V2 mit Frachtschiff-Slots
```

**NPC-Markt Erweiterung:** Zeigt für jede Ressource den aktuellen NPC-Lagerstand als Balken:
```
ORE    ████████░░  82/100  [KAUFEN: 10cr/u] [VERKAUFEN: 8cr/u]
GAS    ██░░░░░░░░  20/100  [KAUFEN: 15cr/u] [VERKAUFEN: VOLL]
CRYSTAL░░░░░░░░░░   0/100  [OUT OF STOCK]   [VERKAUFEN: 20cr/u]
```

Stationslevel sichtbar: `[ OUTPOST LV.1 — XP: 120/500 ]`

### 8.2 BASE-LINK-Monitor (bestehend, erweitert)

Neue Sektion für Fabrik:
```
[FABRIK — AKTIV]
Rezept: ALLOY PLATE
Fortschritt: ████░░░░ 60%  (72s)
Output: 3x alloy_plate (im Lager)
[LADEN] [REZEPT WECHSELN] [FORSCHUNG]
```

Neue Sektion für Kontor:
```
[KONTOR]
[+] NEUER AUFTRAG
#1  ORE   500u @2cr  [210/500] AKTIV  [STORNIEREN]
#2  GAS   200u @5cr  [  0/200] AKTIV  [STORNIEREN]
```

---

## 9. Implementierungsplan

### Phase A — NPC-Stationen Lager & Level (Backend-Fokus)

1. Migration 011: `npc_station_data` + `npc_station_inventory` erstellen
2. `NpcStationEngine` in `packages/server/src/engine/npcStation.ts`:
   - `getOrInitStation(x, y)` — lazy init aus Seed
   - `calculateCurrentStock(item, lastUpdated, rate, stock)` — lazy evaluation
   - `addXp(station, amount)` + `checkLevelUp(station)`
   - `recordVisit(station)` + `recordTrade(station, units)`
3. Bestehende `validateNpcTrade` Logik um Stock-Check erweitern
4. NPC-Preise dynamisch basierend auf Stock-Level
5. Server-seitig: Besuche in SectorRoom tracken → `recordVisit`

### Phase B — Fabrik & Forschung

1. Migration 012: `factory_state` + `player_research` + `active_research`
2. Neue `StructureType`-Werte: `'factory'`, `'research_lab'`, `'kontor'`
3. `ProductionEngine` in `packages/server/src/engine/production.ts`:
   - `getOrCreateFactoryState(structureId)`
   - `calculateProduction(recipe, startedAt, now)` — lazy
   - `startProduction(structureId, recipeId)` + `collectOutput(structureId)`
4. `ResearchEngine` in `packages/server/src/engine/research.ts`:
   - `startResearch(playerId, recipeId)` + `checkAndComplete(playerId)`
5. Commands für: `factory_set_recipe`, `factory_collect`, `research_start`
6. `CargoState` um ProcessedItemType erweitern (rückwärtskompatibel)

### Phase C — Kontor

1. Migration 013: `kontor_orders`
2. Commands: `kontor_place_order`, `kontor_cancel_order`, `kontor_sell_to` (Besucher verkauft)
3. Sektor-Join: Kontor-Aufträge im Sektor an Spieler senden
4. Sichtbarkeit: Fraktions-Kontore über TRADE-Monitor ohne Besuch

### Phase D — Marktplatz erweitern

1. Migration: `marketplace_escrow` + `trade_orders` Spalten-Erweiterung
2. Marktplatz-Logik für ProcessedItemType
3. Escrow-System: Waren werden beim Listenerstellen reserviert
4. Fraktionsweiter Zugriff auf Marktplatz-Aufträge

### Phase E — Frachtschiffe

1. Migration: `freighter_slots` Tabelle
2. `TradeRouteV2` Schema + erweiterte Route-Konfiguration
3. Freighter-Kauf-Command + Slot-Verwaltung
4. Route-Execution erweitern (ProcessedItems + Kontor-Bedienung)
5. Piratenereignis für Frachter auf gefährlichen Routen

---

## 10. Balancing-Richtwerte

### Ressourcenpreise (Basis)

| Item | NPC kauft von Spieler | NPC verkauft an Spieler | Marktplatz-Richtwert |
|---|---|---|---|
| ore | 8 cr/u | 12 cr/u | 9–11 cr/u |
| gas | 12 cr/u | 18 cr/u | 14–16 cr/u |
| crystal | 20 cr/u | 30 cr/u | 23–27 cr/u |
| fuel_cell | 25 cr/u | 40 cr/u | 30–35 cr/u |
| alloy_plate | 40 cr/u | 60 cr/u | 45–55 cr/u |
| circuit_board | 70 cr/u | 100 cr/u | 75–90 cr/u |
| void_shard | 200 cr/u | 300 cr/u | 220–270 cr/u |
| bio_extract | 100 cr/u | 150 cr/u | 110–130 cr/u |

*NPC kauft nur bis Stationslevel erlaubt (Tier 1 keine ProcessedItems)*

### Produktions-Profitabilität (Beispiel fuel_cell_basic)

```
Input:  2 ore (buy @12 = 24 cr) + 3 gas (buy @18 = 54 cr) = 78 cr Kosten
Output: 1 fuel_cell → NPC-Preis 25 cr
→ Verlust wenn Rohstoffe von NPC gekauft! Nur profitabel wenn selbst abgebaut.

Eigenabbau-Kosten (Mining): ~0 cr (Zeit-Investment)
→ 2 ore + 3 gas abgebaut → 1 fuel_cell für 25 cr → Gewinn 25 cr
   vs. direkter Rohstoff-Verkauf: 2*8 + 3*12 = 16 + 36 = 52 cr
→ Direktverkauf ist profitabler! Production sinnvoll nur mit Research (bessere Rezepte).

fuel_cell_efficient (nach Research): 2 ore + 2 gas → 1 fuel_cell @25 cr
   vs. Direktverkauf: 2*8 + 2*12 = 16 + 24 = 40 cr
→ Noch immer Direktverkauf besser, ABER Marktplatz-Preis ist höher!
   Player-Markt: 30–35 cr → Gewinn 30–35 cr > Direktverkauf 40 cr (knapp)
   Hochwertige Rezepte (void_shard): klar profitabler als Rohstoffverkauf
```

### Stationswachstum-Tempo

- Ein aktiver Spieler bei Level-1-Station: ~30 Trades/Tag × 5 units = 150 XP/Tag
- Level 1 → Level 2: 500 XP → ~3–4 Tage aktiver Nutzung
- Mehrere Spieler beschleunigen Wachstum erheblich
- Megastation (Lv.5) erfordert koordinierten Gildeneinsatz

---

## 11. Offene Fragen / Zukunft

1. **Dynamische NPC-Preise Phase 2:** Globale Angebots-/Nachfragekurve (wenn viele Spieler fuel_cells verkaufen, sinkt NPC-Preis global)
2. **Handelsnetzwerk-Karte:** Visualisierung aktiver Handelsrouten auf Nav-Grid
3. **Auktion im Marktplatz:** Zeitlimitierte Auktionen statt Festpreisen
4. **Fraktions-Wirtschaft:** Geteilte Fraktions-Kasse für Gemeinschaftsprojekte
5. **Schwarzmarkt:** Piratenfraktions-spezifische Güter, riskante Trades
6. **Sektorspezifische Güter:** Bestimmte Ressourcen nur in bestimmten Sektortypen (Nebula: spezielle gas-Variante)
