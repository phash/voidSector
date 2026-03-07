# Drohnen-System: Automatisierter Idle-Ressourcen-Abbau

## Übersicht

**Konzept:** Spieler können Drohnen bauen und diese automatisch Ressourcen sammeln lassen — idle-afk Gameplay ohne aktives Spielen.

**Drei Abbau-Modi:**
1. **Schiff-Drohnen:** Vom aktiven Raumschiff aus, solange Spieler online/offline ist
2. **Basis-Drohnen:** Von eigenen Basen aus, permanente Route-Patrouille
3. **Route-Drohnen:** Vordefinierte Multi-Sector-Routen, zeitbasiert

---

## 1. Kern-Mechaniken

### 1.1 Drohnen-Typen

```
SCOUT DRONE (Klein, schnell, wenig Kapazität)
├─ Abbau-Range: 1 Sektor (aktueller Sektor)
├─ Kapazität: 50 ore/resource
├─ Abbau-Zeit: 5 min pro Abbau
├─ Kosten: 100 ore + tech-level
└─ Haltbarkeit: 8h real-time (dann zurück zur Base/Schiff)

HARVESTER DRONE (Mittel, ausdauernd, größere Kapazität)
├─ Abbau-Range: 3er Radius um Base/Sektor
├─ Kapazität: 200 ore/resource
├─ Abbau-Zeit: 10 min pro Abbau
├─ Kosten: 300 ore + 50 crystal + tech-level
└─ Haltbarkeit: 24h real-time

INDUSTRIAL DRONE (Groß, langsam, massive Kapazität)
├─ Abbau-Range: 5er Radius + Route-Support
├─ Kapazität: 500 ore/resource
├─ Abbau-Zeit: 20 min pro Abbau
├─ Kosten: 1000 ore + 200 crystal + 50 exotic
└─ Haltbarkeit: 72h real-time (3 Tage!)
```

### 1.2 Abbau-Modi

#### MODE 1: Schiff-Drohnen (Aktives Schiff)
```
Spieler im Sektor X:Y
├─ Aktiviert "Drone Mining" auf dem Schiff
├─ Drohne fliegt los (Animation: Drohne verlässt Schiff)
├─ Sammelt automatisch im aktuellen Sektor
├─ Kehrt regelmäßig zurück (alle 3 Abbau-Zyklen)
├─ Spieler kann idle sein (afk), Drohne arbeitet weiter
└─ Dauer: Solange Spieler "Drone Mode" aktiv hat

Vorteile:
✓ Keine Base nötig
✓ Überall einsetzbar
✓ Schnelle Aktivierung

Nachteil:
✗ Nur im aktuellen Sektor
✗ Muss "Drone Mode" aktiv schalten
```

#### MODE 2: Basis-Drohnen (Permanente Basis-Patrouille)
```
Basis in Sektor X:Y
├─ Drohne startet täglich um 06:00 UTC
├─ Fliegt zu nearestResourceSector in 3er Radius
├─ Sammelt automatisch (keine Spieler-Interaktion nötig!)
├─ Kehrt am Abend (20:00 UTC) zur Base zurück
├─ Speichert Ressourcen in Base-Storage
└─ Nächster Tag: Wiederholt sich

Vorteile:
✓ Komplett idle! Spieler braucht nie online zu sein!
✓ Permanente Passiv-Generierung
✓ Mehrere Basen = mehrere Drohnen gleichzeitig

Nachteil:
✗ Feste Zeiten (täglich)
✗ Nur 3er Radius
```

#### MODE 3: Route-Drohnen (Multi-Sector Routen)
```
Basis mit Route: B1 → B2 → B3 → B4 → B1
├─ Spieler definiert Route (4–8 Basen/Sektoren)
├─ Drohne fliegt täglich Route ab
├─ Sammelt an jedem Sektor
├─ Bringt Ressourcen zur Start-Base zurück
├─ Zyklisch: Route repeats alle 2 Tage

Beispiel Route (Spieler-Definition):
  Start Base Hasenberl (500:500)
    ↓ Fly to Asteroid Field (501:500) - 10 min
    ↓ Mine 1h (3 cycles × 20min)
    ↓ Fly to Planet (502:499) - 10 min
    ↓ Mine 1h
    ↓ Fly to Meteor (501:498) - 5 min
    ↓ Mine 30min (high exotic yield!)
    ↓ Return to Base (500:500) - 15 min
  Total: ~3.5h real-time pro Zyklus
  Repeats: Alle 2 Tage automatisch

Vorteile:
✓ Strategische Routenplanung
✓ Multi-Sector Abbau
✓ Hohe Yields durch Planung (Meteore, Lava-Planets, etc.)

Nachteil:
✗ Aufwand für Route-Definition
✗ Route muss periodisch optimiert werden
```

---

## 2. Datenbank-Schema

```sql
-- Drohnen (Inventar)
CREATE TABLE player_drones (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL,
  drone_type VARCHAR(50),  -- scout | harvester | industrial
  status VARCHAR(50),  -- idle | mining | returning | damaged
  
  -- Position & Mode
  current_sector_x INT,
  current_sector_y INT,
  assigned_to VARCHAR(50),  -- 'ship' | 'base_id' | 'route_id'
  
  -- Capacity & State
  current_load INT DEFAULT 0,  -- ore equivalent units
  max_capacity INT,  -- je drone_type
  fuel_remaining INT DEFAULT 100,  -- %
  
  -- Timing
  active_since TIMESTAMP,
  last_return TIMESTAMP,
  damage_until TIMESTAMP,  -- wenn zerstört/beschädigt
  
  -- Stats
  total_mined INT DEFAULT 0,
  total_trips INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(player_id) REFERENCES players(id)
);

-- Drohnen-Routen (von Basen)
CREATE TABLE drone_routes (
  id SERIAL PRIMARY KEY,
  base_id INT NOT NULL,
  player_id VARCHAR(255) NOT NULL,
  
  route_name VARCHAR(255),
  waypoints JSONB,  -- [{sector_x, sector_y, mine_duration_minutes}, ...]
  total_duration_minutes INT,  -- geschätzter Zyklus
  
  status VARCHAR(50),  -- active | paused | deleted
  schedule_type VARCHAR(50),  -- daily | every_2_days | weekly
  next_start TIMESTAMP,
  
  stats JSONB DEFAULT '{}',  -- {total_trips, resources_collected, avg_yield}
  
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(base_id) REFERENCES player_bases(id),
  FOREIGN KEY(player_id) REFERENCES players(id)
);

-- Drohnen-Missionen (aktuelle Aufträge)
CREATE TABLE drone_missions (
  id SERIAL PRIMARY KEY,
  drone_id INT NOT NULL,
  mission_type VARCHAR(50),  -- ship_mining | base_patrol | route_mission
  
  -- Mission Details
  target_sector_x INT,
  target_sector_y INT,
  return_to_x INT,
  return_to_y INT,
  
  -- Ressourcen
  resource_type VARCHAR(50),  -- ore | gas | crystal | exotic
  target_amount INT,
  current_collected INT DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMP,
  estimated_completion TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Result
  actual_yield INT,
  result VARCHAR(50),  -- success | partial | failed | damage
  
  FOREIGN KEY(drone_id) REFERENCES player_drones(id)
);
```

---

## 3. Services & Architecture

### 3.1 DroneService (Drohnen-Management)

```typescript
export class DroneService {
  /**
   * Baue eine neue Drohne für Spieler
   */
  async buildDrone(
    playerId: string,
    droneType: 'scout' | 'harvester' | 'industrial'
  ): Promise<Drone> {
    const costs = DRONE_COSTS[droneType];
    const player = await getPlayerResources(playerId);
    
    if (!player.hasResources(costs)) {
      throw new Error('Insufficient_Resources');
    }
    
    // Deduziere Ressourcen
    await deductResources(playerId, costs);
    
    // Erstelle Drohne
    const drone = await db.query(
      `INSERT INTO player_drones (player_id, drone_type, max_capacity, status)
       VALUES ($1, $2, $3, 'idle')
       RETURNING *`,
      [playerId, droneType, DRONE_SPECS[droneType].capacity]
    );
    
    return drone[0];
  }
  
  /**
   * Starte Schiff-Drohnen-Abbau (aktives Schiff)
   */
  async startShipDroneMining(
    playerId: string,
    droneId: number,
    sectorX: number,
    sectorY: number
  ): Promise<Mission> {
    const drone = await getDrone(droneId);
    
    // Validiere Sektor (nicht-betrebar?)
    const env = await sectorContentService.getEnvironment(sectorX, sectorY);
    if (!env.traversable) {
      throw new Error('Cannot_mine_in_non_traversable_sector');
    }
    
    // Erstelle Mission
    const mission = await db.query(
      `INSERT INTO drone_missions (
        drone_id, mission_type, target_sector_x, target_sector_y,
        return_to_x, return_to_y, started_at, estimated_completion
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '5 minutes')
      RETURNING *`,
      [droneId, 'ship_mining', sectorX, sectorY, sectorX, sectorY]
    );
    
    // Update Drohne Status
    await db.query(
      `UPDATE player_drones SET status = 'mining', assigned_to = 'ship'
       WHERE id = $1`,
      [droneId]
    );
    
    return mission[0];
  }
  
  /**
   * Erstelle Basis-Patrouille-Drohne
   */
  async createBaseDroneRoute(
    baseId: number,
    playerId: string,
    droneId: number
  ): Promise<void> {
    const base = await getBase(baseId);
    
    // Auto-find nearestResourceSector in 3er Radius
    const targetSector = await findNearestResourceSector(
      base.sector_x,
      base.sector_y,
      3  // Radius
    );
    
    if (!targetSector) {
      throw new Error('No_resources_in_range');
    }
    
    // Erstelle tägliche Mission
    const mission = await db.query(
      `INSERT INTO drone_missions (
        drone_id, mission_type, target_sector_x, target_sector_y,
        return_to_x, return_to_y, estimated_completion
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 hour')
      RETURNING *`,
      [
        droneId,
        'base_patrol',
        targetSector.x,
        targetSector.y,
        base.sector_x,
        base.sector_y
      ]
    );
    
    // Update Drohne
    await db.query(
      `UPDATE player_drones SET assigned_to = $1, status = 'mining'
       WHERE id = $2`,
      [`base_${baseId}`, droneId]
    );
  }
  
  /**
   * Definiere Route für Route-Drohne
   */
  async createDroneRoute(
    baseId: number,
    playerId: string,
    routeName: string,
    waypoints: Array<{sectorX: number, sectorY: number, minDuration: number}>
  ): Promise<DroneRoute> {
    // Validiere Waypoints
    const totalDuration = waypoints.reduce((sum, w) => sum + w.minDuration, 0);
    
    // Validiere Reichweite vom Base
    const base = await getBase(baseId);
    for (const wp of waypoints) {
      const distance = calculateDistance(base, wp);
      if (distance > 10) {  // Max 10 Sektoren
        throw new Error(`Waypoint_too_far: ${distance} > 10`);
      }
    }
    
    // Erstelle Route
    const route = await db.query(
      `INSERT INTO drone_routes (
        base_id, player_id, route_name, waypoints, total_duration_minutes,
        schedule_type, next_start, status
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '1 day', 'active')
      RETURNING *`,
      [
        baseId,
        playerId,
        routeName,
        JSON.stringify(waypoints),
        totalDuration,
        'daily'
      ]
    );
    
    return route[0];
  }
}
```

### 3.2 DroneExecutorService (Background Worker)

```typescript
export class DroneExecutorService {
  /**
   * Führe Drohnen-Missionen aus (Server-Tick, z.B. alle 5 min)
   */
  async processDroneMissions(): Promise<void> {
    // 1. Alle aktiven Missionen
    const activeMissions = await db.query(
      `SELECT * FROM drone_missions WHERE completed_at IS NULL
       ORDER BY estimated_completion ASC
       LIMIT 100`
    );
    
    for (const mission of activeMissions) {
      // 2. Prüfe ob Zeit abgelaufen
      if (new Date() < new Date(mission.estimated_completion)) {
        continue;  // Noch nicht fertig
      }
      
      // 3. Führe Mission aus
      await executeMission(mission);
    }
    
    // 4. Starte neue Basis-Patrouille-Missionen (täglich um 06:00 UTC)
    const now = new Date();
    if (now.getUTCHours() === 6 && now.getUTCMinutes() < 5) {
      await startDailyBaseDrones();
    }
    
    // 5. Starte Route-Missionen (je nach Schedule)
    await startScheduledRouteMissions();
  }
  
  private async executeMission(mission: DroneMission): Promise<void> {
    // 1. Berechne Abbau-Yield basierend auf Sektor-Typ
    const env = await sectorContentService.getEnvironment(
      mission.target_sector_x,
      mission.target_sector_y
    );
    
    const yield = calculateDroneYield(
      env.type,
      mission.drone_id,  // drone specs
      mission.mission_type
    );
    
    // 2. Speichere Ressourcen in Spieler-Inventar oder Base
    if (mission.mission_type === 'ship_mining') {
      await addPlayerResources(mission.drone_id.player_id, yield);
    } else if (mission.mission_type.includes('base')) {
      await addBaseResources(mission.return_to_base_id, yield);
    }
    
    // 3. Update Mission
    await db.query(
      `UPDATE drone_missions SET completed_at = NOW(), actual_yield = $1, result = 'success'
       WHERE id = $2`,
      [yield.total(), mission.id]
    );
    
    // 4. Update Drohne Status
    await db.query(
      `UPDATE player_drones SET current_load = 0, status = 'idle'
       WHERE id = $1`,
      [mission.drone_id]
    );
  }
  
  private async startScheduledRouteMissions(): Promise<void> {
    const activeRoutes = await db.query(
      `SELECT * FROM drone_routes WHERE status = 'active'
       AND next_start <= NOW()`
    );
    
    for (const route of activeRoutes) {
      // Erstelle Mission für jeden Waypoint
      let currentTime = new Date();
      
      for (const waypoint of route.waypoints) {
        const flightTime = calculateFlightTime(route.base_id, waypoint);
        const completionTime = new Date(
          currentTime.getTime() + flightTime + waypoint.minDuration * 60000
        );
        
        await db.query(
          `INSERT INTO drone_missions (
            route_id, mission_type, target_sector_x, target_sector_y,
            return_to_x, return_to_y, estimated_completion, started_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            route.id,
            'route_mission',
            waypoint.sectorX,
            waypoint.sectorY,
            route.base_id.sector_x,
            route.base_id.sector_y,
            completionTime
          ]
        );
        
        currentTime = completionTime;
      }
      
      // Update Route next_start
      const nextStart = new Date(currentTime.getTime() + 24 * 60 * 60000);  // +1 Tag
      await db.query(
        `UPDATE drone_routes SET next_start = $1 WHERE id = $2`,
        [nextStart, route.id]
      );
    }
  }
}
```

### 3.3 DroneYieldCalculator

```typescript
export function calculateDroneYield(
  environmentType: string,
  droneSpecs: DroneSpec,
  missionType: string
): ResourceYield {
  // Base yields nach Sektortyp (aus restructuring plan)
  const baseYields = RESOURCE_YIELDS[environmentType];
  
  // Drohnen-Effizienz-Multiplikator
  const droneEfficiency = DRONE_SPECS[droneSpecs.type].miningEfficiency;
  // scout: 0.8x (klein, schnell, aber wenig Kapazität)
  // harvester: 1.0x (balanced)
  // industrial: 1.3x (langsam, aber effizient)
  
  // Mission-Multiplikator
  const missionMultiplier = {
    ship_mining: 1.0,       // Spieler kontrolliert direkt
    base_patrol: 0.8,       // Weniger effizient, keine Spieler-Kontrolle
    route_mission: 0.9,     // Automatisch aber optimiert
  }[missionType] || 1.0;
  
  // Berechne finalen Yield
  const finalYield = {
    ore: Math.floor(baseYields.ore * droneEfficiency * missionMultiplier),
    gas: Math.floor(baseYields.gas * droneEfficiency * missionMultiplier),
    crystal: Math.floor(baseYields.crystal * droneEfficiency * missionMultiplier),
    exotic: Math.floor((baseYields.exotic || 0) * droneEfficiency * missionMultiplier),
  };
  
  return finalYield;
}
```

---

## 4. UI/UX Flows

### 4.1 Schiff-Drohnen UI

```
MAIN SCREEN: DRONE MINING PANEL
┌─────────────────────────────────┐
│ 🚁 DRONE MINING CONTROL         │
├─────────────────────────────────┤
│ Status: ACTIVE (mining)         │
│ Drone: Scout-01 [████████░░]   │
│ Capacity: 45/50 ore            │
│                                 │
│ Current Sector: 500:500         │
│ Mining Duration: 00:04:32       │
│ Yield Rate: +12 ore/min        │
│                                 │
│ Next Return: 00:02:15          │
│                                 │
│ [PAUSE]  [RECALL]  [SWITCH]   │
└─────────────────────────────────┘

// Spieler kann afk sein, Drohne arbeitet weiter!
```

### 4.2 Basis-Drohnen Dashboard

```
BASE: Hasenbergl (500:500)
┌─────────────────────────────────────┐
│ DRONE AUTOMATION CENTER            │
├─────────────────────────────────────┤
│ 🚁 Active Drones: 2/4              │
│                                     │
│ Drone-01 (Harvester)               │
│ ├─ Status: IDLE (waiting for 06:00 UTC) │
│ ├─ Last Patrol: 2026-03-06 20:15   │
│ └─ Total Collected: 5,234 ore      │
│                                     │
│ Drone-02 (Industrial)              │
│ ├─ Status: ON ROUTE (Route-Alpha)  │
│ ├─ ETA Return: 2026-03-08 14:30    │
│ └─ Current Yield: 2,145 ore        │
│                                     │
│ [BUILD NEW]  [MANAGE ROUTES]       │
└─────────────────────────────────────┘
```

### 4.3 Route-Editor UI

```
DRONE ROUTE EDITOR: Route-Alpha
┌────────────────────────────────────┐
│ Route Configuration                │
├────────────────────────────────────┤
│ Name: Route-Alpha                  │
│ Base: Hasenbergl (500:500)        │
│                                    │
│ Waypoints (Click to edit):        │
│ 1. Asteroid Field (501:500)       │
│    ├─ Distance: 1 sector          │
│    └─ Mine Duration: 60 min       │
│                                    │
│ 2. Lava Planet (502:499)          │
│    ├─ Distance: 2 sectors         │
│    └─ Mine Duration: 60 min       │
│                                    │
│ 3. Meteor (501:498)               │
│    ├─ Distance: 3 sectors         │
│    └─ Mine Duration: 30 min       │
│                                    │
│ Total Duration: 3h 35min          │
│ Schedule: Daily (starts 06:00 UTC)│
│                                    │
│ [ADD WAYPOINT]  [SAVE]  [DELETE]  │
└────────────────────────────────────┘
```

---

## 5. Balancing & Economy

### 5.1 Drohnen-Kosten vs. Yield

```
SCOUT DRONE
Cost:     100 ore
Yield/Day: ~500 ore (base patrol) × 0.8 = 400 ore
ROI:      2.5 days (break-even)

HARVESTER DRONE
Cost:     300 ore + 50 crystal
Yield/Day: ~1500 ore (base patrol) × 1.0 = 1500 ore
ROI:      5–6 days (break-even)

INDUSTRIAL DRONE
Cost:     1000 ore + 200 crystal + 50 exotic
Yield/Day: ~4000 ore (route mission) × 1.3 = 5200 ore
ROI:      3–4 days (break-even, aber hohe Komplexität)
```

### 5.2 Idle-Spieler vs. Active-Spieler Balance

```
ACTIVE PLAYER (Mining + Drohnen)
├─ Direkter Abbau: +500 ore/30min
├─ Drohne (parallel): +200 ore/30min
└─ Total: +700 ore/30min = Active gameplay rewarded

IDLE PLAYER (nur Drohnen)
├─ Basis-Patrouille: +250 ore/day (Scout)
├─ 2 Drohnen: +500 ore/day
└─ Total: ~500 ore/day (21 ore/hour afk) = Passiv-Generierung

ADVANTAGE: Idle-Spieler können Progression machen, aber deutlich langsamer
```

### 5.3 Ressourcen-Balance

```
SCENARIO: Neuer Spieler mit industriellem Drohnen-System
├─ Tag 1: Baut 1 Scout Drone (100 ore)
├─ Tag 2–3: Scout sammelt jeden Tag ~300 ore
├─ Tag 6: Genug für Harvester (300 ore + 50 crystal)
├─ Tag 7–20: 2 Drohnen × ~500 ore/day = ~7000 ore
├─ Tag 21: Genug für Industrial (1000 ore + 200 crystal + 50 exotic)
├─ Tag 22+: 3 Drohnen mit Route = massive passive income
└─ Limit: Max 4–5 Drohnen pro Base (keine total Afk-Dominanz)
```

---

## 6. Implementierungs-Roadmap

### Phase 3+ (Nach Phase 2 Rebuild)

**Sprint 1: Drohnen-System Grundlagen (2 Wochen)**
- [ ] DB-Schema (player_drones, drone_missions, drone_routes)
- [ ] DroneService (buildDrone, startShipDroneMining, createBaseDroneRoute)
- [ ] DroneYieldCalculator (Yield-Logik)
- [ ] Unit-Tests (15+)

**Sprint 2: Drohnen-Executor (1 Woche)**
- [ ] DroneExecutorService (Background Worker)
- [ ] Tägliche Basis-Patrouille-Automatik
- [ ] Route-Mission-Scheduling
- [ ] Integration-Tests (10+)

**Sprint 3: UI/UX (1 Woche)**
- [ ] Schiff-Drohnen Panel
- [ ] Basis-Drohnen Dashboard
- [ ] Route-Editor UI
- [ ] E2E-Tests (5+)

**Sprint 4: Balancing & Polish (1 Woche)**
- [ ] Yield-Balancing
- [ ] Drohnen-Haltbarkeit + Schäden
- [ ] Performance-Optimierung
- [ ] Final Testing

**Total: 5 Wochen nach Phase 2**

---

## 7. Erweiterungs-Möglichkeiten (Future)

```
PHASE 2 EXTENSIONS:
├─ Drohnen-Kampf (andere Drohnen abschießen)
├─ Drohnen-Upgrades (Panzerung, Geschwindigkeit)
├─ Drohnen-Netzwerk (Drohnen arbeiten zusammen für Bonus)
├─ Expeditions-Drohnen (zu neuen Quadranten)
└─ Boss-Drohnen (spezielle Sektoren nur mit starken Drohnen)

ECONOMY EXTENSIONS:
├─ Drohnen-Verleih (Spieler vermietern Drohnen)
├─ Drohnen-Markt (Kauf/Verkauf)
├─ Drohnen-Versicherung (gegen Verlust)
└─ Drohnen-Rennen (PvP-Minigame)
```

---

## 8. Success Criteria

✅ Spieler können Drohnen bauen und einsetzen  
✅ Schiff-Drohnen funktionieren (aktiv + idle)  
✅ Basis-Drohnen-Patrouille läuft automatisch täglich  
✅ Route-System funktioniert mit Multi-Sector-Routen  
✅ Yield-Balancing ist fair (aktiv > idle, aber idle möglich)  
✅ Performance: DroneExecutor läuft alle 5 min ohne Lag  
✅ UI ist intuitiv + responsive  
✅ 40+ Unit-Tests + 15+ Integration-Tests grün  

---

**Dokument Status:** READY FOR DISCUSSION  
**Komplexität:** MEDIUM-HIGH (neue Subsysteme, Background-Worker, UI)  
**Impact:** HIGH (Kern-Feature für Idle-MMO)  
**Zielstart:** Nach Phase 2 Rebuild (ca. Mitte April 2026)
