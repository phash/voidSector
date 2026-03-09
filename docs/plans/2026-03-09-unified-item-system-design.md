# Unified Item System — Design Dokument

**Datum:** 2026-03-09
**Status:** APPROVED
**Ersetzt:** Cargo-Tabelle, module_inventory JSONB, player_research.blueprints[]

---

## Kernprinzip

Alle physischen Gegenstände des Spiels — Ressourcen, Module, Blaupausen — werden
in einer einheitlichen `inventory`-Tabelle verwaltet. Das ermöglicht einheitlichen
Handel (Kontor + Direkthandel) für alle Item-Typen.

Credits bleiben Währung, kein Item. Research-Unlocks bleiben DB-Feld (nicht handelbar).

---

## 1. Item-Datenmodell

### DB-Tabelle

```sql
CREATE TABLE inventory (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(100) NOT NULL,
  item_type TEXT    NOT NULL,  -- 'resource' | 'module' | 'blueprint'
  item_id   TEXT    NOT NULL,  -- 'ore' | 'drive_mk2' | 'scanner_mk3'
  quantity  INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (player_id, item_type, item_id)
);
CREATE INDEX ON inventory (player_id);
```

### Item-Typen

| `item_type`   | `item_id` Beispiele              | Stapelbar | Handelbar | Herstellbar |
|---------------|----------------------------------|-----------|-----------|-------------|
| `resource`    | `ore`, `gas`, `crystal`, `artefact` | ✅     | ✅        | via Mining/Scan |
| `module`      | `drive_mk2`, `scanner_mk3`       | ✅        | ✅        | via Werkstatt |
| `blueprint`   | `drive_mk2`, `scanner_mk3`       | ❌ (max 1)| ✅        | ❌ (gefunden) |

### Was bleibt separat

- **Credits** — Währung, kein Item
- **Schiff-Slots** — `ships.modules[]` (installierte Module ≠ Inventar)
- **Research-Unlock** — `player_research.unlocked_modules[]` (permanent, nicht handelbar)

### Was wegfällt

| Ersetzt | Durch |
|---------|-------|
| `cargo`-Tabelle (ore/gas/crystal/artefact Spalten) | `inventory` (type=resource) |
| `module_inventory` JSONB auf players | `inventory` (type=module) |
| `player_research.blueprints[]` | `inventory` (type=blueprint) |

---

## 2. Item-Herkunft & Produktion

### Zwei Wege zu einem physischen Modul

```
WEG 1: Selbst herstellen (Werkstatt)
  Forschung-Unlock (player_research) ODER Blueprint in inventory
    + Ressourcen + Zeit (Factory-Timer)
    → physisches Modul qty+1 in inventory

WEG 2: Kaufen (NPC-Store oder Spieler-Handel)
    → physisches Modul qty+1 in inventory
    (kein Rezept nötig — kann es nutzen aber nicht selbst herstellen)
```

### Blueprint — reusable recipe

```
Blueprint in inventory (qty immer 1)
  → HERSTELLEN → Ressourcen + Zeit → Modul qty+1 (Blueprint bleibt)
  → HERSTELLEN → Ressourcen + Zeit → Modul qty+1 (Blueprint bleibt)
  → VERKAUFEN  → Blueprint geht an Käufer, Käufer kann herstellen
```

Blueprint kommt aus: Alien-Encounters, Ancient Ruins, Spieler-Handel.

### Research-Unlock — permanentes Rezept (nicht handelbar)

```
Forschung abgeschlossen → player_research.unlocked_modules += moduleId
  → kann unbegrenzt herstellen (wie Blueprint, aber nicht verkaufbar)
```

### Modul-Lebensweg

```
Herstellen / Kaufen → inventory (type=module, qty+1)
     ↓
INSTALLIEREN → inventory qty-1 + ships.modules[] += moduleId
     ↓
AUSBAUEN     → ships.modules[] -= moduleId + inventory qty+1
     ↓
VERKAUFEN    → inventory qty-1 + Credits/Items zu Käufer
```

---

## 3. Handel

### Kontor (asynchron)

Das bestehende Kontor-System bekommt ein `item_type`-Feld:

```sql
ALTER TABLE kontor_orders
  ADD COLUMN item_type TEXT NOT NULL DEFAULT 'resource';
-- item_id bereits vorhanden als 'sell_resource'/'buy_resource' → wird zu item_id
```

Order-Typen bleiben: `BUY` (biete Credits, möchte Item) | `SELL` (biete Item, möchte Credits).

UI: TRADE-Screen bekommt Kontor-Tab mit Filter nach item_type (Ressourcen / Module / Blaupausen).

### Direkthandel (synchron, gleicher Sektor)

```
Spieler A tippt: /trade @SpielerB
Spieler B sieht Anfrage → akzeptiert

Trade-Fenster:
  [ A bietet:          ]  [ B bietet:          ]
  2× ore                   1× drive_mk2
  1× scanner_blueprint     500 Credits

A ✓ + B ✓ → atomarer Swap
Timeout: 60s ohne Bestätigung → abgebrochen
```

Regeln:
- Gleicher Sektor erforderlich
- Credits + beliebige Items kombinierbar
- Kein Escrow, kein Zwischenhändler

### Factory Werkstatt (Herstellung)

Neuer Tab im TECH/FACTORY-Screen: **WERKSTATT**

Zeigt: alle Rezepte aus `player_research.unlocked_modules` + Blueprints in inventory.

```
Rezept: drive_mk2
  Input:  2× ore + 1× crystal + 50 CR + 5 Min
  Output: 1× drive_mk2 in inventory
  [HERSTELLEN]
```

---

## 4. Migration

### Schritt 1: Additive Migration

Migration 044 erstellt `inventory`-Tabelle, ändert aber noch nichts am bestehenden Code.
Server liest/schreibt parallel beide Systeme während der Transition.

### Schritt 2: Service-by-Service Migration

Jeder Service wird einzeln auf `inventory` umgestellt:
1. MiningService (ore/gas/crystal)
2. ScanService (artefact)
3. ShipService (module inventory)
4. QuestService, EconomyService (artefact, ressourcen)
5. Blueprints (alien encounters, ancient ruins)

### Schritt 3: Cargo-Tabelle deprecaten

Sobald alle Services migriert: `cargo`-Tabelle wird nicht mehr geschrieben.
Alte Daten per Data-Migration in `inventory` überführt.

---

## 5. Cargo-Cap

Cargo-Cap gilt weiterhin für `resource`-Items (Summe aller Ressourcen).
Module + Blaupausen sind **nicht** cargo-gecappt (unbegrenzt im Inventar).

---

## 6. Implementierungs-Reihenfolge

1. DB Migration 044 (`inventory` + `kontor_orders.item_type`)
2. Shared types + inventory queries
3. `inventoryService.ts` (CRUD)
4. Ressourcen migrieren (Mining, Scan, Economy)
5. Module migrieren (ShipService)
6. Blueprints migrieren (Encounters, Ruins)
7. Factory Werkstatt (Crafting)
8. Kontor Extension (alle Item-Typen)
9. Direkthandel (`/trade @player`)
10. Client UI (Inventar-Anzeige, Kontor-Filter, Trade-Fenster)
