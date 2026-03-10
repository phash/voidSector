# Phase 3-N — FACTION + SHIP-SYS Detail Panels Design Spec
*2026-03-10 · Brainstorming-Session*

---

## Überblick

Zwei neue Detail-Panels für Section 3 (rechter Monitor) wenn FACTION oder SHIP-SYS in Section 2 aktiv ist. Aktuell gibt `getDetailForProgram()` in `CockpitLayout.tsx` für beide Programme `null` zurück — Section 3 bleibt leer.

Beide Panels folgen dem Prinzip: **kontextuelle Zusatzinfo + Steuerungs-Aktionen** — sie zeigen Dinge die nicht direkt in der Hauptansicht stehen, und ihre Buttons navigieren gezielt zu Tabs im Hauptprogramm.

---

## Neue Komponenten

### `FactionDetailPanel.tsx`

Zwei States je nach Mitgliedsstatus:

#### State A: Spieler ist Fraktionsmitglied

```
◈ STELLAR COMPACT · 7 MEMBERS

┌─ Rang-Block ──────────────────────┐
│ DEIN RANG                          │
│ OFFICER                            │
│ (Rang-Badge — leader / officer /   │
│  member, je nach FactionRank)      │
└────────────────────────────────────┘

AKTIVE UPGRADES
✓ Cargo +20%  ✓ Scan +2  ✓ Mining +15%

NÄCHSTER UPGRADE
→ Combat Shield +10% (fehlt: 1200 Cr)

[MEMBERS →]  [UPGRADES →]
```

- **Rang-Block**: eigener `FactionRank` (`leader` / `officer` / `member`) — kein XP-Balken, da kein Rang-XP-System im Spiel existiert. Rang wird aus `factionData.members` gelesen (der eigene Eintrag).
- **Upgrade-Block**: aktive Upgrades (kompakt, kommasepariert aus `FactionUpgradeState`) + nächster Upgrade mit Kosten. Wenn keine Upgrade-Daten vorhanden: Block ausgeblendet.
- **Buttons** navigieren per `setMonitorMode(MONITORS.FACTION, 'members')` resp. `setMonitorMode(MONITORS.FACTION, 'upgrades')` — identisches Pattern wie ShipSysScreen.

#### State B: Spieler hat keine Fraktion

```
◈ HUMANITY REP: NEUTRAL +12

◈ OPEN RECRUITMENT · 1 OF 3
┌───────────────────────────────────┐
│ ⬡ STELLAR COMPACT                  │
│ "We mine together, we profit       │
│  together. Experienced pilots      │
│  welcome."                         │
│ 7 Mitglieder                        │
└───────────────────────────────────┘
█░░  (Fortschritts-Dots, 1 von 3)

[STELLAR COMPACT →]
(wechselt alle 5s automatisch)
```

- **Humanity Rep**: Tier-Label + numerischer Gesamtwert. Quelle: `humanityReps` (Record aus gameSlice, per-alien-Fraktion). Aggregat: `Object.values(humanityReps).reduce((sum, e) => sum + e.repValue, 0)` → Tier via `getHumanityRepTier(total)` aus shared. Panel ruft `network.requestHumanityReps()` on mount (analog zu `AlienRepTab` in QuestsScreen). Wenn `humanityReps` leer: zeige `HUMANITY REP: LOADING...`
- **Rotating Recruitment Cards**: eine Fraktion auf einmal, auto-rotierend alle 5000ms
- **Fortschritts-Dots** zeigen Position — bei count=1: keine Dots, keine Rotation (statisch)
- **`[FRAKTIONSNAME →]`** setzt `selectedFactionId` im lokalen FactionScreen-State und navigiert per `setMonitorMode(MONITORS.FACTION, 'info')` (Tab muss in FactionScreen existieren)
- Wenn keine Fraktion `is_recruiting = true`: statische Meldung `NO CONNECTION TO NETWORK...`

---

### `ShipDetailPanel.tsx`

```
⬡ NIGHTFALL · GEN 2

ACEP PATHS
CNST  ████████░░  34
INTL  █████░░░░░  22
CMBT  █████████░  48
EXPL  ██░░░░░░░░  10

ACTIVE TRAITS
⬡ RECKLESS · ⬡ VETERAN

MODULES · 3/5 SLOTS
Mining Laser · Cargo Exp. · Shield
2 slots free

[ACEP →]  [MODULES →]
```

**Empty State** (wenn alle ACEP-XP = 0 oder `acepXp` fehlt):
```
⬡ NIGHTFALL

ACEP PATHS
CNST  ░░░░░░░░░░  0
INTL  ░░░░░░░░░░  0
CMBT  ░░░░░░░░░░  0
EXPL  ░░░░░░░░░░  0

NO TRAITS ACTIVE YET

MODULES · 2/3 SLOTS
...
```

- **ACEP-Block**: 4 Pfade mit kompakten Balken (4-Zeichen-Label, ASCII-Balken, XP-Zahl). XP-Skala 0–50 (cap). Traits aus `ship.acepTraits` (neu, siehe unten).
- **Modul-Block**: installierte Module (Namen, kommasepariert aus `ship.modules`) + "N slots free"
- **`[MODULES →]`** navigiert per `setMonitorMode(MONITORS.SHIP_SYS, 'modules')` — Tab existiert bereits in ShipSysScreen.
- **`[ACEP →]`** navigiert per `setMonitorMode(MONITORS.SHIP_SYS, 'acep')` — dieser Tab existiert noch **nicht** in ShipSysScreen (ACEP UI Panel ist noch open). Als Teil dieser Aufgabe wird in `GameScreen.tsx` ein leerer `acep`-Branch eingefügt (`view === 'acep'` → Placeholder `<div>ACEP — COMING SOON</div>`), damit der Button nicht ins Leere führt. Das vollständige ACEP-Panel folgt in einem separaten Feature.

---

## Neues Feature: Fraktion-Recruiting

### DB — Migration 051

```sql
ALTER TABLE factions
  ADD COLUMN is_recruiting BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN slogan        VARCHAR(160),
  ADD COLUMN color         VARCHAR(7);
```

`color` ist ein optionaler Hex-Farbcode (`#rrggbb`) — kann von Fraktionsgründern gesetzt werden (in einem späteren PR), hier wird er nur für die Darstellung in `FactionDetailPanel` State B genutzt.

### Server — FactionService

- Neue Methode `setRecruiting(factionId, isRecruiting, slogan)` — nur Gründer darf aufrufen, prüft `rank === 'leader'`
- Nach Änderung: `broadcastRecruitingFactions()` baut die `recruitingFactions`-Liste aus der DB und sendet sie per **Room-Broadcast** (`this.ctx.broadcast('recruitingFactionsUpdate', data)`) an alle Spieler im Room — kein per-client `send()`, sondern echter Room-Broadcast
- `RecruitingFaction`: `{ factionId: string; name: string; color: string | null; slogan: string | null; memberCount: number }` — kein `baseLevel` (keine DB-Spalte vorhanden)
- Wird bei Join (via `onJoin`-Handler) und nach `setRecruiting`-Aufrufen gepusht

### Client — FactionScreen Management-Tab

FactionScreen braucht ein **Tab-System** (wird von scratch gebaut — aktuell hat FactionScreen keine Tabs, nur ein flaches Layout). Tabs: `info` | `members` | `upgrades` | `management`.

Tab-Navigation via `monitorModes[MONITORS.FACTION]` (default: `'info'`).

Neues UI-Element im **Management-Tab** (nur für Fraktionsgründer sichtbar):

```
RECRUITING

[●] AKTIV REKRUTIEREN        ← Toggle

Slogan (max 160 Zeichen):
┌─────────────────────────────────┐
│ We mine together...             │
│                           47/160│
└─────────────────────────────────┘
[SPEICHERN]
```

- Toggle `is_recruiting` + Textarea für Slogan
- Zeichenzähler (live, 160 Max)
- `[SPEICHERN]` sendet `setRecruiting` Message ans Server

### Client — gameSlice

`recruitingFactions: RecruitingFaction[]` zum gameState hinzufügen.

Wird aus `recruitingFactionsUpdate`-Message befüllt (im `client.ts` via `room.onMessage('recruitingFactionsUpdate', ...)` registrieren — analog zu `humanityReps`-Handler in Zeile 1593), von `FactionDetailPanel` (State B) gelesen.

---

## Tab-Navigation: `monitorModes`-Pattern

Beide Panels nutzen das **bestehende** `monitorModes`/`setMonitorMode`-System aus `uiSlice`:

```ts
// Detail-Panel-Button-Klick:
setMonitorMode(MONITORS.FACTION, 'members');

// FactionScreen liest:
const tab = monitorModes[MONITORS.FACTION] ?? 'info';
```

- **Kein neues Slice-Feld** (`programTabTarget` entfällt) — `setMonitorMode` ist bereits vorhanden und korrekt
- FactionScreen: `useEffect(() => { /* sync active tab with monitorModes value */ }, [monitorModes[MONITORS.FACTION]])`
- ShipSysScreen: bereits bestehende Tabs werden über `setMonitorMode(MONITORS.SHIP_SYS, ...)` gesteuert — Detail-Panel-Buttons nutzen denselben Mechanismus

---

## ClientShipData: Traits hinzufügen

`ClientShipData` in `packages/client/src/state/gameSlice.ts` bekommt ein neues optionales Feld:

```ts
acepTraits?: string[];  // z.B. ['reckless', 'veteran']
```

Der Server befüllt dieses Feld im `shipList`-Handler aus der DB-Spalte `acep_traits` (JSONB-Array in der `ships`-Tabelle, bereits vorhanden via Migration 039).

---

## Betroffene Dateien

**Neu erstellen:**
- `packages/client/src/components/FactionDetailPanel.tsx`
- `packages/client/src/components/ShipDetailPanel.tsx`

**Modifizieren:**
- `packages/client/src/components/CockpitLayout.tsx` — `getDetailForProgram()`: FACTION → `<FactionDetailPanel />`, SHIP-SYS → `<ShipDetailPanel />`
- `packages/client/src/state/gameSlice.ts` — `recruitingFactions: RecruitingFaction[]` + `acepTraits?: string[]` in `ClientShipData`
- `packages/client/src/components/FactionScreen.tsx` — Tab-System von scratch + Management-UI für Recruiting + `monitorModes`-Lesen
- `packages/client/src/network/client.ts` — `recruitingFactionsUpdate`-Handler registrieren (`room.onMessage('recruitingFactionsUpdate', ...)`, analog zu `humanityReps` Handler)
- `packages/client/src/components/GameScreen.tsx` — `'acep'`-Branch in ShipSysScreen-View-Switch einfügen (Placeholder, bis ACEP UI Panel implementiert ist)
- `packages/server/src/services/FactionService.ts` — `setRecruiting()` + `broadcastRecruitingFactions()` + Join-Push
- `packages/server/src/db/migrations/051_faction_recruiting.ts` — Migration (is_recruiting, slogan, color) — **051**, da 049 (`civ_ships`) und 050 (`construction_sites`) bereits existieren
- `packages/server/src/rooms/handlers/` — `setRecruiting`-Message-Handler registrieren
- `packages/server/src/rooms/SectorRoom.ts` (oder Handler-Datei) — `shipList`-Response um `acepTraits` erweitern

**Nicht in Scope:**
- Request/Accept-System für Beitrittsanfragen (separates Feature, später)
- Faction-Farben/Icons in der Karte (bestehende Darstellung beibehalten)
- Fraktions-Farbe setzen (Farb-Picker UI) — color-Spalte wird angelegt, aber UI folgt später
