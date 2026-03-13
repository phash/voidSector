# Kampfsystem v1.0 — Design Dokument

**Datum:** 2026-03-11
**Issue:** #256
**Status:** APPROVED
**Ersetzt:** Legacy CombatService + CombatV2

---

## Kernprinzip

Vollständiger Ersatz beider bisheriger Kampfsysteme (Legacy + CombatV2) durch ein einheitliches, energie-basiertes Rundenkampfsystem. Gleichzeitig wird das AP-System an den Generator des Schiffs gekoppelt — der Generator beeinflusst sowohl die normale Spielgeschwindigkeit als auch den Kampf.

---

## Sektion 1: Modul-System-Erweiterungen

### Neuer Generator-Slot (Slot 0) — Alle Slots um +1 verschoben

| Slot | Kategorie | Unique | ACEP-Pfad |
|------|-----------|--------|-----------|
| 0 | generator | ja | AUSBAU |
| 1 | drive | nein | AUSBAU |
| 2 | weapon | nein | KAMPF |
| 3 | armor | nein | AUSBAU |
| 4 | shield | ja | KAMPF |
| 5 | scanner | ja | INTEL |
| 6 | mining | nein | AUSBAU |
| 7 | cargo | nein | AUSBAU |
| 8+ | extra (AUSBAU-gated) | — | — |

ACEP Extra-Slot-Thresholds: war `index >= 7`, jetzt `index >= 8`.

### Neue Modul-Kategorien

**Generator (Spezialisierter Slot 0, unique):**

| Tier | EP/Runde (Kampf) | AP/s (Normal, HIGH) | Modul-HP |
|------|-----------------|---------------------|----------|
| 1 | 6 | 0.20 | 20 |
| 2 | 9 | 0.30 | 35 |
| 3 | 12 | 0.50 | 55 |
| 4 | 15 | 0.70 | 80 |
| 5 | 18 | 1.00 | 110 |

**Repair-Modul (Nur Extra-Slots, stackable):**

| Tier | Repair im Kampf (HP/Runde) | Repair außerhalb (HP/s) | Modul-HP |
|------|---------------------------|------------------------|----------|
| 1 | 2 | 0.5 | 20 |
| 2 | 4 | 1.0 | 35 |
| 3 | 7 | 2.0 | 55 |
| 4 | 11 | 3.5 | 80 |
| 5 | 16 | 5.0 | 110 |

### Modul-HP (alle Kategorien)

| Tier | Modul-HP |
|------|----------|
| 1 | 20 |
| 2 | 35 |
| 3 | 55 |
| 4 | 80 |
| 5 | 110 |

### ShipModule — neue Felder

```typescript
powerLevel: 'off' | 'low' | 'mid' | 'high'  // default: 'high'
currentHp: number                              // default: moduleDef.maxHp
```

### Damage States (aus currentHp/maxHp abgeleitet)

| State | HP-Bereich | Power-Cap |
|-------|-----------|-----------|
| `intact` | > 75% | HIGH |
| `light` | 50–75% | max MID |
| `heavy` | 25–50% | max LOW |
| `destroyed` | < 25% | OFF (forced) |

---

## Sektion 2: AP-System — Generator-Integration

### Neue AP-Formel

```
apRegen = BASE_HULL_REGEN + generator.apPerSecond × powerMultiplier × (currentHp / maxHp)
```

- `BASE_HULL_REGEN = 0.08 AP/s` — Schiff generiert immer etwas, kein Hard-Lock
- Kein Generator installiert → nur Basis-Regen (0.08 AP/s)
- Generator `destroyed` → forced OFF → nur Basis-Regen

### Power-Level-Multiplikatoren

| Power Level | Multiplikator |
|-------------|---------------|
| `off` | 0.0 |
| `low` | 0.4 |
| `mid` | 0.7 |
| `high` | 1.0 |

### Referenzwerte (Generator HIGH, volle HP)

| Situation | AP/s |
|-----------|------|
| Kein Generator (Basis) | 0.08 |
| Generator Tier 1 | 0.28 |
| Generator Tier 3 | 0.58 |
| Generator Tier 5 | 1.08 |
| Generator Tier 3, heavy damage (50% HP) | 0.33 |
| Generator zerstört | 0.08 |

### Implementierungs-Änderung

`ap.ts`: `regenPerSecond` wird nicht mehr aus Konstante gelesen, sondern per `calculateApRegen(ship)` berechnet. Lazy-Evaluation-Logik bleibt unverändert.

Neues Schiff: ShipService setzt zwingend einen Generator Tier 1 bei Schiffserstellung.

---

## Sektion 3: Kampf-Rundenstruktur

### Ablauf (max. 10 Runden, dann Unentschieden)

**1. Energy Distribution** *(Spieler-Input)*
- Spieler verteilt EP (Buffer + Generator-Output) auf Module
- Jedes Modul hat EP-Kosten: OFF=0, LOW=x, MID=y, HIGH=z
- Nicht verwendete EP gehen in Buffer (max = GeneratorTier × 2)
- Beschädigter Generator: Output reduziert proportional zu HP

**2. Primary Action** *(Spieler-Input)*

| Aktion | Bedingung |
|--------|-----------|
| Attack | Weapon auf LOW+ |
| Scan | Scanner auf LOW+ — enthüllt gegnerische Module/HP |
| Repair | Repair-Modul installiert + Ressourcen vorhanden |
| Flee | Drive-EP > gegnerischer Drive-EP (sonst Runde verloren) |
| Wait | EP in Buffer laden |

**3. Reaction** *(auto + optional)*
- **Auto:** Schilde absorbieren Treffer. Point-Defense feuert automatisch vs. Missiles wenn MID+.
- **Optional (eine Wahl):** Shield Boost / ECM Pulse / Emergency Eject (< 15% HP, verliert Cargo, garantierte Flucht)

**4. Ancient Ability** *(optional, einmal pro Kampf)*
- Lädt auf: 3 Runden ohne Einsatz
- **EXPLORER L5 (passiv):** Runde 1 zeigt automatisch gegnerisches Modul-Layout
- **Ancient Core Modul (aktiv):** Ancient Energy Pulse — ignoriert Schilde, trifft direkt HP

**5. Resolution**
- Schaden berechnen und verteilen
- Modul-HP aktualisieren → damageState ableiten
- Kampfende: `playerHp ≤ 0` oder Generator `destroyed` → defeat; `enemyHp ≤ 0` → victory

### Gezielter Modul-Angriff

Special Action "Aim at module": +20% EP-Kosten, Schaden geht gezielt auf ein Modul des Gegners. KI-Gegner (höhere Piratenlevel) zielen bevorzugt auf Generator.

### Post-Kampf

`currentHp` aller Module bleibt persistiert in `ships.modules` JSONB. Kein Reset zwischen Kämpfen.

---

## Sektion 4: Schaden & Reparatur

### Reparatur-Optionen

| Methode | Wo | Kosten | Geschwindigkeit | Einschränkung |
|---------|----|--------|----------------|---------------|
| Onboard (Repair-Modul) | Überall | Ore (light/heavy), Ore+Crystal (→heavy aus destroyed) | Repair-Modul HP/s | destroyed→heavy nur Tier 3+ |
| Im Kampf | Kampfrunde | Ore | Repair-Modul HP/Runde | destroyed nicht heilbar im Kampf |
| Station | An Station | Credits | Sofort (volles HP) | — |

### Ressourcenkosten (Onboard)

| Von → Nach | Ressource |
|------------|-----------|
| destroyed → heavy | Crystal (teuer) |
| heavy → light | Ore + Crystal |
| light → intact | Ore |

### Permadeath-Legacy

Nachfolger-Schiff erbt Module mit 70% HP (Narben-System aus ACEP-Design).

---

## Sektion 5: DB-Änderungen & Legacy-Cleanup

### Migration 053 — Module State Backfill

`powerLevel: 'high'` und `currentHp: <maxHp>` in alle bestehenden `ships.modules` Einträge eintragen (analog Migration 052).

### Migration 054 — Legacy Combat Tables Drop

```sql
DROP TABLE IF EXISTS battle_log;
DROP TABLE IF EXISTS battle_log_v2;
```

### Neue Tabelle `combat_log`

```sql
CREATE TABLE combat_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(100),
  quadrant_x INTEGER, quadrant_y INTEGER,
  sector_x INTEGER, sector_y INTEGER,
  enemy_type VARCHAR(50),
  enemy_level INTEGER,
  outcome VARCHAR(20),        -- 'victory', 'defeat', 'fled', 'draw'
  rounds INTEGER,
  player_hp_end INTEGER,
  modules_damaged JSONB,      -- [{moduleId, hpBefore, hpAfter}]
  loot JSONB,
  fought_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Legacy-Dateien löschen

- `packages/server/src/engine/combatV2.ts`
- `packages/server/src/engine/combatV2Types.ts`
- `FEATURE_COMBAT_V2` Flag + alle Guards in CombatService
- `battle_log` / `battle_log_v2` Tabellen

### Neue Dateien

| Datei | Inhalt |
|-------|--------|
| `packages/server/src/engine/combatEngine.ts` | Rundenlogik, Resolution, Flee, Ancient Ability |
| `packages/server/src/engine/combatTypes.ts` | CombatState, RoundResult, EnergyAllocation, etc. |
| `packages/server/src/rooms/services/CombatService.ts` | Komplett neu (ersetzt bestehende Datei) |
| `packages/server/src/rooms/services/RepairService.ts` | Onboard-Reparatur + Station-Reparatur |

---

## Modul-EP-Kosten (Referenz)

| Modul-Kategorie | OFF | LOW | MID | HIGH |
|----------------|-----|-----|-----|------|
| Weapon | 0 | 2 | 4 | 6 |
| Shield | 0 | 1 | 2 | 4 |
| Drive (Flee) | 0 | 2 | 4 | 6 |
| Scanner | 0 | 1 | 2 | 3 |
| Repair | 0 | 1 | 2 | 4 |
| Generator | — | — | — | — |

---

## Implementierungs-Reihenfolge

1. Shared: Slot-Remap + neue Typen (powerLevel, currentHp, generator/repair Kategorien)
2. Shared: Module-Definitionen (Generator T1–5, Repair T1–5) + `calculateApRegen()`
3. Server: Migration 053 (Module State Backfill) + 054 (Legacy Tables Drop)
4. Server: `combatTypes.ts` + `combatEngine.ts` (neue Rundenlogik)
5. Server: `CombatService.ts` komplett neu
6. Server: `RepairService.ts`
7. Server: AP-System anpassen (`ap.ts` + ShipService Generator-Pflicht)
8. Client: CombatDialog überarbeiten (Energy Distribution UI, Module-HP-Anzeige)
9. Client: RepairPanel (Onboard-Reparatur-Interface)
