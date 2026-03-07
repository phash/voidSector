# Umstellungs-Konzept: Tiefgreifende Systemumstrukturierung (Phase 2)

## Übersicht

Die neuen Sektortypen (Leer, Nebel, Stern, Planet, Asteroid, Schwarzes Loch) und Inhalts-Systeme (Station, Meteor, Piraten, Relikt, NPC Schiff) erfordern eine fundamentale Umgestaltung von:
- **Wirtschaftssystem** (Trading, Ressourcen-Abbau, Preisbildung)
- **Technik-Systeme** (Tech Tree, Schiffs-Module, Forschung)
- **NPC-Ökosystem** (Spawn-Logik, Handels-Routen, Reputations-Auswirkungen)
- **Navigationssystem** (Sektor-Klassifizierung, Autopilot, Nebel-Navgation)
- **Kampf-System** (Encounter-Typen, Piratische Gegner, Station-Verteidigung)

**Kontext:** 🔴 **KEIN LIVE-SPIEL, KEINE SPIELER-DATEN**  
→ Komplett neuer Datensatz nach Umbauten möglich  
→ Keine Data-Migration, Backward-Compatibility-Overhead obsolet  
→ Deutlich simplere, schnellere Umsetzung

**Ziel:** Vollständiger Rebuild der Basis-Systeme mit neuer Seeding-Strategie.

---

## 1. Analyse: Aktuelle Systeme vs. Neue Anforderungen

### 1.1 Aktuelle Struktur (Vor Umstellung)

**Sektor-Modell:**
```
Sektor = {
  x, y,
  environment: string (free-form, z.B. "station", "pirate_base"),
  contents: mixed types (keine strikte Klassifikation)
}
```

**Ressourcen-Abbau:**
- Asteroids → ore/gas/crystal
- Planets → mining möglich, aber undifferenziert
- Keine Ressourcen-Regeneration
- Keine Umgebungs-Auswirkung auf Abbau-Rate

**Handel & Wirtschaft:**
- NPC Stationen (feste Preise)
- Spieler-Markt (Storage + Trading Post)
- Credits als Währung
- Keine Abhängigkeit von Sektortypen

**NPC-Ökosystem:**
- Station-basierte Quests (fetch, scan, bounty, delivery)
- 4 NPC Fraktionen (Händler, Wissenschaftler, Piraten, Uralte)
- Reputations-Bonussse (-100..+100)
- Keine Auswirkung von Sektorumgebung auf NPC-Spawn

**Technik-System:**
- Tech Tree (artefact-basiert)
- Factory mit 5 Rezepten
- Module (Antrieb, Cargo, Scanner, Armor mit MK.I–III)
- Keine Differenzierung nach Planetentyp

**Navigation:**
- Quadrant-basierte Rooms (10,000×10,000 Sektoren pro Quadrant)
- Jumpgates & Wormholes (fast Reisen)
- Autopilot (route-basiert)
- Keine Nebel-Navigation (visuell nur)

---

### 1.2 Neue Anforderungen (Nach Umstellung)

**Strikte Sektortypen-Klassifikation:**
```
environment_type: 'empty' | 'nebula' | 'star' | 'planet' | 'asteroid' | 'black_hole'
  ├─ planet → subtype: 'terrestrial' | 'water' | 'ice' | 'lava'
  └─ star/black_hole → nicht betrebar, Navigationsziele

content_type: 'station' | 'meteor' | 'pirates' | 'relic' | 'npc_ship'
  ├─ Maximal 3 Items pro Sektor
  ├─ Deterministische Generierung (seed-basiert)
  └─ Temporäre Respawn-Zyklen
```

**Ressourcen-System mit Umgebungs-Auswirkung:**
- Planeten: 100–200 ore (je Typ)
- Asteroids: 50–100 ore (häufiger, weniger Ertrag)
- Meteore: 20–50 ore (temporär, 1–4h respawn)
- Abbau-Effizenz hängt von Schiffs-Modulen + Tech-Tier ab
- Ressourcen-Regeneration: 1–24h je nach Typ

**Wirtschaft mit Spatial Bias:**
- Stationen seltener zum Zentrum hin (50% spawn reduction at center)
- Preis-Volatilität je nach lokaler Ressourcen-Verfügbarkeit
- NPC Preise passen sich an Nachfrage/Angebot an
- Nebula-Gebiete → reduzierte Handels-Netzwerke → höhere Preise

**NPC-Ökosystem mit Umgebungs-Intelligenz:**
- NPCs bevorzugen bestimmte Sektortypen (z.B. Piraten → Star/Black Hole Nähe)
- Station-Häufigkeit steuert NPC-Schiff-Häufigkeit (inverse Beziehung)
- Quests referenzieren spezifische Sektortypen + Contents
- Reputation wirkt sich auf lokale Handel-Preise aus

**Technik-Baum an Ressourcen-Verfügbarkeit gekoppelt:**
- Nur bestimmte Planeten-Typen liefern bestimmte Materialien
- Tech-Tier-Upgrades müssen lokale Ressourcen nutzen
- Nebula-Gebiete → seltene Artefakte häufiger
- Forschungs-Geschwindigkeit an Basen-Standort gekoppelt

**Navigation mit Umgebungs-Herausforderungen:**
- Nebel → Scan-Reichweite reduziert (25% statt 100%)
- Stars/Black Holes → können nicht direkt durchquert werden
- Autopilot muss diese Hindernisse umgehen
- Warp-Sprünge scheitern teilweise in Nebeln (retry nötig)

---

## 2. Simplified Approach (kein Live-Spiel)

### 2.1 Vorteile des Rebuilds ohne Spieler

✅ **Keine Data-Migration nötig** — Komplette Löschung alter Tabellen → Neuseed  
✅ **Keine Backward-Compatibility** — Alte Features müssen nicht funktionieren  
✅ **Keine Spieler-Kompensation** — Kein Progress zu schützen  
✅ **Einfacheres Testing** — Fokus auf neue Features, nicht auf Edge-Cases  
✅ **Schnellerer Rollout** — Phasen parallel oder sequenziell ok  

### 2.2 Neue Simplified Phasen

| Phase | Was | Abhängig von | Dauer |
|-------|-----|-------------|-------|
| **1: Core DB** | Migration 031, Services | — | 3 Tage |
| **2: Seeding** | SectorContentService generiert alle Sektoren | Phase 1 | 2 Tage |
| **3: Resources** | Ressourcen-Yields pro Typ, Exotic-Verteilung | Phase 2 | 3 Tage |
| **4: NPC + Quests** | Services implementieren | Phase 3 | 3 Tage |
| **5: Navigation** | Pathfinding v2 | Phase 2 | 2 Tage |
| **6: Live Testserver** | Alles integriert, E2E Tests | Alle | 5 Tage |

**Total: ~3 Wochen** (statt 6 Wochen mit Migration)

---

## 3. Vereinfachtes Phasen-Modell (No Player Data)

### Phase 1: Core Datenbank-Struktur (3 Tage)

**Ziel:** Neue Tabellen erstellen + alte löschen

**Tasks:**
1. Migration 031: `sector_environments` + `sector_contents` + `artefakt_drops`
2. Alle old Tables löschen (kein soft-delete nötig)
3. Constants aktualisieren (SECTOR_ENVIRONMENT_TYPES, SECTOR_CONTENT_TYPES, etc.)
4. SectorContentService erstellen
5. SectorEnvironmentService erstellen

**Output:**
- Saubere neue Datenbank-Struktur
- Services bereit für Seeding

**Risiko:** LOW (Grünes Feld, keine Daten zu schützen)

---

### Phase 2: Sektor-Seeding (2 Tage)

**Ziel:** Komplettes Universum neu generieren (deterministisch)

**Tasks:**
1. **UniverseSeedingService** erstellen
   ```typescript
   // Generiere alle Sektoren in Quadranten 0..9999 × 0..9999
   async seedUniverse(worldSeed: string) {
     for (let qx = 0; qx < 10000; qx += QUADRANT_SIZE) {
       for (let qy = 0; qy < 10000; qy += QUADRANT_SIZE) {
         // For each sector in quadrant
         const sectors = generateSectorsInQuadrant(qx, qy, worldSeed);
         await insertBatch(sectors);
       }
     }
   }
   ```
2. Alle Sektoren mit `sector_environments` + `sector_contents` füllen
3. Determinism-Tests: Gleicher Seed → gleiche Sektoren reproduzierbar
4. Performance-Optimierung: Batch-Insert (min. 10k records)

**Timing:**
- ~10M Sektoren zu generieren + einfügen
- Mit Batch-Inserts: ~2 Stunden
- Mit Validierung: +1 Stunde

**Output:**
- Komplett geseedetes Universum
- Alle Sektoren im DB + Cache

**Optional (aber einfach): #156 — Quadrant Discovery Info** 🟢
```typescript
// #156: Neue Quadranten-Infos mit Entdecker-Name
// Erweiterung der Seeding-Logik:

async function seedQuadrant(qx: number, qy: number, worldSeed: string) {
  // OPTIONAL: Quadrant-Variationen (±80% seed offset)
  const quadrantVariationSeed = Math.random() < 0.5 ? -0.8 : 0.8;
  const quadrantSeed = hashCoords(qx, qy, worldSeed, quadrantVariationSeed);
  
  // Speichere Discovery-Info (optional für Phase 2)
  const quadrant = {
    quadrant_x: qx,
    quadrant_y: qy,
    seed: quadrantSeed,
    discovered_by: null,  // Wird später gefüllt, wenn Spieler betritt
    discovered_at: null,
    created_at: Date.now(),
  };
  
  // Seeding wie normal...
}
```
**Status:** OPTIONAL — kann jetzt oder später gemacht werden, keine Abhängigkeiten

---

### Phase 3: Ressourcen-Yields & Exotic-Verteilung (3 Tage)

**Ziel:** Vollständige Ressourcen-Wirtschaft mit Exotic-Material-Fokus auf Meteore + spezielle Planeten

**🎯 CRITICAL DESIGN: Exotic-Verteilung**

```
EXOTIC RESOURCE DISTRIBUTION:

Meteore (HAUPTQUELLE, viel Exotic):
  └─ 30–40% Chance auf Exotic Materials pro Meteor
  └─ 15–40 exotic pro Abbau-Zyklus
  └─ Temporär (1–4h respawn) → Spieler müssen aktiv suchen

Asteroiden (WENIG Exotic):
  └─ 0–1% Chance auf Exotic
  └─ Quasi keine zuverlässige Quelle
  └─ Häufig, aber zu schwach

Lava-Planeten (SPECIAL):
  └─ 3–5% Chance auf Exotic pro Abbau
  └─ 2–5 exotic Materials
  └─ Permanent, aber selten (1 von ~1000 Planeten)

Exotische Planeten (ULTRA-RARE, ~100–200 im Universum):
  └─ Type A: 50–100 exotic + ore focus
  └─ Type B: 80–150 exotic + crystal focus
  └─ Type C: 100–200 exotic + gas focus
  └─ Strategische Rohstoff-Goldminen für späte Spieler
```

**Tasks:**
1. **ExoticResourceService** — Material-Definition + Häufigkeit
2. **ExoticPlanetGenerator** — ~0.1% aller Planeten als Exotic-Typ
3. **ResourceYieldService** — Yields nach Content-Type + Sektortyp
4. **UniverseYieldStatistics** — Verifiziere Gesamtverteilung
5. **GameBalanceTest** — Spieler-Progressions-Kurve validieren
6. **FirstBaseService** ← **NEW: #150 Integration**
   ```typescript
   // #150: First Base - Freies Placement
   async buildFirstBase(playerId: string, sectorX: number, sectorY: number) {
     // Validations:
     const env = await getSectorEnvironment(sectorX, sectorY);
     
     if (env.type !== 'empty') throw new Error('Only empty sectors');
     if (env.type === 'nebula') throw new Error('No first base in nebula');
     
     const contents = await getSectorContents(sectorX, sectorY);
     const hasPirates = contents.some(c => c.type === 'pirates' && c.status !== 'defeated');
     if (hasPirates) throw new Error('Defeat pirates first or choose different sector');
     
     // Build (kostenlos!)
     const base = await createBase({
       player_id: playerId,
       sector_x: sectorX,
       sector_y: sectorY,
       is_starter_base: true,  // Flag für Wiedererkennung
       cost: 0,  // FREE
     });
     
     return base;
   }
   ```

7. **ScanSharingService** ← **NEW: #159 Integration (Phase 2)**
   ```typescript
   // #159: Scan-Sharing - Fraktion-basiert
   async recordSectorDiscovery(
     playerId: string,
     sectorX: number,
     sectorY: number,
     discoveryScope: 'private' | 'faction' | 'public'
   ) {
     const player = await getPlayer(playerId);
     const faction = player.faction_id;
     
     // Private: Nur dieser Spieler
     if (discoveryScope === 'private') {
       await recordPrivateScan(playerId, sectorX, sectorY);
     }
     
     // Faction: Alle Fraktion-Member
     if (discoveryScope === 'faction' && faction) {
       const factionMembers = await getFactionMembers(faction);
       for (const member of factionMembers) {
         await recordSharedScan(member.id, sectorX, sectorY);
       }
     }
     
     // (Public: später für Relikt-Info, etc.)
   }
   ```

**Output:**
- Exotic fokussiert auf Meteore (35% Drop), selten auf Asteroiden (<1%)
- Spezielle Lava & Exotic Planeten mit höheren Yields
- **#150 First Base:** Freies Placement mit Restrictions
- **#159 Scan-Sharing:** Fraktion-basierte Scan-Daten-Verteilung

**Risiko:** MEDIUM (Wirtschaft + Fraktion-Feature)

---

### Phase 4: NPC-Ökosystem-Remodeling (3 Tage)

**Ziel:** NPC-Spawn + Quests an Sektortypen + Contents binden

**Tasks:**
1. **SectorTypeAwarenessService** — NPC-Präferenz-Matrix
   ```
   Händler: empty > planet > asteroid > nebula
   Wissenschaftler: planet > nebula > asteroid
   Piraten: black_hole > star > empty > nebula
   Uralte: nebula > planet > black_hole
   ```
2. **DynamicPriceService** — Preise basierend auf lokaler Verfügbarkeit + Reputation
   ```
   Base Price = (Produktionskosten × Nachfrage-Faktor)
   Local Price = Base × (1 + nebula_premium × 0.2) × (1 - station_density × 0.3)
   Player Reputation Modifier: [-0.5, +0.5]
   ```
3. **QuestGeneratorV2** — Sektortyp-abhängige Quest-Ziele
   ```
   Quest: "Scan für Anomalien" → nur in Nebeln
   Quest: "Piraten-Beute" → nur bei black_holes
   Quest: "Planetar-Proben" → nur bei Planeten
   ```
4. **NPCShipService** — Mobile Einheiten mit Sektor-Patrouillen
5. Alte Quests löschen (kein Soft-Delete nötig, keine Spieler)

**Output:**
- NPCs spawnen intelligenter je nach Umgebung
- Preise schwanken regional
- Neue Quests mit Environment-Bewusstsein

---

### Phase 5: Navigation-Update (2 Tage)

**Ziel:** Tech-Tree an Ressourcen-Verfügbarkeit koppeln

**Tasks:**
1. **TechResourceRequirementService** — Material-Spezialisierung
   ```
   Tech Tier 1 (Standard): ore + crystal nur
   Tech Tier 2 (Advanced): ore + crystal + exotic (Planeten-exklusiv)
   Tech Tier 3 (Alien): rare materials (Nebula-exklusiv)
   ```
2. **ResearchEfficiencyCalculator** — Base-Standort wirkt sich auf Geschwindigkeit aus
   ```
   Asteroid Base: 1.0x (neutral)
   Planet Base: 1.2x (Ressourcen-Nähe)
   Nebula Base: 1.5x (Alien-Technologie-Bonususs)
   ```
3. **FactoryRecipeV2** — Rezepte aktualisieren für neue Materials
4. Spieler-Tech-Progress speichern + neu-kalkulieren
5. Automatische Tier-Downgrades für unausfürbare Rezepte

**Spieler-Impact:**
- Tech-Progression könnte verlangsamt werden (neue Material-Anforderungen)
- Basen-Relokation könnte wirtschaftlich sinnvoll werden
- Alte Rezepte könnte nicht mehr möglich sein → Rekompensation nötig

**Rollback:** Alte Tech-Tabellen, Recipes zurücksetzen

**Tasks:**
1. **SectorTraversabilityService** — Check: Ist Sektor begehbar?
   ```typescript
   isTraversable(environmentType: SectorEnvironmentType): boolean {
     return ['empty', 'nebula', 'planet', 'asteroid'].includes(environmentType);
   }
   ```
2. **AutopilotPathfinder V2** — Stars/Black Holes umgehen
   - A* mit Traversability-Check
   - Nebel als "teuer" (längere Reisezeit)
3. **WarpJumpValidator** — Direkte Sprünge in Stars → Fail + Message

**Output:**
- Navigation arbeitet mit neuen Sektortypen
- Autopilot umgeht Sterne/Black Holes automatisch

---

### Phase 6: Live Testserver & Integration (5 Tage)

**Ziel:** Alles zusammen testen, dann Go-Live

**Pre-Deployment Checklist:**
- [ ] Alle Unit-Tests grün (300+)
- [ ] Integration-Tests grün (100+)
- [ ] E2E-Tests grün (50+)
- [ ] Determinism-Tests (Seed-Reproduzierbarkeit)
- [ ] Universe-Seeding erfolgreich (10M+ Sektoren)
- [ ] Performance-Tests bestanden (Batch-Insert ~2h)

**Schritte:**
1. **Cleanup:** Alte Datenbank-Strukturen löschen
2. **Fresh Seed:** Komplettes Universum neu seeden
3. **Testserver Deploy:** Alle Services online
4. **Smoke Tests:** Gameplay-Szenarien durchspielen
5. **Go-Live:** Auf Production deployen

**Go-Live Timeline:**
```
T-5h: Datenbank-Backup
T-2h: Services testen
T-0h: Universe-Seeding starten (~2-3h)
T+0h: Services starten
T+1h: Spieler-Server online
T+5h: Monitoring, Fehler-Logs prüfen
```

**Fertig!** 🚀

---

## 4. Vereinfachte Seeding-Strategie (Kein Player Data)

### 4.1 Fresh Rebuild (alle alten Tabellen weg)

```sql
-- Phase 1: Cleanup (löschen ohne Soft-Delete)
DROP TABLE IF EXISTS sectors CASCADE;
DROP TABLE IF EXISTS player_sectors CASCADE;
-- ... alle alten Struktur-Tabellen

-- Phase 031: Neu mit neuen Tabellen
CREATE TABLE sector_environments (...);
CREATE TABLE sector_contents (...);
CREATE TABLE artefakt_drops (...);
```

### 4.2 Universe-Seeding Script

```typescript
async function seedUniverseFromScratch() {
  const WORLD_SEED = 'voidSector_2026_rebuild';
  const QUADRANT_SIZE = 10_000;
  const TOTAL_QUADRANTS = 10_000;  // 0..9999
  
  // Statistiken sammeln
  const stats = {
    sectorsCreated: 0,
    contentsCreated: 0,
    startTime: Date.now(),
  };
  
  // Batch-Insert für Performance
  const BATCH_SIZE = 10_000;
  let environmentBatch = [];
  let contentBatch = [];
  
  for (let qx = 0; qx < TOTAL_QUADRANTS; qx += 1) {
    for (let qy = 0; qy < TOTAL_QUADRANTS; qy += 1) {
      // Für jeden Quadrant: Alle Sektoren seeden
      const quadrantSectors = generateSectorsInQuadrant(qx * QUADRANT_SIZE, qy * QUADRANT_SIZE, WORLD_SEED);
      
      for (const sector of quadrantSectors) {
        // Sektor-Umgebung
        const env = sectorContentService.generateEnvironment(sector.x, sector.y, WORLD_SEED);
        environmentBatch.push({
          sector_x: sector.x,
          sector_y: sector.y,
          quadrant_x: Math.floor(sector.x / QUADRANT_SIZE),
          quadrant_y: Math.floor(sector.y / QUADRANT_SIZE),
          ...env,
        });
        
        // Sektor-Inhalte
        const contents = sectorContentService.generateContent(sector.x, sector.y, WORLD_SEED);
        for (const content of contents) {
          contentBatch.push({
            sector_x: sector.x,
            sector_y: sector.y,
            quadrant_x: Math.floor(sector.x / QUADRANT_SIZE),
            quadrant_y: Math.floor(sector.y / QUADRANT_SIZE),
            ...content,
          });
        }
        
        stats.sectorsCreated++;
        stats.contentsCreated += contents.length;
      }
      
      // Batch-Insert wenn voll
      if (environmentBatch.length >= BATCH_SIZE) {
        await db.batchInsert('sector_environments', environmentBatch);
        environmentBatch = [];
      }
      
      if (contentBatch.length >= BATCH_SIZE) {
        await db.batchInsert('sector_contents', contentBatch);
        contentBatch = [];
      }
      
      // Progress log
      if ((qx * TOTAL_QUADRANTS + qy) % 100 === 0) {
        console.log(`Seeding progress: ${qx}/${qy} — ${stats.sectorsCreated} sectors, ${stats.contentsCreated} contents`);
      }
    }
  }
  
  // Flush remaining batches
  if (environmentBatch.length > 0) {
    await db.batchInsert('sector_environments', environmentBatch);
  }
  if (contentBatch.length > 0) {
    await db.batchInsert('sector_contents', contentBatch);
  }
  
  console.log(`✅ Universe seeded in ${Date.now() - stats.startTime}ms`);
  console.log(`   Sectors: ${stats.sectorsCreated}`);
  console.log(`   Contents: ${stats.contentsCreated}`);
  
  return stats;
}
```

### 4.3 Deterministisches Seeding validieren

```typescript
async function validateSeedingConsistency() {
  // Test: Gleicher Seed produziert gleiche Sektoren
  const sector1a = sectorContentService.generateEnvironment(500, 500, 'voidSector_2026_rebuild');
  const sector1b = sectorContentService.generateEnvironment(500, 500, 'voidSector_2026_rebuild');
  
  assert(JSON.stringify(sector1a) === JSON.stringify(sector1b), 
    'Seeding nicht deterministisch!');
  
  // Test: DB-Daten entsprechen generierten Daten
  const dbSector = await db.query(
    'SELECT * FROM sector_environments WHERE sector_x = 500 AND sector_y = 500'
  );
  
  assert(dbSector[0].environment_type === sector1a.type,
    'DB-Seeding nicht mit Service-Seeding konsistent!');
  
  console.log('✅ Seeding-Konsistenz validiert');
}
```

---

## 5. Test-Strategie (Simplified)

### 5.1 Test-Kategorien

| Kategorie | Anzahl | Fokus |
|-----------|--------|-------|
| **Unit Tests** | 150+ | SectorContentService, ResourceYieldService, ExoticPlanetGenerator |
| **Integration Tests** | 80+ | Service-Interaktionen, DB-Constraints |
| **E2E Tests** | 40+ | Gameplay-Szenarien, Sektor-Navigation, Abbau |
| **Seeding Tests** | 50+ | Deterministismus, Yield-Konsistenz, Exotic-Verteilung |
| **Performance Tests** | 20+ | Batch-Insert Speed, Query-Performance |

### 5.2 Migration-Validierung

```typescript
async function validateMigration() {
  // 1. Seed-Konsistenz: Alte Sector-Seeds → sollten reproduzierbar sein
  const oldSectors = await getOldSectors();
  for (const sector of oldSectors) {
    const newEnv = generateEnvironment(sector.x, sector.y, WORLD_SEED);
    assert(seedConsistent(sector.seed, newEnv.seed), 
      `Seed mismatch at ${sector.x},${sector.y}`);
  }
  
  // 2. Content-Vollständigkeit: Alle alten Contents gemappt
  const oldContents = await countOldContents();
  const newContents = await countNewContents();
  assert(oldContents === newContents, 'Content count mismatch');
  
  // 3. Enum-Validität: Alle environment_type/content_type sind valid
  const invalidEnvs = await query(
    'SELECT * FROM sector_environments WHERE environment_type NOT IN (...)'
  );
  assert(invalidEnvs.length === 0, `Invalid environment types: ${invalidEnvs}`);
  
  // 4. Referenz-Integrität: Alle sector_contents haben gültige sector_environments
  const orphanedContents = await query(`
    SELECT * FROM sector_contents
    WHERE (sector_x, sector_y) NOT IN (SELECT sector_x, sector_y FROM sector_environments)
  `);
  assert(orphanedContents.length === 0, 'Orphaned contents detected');
  
  // 5. Spieler-Daten: Tech-Baum, Basen, Ressourcen sind konsistent
  await validatePlayerTechProgression();
  await validatePlayerBaseValidity();
}
```

---

## 6. Risk-Mitigation

### 6.1 Kritische Risiken

| Risk | Wahrscheinlichkeit | Impact | Mitigation |
|------|------------------|--------|-----------|
| **Datenbank-Corruption** | Medium | CRITICAL | Backups vor Phase F, Transaktions-Rollback |
| **Spieler blockiert** (begehbar-Check fails) | Medium | HIGH | Whitelist für ungültige Sektoren, warp-to-home fallback |
| **Autopilot-Chaos** | Medium | HIGH | Testing mit 100k Pfade, Manual-Mode fallback |
| **Preisvolatilität** (wilde Sprünge) | Low | MEDIUM | Price-Caps, Stabilisierung über 24h |
| **NPC-Spawning kaputt** | Low | HIGH | Fallback zu altem NPC-Spawn, Neustart erzwingt |
| **Ressourcen-Yields unrealistisch** | Low | MEDIUM | Spieler-Kompensation, Rapid-Patch |

### 6.2 Feature-Flags

```typescript
// Alle neuen Services hinter Flags
export const FEATURE_FLAGS = {
  SECTOR_ENVIRONMENT_V2: process.env.ENABLE_SECTOR_ENV_V2 === 'true',
  RESOURCE_YIELD_V2: process.env.ENABLE_RESOURCE_YIELD_V2 === 'true',
  DYNAMIC_PRICING_V2: process.env.ENABLE_DYNAMIC_PRICING_V2 === 'true',
  NPC_ECOSYSTEM_V2: process.env.ENABLE_NPC_ECOSYSTEM_V2 === 'true',
  NAVIGATION_V2: process.env.ENABLE_NAVIGATION_V2 === 'true',
};

// Im Service:
function getResourceYield(sectorType: string) {
  if (FEATURE_FLAGS.RESOURCE_YIELD_V2) {
    return resourceYieldServiceV2.calculate(sectorType);
  } else {
    return resourceYieldServiceV1.calculate(sectorType);
  }
}
```

### 6.3 Notfall-Hotlines

| Scenario | Aktion | Owner |
|----------|--------|-------|
| Datenbank-Error | Rollback zu Phase-E-Backup | DBA |
| Spieler blockiert | Whitelist Sektor, erlauben warp-to-home | Game Dev |
| Autopilot broken | Deaktivieren, Fallback zu Manual | Nav Dev |
| Preise crahs | Price-Limiter aktivieren | Economy Dev |

---

## 7. Kommunikation & Support

### 7.1 Spieler-Ankündigung (vor Phase A)

```markdown
# 🎮 Große Umstrukturierung: Sektor-System-Überhaul

Liebe Spieler,

In den nächsten 6 Wochen werden wir das Sektor- und Wirtschafts-System
fundamental umgestalten. Das Universum wird lebendiger und komplexer!

## Was ändert sich:
- **Sektoren** bekommen jetzt unterschiedliche Typen (Planeten, Nebel, Sterne, etc.)
- **Ressourcen** hängen vom Planetentyp ab (unterschiedliche Yields)
- **NPC & Quests** werden umgebungs-intelligent
- **Preise** schwanken regional je nach Ressourcen-Verfügbarkeit
- **Navigation** wird anspruchsvoller (müsst Sterne umgehen)

## Kompensation:
- Spieler mit >50% Progress erhalten Ressourcen-Bonus
- Alte Quests werden archiviert, neue Quests mit besseren Rewards
- Tech-Downgrades führen zu automatischen Ressourcen-Rückerstattungen

## Timeline:
- Woche 1–2: Datenbank-Upgrade (im Hintergrund)
- Woche 3–4: Ressourcen-Umstellung
- Woche 5–6: Go-Live

Fragen? Support bereit unter discord://...

—voidSector Team
```

### 7.2 Support-Guide

**Häufige Fragen:**

Q: "Meine Daten sind weg?"  
A: Nein, alles wurde migriert. Sieh nach deiner Basis → neue Ressourcen-Yields

Q: "Mein Autopilot funktioniert nicht?"  
A: Stars können nicht durchquert werden. Neue Route wird berechnet (klick Refresh)

Q: "Preise sind verrückt geworden?"  
A: Preise sind jetzt regional. Finde billige Asterioden-Felder zum Handeln

Q: "Mein Tech ist weg?"  
A: Tech wurde downgraded wenn Ressourcen nicht erreichbar. Kompensation im Inventar

---

## 6. Erfolgs-Kriterien

✅ **Phase 1:** Services + Constants vollständig  
✅ **Phase 2:** Universe geseedet, Determinismus validiert  
✅ **Phase 3:** Exotic-Yields korrekt (Meteore >> Asteroiden)  
✅ **Phase 4:** NPC + Quest-Services funktionieren  
✅ **Phase 5:** Navigation mit Hindernissen ok  
✅ **Phase 6:** Testserver stable, ready for launch  

**Final Validation:**
- 200+ Unit-Tests grün
- 80+ Integration-Tests grün
- 40+ E2E-Tests grün
- Seeding-Konsistenz validiert
- Exotic-Statistiken im Erwartungs-Bereich

---

## 7. Anhang: Ressourcen-Referenztabelle

### Ressourcen-Yields nach Sektortyp & Content (Exotic-Fokus!)

```
ASTEROID FIELD (HÄUFIG, ABER SCHLECHT):
  ore: 50–100 (1h respawn)
  gas: 5–10
  crystal: 8–15
  exotic: 0–1 (0.5% Chance) ← QUASI KEINE SOURCE!

METEOR (HAUPTQUELLE, TEMPORÄR 1–4h):
  ore: 20–50
  gas: 2–5
  crystal: 3–8
  exotic: 15–40 (35% Chance) ← GOLD MINE! 🎯

PLANET (TERRESTRIAL):
  ore: 100–150
  gas: 10–20
  crystal: 5–10
  exotic: 0–1 (1% Chance)

PLANET (WATER):
  ore: 50–80
  gas: 40–60 (Spezialität)
  crystal: 3–8
  exotic: 0–1 (0.5%)

PLANET (ICE):
  ore: 60–100
  gas: 20–30
  crystal: 8–15
  exotic: 0–2 (1%)

PLANET (LAVA, SPECIAL):
  ore: 80–120
  gas: 30–50
  crystal: 12–25
  exotic: 2–5 (3–5% Chance) ← ALTERNATIVE SOURCE!

PLANET (EXOTIC-TYPE-A, ULTRA-RARE ~0.1%):
  ore: 200–300
  gas: 10–20
  crystal: 5–10
  exotic: 50–100 (GUARANTEED) ← END-GAME GOLDRUSH!

PLANET (EXOTIC-TYPE-B, ULTRA-RARE):
  ore: 20–30
  gas: 10–20
  crystal: 30–50
  exotic: 80–150 (GUARANTEED)

PLANET (EXOTIC-TYPE-C, ULTRA-RARE):
  ore: 10–20
  gas: 20–50
  crystal: 20–40
  exotic: 100–200 (GUARANTEED)

STAR / BLACK HOLE:
  — Nicht begehbar, keine Ressourcen

NEBULA (Region-Bonus):
  × 1.5 artefakt_drop_chance für Relikt-Inhalte
```

### Universale Exotic-Statistiken

```
Universum-Größe: ~100M Sektoren
Sektorverteilung:
  └─ 70% empty (70M)
  └─ 2% nebula (2M) 
  └─ 3% star (3M) — nicht begehbar
  └─ 10% planet (10M)
  └─ 12% asteroid (12M)
  └─ 3% black_hole (3M) — nicht begehbar

Exotische-Material-Vorkommen:
  └─ Meteore: ~2M Sektoren × 30 avg = ~60M exotic total
  └─ Lava-Planeten: ~300k × 3 avg = ~900k exotic
  └─ Exotische Planeten: ~150 × 75 avg = ~11k exotic
  └─ Normale Asteroiden: ~15M × 0.0075 avg = ~112k exotic
  └─ **Gesamt: ~62M Exotic Materials im Universum** 🎯

Spieler-Strategie:
  ├─ Early Game: Asteroid-Grinding (einfach, wenig Reward)
  ├─ Mid Game: Meteor-Jagd (aufregend, 30+ Materials pro Treffer!)
  ├─ Late Game: Exotische Planeten-Suche (strategisch, End-Game Content)
  └─ Veterans: Base-Standort-Optimierung + Handels-Arbitrage
```

### NPC Präferenz-Verteilung

```
TRADERS (Händler):
  ├─ 40% empty
  ├─ 30% planet
  ├─ 20% asteroid
  └─ 10% nebula

SCIENTISTS (Wissenschaftler):
  ├─ 35% planet
  ├─ 30% nebula
  ├─ 20% asteroid
  └─ 15% empty

PIRATES (Piraten):
  ├─ 40% black_hole vicinity
  ├─ 30% star vicinity
  ├─ 20% empty
  └─ 10% asteroid

ANCIENTS (Uralte):
  ├─ 50% nebula
  ├─ 25% planet
  ├─ 15% black_hole
  └─ 10% asteroid
```

---

**Dokument Status:** READY FOR REVIEW  
**Autor:** Claude Opus 4.6  
**Datum:** 2026-03-06  
**Zielstatus:** Genehmigt für Phase-A-Start

