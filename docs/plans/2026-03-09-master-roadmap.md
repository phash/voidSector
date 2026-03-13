# VoidSector — Master Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Stand:** 2026-03-13 · Zuletzt aktualisiert nach i18n Phase A Merge

**Architektur:** Colyseus (Rooms), PostgreSQL (queries.ts), Redis (AP/State), React + Zustand (Client), Vitest (Tests).

---

## ✅ Abgeschlossen

| Phase | Inhalt |
|-------|--------|
| Phasen 1–7 | Fuel, Jumpgates, Autopilot, Ship Designer, Trade, Factions, Quests, Combat v2 |
| Codebase Review | SectorRoom → 10 Services, ESLint/Prettier, pino |
| Admin Console | Admin API, Quadrant-System, QUAD-MAP, First-Contact-Naming |
| Cockpit | 6-Section-Layout, Bookmarks, Staleness, Nav-Grid-Overhaul |
| Quality Sprints S0–S4 | Bugfixes, UI Quick Wins, Navigation, Mining/Trade, Scan/Schiff |
| Phase 2 | Sektor-System Rebuild (#162–168) |
| Phase LU | Lebendiges Universum (#177–184) |
| Phase D | Drohnen-System (#169) |
| Phase EW | frictionEngine, expansionEngine, warfareEngine, StrategicTickService |
| Phase AQ | Alien Quest System (#170–175) |
| Humanity Rep | Alien-Rep-Aggregat, Encounter-Modifier, AlienEncounterToast |
| ACEP | XP-Engine, 4 Paths, Traits, Permadeath, 3-Tab-UI, Sec3-Detailpanel |
| Forschung & Wissen | Wissen-Ressource, Artefakte (9 Typen), Lab 1–5, TechTreeCanvas (Migration 044) |
| Hull-Legacy-Cleanup | HullType/HULLS entfernt, BASE_*-Konstanten, Hyperjump V2 permanent (Migration 060) |
| Playtest-Fixes | HANGAR entfernt, drive_mk1 Starter, actionError/badgeAwarded Handler, BASE_CARGO=10, Cargo-Module ×2 |
| i18n Phase A | DE/EN Locale-Dateien, i18n.ts, ui-helpers.ts, alle UI-Strings externalisiert |

---

## 🔜 Offen — Nächste Schritte

| Prio | Feature | Notizen |
|------|---------|---------|
| 1 | **Wreck-POIs auf dem Radar** | Explizit als nächstes in CLAUDE.md |
| 2 | i18n Phase B | EN-Texte vervollständigen, Sprach-Toggle |
| — | Sprint 0–4 Restbugs | Soweit nicht in S0–S4 erledigt: #143 (Gates), #144 (Piratenkampf), #154 (Sektor-Infos) |

---

## Abhängigkeits-Grafik (aktuell)

```
i18n Phase A ✅
    │
    └──► i18n Phase B (EN-Texte, Toggle)

Wreck-POIs ← nächstes Feature
```

---

## Archiv: Sprint-Details (alle erledigt — S0–S4, P2, LU, D, AQ)

> Die detaillierten Implementierungsschritte der erledigten Sprints sind in der Git-History.
> Restbugs aus Sprint 0 (#143, #144, #154) prüfen via GitHub Issues.

---

## Sprint 0 — Bugfixes

*Fixes zuerst, bevor neue Features landen.*

---

### Issue #143 — Zu viele random Ancient Jumpgates

**Problem:** Ancient Jumpgates spawnen zu häufig. Sollen sehr selten sein, nur in Nebeln, Reichweite mehrere Quadranten.

**Files:**
- `packages/server/src/engine/jumpgates.ts`
- `packages/shared/src/constants.ts`
- `packages/server/src/__tests__/jumpgates.test.ts`

**Step 1: Analyse der aktuellen Spawn-Rate**
```bash
grep -n "ANCIENT\|ancient\|jumpgate.*spawn\|spawnJumpgate" packages/server/src/engine/jumpgates.ts
grep -n "JUMPGATE\|jumpgate" packages/shared/src/constants.ts
```

**Step 2: Spawn-Rate reduzieren**
```typescript
// packages/shared/src/constants.ts
export const ANCIENT_JUMPGATE_SPAWN_RATE = 0.0001; // 1 pro 10.000 Sektoren (war vermutlich 0.01)
export const ANCIENT_JUMPGATE_NEBULA_ONLY = true;   // Nur in Nebel-Sektoren
export const ANCIENT_JUMPGATE_MIN_QUADRANT_DIST = 100; // Mindest-Quadrant-Distanz von 0:0
export const ANCIENT_JUMPGATE_RANGE_QUADRANTS = 3;  // Reichweite: 3 Quadranten
```

**Step 3: Spawn-Logik anpassen**
- `jumpgates.ts`: Guard einbauen — nur spawnen wenn `sectorType === 'nebula'`
- Radius-Check: Ancient Gates verbinden Quadranten (3 QU Reichweite), keine Sektoren
- Deterministische Erzeugung via `hashCoords` bleibt, nur Rate sinkt

**Step 4: Test**
```bash
cd packages/server && npx vitest run src/__tests__/jumpgates.test.ts
```

**Step 5: Commit**
```bash
git commit -m "fix: reduce ancient jumpgate spawn rate, nebula-only, closes #143"
```

---

### Issue #144 — Kein Fight mit Pirate

**Problem:** Spieler betritt Piraten-Sektor, kein Kampf wird ausgelöst.

**Files:**
- `packages/server/src/rooms/services/CombatService.ts`
- `packages/server/src/engine/commands.ts`
- `packages/server/src/__tests__/combat.test.ts`

**Step 1: Reproduzieren**
```bash
# Schaue welcher Befehl beim Sektor-Betreten den Kampf auslösen soll
grep -n "pirate\|PIRATE\|triggerCombat\|encounter" packages/server/src/rooms/services/CombatService.ts | head -20
grep -n "moveSector\|pirates" packages/server/src/engine/commands.ts | head -20
```

**Step 2: Root Cause finden**
- Prüfen: Wird `checkPirateEncounter()` bei `moveSector` aufgerufen?
- Prüfen: Gibt es eine Bedingung, die verhindert dass Kampf ausgelöst wird (z.B. Cooldown, falscher State)?

**Step 3: Fix implementieren**
- Sicherstellen dass nach jedem `moveSector` in Piraten-Sektoren der Kampf-Flow ausgelöst wird
- CombatService-Aufruf in der `moveSector`-Handling-Pipeline

**Step 4: Test**
```typescript
// packages/server/src/__tests__/combat.test.ts
it('triggers pirate encounter on entering pirate sector', async () => {
  // Arrange: Spieler betritt Sektor mit pirates content
  // Assert: CombatService.initiateCombat() wird aufgerufen
});
```

**Step 5: Commit**
```bash
git commit -m "fix: trigger pirate combat on sector entry, closes #144"
```

---

### Issue #154 — Aktueller Sektor verliert Infos auf NAV-Karte

**Problem:** Beim Betreten eines Sektors wird er auf der Nav-Karte schwarz (Infos verschwinden).

**Files:**
- `packages/client/src/components/Radar/RadarRenderer.ts` (oder NavMap-Komponente)
- `packages/client/src/store/gameSlice.ts`

**Step 1: Analyse**
```bash
grep -n "currentSector\|visitedSectors\|sectorData" packages/client/src/store/gameSlice.ts | head -20
```

**Step 2: Root Cause**
- Wahrscheinlich: Beim Betreten wird `currentSector` überschrieben statt gemergt
- Oder: Sektor-Daten werden beim `moveSector`-Response gecleart

**Step 3: Fix**
- Bestehende Sektor-Daten beim Wechsel beibehalten (merge statt replace)
- Render-Logik: CurrentSector zeigt weiterhin seine gespeicherten Infos

**Step 4: Test**
```bash
cd packages/client && npx vitest run
```

**Step 5: Commit**
```bash
git commit -m "fix: preserve sector info display after entering sector, closes #154"
```

---

## Sprint 1 — UI Quick Wins

---

### Issue #160 — Schwarzes Loch kein Hyperjump-Ziel

**Problem:** Spieler kann zu Sektoren mit Schwarzem Loch springen.

**Files:**
- `packages/server/src/engine/jumpgates.ts` oder `commands.ts`
- `packages/client/src/components/Nav/` (UI-Button ausblenden)

**Step 1: Server-Guard**
```typescript
// commands.ts oder jumpgates.ts — beim Hyperjump:
if (targetSector.environment_type === 'black_hole') {
  return { error: 'JUMP_TARGET_INVALID', message: 'Schwarze Löcher sind kein gültiges Sprungziel.' };
}
```

**Step 2: Client-UI**
- Hyperjump-Button in Nav-Detailview ausblenden/disabled wenn Sektor `black_hole`

**Step 3: Commit**
```bash
git commit -m "fix: prevent hyperjump to black hole sectors, closes #160"
```

---

### Issue #153 — Fehlermeldungen inline anzeigen

**Problem:** Fehler (z.B. "nicht genug Ressourcen") erscheinen nicht am Ort der Aktion.

**Files:**
- `packages/client/src/components/` (alle relevanten Action-Komponenten)
- Neues: `packages/client/src/components/common/InlineError.tsx`

**Step 1: Komponente erstellen**
```typescript
// packages/client/src/components/common/InlineError.tsx
interface InlineErrorProps {
  message: string | null;
  className?: string;
}
export function InlineError({ message, className }: InlineErrorProps) {
  if (!message) return null;
  return (
    <div className={`inline-error crt-text ${className ?? ''}`}>
      ⚠ {message}
    </div>
  );
}
```

**Step 2: Einbinden**
- Mining-Panel: Fehler bei zu wenig AP
- Trade-Panel: Fehler bei zu wenig Credits/Ressourcen
- Station-Build: Fehler bei fehlendem Material

**Step 3: Commit**
```bash
git commit -m "feat: add inline error messages at action origin, closes #153"
```

---

### Issue #158 — NAV-Screen nicht verschiebbar

**Problem:** Die NAV-Karte (Panel 2) kann nicht gescrollt/verschoben werden, auch nicht außerhalb der Schiff-Sichtweite.

**Files:**
- `packages/client/src/components/Nav/NavMapCanvas.tsx`
- `packages/client/src/store/uiSlice.ts` (Pan-State)

**Step 1: Pan-State hinzufügen**
```typescript
// uiSlice.ts
navMapPan: { x: number; y: number };
setNavMapPan(pan: { x: number; y: number }): void;
```

**Step 2: Canvas-Drag implementieren**
```typescript
// NavMapCanvas.tsx — Mouse/Touch drag handler
onMouseDown → isPanning = true, startPos = e.clientXY
onMouseMove → wenn isPanning: setNavMapPan(delta)
onMouseUp   → isPanning = false
```

**Step 3: Commit**
```bash
git commit -m "feat: make NAV map pannable/scrollable, closes #158"
```

---

### Issue #161 + #147 — Auto-Follow Detail-View (NAV Secondary)

**Problem:** NAV-Detail-View (Panel 3) folgt nicht automatisch dem Spieler.
*(#147 = Hardware-Button, #161 = Auto-Follow-Logik — gleiche Implementation)*

**Files:**
- `packages/client/src/components/Nav/NavDetailPanel.tsx`
- `packages/client/src/components/HardwareControls.tsx`
- `packages/client/src/store/uiSlice.ts`

**Step 1: State**
```typescript
// uiSlice.ts
navDetailAutoFollow: boolean;
toggleNavDetailAutoFollow(): void;
```

**Step 2: Hardware-Button** (ersetzt PWR-Button laut #147)
```typescript
// HardwareControls.tsx — PWR-Button → FOLLOW-Toggle
<button
  className={`hw-btn ${autoFollow ? 'active' : ''}`}
  onClick={toggleNavDetailAutoFollow}
  title="Auto-Follow NAV Detail"
>
  FOL
</button>
```

**Step 3: Auto-Follow Logic**
```typescript
// NavDetailPanel.tsx — beim Spieler-Sektorwechsel:
useEffect(() => {
  if (navDetailAutoFollow && currentPlayerSector) {
    setDetailViewSector(currentPlayerSector);
  }
}, [currentPlayerSector, navDetailAutoFollow]);
```

**Step 4: Commit**
```bash
git commit -m "feat: add auto-follow toggle for NAV detail view, closes #147 #161"
```

---

### Issue #152 — Testbildschirm überarbeiten

**Problem:** Test-Pattern auf Screen 3 (wenn kein Detail-Panel) hat zu viele Farben und stört.
**Lösung:** Screen 3 bekommt 2-Button-Toggle: `[1] Detail-Mode` `[2] TV-Modus` (Werbe-Inhalte)

**Files:**
- `packages/client/src/components/DetailMonitor/`
- `packages/client/src/components/common/ScreenToggle.tsx`
- `packages/client/src/components/tv/TvScreen.tsx` (neu)

**Step 1: Toggle-Buttons im Monitor-Bezel**
```typescript
// HardwareControls des Detail-Monitors
<div className="monitor-mode-toggle">
  <button className={mode==='detail' ? 'active':''} onClick={() => setMode('detail')}>1</button>
  <button className={mode==='tv' ? 'active':''} onClick={() => setMode('tv')}>2</button>
</div>
```

**Step 2: TV-Screen** (statisch, Werbetexte)
```typescript
// TvScreen.tsx — rotating CRT-style ads
const ADS = [
  'VOID-CORP™ — MINING ISN\'T JUST A JOB, IT\'S A LIFESTYLE',
  'VISIT QUADRANT 0:0 — HUMANITY\'S PROUD CENTER™',
  'BUY ORE. SELL ORE. REPEAT. VOID-MART™',
];
```

**Step 3: Test-Pattern durch ruhiges CRT-Standby ersetzen**
- Einfaches dunkles Bild mit minimaler Rauschtextur oder Standby-Text

**Step 4: Commit**
```bash
git commit -m "feat: replace test pattern with detail/tv toggle, closes #152"
```

---

### Issue #155 — Move-Animation verbessern

**Problem:** Sektor-Wechsel-Animation ist ruckelnd und unangenehm.
**Lösung:** Eigenes Schiff als Icon, das sanft von Sektor zu Sektor gleitet.

**Files:**
- `packages/client/src/components/Radar/RadarRenderer.ts`
- `packages/client/src/store/gameSlice.ts` (ship position state)

**Step 1: Schiff-Position interpolieren**
```typescript
// gameSlice.ts
shipMoveAnimation: {
  fromX: number; fromY: number;
  toX: number; toY: number;
  startTime: number;
  duration: number; // 800ms
} | null;
```

**Step 2: Schiff-Icon im Radar**
```typescript
// RadarRenderer.ts — drawPlayerShip():
// Statt Pixel: kleines Dreieck/Schiff-Symbol
// Position via lerp(from, to, progress)
const progress = Math.min((now - startTime) / duration, 1.0);
const easedProgress = easeInOutCubic(progress);
const x = from.x + (to.x - from.x) * easedProgress;
const y = from.y + (to.y - from.y) * easedProgress;
```

**Step 3: Animation starten bei moveSector-Response**

**Step 4: Commit**
```bash
git commit -m "feat: smooth ship movement animation between sectors, closes #155"
```

---

## Sprint 2 — Navigation + Karte + Journal

---

### Issue #156 — Neue Quadranten: Entdecker-Anzeige + Varianz

**Problem:** Neue Quadranten zeigen keinen Entdecker auf der QUAD-MAP. Außerdem soll jeder Quadrant ±80% Varianz vom normalen Seed haben.

**Files:**
- `packages/server/src/db/migrations/` (neues Feld `discovered_by`)
- `packages/server/src/db/quadrantQueries.ts`
- `packages/client/src/components/QuadMap/QuadMapCanvas.tsx`
- `packages/server/src/engine/worldgen.ts`

**Step 1: DB-Migration (kleine Migration 032)**
```sql
-- 032_quadrant_discoverer.sql
ALTER TABLE quadrants ADD COLUMN IF NOT EXISTS discovered_by VARCHAR(100);
ALTER TABLE quadrants ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ;
ALTER TABLE quadrants ADD COLUMN IF NOT EXISTS content_variance FLOAT DEFAULT 1.0;
-- variance = 0.2 bis 1.8 (+/- 80% vom normalen Seed)
```

**Step 2: Entdecker tracken**
```typescript
// quadrantQueries.ts — beim ersten Quadrant-Betreten:
await setQuadrantDiscoverer(qx, qy, playerName, variance);
// variance = seeded random(0.2, 1.8) basierend auf hashCoords(qx, qy, worldSeed)
```

**Step 3: QUAD-MAP Tooltip/Label**
```typescript
// QuadMapCanvas.tsx — auf Hover über Quadrant:
// Tooltip: "Entdeckt von: [Name] am [Datum]"
// Kleines ★-Symbol neben entdeckten Quadranten
```

**Step 4: Commit**
```bash
git commit -m "feat: track quadrant discoverers, add content variance, closes #156"
```

---

### Issue #151 — Quest-Journal auf Schiff

**Problem:** Quest-Programm zeigt keine aktiven Quests als Journal. Kein Link von Sektoren zu Quests.

**Files:**
- `packages/client/src/components/programs/QuestProgram.tsx`
- `packages/client/src/components/Nav/NavDetailPanel.tsx`
- `packages/client/src/store/gameSlice.ts`

**Step 1: Quest-Journal UI**
```typescript
// QuestProgram.tsx — statt Liste: Journal-Format
// Aktive Quest → expandiert mit Text, Ziel, Fortschritt
// Erledigte Quests → automatisch entfernt
```

**Step 2: Quest-Ziele in Sektor-Detailview**
```typescript
// NavDetailPanel.tsx — wenn Sektor ein Quest-Ziel enthält:
if (hasQuestTarget(sector)) {
  <div className="quest-hint">
    📋 Quest-Ziel hier: <a onClick={() => switchToQuest(questId)}>{questTitle}</a>
  </div>
}
```

**Step 3: Sektoren mit Quest-Zielen in Nav markieren**
```typescript
// NavMapCanvas.tsx — Sektoren mit Quest-Ziel erhalten dickeren Rahmen
if (isQuestTarget(sector)) {
  ctx.strokeStyle = '#ffff44'; // gelb
  ctx.lineWidth = 2;
}
```

**Step 4: Commit**
```bash
git commit -m "feat: add quest journal, sector quest markers, closes #151"
```

---

### Issue #148 — Anzeige der Möglichkeiten im NAV-Detail-View

**Problem:** Im Sektor-Detail-View fehlen Icons, die zeigen was man dort machen kann.
*(War als `waiting` markiert — nach #151 umsetzbar.)*

**Files:**
- `packages/client/src/components/Nav/NavDetailPanel.tsx`
- `packages/client/src/components/icons/` (neue Capability-Icons)

**Step 1: Capability-Icons definieren**
```typescript
// Welche Aktionen sind in diesem Sektor möglich:
type SectorCapability = 'trade' | 'quest' | 'mine' | 'dock' | 'jumpgate' | 'scan' | 'build';

function getSectorCapabilities(sector: SectorData): SectorCapability[] {
  const caps: SectorCapability[] = [];
  if (sector.contents.includes('station')) caps.push('trade', 'quest', 'dock');
  if (sector.contents.includes('asteroid')) caps.push('mine');
  if (sector.contents.includes('jumpgate')) caps.push('jumpgate');
  return caps;
}
```

**Step 2: Icons neben Objekt-Namen**
```typescript
// NavDetailPanel.tsx — pro Content-Item:
<div className="sector-object">
  {contentItem.name}
  {capabilities.map(cap => <CapabilityIcon key={cap} type={cap} />)}
</div>
```

**Step 3: Klick → Detail-View des Objekts**
```typescript
// Station click → StationDetailView
// Jumpgate click → JumpgateDetailView
```

**Step 4: Commit**
```bash
git commit -m "feat: show capability icons in sector detail view, closes #148"
```

---

## Sprint 3 — Mining + Trade + Quests

---

### Issue #140 — Mining immersiver

**Problem:** Mining passiert sofort, keine Animation, kein Feedback.

**Files:**
- `packages/client/src/components/programs/MiningProgram.tsx`
- `packages/client/src/store/gameSlice.ts` (mining animation state)

**Step 1: Mining-Progress-State**
```typescript
// gameSlice.ts
miningProgress: {
  resource: 'ore' | 'gas' | 'crystal';
  current: number;
  max: number;
  startTime: number;
  duration: number; // ms
} | null;
```

**Step 2: Animierter Ladebalken**
```typescript
// MiningProgram.tsx
// Beim Start eines Mining-Vorgangs: Progress-Bar zeigt laufenden Abbau
// Resource-Icon + Name: "ORE — 47/100"
// Balkenfüllung: animiert von 0% auf 100% über mining-Duration

<div className="mining-progress">
  <span className="resource-label">{resource.toUpperCase()}</span>
  <div className="progress-bar">
    <div className="fill" style={{ width: `${progress}%` }} />
  </div>
  <span className="amount">{current}/{max}</span>
</div>
```

**Step 3: Schiffskapazitäten anzeigen**
```typescript
// MiningProgram.tsx — Cargo-Kapazität des Schiffs:
<div className="cargo-capacity">
  ORE: {cargo.ore}/{ship.cargoCapacity.ore}
  GAS: {cargo.gas}/{ship.cargoCapacity.gas}
  CRYSTAL: {cargo.crystal}/{ship.cargoCapacity.crystal}
</div>
```

**Step 4: Verbindung zwischen Mining-Schiff-Icon und Sektor-Asteroid**
*(Laut Issue: "Link zwischen Mining und Sektor" — visuelles Element im Radar)*
```typescript
// RadarRenderer.ts — während Mining: gepunktete Linie von Schiff zu Asteroid
```

**Step 5: Commit**
```bash
git commit -m "feat: add mining progress animation and cargo display, closes #140"
```

---

### Issue #141 — Trade-View eigene Vorräte anzeigen

**Problem:** Im Trade-View ist nicht sichtbar was der Spieler selbst besitzt.

**Files:**
- `packages/client/src/components/programs/TradeProgram.tsx`

**Step 1: Layout ändern**
```
STATION          SPIELER
────────         ────────
Ore:  150cr      Ore:   45 ← dein Bestand
Gas:   80cr      Gas:    0
Crystal: 200cr   Crystal: 12
```

**Step 2: Getauschte Items wechseln die Seite**
```typescript
// Wenn Trade abgeschlossen:
// Item-Element animiert von links nach rechts (Station→Spieler) oder umgekehrt
```

**Step 3: Trade-View von Station/Spieler erreichbar**
```typescript
// StationDetailView / PlayerDetailView → "TRADE" Button → öffnet TradeProgram
// mit vorausgewähltem Handelspartner
```

**Step 4: Commit**
```bash
git commit -m "feat: show player inventory in trade view, closes #141"
```

---

### Issue #157 — Black Hole Kartographier-Quest

**Problem:** Schwarze Löcher sind unerreichbar, aber es gibt noch keine Quest die das nutzt.

**Files:**
- `packages/server/src/engine/questTemplates.ts`
- `packages/server/src/engine/questgen.ts`

**Step 1: Quest-Template hinzufügen**
```typescript
// questTemplates.ts
{
  id: 'black_hole_cartography',
  type: 'scan',
  title: 'Schwarzes Loch kartografieren',
  description: 'Scanne 4 Nachbar-Sektoren des Schwarzen Lochs bei [{targetX}:{targetY}]',
  requirements: {
    sectorType: 'black_hole_adjacent', // neuer Virtual-Type
    scanCount: 4,
    targetSectorX: number,
    targetSectorY: number,
  },
  reward: { credits: 500, xp: 200, artefactChance: 0.3 },
}
```

**Step 2: Quest-Generator**
```typescript
// questgen.ts — neue Funktion:
function generateBlackHoleQuest(blackHoleSector): Quest {
  // Finde 4 Nachbar-Sektoren (N/S/E/W)
  const adjacentSectors = getAdjacentSectors(blackHoleSector);
  return createQuestFromTemplate('black_hole_cartography', { adjacentSectors });
}
```

**Step 3: Scan-Tracking**
```typescript
// ScanService.ts — beim Scan in Nachbar-Sektor:
if (hasActiveBlackHoleQuest() && isAdjacentToBlackHole(sector)) {
  updateQuestProgress(quest.id, scanCount + 1);
}
```

**Step 4: Commit**
```bash
git commit -m "feat: add black hole cartography scan quest, closes #157"
```

---

## Sprint 4 — Scan-Sharing, Schiffswechsel, Station Rework

---

### Issue #159 — Scan-Sharing innerhalb Fraktion

**Problem:** Gescannte Sektoren nur für Scannenden sichtbar. Fraktionsmitglieder sollen alle Scans teilen.

*(Integriert in Phase 2 / #165 — hier standalone Pre-Implementation)*

**Files:**
- `packages/server/src/rooms/services/ScanService.ts`
- `packages/server/src/db/queries.ts`
- `packages/server/src/__tests__/scanSharing.test.ts`

**Step 1: Faction-Scan-Sharing-Mechanismus**
```typescript
// ScanService.ts — nach erfolgreichem Scan:
const factionMembers = await getFactionMembers(player.factionId);
for (const member of factionMembers) {
  if (member.id === player.id) continue;
  await broadcastScanResultToPlayer(member.id, scanResult);
}
```

**Step 2: Broadcast via Colyseus**
```typescript
// Spieler in derselben Faction bekommen Scan-Updates
// via Room.broadcast() oder gezieltem send() wenn online
```

**Step 3: Test**
```typescript
it('shares scan result with faction members', async () => {
  // Arrange: 2 Spieler in gleicher Fraktion
  // Act: Spieler 1 scannt
  // Assert: Spieler 2 empfängt Scan-Daten
});
it('does not share scan with other factions', async () => {
  // Assert: Spieler ohne gleiche Fraktion empfängt nichts
});
```

**Step 4: Commit**
```bash
git commit -m "feat: share scan results within same faction, closes #159"
```

---

### Issue #146 — Schiffswechsel + Frachter

**Problem:** Spieler kann nur ein Schiff nutzen. Für große Transporte werden Frachter benötigt.

**Files:**
- `packages/server/src/engine/commands.ts`
- `packages/server/src/db/queries.ts`
- `packages/client/src/components/programs/HangarProgram.tsx`
- `packages/server/src/__tests__/shipSwitch.test.ts`

**Step 1: Multi-Ship-DB** *(ggf. bereits in migration 011)*
```sql
-- Prüfen ob ships-Tabelle bereits multi-ship unterstützt
-- Hangar-Slots pro Base: ALTER TABLE bases ADD COLUMN hangar_slots INTEGER DEFAULT 3
```

**Step 2: Frachter-Schiffstyp**
```typescript
// packages/shared/src/constants.ts
export const SHIP_HULLS = {
  // Bestehend: scout, freighter, cruiser, explorer, battleship
  // freighter: hohe Cargo-Kapazität, langsam
  freighter: {
    cargoCapacity: { ore: 2000, gas: 1500, crystal: 500, exotic: 50 },
    speed: 0.5, // halb so schnell wie Scout
    price: 5000,
  },
};
```

**Step 3: Schiff-Wechsel Server-Handler**
```typescript
// commands.ts
case 'switchShip': {
  const { shipId } = data;
  // Validieren: Schiff im Hangar dieser Base
  // Spieler-Schiff wechseln
  // Response: neues Schiff-State
}
```

**Step 4: Hangar-UI**
```typescript
// HangarProgram.tsx
// Liste der geparkte Schiffe pro Base
// "Einsteigen" → switchShip()
// "Kaufen" → buyShip()
```

**Step 5: Tests**
```typescript
it('switches active ship to hangar ship', async () => { ... });
it('cannot switch to ship in different base hangar', async () => { ... });
```

**Step 6: Commit**
```bash
git commit -m "feat: add ship switching and freighter hull, closes #146"
```

---

### Issue #149 — Station Rework (CLI-Terminal UI)

**Problem:** Stationsinteraktion passiert im Cockpit. Soll stattdessen eine eigene Terminal-UI sein.

*(Größeres Feature, braucht eigenen Brainstorming-Schritt)*

**Files:**
- `packages/client/src/components/StationTerminal/` (neu)
- `packages/client/src/store/uiSlice.ts`
- `packages/client/src/components/CockpitLayout.tsx`

**Step 1: Design-Entscheidung**
```
Layout (aus Issue-Screenshot):
┌──────────────────────────────────────────────┐
│ [1] Station-BG  [2] Terminal    [3] BG-Art   │
│                 ┌─────────────┐              │
│                 │ Programme   │              │
│                 │ HANGAR      │  [4] Schiff  │
│                 │ HANDEL      │  Profil      │
│                 │ QUESTS      │              │
│                 │ FORSCHUNG   │  [5] Info    │
│                 │ VERWALTEN   │  Station     │
│                 └─────────────┘              │
│                                [6] Chat      │
└──────────────────────────────────────────────┘
```

**Step 2: Station-Terminal-State**
```typescript
// uiSlice.ts
staionTerminalOpen: boolean;
dockedStationId: string | null;
openStationTerminal(stationId: string): void;
closeStationTerminal(): void;
```

**Step 3: CRT-Terminal Komponente**
```typescript
// StationTerminal/index.tsx
// Anderes Farbschema: grün-auf-schwarz (statt amber)
// Programm-Leiste links (8 Programme)
// Hauptbereich: CLI-artiger Output + Mouse-Navigation
// Eigene Station: + VERWALTEN, EINSTELLUNGEN, EIGENE QUESTS
// NPC-Station: HANGAR, HANDEL, QUESTS
```

**Step 4: "Andocken"-Flow**
```typescript
// NavDetailPanel.tsx: Sektor mit Station → "ANDOCKEN"-Button
// Klick → Nachricht an Server → Server bestätigt → openStationTerminal(stationId)
```

**Step 5: Terminal-Programme implementieren**
- HANGAR: bestehendes HangarProgram → in Terminal-Kontext
- HANDEL: bestehendes TradeProgram → in Terminal-Kontext
- QUESTS: QuestProgram in Terminal
- FORSCHUNG: Stub (kommt später)

**Step 6: Commit**
```bash
git commit -m "feat: station terminal CLI UI with docking flow, closes #149"
```

---

## Phase 2 (P2) — Sektor-System Rebuild

*Vollständiger Umbau des Sektor-Systems. Kein live-Betrieb → Fresh Seed nach Abschluss.*
*Detail-Pläne in jeweiligen Issues.*

---

### Issue #163 — Phase 2/1: Core DB + POI-Constants + SectorContentService

**Implementierungsplan:** Siehe Issue #163
**Kernaufgaben:**
- `packages/shared/src/constants.ts`: `SECTOR_ENVIRONMENT_TYPES`, `SECTOR_CONTENT_TYPES`, Dichte-Konstanten
- Migration `031_sector_environment_content.sql`: `sector_environment` und `sector_contents` Tabellen
- `SectorContentService.ts`: Sektor-Inhalte lesen/schreiben

**Tests:** Mindestens 5 Tests für SectorContentService
**Commit:** `feat: Phase 2/1 — sector type system and DB foundation, closes #163`

---

### Issue #164 — Phase 2/2: UniverseSeedingService + ExoticPlanetGenerator

**Implementierungsplan:** Siehe Issue #164
**Kernaufgaben:**
- `UniverseSeedingService.ts`: Distanz-basierte Sektor-Generierung
- `ExoticPlanetGenerator.ts`: Seltene Planeten mit garantierten Exotic-Resources
- `getDistanceMultipliers(x, y)`: Station 2.5× dichter bei 0:0, Piraten 2× mehr weit weg

**Tests:** Distanz-Multiplier-Tests, Planet-Generator-Tests
**Commit:** `feat: Phase 2/2 — universe seeding with distance-based density, closes #164`

---

### Issue #165 — Phase 2/3: ResourceYieldService + FirstBaseService + ScanSharingService

**Implementierungsplan:** Siehe Issue #165
**Kernaufgaben:**
- `ResourceYieldService.ts`: Ertrag nach Sektortyp (Tabelle im Issue)
- `FirstBaseService.ts`: Erste Base kostenlos, Validierungen (kein Nebel, keine aktiven Piraten)
- `ScanSharingService.ts`: Fraktion teilt Scan-Daten (Integration von #159)
- Schließt: #150 (First Base), #159 (Scan-Sharing)

**Tests:** je 5+ Tests pro Service
**Commit:** `feat: Phase 2/3 — resource yield, first base, scan sharing, closes #165 #150 #159`

---

### Issue #166 — Phase 2/4: NPC Ecosystem V2

**Implementierungsplan:** Siehe Issue #166
**Kernaufgaben:**
- `SectorTypeAwarenessService.ts`: NPC-Fraktions-Präferenz nach Sektortyp + Distanz
- `DynamicPriceService.ts`: Preisvolatilität steigt mit Distanz
- `QuestGeneratorV2.ts`: Sektortyp + Distanz-abhängige Quests
- Narrative-Layer: NPC-Dialoge verändern sich mit Distanz von 0:0
- Schließt: #157 (Black Hole Quest) via QuestGen-Integration

**Tests:** 10+ Tests
**Commit:** `feat: Phase 2/4 — NPC ecosystem V2 with sector awareness, closes #166`

---

### Issue #167 — Phase 2/5: Navigation V2

**Implementierungsplan:** Siehe Issue #167
**Kernaufgaben:**
- `SectorTraversabilityService.ts`: Sektoren blockieren Navigation (Stern, schwarzes Loch)
- `AutopilotPathfinderV2.ts`: Autopilot umgeht nicht-begehbare Sektoren + Nebel-Malus
- Schließt: #147 (Auto-Update NAV secondary bereits in Sprint 1), #160 (black hole bereits in Sprint 1)

**Tests:** Pathfinder-Tests mit Hindernissen
**Commit:** `feat: Phase 2/5 — navigation V2 with traversability, closes #167`

---

### Issue #168 — Phase 2/6: Testing + Go-Live

**Kernaufgaben:**
- 200+ Tests für alle Phase-2-Systeme
- Fresh Universe Seed
- Playwright E2E: Scan, Mining, Trade, Navigation
- Performance-Check: Seeding-Zeit, Room-Startup
- Schließt #162 (Epic)

**Commit:** `feat: Phase 2/6 — full test suite and go-live, closes #168 #162`

---

## Phase LU — Lebendiges Universum

*Nach Phase 2. Detail-Pläne in `docs/plans/2026-03-09-lebendiges-universum.md`.*

### Reihenfolge:

```
#178 LU-1 → #179 LU-2 → #180 LU-3 → #181 LU-4 → #182 LU-5 → #183 LU-6 → #184 LU-7
```

**Kurzübersicht:**

| Issue | Kernaufgabe |
|-------|------------|
| #178 LU-1 | Cosmic Faction DB (Migration 031), TerritoryEngine |
| #179 LU-2 | UniverseTickEngine (5s-Loop), TerritoryTickHandler |
| #180 LU-3 | NPC Expansion Cycle (Frachter → Kolonien) |
| #181 LU-4 | Human Civilization Meter (Spielerbeiträge) |
| #182 LU-5 | QUAD-MAP Faction-Farben, Territory API |
| #183 LU-6 | UniverseSeedingService (25 Menschheits-Quadranten + Aliens) |
| #184 LU-7 | Admin Dashboard + Test-Suite |

Closes #177 (Epic)

---

## Phase D — Drohnen-System

*Nach Phase 2. Steht allein, kein Abhängigkeitskonflikte mit LU.*

### Issue #169 — Drohnen-System

**Implementierungsplan:** `docs/plans/2026-03-07-drone-idle-automation-system.md`

**Drohnen-Typen:** Scout / Harvester / Industrial
**3 Modi:** Schiff-Drohne (aktiv AFK), Basis-Drohne (täglich), Route-Drohne

**Kernaufgaben:**
- DB-Migration: `drones` Tabelle (type, base_id, route_json, state, resources)
- `DroneService.ts`: Drohnen spawnen, Route abfliegen, Ressourcen einsammeln
- `DroneTickHandler.ts`: Im Universe-Tick-Engine registriert
- Client: Drohnen-Panel im Mining-Programm oder eigenes Programm

**Tests:** 10+ Tests (Drohnen-Spawn, Routen, Ressourcen-Ertrag)
**Commit:** `feat: drone system for idle resource automation, closes #169`

---

## Phase AQ — Alien Quest System

*Nach Phase 2 + LU. Detail-Pläne in `docs/plans/2026-03-07-quest-alien-system.md`.*

### Reihenfolge:

```
#171 AQ-1 → #172 AQ-2 → #173 AQ-3 → #174 AQ-4 → #175 AQ-5
```

| Issue | Inhalt |
|-------|--------|
| #171 Sprint 1 | AlienFactionTypes, DB-Schema (alien_reputation, alien_encounters), AlienReputationService |
| #172 Sprint 2 | Story-Quest-Kette Kapitel 0–4, Branch-Mechanik (3 Wahl-Outcomes) |
| #173 Sprint 3 | Spontane Alien-Encounter-Events (distanzbasiert, Scan-Trigger) |
| #174 Sprint 4 | Community-Quests (server-weite Ziele mit kollektivem Fortschritt) |
| #175 Sprint 5 | K'thari, Mycelianer, Touristengilde + Story-Kapitel 5–8 |

Closes #170 (Epic)

---

## Abhängigkeits-Grafik

```
Sprint 0 (Bugs) ──────────────────────────────► immer zuerst
Sprint 1 (UI) ─────────────────────────────────► kann parallel zu Sprint 0
Sprint 2 (Nav+Karte) ──────────────────────────► nach Sprint 1
Sprint 3 (Mining+Trade) ───────────────────────► nach Sprint 1
Sprint 4 (Scan+Schiff+Station) ────────────────► nach Sprint 2+3
    │
    ▼
Phase 2: Sektor-Rebuild (#162–168)
    │   ├── #163 → #164 → #165 → #166 → #167 → #168
    │   └── Fresh Seed nach #168
    │
    ├──► Phase LU: Lebendiges Universum (#177–184)
    │       └── #178→#179→#180→#181→#182→#183→#184
    │
    ├──► Phase D: Drohnen-System (#169)
    │       └── parallel zu LU möglich
    │
    └──► Phase AQ: Alien Quest System (#170–175)
            └── nach Phase 2 + LU
                #171→#172→#173→#174→#175
```

---

## Zusammenfassung: Alle Issues nach Sprint

| Sprint | Issue | Titel | Typ |
|--------|-------|-------|-----|
| S0 | #143 | zu viele random Gates | 🐛 |
| S0 | #144 | Kein Fight mit Pirate | 🐛 |
| S0 | #154 | aktueller Sektor verliert Infos | 🐛 |
| S1 | #160 | schwarzes Loch kein Hyperjump | 🐛 |
| S1 | #153 | Fehlermeldungen inline | ✨ |
| S1 | #158 | NAV-Screen nicht verschiebbar | ✨ |
| S1 | #161 | Enable 2nd to follow 1st | ✨ |
| S1 | #147 | Auto-Update NAV secondary | ✨ |
| S1 | #152 | Testbildschirm überarbeiten | ✨ |
| S1 | #155 | Move-Animation verbessern | ✨ |
| S2 | #156 | Neue Quadranten: Entdecker + Varianz | ✨ |
| S2 | #151 | Quest-Journal | ✨ |
| S2 | #148 | Anzeige der Möglichkeiten | ✨ |
| S3 | #140 | Mining immersiver | ✨ |
| S3 | #141 | Trade-View eigene Vorräte | ✨ |
| S3 | #157 | Black Hole Kartographier-Quest | ✨ |
| S4 | #159 | Scan-Sharing | ✨ |
| S4 | #146 | Schiffswechsel + Frachter | ✨ |
| S4 | #149 | Station Rework (CLI-Terminal) | 🏗 |
| P2 | #162 | Epic: Phase 2 | 🏗 |
| P2 | #163 | P2/1: Core DB | 🏗 |
| P2 | #164 | P2/2: Universe Seeding | 🏗 |
| P2 | #165 | P2/3: Resources + FirstBase + ScanShare | 🏗 |
| P2 | #166 | P2/4: NPC Ecosystem V2 | 🏗 |
| P2 | #167 | P2/5: Navigation V2 | 🏗 |
| P2 | #168 | P2/6: Testing + Go-Live | 🏗 |
| LU | #177 | Epic: Lebendiges Universum | 🏗 |
| LU | #178 | LU-1: Cosmic Faction DB | 🏗 |
| LU | #179 | LU-2: Universe Tick Engine | 🏗 |
| LU | #180 | LU-3: NPC Expansion | 🏗 |
| LU | #181 | LU-4: Human Civilization | 🏗 |
| LU | #182 | LU-5: QUAD-MAP Colors | 🏗 |
| LU | #183 | LU-6: Universe Seeding | 🏗 |
| LU | #184 | LU-7: Admin Dashboard | 🏗 |
| D  | #169 | Drohnen-System | ✨ |
| AQ | #170 | Epic: Alien Quest System | 🏗 |
| AQ | #171 | AQ Sprint 1: Fundament | 🏗 |
| AQ | #172 | AQ Sprint 2: Story Kapitel 0–4 | 🏗 |
| AQ | #173 | AQ Sprint 3: Encounter Events | 🏗 |
| AQ | #174 | AQ Sprint 4: Community Quests | 🏗 |
| AQ | #175 | AQ Sprint 5: Story Kapitel 5–8 | 🏗 |

**Total: 43 Issues** (3 🐛 Bugs + 18 ✨ Features + 22 🏗 Epics/Sub-Issues)
