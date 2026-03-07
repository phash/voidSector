# Finaler Umsetzungsplan: GitHub Issues Integration

**Status:** Aktualisiert mit Nutzer-Entscheidungen  
**Datum:** 2026-03-06  
**Kontext:** Keine Spieler-Daten, frischer Rebuild

---

## 📊 Issue-Klassifizierung

### 🟢 PHASE 2 REBUILD INCLUDED (direkt umsetzen)

| # | Titel | Phase | Priorität | Task |
|---|-------|-------|-----------|------|
| #160 | schwarzes Loch | 5 | HIGH | SectorTraversabilityService |
| #157 | Black Hole Quest | 4 | MEDIUM | QuestGeneratorV2 |
| #161 | Detail-Follow | 4 | LOW | DetailView-Handler |
| #147 | Auto-Update NAV | 5 | MEDIUM | AutopilotPathfinder |

**Action:** ✅ Implementiere nach Plan, keine Änderungen

---

### 🟡 PHASE 2 REBUILD ERGÄNZUNG (UPDATED PLANS)

#### #150 — First Base (Freies Placement) 
**Phase:** 3 (Ressourcen-Yields)  
**Priorität:** MEDIUM  
**New Task 3.6:** FirstBaseService

```typescript
/**
 * #150 - First Base: Spieler bauen erste Base KOSTENLOS
 * Restrictions: empty sector, nicht pirate, nicht nebula
 */

export class FirstBaseService {
  async buildFirstBase(
    playerId: string,
    sectorX: number,
    sectorY: number
  ): Promise<Base> {
    // 1. Sektor validieren
    const env = await sectorContentService.getEnvironment(sectorX, sectorY);
    
    if (env.type !== 'empty') {
      throw new GameError('Base_Error_OnlyEmpty', `Sektor Typ: ${env.type}`);
    }
    
    if (env.type === 'nebula') {
      throw new GameError('Base_Error_NoNebula', 'Erste Base nicht in Nebeln');
    }
    
    // 2. Contents checken (Piraten?)
    const contents = await sectorContentService.getContents(sectorX, sectorY);
    const activePirates = contents.filter(
      c => c.type === 'pirates' && !c.defeated_at
    );
    
    if (activePirates.length > 0) {
      throw new GameError('Base_Error_PiratesPresent', 
        'Besiege Piraten zuerst oder wähle anderen Sektor');
    }
    
    // 3. Base bauen (KOSTENLOS!)
    const base = await db.query(
      `INSERT INTO bases (
        player_id, sector_x, sector_y, 
        is_starter_base, construction_cost, created_at
      ) VALUES ($1, $2, $3, true, 0, NOW())
      RETURNING *`,
      [playerId, sectorX, sectorY]
    );
    
    // 4. Benachrichtigung
    await notificationService.send(playerId, {
      type: 'base_constructed',
      message: `Erste Base in Sektor ${sectorX}:${sectorY} gebaut!`,
      sector: { x: sectorX, y: sectorY },
    });
    
    return base[0];
  }
}
```

**DB-Migration:** Neue Spalte in bases-Tabelle
```sql
ALTER TABLE bases ADD COLUMN is_starter_base BOOLEAN DEFAULT false;
```

**Server Message Handler:**
```typescript
// In SectorRoom.ts MessageHandlers
room.onMessage('buildFirstBase', async (client, data) => {
  const { sectorX, sectorY } = data;
  const player = client.userData;
  
  try {
    const base = await firstBaseService.buildFirstBase(
      player.id,
      sectorX,
      sectorY
    );
    
    client.send('base_built', { base });
  } catch (error) {
    client.send('error', { code: error.code, message: error.message });
  }
});
```

**Tests:**
- ✓ Empty Sector → Success
- ✓ Non-Empty Sector → Fail (ore, gas, crystal, etc.)
- ✓ Nebula → Fail
- ✓ Pirate Present → Fail
- ✓ Pirate Defeated → Success
- ✓ Cost is 0 (free)

**Estimated Effort:** 2–3 Tage (implementiert in Phase 3)

---

#### #159 — Scan-Sharing (Fraktion-Feature)
**Phase:** 2 (DB-Schema) + 3 (Implementierung)  
**Priorität:** HIGH  
**Integration:** Phase 3 zusätzliche Task

```typescript
/**
 * #159 - Scan-Sharing: Alle Fraktion-Members sehen Scans
 * Private Scans nur für Scanner
 * Faction Scans für alle Faction-Member
 */

export class ScanSharingService {
  async recordSectorDiscovery(
    playerId: string,
    sectorX: number,
    sectorY: number,
    discoveryScope: 'private' | 'faction' | 'public'
  ): Promise<void> {
    const player = await db.query(
      'SELECT faction_id FROM players WHERE id = $1',
      [playerId]
    );
    
    // Private: Nur dieser Spieler
    if (discoveryScope === 'private') {
      await db.query(
        `INSERT INTO sector_discoveries (
          player_id, sector_x, sector_y, discovered_at, scope
        ) VALUES ($1, $2, $3, NOW(), 'private')`,
        [playerId, sectorX, sectorY]
      );
    }
    
    // Faction: Alle Fraktion-Member
    if (discoveryScope === 'faction' && player[0].faction_id) {
      const factionMembers = await db.query(
        'SELECT id FROM players WHERE faction_id = $1',
        [player[0].faction_id]
      );
      
      for (const member of factionMembers) {
        await db.query(
          `INSERT INTO sector_discoveries (
            player_id, sector_x, sector_y, discovered_at, scope, shared_by
          ) VALUES ($1, $2, $3, NOW(), 'faction', $4)`,
          [member.id, sectorX, sectorY, playerId]
        );
      }
    }
  }
  
  async getDiscoveredSectors(
    playerId: string,
    includeFactionShares: boolean = true
  ): Promise<Sector[]> {
    if (!includeFactionShares) {
      return db.query(
        'SELECT * FROM sector_discoveries WHERE player_id = $1 AND scope = $2',
        [playerId, 'private']
      );
    }
    
    // Include faction shares
    return db.query(
      `SELECT * FROM sector_discoveries 
       WHERE player_id = $1 AND (scope = 'private' OR scope = 'faction')`,
      [playerId]
    );
  }
}
```

**DB-Schema (neue Tabelle):**
```sql
CREATE TABLE sector_discoveries (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL,
  sector_x INT NOT NULL,
  sector_y INT NOT NULL,
  discovered_at TIMESTAMP DEFAULT NOW(),
  scope VARCHAR(20) DEFAULT 'private',  -- private | faction | public
  shared_by VARCHAR(255),  -- Player ID wer es gescannt hat (bei faction)
  FOREIGN KEY(player_id) REFERENCES players(id)
);

CREATE INDEX idx_discoveries_player ON sector_discoveries(player_id, scope);
CREATE INDEX idx_discoveries_coords ON sector_discoveries(sector_x, sector_y);
```

**Migration 032 (neue Migrations-Nr!):**
```sql
CREATE TABLE sector_discoveries (...);
```

**Tests:**
- ✓ Private Scan → Nur Scanner sieht
- ✓ Faction Scan → Alle Fraktion-Member sehen
- ✓ No Faction → Default private
- ✓ getDiscoveredSectors respektiert scope

**Estimated Effort:** 3–4 Tage (Phase 3, nach Phase 2)

---

### 🟢 OPTIONAL (Jederzeit ok)

#### #156 — Quadrant Discovery Info
**Phase:** 2 (optional) oder später  
**Priorität:** LOW  
**Status:** Vorbereitet in Seeding-Service, nicht blockierend

```typescript
// In UniverseSeedingService
async function seedQuadrant(qx: number, qy: number, worldSeed: string) {
  // Optional: Seed-Variation per Quadrant (±80%)
  const variation = Math.random() < 0.5 ? -0.8 : 0.8;
  const quadrantSeed = calculateVariedSeed(worldSeed, qx, qy, variation);
  
  // Quadrant-Info speichern (optional)
  const quadrant = {
    quadrant_x: qx,
    quadrant_y: qy,
    seed: quadrantSeed,
    discovered_by: null,  // Wird gefüllt bei erstem Eintritt
    discovered_at: null,
    variation_offset: variation,
  };
  
  // Insert optional
  // await db.query('INSERT INTO quadrants (...) VALUES (...)', quadrant);
}
```

**Action:** Kann später schnell implementiert werden, keine Urgenz

---

### 🔵 DEFERRED (Nächste Sessions)

#### #149 — Station Terminal UI
**Phase:** Nach Phase 2  
**Status:** Brainstorm nächstes Mal (/brainstorm skill)  
**Action:** ⏳ Nicht in Phase 2 Rebuild

#### #146 — Schiffswechsel (Multi-Ship)
**Phase:** Phase 3+ (separates Gameplay-Feature)  
**Status:** Design-Spec erforderlich  
**Action:** ⏳ Nach Phase 2 planen

#### UI/UX Issues (#158, #154, #155, #152, #151, #153)
**Phase:** Parallel oder nach Phase 2  
**Status:** Independent, nicht blockierend  
**Action:** ⏳ Könnte mit QA-Team parallel laufen

---

## 📋 FINALER TIMELINE

### Phase 2 Rebuild (3 Wochen)

```
PHASE 1: Core DB (3 Tage)
├─ Migration 031: sector_environments + sector_contents
└─ Migration 032: sector_discoveries (#159 vorbereitung)
✓ Issue #160 Fundament: Black Hole als non-traversable

PHASE 2: Seeding (2 Tage)
├─ UniverseSeedingService
├─ ExoticPlanetGenerator (Meteore + Lava + Exotic)
└─ OPTIONAL: Quadrant Info (#156)

PHASE 3: Ressourcen + FirstBase (3 Tage)
├─ ExoticResourceService
├─ ResourceYieldService
├─ GameBalanceTest
├─ FirstBaseService (#150) ← NEW TASK
└─ ScanSharingService (#159) ← NEW TASK

PHASE 4: NPC + Quests (3 Tage)
├─ SectorTypeAwarenessService
├─ DynamicPriceService
├─ QuestGeneratorV2
│  ├─ Black Hole Quest (#157)
│  └─ Sector-Type Awareness
├─ DetailView-Follow Handler (#161)
└─ NPCShipService

PHASE 5: Navigation (2 Tage)
├─ SectorTraversabilityService
├─ AutopilotPathfinder V2 (#147)
└─ WarpJumpValidator

PHASE 6: Testing + Go-Live (5 Tage)
├─ 200+ Unit Tests grün
├─ 80+ Integration Tests grün
├─ Fresh Universe-Seed
└─ Launch!
```

**Total: 3 Wochen + Issue-Integrationen**

---

## ✅ Checklist für Implementierung

### Phase 1: Core DB
- [ ] Migration 031 erstellen + run
- [ ] Migration 032 erstellen (sector_discoveries)
- [ ] Constants aktualisieren
- [ ] Services scaffolden

### Phase 2: Seeding
- [ ] UniverseSeedingService implementieren
- [ ] ExoticPlanetGenerator (0.1% planets)
- [ ] Determinism-Tests
- [ ] Performance-Tests (10M sectors ~2h)
- [ ] Optional: Quadrant-Info vorbereiten

### Phase 3: Ressourcen + #150 + #159
- [ ] ExoticResourceService
- [ ] ResourceYieldService (alle Yields)
- [ ] GameBalanceTest
- [ ] **FirstBaseService (#150)** ← Neue Task
  - [ ] Server Message Handler
  - [ ] DB-Migration (is_starter_base)
  - [ ] Tests (5 Szenarios)
- [ ] **ScanSharingService (#159)** ← Neue Task
  - [ ] recordSectorDiscovery()
  - [ ] getDiscoveredSectors()
  - [ ] Tests (4 Szenarios)

### Phase 4: NPC + Quests + #157 + #161
- [ ] SectorTypeAwarenessService
- [ ] DynamicPriceService
- [ ] QuestGeneratorV2
  - [ ] **Black Hole Kartographie-Quest (#157)**
  - [ ] Sector-Type Awareness
- [ ] **DetailView-Follow Handler (#161)**
- [ ] NPCShipService

### Phase 5: Navigation + #147
- [ ] SectorTraversabilityService
- [ ] AutopilotPathfinder V2
  - [ ] **Auto-Update NAV (#147)**
- [ ] WarpJumpValidator

### Phase 6: Testing
- [ ] All unit tests pass (200+)
- [ ] All integration tests pass (80+)
- [ ] Seeding-Konsistenz validiert
- [ ] Exotic-Stats im Erwartungsbereich
- [ ] Fresh seed + launch

---

## 📊 Issue Summary

| Issue | Titel | Status | Phase | Effort |
|-------|-------|--------|-------|--------|
| #160 | schwarzes Loch | ✅ Included | 5 | 1d |
| #157 | Black Hole Quest | ✅ Included | 4 | 1d |
| #161 | Detail-Follow | ✅ Included | 4 | 0.5d |
| #147 | Auto-Update NAV | ✅ Included | 5 | 1d |
| #150 | First Base | ✅ **NEW** | 3 | 2–3d |
| #159 | Scan-Sharing | ✅ **NEW** | 3 | 3–4d |
| #156 | Quadrant Info | ⏳ Optional | 2 | 1d |
| #149 | Station Terminal | ⏳ Defer | Later | TBD |
| #146 | Multi-Ship | ⏳ Defer | Later | TBD |
| #158–#153 | UI/UX | ⏳ Parallel | Any | 2–5d |

**Total Phase 2 Effort: ~3 Wochen + Issue-Integrationen**

---

## 🎯 Nächste Schritte

1. ✅ Pläne aktualisiert mit #150 + #159
2. ⏳ **Nächste Session:** #149 Brainstorm (Station Terminal)
3. 🚀 **Start Phase 1:** Core DB + Services
4. 📅 Timeline: Start März 7, Launch März 28

**Status:** READY FOR EXECUTION 🟢

---

**Dokument Status:** FINAL  
**Letztes Update:** 2026-03-06  
**Autor:** Claude  
**Approval:** ✅ Ready
