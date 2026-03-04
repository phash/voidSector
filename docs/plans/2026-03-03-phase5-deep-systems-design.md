# Phase 5: Deep Systems — Design Document

**Goal:** Erweitere voidSector um tiefe Gameplay-Systeme: Fuel, JumpGates, Multi-Content-Sektoren, Fraktionsbaum, Rettungsmissionen, Handelsrouten-Automatisierung und erweiterte DatenDisks. Dazu Bug-Fixes für Mining-Navigation und UI.

**Architecture:** Aufbau in 4 Blöcken (A→D) nach Abhängigkeiten. Jeder Block baut auf dem vorherigen auf. Server-seitig: neue DB-Tabellen, SectorRoom-Handler, Engine-Module. Client-seitig: neue Screens, Store-Erweiterungen, Minispiel-Komponente.

**Tech Stack:** TypeScript, Colyseus, PostgreSQL, Redis, React + Zustand, Canvas (Frequenz-Minispiel)

---

## Block A: Grundlagen

### A1: Bug-Fix #17 — Mining-Navigation-Lock

**Problem:** Spieler kann während aktivem Mining per Jump navigieren. `validateJump()` prüft Mining-State nicht.

**Lösung:**
- Server: In `validateJump()` prüfen ob `miningState.active === true` → Fehler "Cannot jump while mining"
- Client: Jump-Buttons visuell deaktivieren wenn `miningState.active`
- Detail-View soll Scan-Ergebnisse live anzeigen (selectedSector-Daten aus discoveries refreshen)

### A2: Bug-Fix #16 — UI Anpassungen

**4 Punkte:**

1. **Detail-View Auto-Update Knopf:** Retro-Toggle-Button im DetailPanel. Wenn aktiv: `selectedSector` folgt automatisch der Spielerposition nach jedem Jump. Default: aus.

2. **Fade-Out-Effekt schwächer:** Die CSS-Gradient-Masken an den Monitor-Rändern abschwächen (Opacity von ~0.8 auf ~0.3 oder ähnlich).

3. **Fixe Monitor-Breite:** Sidebar-Monitore bekommen `min-width` und `width` fest gesetzt, damit Umschalten zwischen Monitoren kein Layout-Springen verursacht. Größere Variante bevorzugen.

4. **Scrollbalken in Spieloptik:** Custom Scrollbar CSS im CRT-Amber-Style:
   ```css
   ::-webkit-scrollbar { width: 8px; }
   ::-webkit-scrollbar-track { background: #0a0a0a; }
   ::-webkit-scrollbar-thumb { background: rgba(255, 176, 0, 0.4); border: 1px solid rgba(255, 176, 0, 0.2); }
   ::-webkit-scrollbar-thumb:hover { background: rgba(255, 176, 0, 0.6); }
   ```

### A3: Fuel-System (#14)

**Aktuell:** `FuelState`, `ShipData.fuel/fuelMax`, `SHIP_CLASSES.fuelPerJump` und Store-State existieren, sind aber nicht aktiv.

**Aktivierung:**
- Server: `handleJump()` → Fuel-Verbrauch (`ship.fuelPerJump` pro Jump). Kein Fuel → kein Jump.
- Server: Auftanken an Stationen (neuer `refuel` Message-Handler). Kostet Credits (`fuelPerUnit * amount`).
- Client: Fuel-Bar in StatusBar neben AP-Bar anzeigen.
- Client: Refuel-Button im Detail-Panel wenn an Station.
- Fuel-State in Redis persistieren (wie AP).

**Konstanten:**
```typescript
FUEL_COST_PER_UNIT = 2;  // Credits pro Fuel-Einheit
```

### A4: Multi-Content-Sektoren (#15)

**Aktuell:** Ein Sektor hat genau einen `type` (empty, nebula, asteroid_field, station, anomaly, pirate).

**Änderung:** Sektoren können mehrere "Features" haben. Der primäre `type` bleibt bestehen (World-Gen), aber zusätzliche Objekte können existieren:
- Spieler-Strukturen (bereits via `structures` Tabelle)
- JumpGates (neuer Content-Typ, Block C)
- NPCs an Stationen (bereits vorhanden)

**Dichte-Grenze:** Max 3 Features pro Sektor (Typ + 2 zusätzliche).

**Grid-Darstellung:**
- Primär-Icon bleibt der Sektor-Typ
- Zusätzliche kleine Marker-Icons (farbig) neben dem Haupt-Symbol
- Legende am unteren Grid-Rand

**Detail-View:** Zeigt alle Features als Liste an (Typ, Strukturen, JumpGates, NPCs).

**Implementation:** Kein Schema-Change nötig — Strukturen sind bereits separat gespeichert. JumpGates kommen als neue Tabelle. Detail-Panel aggregiert aus mehreren Quellen.

---

## Block B: Fraktionen & Progression

### B1: Fraktions-Verbesserungsbaum

**Konzept:** Jede Spieler-Fraktion kann pro Tier eine binäre Entscheidung treffen. 3 Tiers, jeweils 2 Optionen (A oder B). Einmal gewählt = permanent.

**Tiers:**
```
Tier 1 (Cost: 500 Credits):
  A: MINING BOOST — +15% Mining-Rate für alle Members
  B: CARGO EXPANSION — +3 Cargo-Cap für alle Members

Tier 2 (Cost: 1500 Credits, requires Tier 1):
  A: SCAN RANGE — +1 Area-Scan-Radius für alle Members
  B: AP REGEN — +20% AP-Regeneration für alle Members

Tier 3 (Cost: 5000 Credits, requires Tier 2):
  A: COMBAT BONUS — +15% Kampfbonus für alle Members
  B: TRADE DISCOUNT — -10% NPC-Handelspreise für alle Members
```

**Entscheidungsprozess:** Nur Faction-Leader kann Upgrade wählen. Credits werden vom Leader-Konto abgezogen.

**DB:** Neue Tabelle `faction_upgrades`:
```sql
CREATE TABLE faction_upgrades (
  faction_id TEXT REFERENCES factions(id),
  tier INTEGER NOT NULL,
  choice TEXT NOT NULL,  -- 'A' or 'B'
  chosen_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (faction_id, tier)
);
```

**Bonus-Anwendung:** Bei relevanten Aktionen (Mining, Jump, Scan, Battle, Trade) prüft der Server die Fraktions-Upgrades des Spielers und wendet Modifikatoren an.

---

## Block C: Rettung & Exploration

### C1: Rettungsmissionen-System

**3 Auslöser:**

1. **Scan-Event (bestehend):** `distress_signal` beim Scannen entdeckt. Spieler fliegt hin, birgt Gestrandete.

2. **NPC-Quest:** NPCs an Stationen geben Rettungsquests ("Finde meine Crew bei ~X,Y"). Nutzt bestehendes Quest-System mit neuem Template-Typ `rescue`.

3. **Funk-Hilferuf (NEU):** Innerhalb der Comm-Reichweite des Spielers wird ein Hilferuf empfangen.
   - Wird per Timer/Event ausgelöst (z.B. beim Betreten eines Sektors, Chance-basiert)
   - Spieler bekommt Nachricht: "DISTRESS SIGNAL EMPFANGEN — Richtung: NNW, geschätzte Entfernung: 5-8 Sektoren"
   - **Richtungsanzeige:** Winkel zum Zielsektor berechnen → in Himmelsrichtung umwandeln (N, NE, E, SE, S, SW, W, NW)
   - **Entfernungsschätzung:** Tatsächliche Distanz ± 30% Unschärfe
   - Spieler muss den Sektor selbst finden (Scan + Navigation)
   - Zeitlimit: 30 Minuten nach Empfang

**Bergungsmechanik:**
- Am Zielsektor: "BERGEN"-Button (kostet 5 AP)
- Benötigt freie `safeSlots` auf dem Schiff
- Gerettete werden als temporäres Cargo-Item transportiert
- Ablieferung an beliebiger Station → Belohnung (Credits + Rep + XP)

**Belohnungen:**
```typescript
RESCUE_REWARDS = {
  scan_event: { credits: 50, rep: 10, xp: 25 },
  npc_quest: { credits: 80, rep: 15, xp: 40 },
  comm_distress: { credits: 100, rep: 20, xp: 50 },  // highest because hardest
};
```

### C2: JumpGates

**Sektor-Feature:** JumpGates sind Objekte in Sektoren (nicht eigener Sektor-Typ). Deterministische Platzierung via World-Seed.

**Typen:**
1. **Bidirektional (Alien-Tech):** Sicheres Reisen in beide Richtungen. Immer gepaart (Gate A ↔ Gate B).
2. **Einbahnstraße (Wurmloch):** Nur eine Richtung. Kann hunderte/tausende Sektoren weit gehen. Risikoreicher.

**Zugangscodes:**
- Manche Gates brauchen einen Code (8-stelliger alphanumerischer String)
- Codes als Loot in Sektoren findbar (Scan-Events, Quest-Belohnungen)
- Codes für einzelne Gates oder Gate-Gruppen
- Codes können auf DatenDisks gespeichert und gehandelt werden

**Frequenz-Matching Minispiel:**
- Manche Gates (ca. 30%) erfordern das Minispiel statt/zusätzlich zum Code
- Canvas-basiert: Zwei Sinuswellen (Target + Player)
- Spieler dreht per Tastatur/Mausrad an der Frequenz
- Match ≥ 90% → Gate öffnet sich
- CRT-Ästhetik: Grüne Wellenlinien auf schwarzem Grund, Scanlines

**Generierung:**
- Deterministische Platzierung: `hashCoords(x, y, WORLD_SEED + GATE_SALT)` → Chance ~2% pro Sektor
- Zielkoordinaten ebenfalls seed-basiert
- Reichweite: 50-10.000 Sektoren (gewichtet: meist 50-500, selten >1000)

**DB:** Neue Tabelle `jumpgates`:
```sql
CREATE TABLE jumpgates (
  id TEXT PRIMARY KEY,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  target_x INTEGER NOT NULL,
  target_y INTEGER NOT NULL,
  gate_type TEXT NOT NULL,  -- 'bidirectional' | 'wormhole'
  requires_code BOOLEAN DEFAULT FALSE,
  requires_minigame BOOLEAN DEFAULT FALSE,
  access_code TEXT,
  UNIQUE(sector_x, sector_y)
);
```

**Fuel-Kosten:** JumpGate-Reisen kosten 1 Fuel (unabhängig von Entfernung) — Vorteil gegenüber normalem Springen.

### C3: DatenDisks (Erweitert)

**Aktuell:** Data Slates enthalten nur Sektor-Scan-Daten (`SectorSlateData[]`).

**Erweiterung:** Neuer Slate-Typ `custom` neben `sector` und `area`:
- Spieler kann beliebige Daten hinterlegen:
  - Koordinaten-Listen (Bookmarks)
  - JumpGate-Zugangscodes
  - Freitext-Notizen (max 500 Zeichen)
- Erstellung kostet 2 AP + 5 Credits (Materialkosten)
- Handelbar wie bestehende Slates (Marktplatz Tier 2+)

**Neue Felder in `DataSlate`:**
```typescript
interface DataSlate {
  // ... existing fields
  customData?: {
    label: string;           // max 32 chars
    coordinates?: Coords[];  // bookmark list
    codes?: string[];        // gate codes etc.
    notes?: string;          // freetext, max 500 chars
  };
}
```

---

## Block D: Handel & Automatisierung

### D1: Handelsrouten-Automatisierung

**Voraussetzung:** Trading Post Tier 3 ("AUTO-TRADE")

**Konzept:** Spieler konfiguriert Handelsrouten zwischen eigener Base und Stationen.

**Route-Definition:**
```typescript
interface TradeRoute {
  id: string;
  ownerId: string;
  tradingPostId: string;     // structure id
  targetStationX: number;
  targetStationY: number;
  sellResource: ResourceType;
  sellAmount: number;
  buyResource: ResourceType;
  buyAmount: number;
  cycleMinutes: number;      // min 15, max 120
  active: boolean;
  lastCycleAt: number;
}
```

**Zyklen:**
- Server prüft aktive Routen periodisch (alle 60s)
- Pro Zyklus: Sell → Buy an NPC-Preisen (mit Rep-Modifikatoren)
- Fuel-Kosten pro Zyklus: `distance * 0.5` (gerundet)
- Fuel wird aus Ship-Fuel oder Base-Storage gezogen
- Max 3 aktive Routen pro Trading Post

**Einschränkungen:**
- Route nur zu Station-Sektoren
- Sell nur aus eigenem Storage
- Buy geht in eigenes Storage
- Wenn Storage voll oder Fuel leer → Route pausiert automatisch

**DB:** Neue Tabelle `trade_routes`:
```sql
CREATE TABLE trade_routes (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  trading_post_id TEXT REFERENCES structures(id),
  target_x INTEGER NOT NULL,
  target_y INTEGER NOT NULL,
  sell_resource TEXT,
  sell_amount INTEGER,
  buy_resource TEXT,
  buy_amount INTEGER,
  cycle_minutes INTEGER DEFAULT 30,
  active BOOLEAN DEFAULT TRUE,
  last_cycle_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Client:** Neuer "ROUTEN"-Tab im Trade-Monitor bei Tier 3. Zeigt aktive Routen mit Status-Bar (Fortschritt im aktuellen Zyklus).

---

## Neue DB-Migrationen

- **009:** `faction_upgrades` Tabelle
- **010:** `jumpgates` Tabelle + `gate_codes` Tabelle (Spieler-gefundene Codes)
- **011:** `trade_routes` Tabelle
- **012:** `rescued_survivors` Tabelle (temporäres Cargo)
- **013:** `data_slates` Schema-Erweiterung (customData JSON-Feld)

## Betroffene Shared Types

Neue Types: `JumpGate`, `JumpGateType`, `TradeRoute`, `RescueSurvivor`, `FactionUpgradeChoice`, `DistressSignal`, `CustomSlateData`

Neue Messages: `RefuelMessage`, `UseJumpGateMessage`, `FrequencyMatchResult`, `ConfigureRouteMessage`, `RescueMessage`, `CreateCustomSlateMessage`, `FactionUpgradeMessage`

Neue Constants: `FUEL_COST_PER_UNIT`, `JUMPGATE_CHANCE`, `JUMPGATE_FUEL_COST`, `RESCUE_REWARDS`, `MAX_TRADE_ROUTES`, `CUSTOM_SLATE_COST`, `FACTION_UPGRADE_TIERS`
