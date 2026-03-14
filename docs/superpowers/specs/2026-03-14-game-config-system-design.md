# Game Config System — Design Spec

**Datum:** 2026-03-14
**Status:** APPROVED

---

## Uebersicht

Alle spielrelevanten Balance-Konstanten (~200+ Werte) werden aus einer DB-Tabelle `game_config` geladen und koennen zur Laufzeit ueber die Admin-UI geaendert werden. Aenderungen propagieren sofort via Redis Pub/Sub an alle Server-Instanzen. Ein GitHub-Issue-Export-Button ermoeglicht es, die aktuellen Werte als Default-Update-Issue zu erstellen.

---

## 1. Datenmodell

**Migration 067:**

```sql
CREATE TABLE IF NOT EXISTS game_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_config_category ON game_config(category);
```

Jeder Wert als JSONB (Zahl, Objekt, Array). Beispiele:

| key | value | category |
|-----|-------|----------|
| AP_DEFAULTS.max | 100 | ap |
| AP_COSTS_BY_SCANNER | {1:{areaScan:3,...}...} | ap |
| MODULES.drive_mk1 | {id:...,effects:...} | modules |
| faction_config.kthari | {home_qx:20,...} | conquest |

**Kategorien:** ap, mining, combat, fuel, economy, world, modules, conquest, quests, acep, navigation, progression, scanning, structures, ship, research, timers

**Seeding:** Migration 067 seedet alle aktuellen Werte aus constants.ts als Default-Rows. INSERT ON CONFLICT DO NOTHING (idempotent).

---

## 2. GameConfigService (Server-Singleton)

Neuer Service: `packages/server/src/engine/gameConfigService.ts`

```typescript
class GameConfigService {
  private cache: Map<string, any>;
  private redis: Redis;
  private subscriber: Redis;

  async init(): Promise<void>
    // 1. Alle Werte aus DB laden in cache
    // 2. applyConfig() ausfuehren (In-Memory-Konstanten ueberschreiben)
    // 3. Redis subscriber auf 'game_config_update' channel

  get(key: string): any
    // Aus cache lesen

  getAll(category?: string): Array<{key, value, category, description}>
    // Alle Werte, optional nach Kategorie gefiltert

  async set(key: string, value: any, category: string): Promise<void>
    // 1. DB: UPSERT game_config
    // 2. Cache aktualisieren
    // 3. applyConfig() fuer diesen Key
    // 4. redis.publish('game_config_update', JSON.stringify({key, value}))

  async delete(key: string): Promise<void>
    // 1. DB: DELETE FROM game_config WHERE key = $1
    // 2. Cache entfernen
    // 3. applyConfig() mit Default-Wert aus constants.ts
    // 4. redis.publish('game_config_update', JSON.stringify({key, value: null}))

  private onRedisMessage(channel: string, message: string): void
    // Parse message, update cache, applyConfig()
}

export const gameConfig = new GameConfigService();
```

---

## 3. applyConfig — Proxy-Ansatz

`constants.ts` bleibt als Fallback. Server ueberschreibt Properties zur Laufzeit.

```typescript
// packages/server/src/engine/gameConfigApply.ts

// Map von config-key zu Setter-Funktion
const APPLY_MAP: Record<string, (value: any) => void> = {
  'AP_DEFAULTS.max': (v) => { AP_DEFAULTS.max = v; },
  'AP_DEFAULTS.regenPerSecond': (v) => { AP_DEFAULTS.regenPerSecond = v; },
  'AP_COSTS_BY_SCANNER': (v) => { Object.assign(AP_COSTS_BY_SCANNER, v); },
  'MODULES.drive_mk1': (v) => { Object.assign(MODULES.drive_mk1, v); },
  // ... fuer alle ~200 Keys
};

export function applyConfigValue(key: string, value: any): void {
  const setter = APPLY_MAP[key];
  if (setter && value !== null) setter(value);
}
```

**Snapshot der Defaults:** Beim Server-Start, BEVOR applyConfig() laeuft, werden die Original-Werte aus constants.ts in einer DEFAULTS Map gesichert. Damit kann DELETE /config/:key den Originalwert wiederherstellen.

**Client:** Nutzt weiterhin Build-Time-Werte. Server ist Authority fuer alle Gameplay-Berechnungen.

---

## 4. Redis Pub/Sub

```
Admin aendert Wert
  -> PUT /admin/api/config/AP_DEFAULTS.max
  -> DB UPDATE
  -> redis.publish('game_config_update', JSON.stringify({key, value}))
  -> Alle Server-Prozesse empfangen
  -> applyConfig() aktualisiert In-Memory-Wert
  -> Sofort wirksam fuer naechste Aktion
```

Channel: `game_config_update`
Message: `{key: string, value: any}` (value=null bei DELETE/Reset)

---

## 5. Admin API Endpoints

Alle unter `/admin/api/config`, hinter adminAuth Middleware.

| Method | Path | Beschreibung |
|--------|------|-------------|
| GET | /admin/api/config | Alle Werte (query: ?category=ap) |
| GET | /admin/api/config/:key | Einzelner Wert + Default + Description |
| PUT | /admin/api/config/:key | Wert aendern (body: {value, category?, description?}) |
| DELETE | /admin/api/config/:key | Auf Code-Default zuruecksetzen |
| POST | /admin/api/config/export-issue | GH Issue mit allen aktuellen Werten erstellen |

**Export-Issue** nutzt `execFileNoThrow('gh', ['issue', 'create', ...])` fuer sichere Shell-Ausfuehrung.

---

## 6. Admin-UI — CONFIG Tab

Neuer Tab "CONFIG" in console.html.

- Kategorie-Buttons oben (AP, MINING, COMBAT, FUEL, etc.)
- Klick auf Kategorie zeigt alle Werte
- Pro Wert: Key | Aktueller Wert | Edit-Button
- Einfache Werte (number/string): Input-Feld
- Komplexe Werte (Object/Array): JSON-Textarea
- [SPEICHERN] pro Wert: PUT an API
- [ZURUECKSETZEN] pro Wert: DELETE an API (faellt auf Code-Default zurueck)
- [EXPORT -> GH ISSUE] Button oben: POST an export-issue Endpoint

---

## 7. Werte-Katalog (~200+ Werte in 17 Kategorien)

### ap (~18 Werte)
AP_DEFAULTS.max, AP_DEFAULTS.startingAP, AP_DEFAULTS.regenPerSecond,
AP_COSTS.jump, AP_COSTS.scan, AP_COSTS.mine,
AP_COSTS_LOCAL_SCAN, AP_COSTS_BY_SCANNER, BASE_HULL_AP_REGEN

### mining (~10 Werte)
MINING_RATE_PER_SECOND, RESOURCE_REGEN_DELAY_TICKS, RESOURCE_REGEN_INTERVAL_TICKS,
SECTOR_RESOURCE_YIELDS (pro Typ), ARTEFACT_DROP_CHANCES

### combat (~30 Werte)
PIRATE_BASE_HP, PIRATE_HP_PER_LEVEL, PIRATE_BASE_DAMAGE, PIRATE_DAMAGE_PER_LEVEL,
PIRATE_LEVEL_DISTANCE_DIVISOR, PIRATE_MAX_LEVEL,
COMBAT_V2_MAX_ROUNDS, COMBAT_V2_ROLL_MIN, COMBAT_V2_ROLL_MAX,
AIM_ACCURACY_BONUS, AIM_DISABLE_CHANCE, AIM_DISABLE_ROUNDS,
EVADE_CHANCE, EMP_HIT_CHANCE, EMP_DISABLE_ROUNDS,
BATTLE_AP_COST_FLEE, BATTLE_CARGO_LOSS_MIN, BATTLE_CARGO_LOSS_MAX,
BATTLE_NEGOTIATE_COST_PER_LEVEL, BATTLE_FLEE_BASE_CHANCE,
STATION_BASE_HP, STATION_REPAIR_CR_PER_HP, STATION_REPAIR_ORE_PER_HP, STATION_COMBAT_MAX_ROUNDS

### fuel (~15 Werte)
FUEL_COST_PER_UNIT, FUEL_MIN_TANK, FREE_REFUEL_MAX_SHIPS,
STATION_FUEL_BASELINE_PER_TICK, STATION_FUEL_GAS_RATE_PER_TICK,
STATION_FUEL_PER_GAS, STATION_FUEL_MAX_STOCK,
STATION_FUEL_LEVEL_EFFICIENCY, HYPERDRIVE_CHARGE_PER_GAS,
HYPERJUMP_FUEL_PER_SECTOR, EMPTY_FUEL_MODIFIER

### economy (~20 Werte)
NPC_PRICES, NPC_BUY_SPREAD, NPC_SELL_SPREAD,
NPC_XP_DECAY_PER_HOUR, NPC_XP_VISIT, NPC_XP_PER_TRADE_UNIT, NPC_XP_QUEST_COMPLETE,
STORAGE_TIERS, TRADING_POST_TIERS, REP_PRICE_MODIFIERS,
STATION_REP_VISIT, STATION_REP_TRADE,
MAX_TRADE_ROUTES, TRADE_ROUTE_MIN_CYCLE, TRADE_ROUTE_MAX_CYCLE

### world (~25 Werte)
ANCIENT_STATION_CHANCE, NEBULA_ZONE_GRID, NEBULA_ZONE_CHANCE,
NEBULA_ZONE_MIN_RADIUS, NEBULA_ZONE_MAX_RADIUS, NEBULA_SAFE_ORIGIN,
BLACK_HOLE_SPAWN_CHANCE, BLACK_HOLE_MIN_DISTANCE,
CONTENT_WEIGHTS, SECTOR_ENVIRONMENT_WEIGHTS,
DENSITY_STATION_NEAR/FAR, DENSITY_PIRATE_NEAR/FAR, DENSITY_DISTANCE_THRESHOLD,
NEBULA_SCANNER_MALUS, NEBULA_PIRATE_SPAWN_MODIFIER, NEBULA_CONTENT_ENABLED

### conquest (~15 Werte)
CONQUEST_POOL_DRAIN_PER_TICK, CONQUEST_POOL_MAX, CONQUEST_RATE,
NEIGHBOR_MIN_SHARE, ADVANTAGE_THRESHOLD, CRUSHING_THRESHOLD,
LOSS_ON_WIN, LOSS_ON_STALEMATE, BASE_FRICTION, STATION_DEFENSE,
Alien faction_config (home coords, expansion_rate, aggression pro Fraktion)

### navigation (~15 Werte)
JUMPGATE_CHANCE, JUMPGATE_FUEL_COST, JUMPGATE_TRAVEL_COST_CREDITS,
PLAYER_GATE_TRAVEL_COST_CREDITS, JUMPGATE_MIN_RANGE, JUMPGATE_MAX_RANGE,
JUMPGATE_DISTANCE_LIMITS, JUMPGATE_CONNECTION_LIMITS,
HYPERJUMP_BASE_AP, HYPERJUMP_AP_PER_SPEED, HYPERJUMP_MIN_AP,
STALENESS_DIM_HOURS, STALENESS_FADE_DAYS

### modules (~50+ Eintraege)
Jedes Modul als eigener Key: MODULES.drive_mk1, MODULES.generator_mk1, etc.
Komplettes Modul-Objekt als JSONB.

### structures (~25 Werte)
STRUCTURE_COSTS, STRUCTURE_AP_COSTS, JUMPGATE_BUILD_COST,
JUMPGATE_UPGRADE_COSTS, RESEARCH_LAB_UPGRADE_COSTS

### quests (~10 Werte)
MAX_ACTIVE_QUESTS, QUEST_EXPIRY_DAYS, SCAN_EVENT_CHANCE,
RESCUE_AP_COST, RESCUE_DELIVER_AP_COST, RESCUE_EXPIRY_MINUTES, DISTRESS_CALL_CHANCE

### acep (~15 Werte)
ACEP_PATH_CAP, ACEP_TOTAL_CAP, ACEP_LEVEL_THRESHOLDS,
ACEP_LEVEL_MULTIPLIERS, ACEP_EXTRA_SLOT_THRESHOLDS

### progression (~10 Werte)
XP_LEVELS, REP_TIERS

### scanning (~10 Werte)
SLATE_AP_COST_SECTOR, SLATE_AP_COST_AREA, SLATE_NPC_PRICE_PER_SECTOR,
SLATE_AREA_RADIUS, BASE_SCANNER_MEMORY,
CUSTOM_SLATE_AP_COST, CUSTOM_SLATE_CREDIT_COST

### ship (~10 Werte)
BASE_FUEL_CAPACITY, BASE_FUEL_PER_JUMP, BASE_CARGO, BASE_MODULE_SLOTS,
BASE_HP, BASE_JUMP_RANGE, BASE_ENGINE_SPEED, BASE_COMM_RANGE, BASE_SCANNER_LEVEL

### research (~5 Werte)
LAB_WISSEN_MULTIPLIER, RESEARCH_LAB_MAX_TIER, RESEARCH_TICK_MS

### timers (~5 Werte)
STEP_INTERVAL_MS, STEP_INTERVAL_MIN_MS, AUTOPILOT_STEP_MS,
DISTRESS_INTERVAL_MIN_MS, DISTRESS_INTERVAL_MAX_MS

---

## 8. Server-Start Integration

```
1. DB Migrations (inkl. 067)
2. gameConfig.init() — DB laden, Defaults snapshoten, applyConfig()
3. Redis Subscriber starten
4. Colyseus Rooms starten
```

---

## 9. Dateien

| Datei | Typ | Beschreibung |
|-------|-----|-------------|
| server/db/migrations/067_game_config.sql | Neu | Tabelle + Seed |
| server/engine/gameConfigService.ts | Neu | Singleton, DB + Redis + Cache |
| server/engine/gameConfigApply.ts | Neu | applyConfig Map, Default-Snapshot |
| server/engine/gameConfigSeed.ts | Neu | Seed-Daten: Keys, Defaults, Kategorien, Beschreibungen |
| server/adminRoutes.ts | Modify | 5 neue Endpoints |
| server/admin/console.html | Modify | CONFIG Tab |
| server/index.ts oder universeBootstrap.ts | Modify | gameConfig.init() |

---

## 10. Offene Punkte

- **Client-Sync:** Spaeter koennte der Server geaenderte Werte an Clients pushen
- **Audit-Log:** Wer hat wann was geaendert (via bestehendes logAdminEvent)
- **Validierung:** Min/Max-Ranges fuer Werte
