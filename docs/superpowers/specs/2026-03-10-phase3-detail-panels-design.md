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
│ LEUTNANT                           │
│ █████████░  920 · 80 bis KAPITÄN   │
└────────────────────────────────────┘

BASIS-LEVEL: STUFE 3 — TRADING POST aktiv

AKTIVE UPGRADES
✓ Cargo +20%  ✓ Scan +2  ✓ Mining +15%

NÄCHSTER UPGRADE
→ Combat Shield +10% (fehlt: 1200 Cr)

[MEMBERS →]  [UPGRADES →]
```

- Rang-Block: eigener Rang + XP-Fortschrittsbalken + XP bis nächstem Rang
- Fraktions-Block: Basis-Level, aktive Upgrades (kompakt, kommasepariert), nächster Upgrade mit Kosten
- Buttons navigieren per `programTabTarget` zu den jeweiligen Tabs in FactionScreen

#### State B: Spieler hat keine Fraktion

```
◈ HUMANITY REP: NEUTRAL +12

◈ OPEN RECRUITMENT · 1 OF 3
┌───────────────────────────────────┐
│ ⬡ STELLAR COMPACT                  │
│ "We mine together, we profit       │
│  together. Experienced pilots      │
│  welcome."                         │
│ 7 Mitglieder · Stufe 3             │
└───────────────────────────────────┘
█░░  (Fortschritts-Dots, 1 von 3)

[STELLAR COMPACT →]
(wechselt alle 5s automatisch)
```

- Humanity Rep: Tier-Label + numerischer Wert
- Rotating Recruitment Cards: eine Fraktion auf einmal, auto-rotierend alle 5000ms
- Fortschritts-Dots zeigen Position (1/2/3)
- `[FRAKTIONSNAME →]` navigiert per `programTabTarget` zu dieser Fraktion in FactionScreen (vorselektiert)
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

- ACEP-Block: 4 Pfade mit kompakten Balken (4-Zeichen-Label, ASCII-Balken, XP-Zahl) + aktive Trait-Namen namentlich
- Modul-Block: installierte Module (Namen, kommasepariert) + "N slots free"
- Buttons navigieren zu ACEP- bzw. MODULES-Tab in ShipSysScreen

---

## Neues Feature: Fraktion-Recruiting

### DB — Migration 049

```sql
ALTER TABLE factions
  ADD COLUMN is_recruiting BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN slogan        VARCHAR(160);
```

### Server — FactionService

- Neues State-Feld `recruitingFactions: RecruitingFaction[]` im Room-State (für alle Spieler sichtbar, nicht nur Fraktionsmitglieder)
- `RecruitingFaction`: `{ factionId, name, color, slogan, memberCount, baseLevel }`
- Wird bei Join und bei Faction-Updates gepusht
- FactionService: neue Methode `setRecruiting(factionId, isRecruiting, slogan)` — nur Gründer darf aufrufen

### Client — FactionScreen Management-Tab

Neues UI-Element im Management-Tab (nur für Fraktionsgründer sichtbar):

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

`recruitingFactions: RecruitingFaction[]` zum gameState hinzufügen, wird von `FactionDetailPanel` (State B) gelesen.

---

## Tab-Navigation: `programTabTarget`

`uiSlice` bekommt:

```ts
programTabTarget: { program: string; tab: string } | null
```

- Detail-Panel-Buttons rufen `setProgramTabTarget({ program: 'FACTION', tab: 'members' })` auf
- FactionScreen und ShipSysScreen lesen diesen Wert via `useEffect` und wechseln zum Tab
- Nach dem Tab-Wechsel: `setProgramTabTarget(null)` (reset)

---

## Betroffene Dateien

**Neu erstellen:**
- `packages/client/src/components/FactionDetailPanel.tsx`
- `packages/client/src/components/ShipDetailPanel.tsx`

**Modifizieren:**
- `packages/client/src/components/CockpitLayout.tsx` — `getDetailForProgram()`: FACTION → `<FactionDetailPanel />`, SHIP-SYS → `<ShipDetailPanel />`
- `packages/client/src/state/uiSlice.ts` — `programTabTarget` hinzufügen
- `packages/client/src/state/gameSlice.ts` — `recruitingFactions` hinzufügen
- `packages/client/src/components/FactionScreen.tsx` — Tab-Navigation lesen + Management-UI für Recruiting
- `packages/client/src/components/ShipSysScreen.tsx` (oder äquivalent) — Tab-Navigation lesen
- `packages/server/src/services/FactionService.ts` — `setRecruiting()` + `recruitingFactions` State-Push
- `packages/server/src/db/migrations/049_faction_recruiting.ts` — Migration

**Nicht in Scope:**
- Request/Accept-System für Beitrittsanfragen (separates Feature, später)
- Faction-Farben/Icons in der Karte (bestehende Darstellung beibehalten)
