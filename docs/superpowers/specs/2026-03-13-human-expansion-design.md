# Human Expansion — Design Spec

**Datum:** 2026-03-13
**Status:** APPROVED
**Abhängig von:** Phase EW (quadrant_control, faction_config, faction_shares vorhanden, Migration 063)

---

## Übersicht

Spieler bauen Stationen in neuen Quadranten. Diese Stationen **erobern den Quadranten automatisch** pro Strategic Tick (60s). Ressourcen-Lieferungen beschleunigen die Eroberung. Wenn der Quadrant zu 100% kontrolliert wird, wechselt die Station in den Fabrik-Modus. Das System gilt für **alle Fraktionen** (humans + alle Alien-Fraktionen).

---

## 1. Station Mode — State Machine

Jede Station in `civ_stations` hat ein `mode`-Feld:

```
'conquest' | 'factory' | 'battle'
```

**Auto-Transition** (ConquestEngine, jeder Strategic Tick — bidirektional):

```
shares = faction_shares[station.faction] in quadrant_control (0 wenn kein Eintrag)
other_faction_present = any other faction has shares > 0

if shares >= 100:
  mode = 'factory'
elif other_faction_present && friction_score > 80:
  mode = 'battle'     // warfare engine übernimmt, reserviert
else:
  mode = 'conquest'   // inkl. neutraler Quadrant ohne anderen Fraktion
```

Übergang `factory → conquest` passiert automatisch wenn Fremdfraktion anfängt, Shares zu gewinnen (Shares eigene Fraktion < 100). Kein manueller Modus-Wechsel durch Spieler.

`battle` ist reserviert für spätere Warfare-Integration.

---

## 2. Resource Pool

**`conquest_pool` INTEGER** in `civ_stations` (capped auf `CONQUEST_POOL_MAX = 500`).

- Spieler liefern Ressourcen → Pool füllt sich (via `STATION_DEPOSIT` Nachricht, neue Variante für Conquest-Pool)
- Lieferungen über Pool-Max werden abgelehnt / auf Max gecapped
- Pro Strategic Tick: Pool draint um `POOL_DRAIN_PER_TICK = 50` — **nur wenn mode = 'conquest'**
- `pool > 0` → Ressourcen-Bonus auf Conquest Rate aktiv

---

## 3. Conquest Rate

**Levels 1–3** (neues `level`-Feld in `civ_stations`, Default 1):

| Level | Ohne Ressourcen (pool = 0) | Mit Ressourcen (pool > 0) |
|-------|---------------------------|--------------------------|
| 1     | 1.0 Punkte/Tick            | 1.5 Punkte/Tick          |
| 2     | 1.1 Punkte/Tick            | 2.0 Punkte/Tick          |
| 3     | 1.2 Punkte/Tick            | 3.0 Punkte/Tick          |

100 Conquest-Punkte = Quadrant vollständig kontrolliert.

**Friction Modifier** — gilt **nur wenn andere Fraktion Shares > 0 hat**:

| Friction Score | Rate-Modifier | Verhalten |
|----------------|---------------|-----------|
| 0–20 (ALLY)    | × 0           | Expansion hält (gute Beziehung, kein Vordringen) |
| 21–50 (NEUTRAL)| × 0.5         | Langsame Expansion (gelegentliche Scharmützel) |
| 51–80 (HOSTILE)| × 0.25        | Stark gebremst |
| 81–100 (ENEMY) | × 0 → `battle`| Warfare Engine übernimmt |

**Wenn kein anderes Fraktion im Quadrant** (neutral/leer): kein Friction Modifier → volle Rate.

---

## 4. faction_shares — Berechnung

`quadrant_control.faction_shares` ist JSONB, Summe = 100 (invariant).

**Pro Conquest-Tick:**

```
own_gain = tick_conquest_rate
existing_other = sum of all other factions' shares

if existing_other == 0:
  // neutral quadrant, fill directly
  faction_shares[station.faction] = min(100, current + own_gain)
else:
  // contested: reduce others proportionally
  faction_shares[station.faction] = min(100, current + own_gain)
  reduction_total = own_gain
  for each other_faction in shares:
    reduction = (shares[other_faction] / existing_other) * reduction_total
    shares[other_faction] = max(0, shares[other_faction] - reduction)
  // remove factions at 0
  // re-normalize to ensure sum == 100

controlling_faction = faction with highest share
```

**Kein QC-Row vorhanden** (neuer Quadrant ohne Eintrag):
ConquestEngine legt einen neuen `quadrant_control`-Row an mit `{ [station.faction]: 0 }` bevor er die Berechnung startet.

---

## 5. Preis-Scaling nach Distanz

Ressourcen-Kaufpreise an der Station (im Conquest-Modus) steigen mit Quadrant-Distanz vom Ursprung. Basis-Preis ist INTEGER.

```typescript
function getConquestPriceBonus(qx: number, qy: number): number {
  const dist = Math.floor(Math.sqrt(qx * qx + qy * qy));
  if (dist <= 10)  return dist;
  if (dist <= 50)  return 10 + (dist - 10) * 2;
  if (dist <= 100) return 90 + (dist - 50) * 3;
  return 240 + (dist - 100) * 5;
}
```

Beispiele (base_price = 10):

| Distanz | Bonus | Preis |
|---------|-------|-------|
| 5       | +5    | 15    |
| 10      | +10   | 20    |
| 30      | +50   | 60    |
| 50      | +90   | 100   |
| 100     | +240  | 250   |

Im Fabrik-Modus gelten normale Marktpreise.

---

## 6. QUAD-MAP Coloring

`faction_shares` JSONB (bereits vorhanden) treibt die Darstellung:

- Renderer rundet auf **10%-Schritte** für die visuelle Darstellung
- Gemischte Quadranten: beide Farben anteilig sichtbar (geteiltes Farbfeld)
- Gilt für **alle Fraktionen** — `FACTION_COLORS` Map bereits vorhanden in QuadrantMapRenderer
- Neue Render-Funktion `renderMixedControl(shares, ctx, rect)` für anteilige Farben

---

## 7. Datenbankänderungen

**Migration 065** — `civ_stations` erweitern:

```sql
ALTER TABLE civ_stations
  ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'conquest',
  ADD COLUMN IF NOT EXISTS conquest_pool INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
```

Bestehende Stationen starten im `conquest`-Modus. ConquestEngine korrigiert sie auf `factory` beim ersten Tick wenn `faction_shares >= 100`.

---

## 8. Architektur

### ConquestEngine (neu — `packages/server/src/engine/conquestEngine.ts`)

```typescript
export class ConquestEngine {
  async tick(now: Date): Promise<void> {
    const stations = await getAllConquestStations(); // mode != 'factory' OR shares < 100
    for (const station of stations) {
      const qx = Math.floor(station.sector_x / 500);
      const qy = Math.floor(station.sector_y / 500);
      const qc = await getOrCreateQuadrantControl(qx, qy, station.faction);
      const newMode = computeMode(qc, station.faction);
      if (newMode !== 'conquest') {
        await updateStationMode(station.id, newMode);
        continue;
      }
      const rate = computeRate(station.level, station.conquest_pool > 0);
      const modifiedRate = rate * frictionModifier(qc, station.faction);
      await updateFactionShares(qc, station.faction, modifiedRate);
      await drainPool(station.id, CONQUEST_POOL_DRAIN_PER_TICK);
      await updateStationMode(station.id, 'conquest');
    }
  }
}
```

### StrategicTickService (bestehend)

```typescript
await conquestEngine.tick(now);  // neben expansionEngine + warfareEngine
```

### Message Handler (SectorRoom / EconomyService)

Neuer Handler für `STATION_DEPOSIT_CONQUEST`:
```
player sends: { stationId, amount }
server: validate player is in same sector, validate amount <= POOL_MAX - current_pool
        add to conquest_pool, respond with new pool level
```

### Client — Station Detail Panel (Sec 3)

Conquest-Modus zeigt:
- Modus-Badge: `[CONQUEST]` / `[FABRIK]` / `[KAMPF]`
- Fortschritt: `47 / 100 Punkte` + Fortschrittsbalken
- Pool: `conquest_pool / CONQUEST_POOL_MAX` als Balken + `[LIEFERN]`-Button
- Aktueller Kaufpreis für Ressourcen (mit Distanz-Bonus)

---

## 9. Konstanten (`packages/shared/src/constants.ts`)

```typescript
export const CONQUEST_POOL_DRAIN_PER_TICK = 50;
export const CONQUEST_POOL_MAX = 500;

export const CONQUEST_RATE: Record<number, { base: number; boosted: number }> = {
  1: { base: 1.0, boosted: 1.5 },
  2: { base: 1.1, boosted: 2.0 },
  3: { base: 1.2, boosted: 3.0 },
};

export function getConquestPriceBonus(qx: number, qy: number): number {
  const dist = Math.floor(Math.sqrt(qx * qx + qy * qy));
  if (dist <= 10)  return dist;
  if (dist <= 50)  return 10 + (dist - 10) * 2;
  if (dist <= 100) return 90 + (dist - 50) * 3;
  return 240 + (dist - 100) * 5;
}
```

---

## 10. Offene Punkte / Future Work

- `battle` mode: Warfare Engine greift auf Station-Shares zu (Phase EW Design)
- Conquest für Alien-Fraktionen: `expansionEngine.ts` analog erweitern
- Station Tier IV: Jumpgate-Expansion (separater Sprint)
- Admin: `conquest_pool` manuell füllen via Admin-Konsole (Playtest-Beschleunigung)
