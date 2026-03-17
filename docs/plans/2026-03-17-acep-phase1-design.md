# ACEP Phase 1: 7 Pfade, Stufe 1-10, Exponentielle Kosten

**Datum:** 2026-03-17
**Issue:** #523

## Ziel

ACEP-System von 4 auf 7 Pfade erweitern, Stufen 1-10, exponentielle Kosten mit weichem Cap. Auto-XP durch Spielaktionen plus manuelles Boosten.

## Pfade (7)

| Pfad | Key | Farbe | Auto-XP durch |
|------|-----|-------|---------------|
| AUSBAU | ausbau | #FFB000 | Bauen, Crafting |
| INTEL | intel | #4488FF | Scanning, Entdeckungen |
| KAMPF | kampf | #FF4444 | Kämpfe, NPC-Kills |
| EXPLORER | explorer | #44FFAA | Sektorbewegung, Hyperjumps |
| DEFENSE | defense | #FF44FF | Schaden absorbieren |
| TRADER | trader | #FFDD22 | Handeln (buy/sell) |
| MINER | miner | #88FF44 | Mining |

## Stufen & Kosten

### Manueller Boost (+1 Stufe pro Klick)

Basis-Formel:
```
credits = 100 × 2^(stufe - 1)
wissen  = 5 × 2^(stufe - 1)
```

| Stufe | Credits | Wissen |
|-------|---------|--------|
| 1 | 100 | 5 |
| 2 | 200 | 10 |
| 3 | 400 | 20 |
| 4 | 800 | 40 |
| 5 | 1.600 | 80 |
| 6 | 3.200 | 160 |
| 7 | 6.400 | 320 |
| 8 | 12.800 | 640 |
| 9 | 25.600 | 1.280 |
| 10 | 51.200 | 2.560 |

### Weiches Global-Cap

Multiplikator auf alle Kosten:
```
costMult = 1 + (totalLevels / 10)
```
- 0 Stufen investiert: 1.0x
- 10 Stufen: 2.0x
- 20 Stufen: 3.0x
- 30 Stufen: 4.0x

Effekt: Spezialisierung ist billig, Generalist wird exponentiell teurer.

### Auto-XP (passiv durch Aktionen)

Jede relevante Aktion gibt +1 XP zum passenden Pfad. Level-Up bei Schwellen:
```
threshold(stufe) = 10 × (2^stufe - 1)
```

| Stufe | XP benötigt |
|-------|-------------|
| 1 | 10 |
| 2 | 30 |
| 3 | 70 |
| 4 | 150 |
| 5 | 310 |

Auto-XP ist ein Alternativweg — manuelles Boosten überspringt den XP-Grind.

### Auto-XP Trigger

| Pfad | Aktion | XP |
|------|--------|-----|
| AUSBAU | Station/Jumpgate bauen, Craft abschließen | +1 |
| INTEL | Local Scan, Area Scan, Sektor entdecken | +1 |
| KAMPF | Kampfrunde abschließen, NPC besiegen | +1 |
| EXPLORER | Sektor bewegen, Hyperjump, Gate-Sprung | +1 |
| DEFENSE | (Phase 2 — wenn Combat Schaden absorbiert) | +1 |
| TRADER | Buy/Sell an Station oder NPC | +1 |
| MINER | Mining-Tick (1 pro 10s Mining) | +1 |

## DB-Änderung

Migration: `acep_xp` Tabelle erweitern
```sql
ALTER TABLE acep_xp ADD COLUMN IF NOT EXISTS defense INT NOT NULL DEFAULT 0;
ALTER TABLE acep_xp ADD COLUMN IF NOT EXISTS trader INT NOT NULL DEFAULT 0;
ALTER TABLE acep_xp ADD COLUMN IF NOT EXISTS miner INT NOT NULL DEFAULT 0;
```

## Modifizierte Dateien

| Datei | Änderung |
|-------|----------|
| `packages/shared/src/constants.ts` | Neue Pfad-Definitionen, Kosten-Formel, Farben |
| `packages/shared/src/types.ts` | AcepPath union erweitern |
| `packages/server/src/engine/acepXpService.ts` | 7 Pfade, neue Kosten-Logik, Auto-XP |
| `packages/server/src/rooms/services/ShipService.ts` | handleAcepBoost: +1 statt +5, neue Formel |
| `packages/server/src/rooms/SectorRoom.ts` | Auto-XP Trigger bei Aktionen |
| `packages/server/src/db/migrations/082_acep_new_paths.sql` | Neue Spalten |
| `packages/client/src/components/AcepTab.tsx` | 7 Pfade anzeigen, +1 Button, Kosten |
| `packages/client/src/state/gameSlice.ts` | Erweiterte AcepXp Typen |

## ACEP-Tab UI

```
AEGIS ACEP GEN-1          GESAMT: 5/70
WISSEN: 40 / [30]

AUSBAU    ██░░░░░░░░ 2/10    [+1] 400 CR · 20 W
INTEL     █░░░░░░░░░ 1/10    [+1] 200 CR · 10 W
KAMPF     ░░░░░░░░░░ 0/10    [+1] 100 CR · 5 W
EXPLORER  ██░░░░░░░░ 2/10    [+1] 400 CR · 20 W
DEFENSE   ░░░░░░░░░░ 0/10    [+1] 100 CR · 5 W    (NEU)
TRADER    ░░░░░░░░░░ 0/10    [+1] 100 CR · 5 W    (NEU)
MINER     ░░░░░░░░░░ 0/10    [+1] 100 CR · 5 W    (NEU)

KOSTEN-MULTIPLIKATOR: 1.5x (5 Stufen investiert)
```

## Nicht in Phase 1

- Slot-Freischaltung bei Pfad-Stufen (Phase 2)
- Modul-Stacking (Phase 2)
- Trait-Berechnung + Radar-Farben (Phase 3)
