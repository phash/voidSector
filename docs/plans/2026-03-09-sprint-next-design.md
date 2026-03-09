# Sprint Next — Design

**Datum:** 2026-03-09
**Status:** Design abgeschlossen, bereit für Implementation

---

## Übersicht

8 offene Issues in einem Sprint, Reihenfolge Option B (Quick Wins → Fundament → Admin/Visual → UI → Feature):

| # | Issue | Komplexität |
|---|-------|-------------|
| 1 | #210 Usernames case insensitive | Mini |
| 2 | #211 Admin: Cargo-Items Autocomplete | Mini |
| 3 | #215 Kernwelt — Station "Zuhause" bei 0:0 | Mittel |
| 4 | #207 Sim-Config + Expansion Log | Mittel |
| 5 | #212 Admin QMap Deep Zoom | Klein |
| 6 | #213 Area-Scan immersiver | Klein |
| 7 | #216 Trade UI Redesign | Mittel |
| 8 | #214 Quest Journal + Tracking | Groß |

---

## #210 — Usernames case insensitive

**Problem:** `Phash` und `phash` können als separate Accounts angelegt werden.

**Lösung:**
- DB: Eindeutigkeits-Constraint auf `lower(username)` statt `username`
- Auth-Queries: `WHERE LOWER(username) = LOWER($1)` für Login und Duplicate-Check
- Bestehende Usernamen bleiben unverändert, neue Registration prüft case-insensitiv

**Files:**
- `packages/server/src/db/migrations/045_username_case_insensitive.sql`
- `packages/server/src/db/queries.ts` (findPlayerByUsername)
- `packages/server/src/auth.ts` (register duplicate check)

---

## #211 — Admin: Cargo-Items Autocomplete

**Problem:** Freitext-Input für Cargo-Items im Admin-Console ist fehleranfällig.

**Lösung:**
- Bestehenden Input durch `<input list="..."> + <datalist>` ersetzen (natives HTML, kein extra Package)
- Liste aller Item-Keys aus Shared-Constants generiert (Ressourcen, Module, Blueprints)
- User tippt → Browser filtert autocomplete-Vorschläge

**Files:**
- `packages/client/src/components/AdminConsole.tsx` (oder equivalentes Admin-UI-File)

---

## #215 — Kernwelt

**Ziel:** Sektor (0,0) im Quadranten (0,0) hat immer eine Station "Zuhause". Quadrant (0,0) heißt "Zentrum".

**Station "Zuhause":**
- In `universeBootstrap.ts` beim Server-Start idempotent anlegen (prüfen ob existiert → sonst INSERT)
- Station wird nicht durch Worldgen erzeugt sondern explizit in DB gesetzt
- Unabhängig vom Seed — immer vorhanden

**Quadrant "Zentrum":**
- `quadrant_control` für (0,0) beim Bootstrap mit `name = 'Zentrum'` upserten
- Bei First-Contact-Naming: Name von (0,0) wird nie überschrieben (Guard in Naming-Logic)

**Spawn-Synergie:** Spieler spawnen bereits in Radius 5 um (0,0) — "Zuhause" ist natürlicher erster Anlaufpunkt.

**Files:**
- `packages/server/src/engine/universeBootstrap.ts`
- `packages/server/src/db/queries.ts` (ensureKernweltStation)
- `packages/server/src/engine/firstContactNaming.ts` (Guard für Quadrant 0:0)

---

## #207 — Sim-Config + Expansion Log

### Env-Vars (`.env.sim`)

| Variable | Default | Wirkung |
|----------|---------|---------|
| `TICK_MULTIPLIER` | `1` | UniverseTickEngine: `5000 / N` ms, StrategicTick: `60000 / N` ms |
| `ALIEN_EXPANSION_RATE_MUL` | `1` | Multipliziert `faction.expansion_rate` |
| `ALIEN_AGGRESSION_MUL` | `1` | Multipliziert `faction.aggression` |
| `FIRST_CONTACT_MIN_QDIST` | aktueller Wert | Mindest-Quadranten-Distanz für First-Contact |

**Start-Script:** `npm run sim:server` lädt `.env.sim` und startet den Server.
Beispiel `.env.sim`: `TICK_MULTIPLIER=10`, `ALIEN_EXPANSION_RATE_MUL=10`, `ALIEN_AGGRESSION_MUL=2`, `FIRST_CONTACT_MIN_QDIST=3`

### Expansion Log (DB)

Neue Migration + Tabelle `expansion_log`:

```sql
CREATE TABLE expansion_log (
  id        SERIAL PRIMARY KEY,
  ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  faction   TEXT NOT NULL,
  qx        INT NOT NULL,
  qy        INT NOT NULL,
  event     TEXT NOT NULL  -- 'colonized' | 'conquered' | 'discovered' | 'lost'
);
```

**Event-Quellen:**
- `colonized` — Alien-Fleet landet in leerem Quadranten (`deleteArrivedNpcFleets`)
- `conquered` — Alien gewinnt Warfare-Tick gegen Mensch (`processWarfareTick`)
- `lost` — Mensch verliert Quadranten (gleiche Stelle, faction = 'human')
- `discovered` — Mensch betritt neuen Quadranten erstmals (NavigationService / cross-quadrant join)

**Files:**
- `packages/server/src/db/migrations/046_expansion_log.sql`
- `packages/server/src/engine/strategicTickService.ts` (conquered/lost events)
- `packages/server/src/engine/universeBootstrap.ts` (Tick-Multiplikatoren einlesen)
- `packages/server/src/rooms/services/NavigationService.ts` (discovered event)
- `packages/server/package.json` (sim:server script)
- `.env.sim` (neu)

---

## #212 — Admin QMap Deep Zoom

**Zoom-Stufen:** 5× / 10× / 25× / 50× / 250× / 1000×

Bei hohem Zoom wird ein einzelner Quadrant auf den ganzen Canvas gestreckt. Faction-Farben, Friction-Glow und ⚔-Icons bleiben erhalten. Nur im Admin-Modus sichtbar (normale Spieler sehen die normalen QUAD-MAP-Zoom-Stufen).

**Files:**
- `packages/client/src/components/QuadMapCanvas.tsx` (oder equivalent)
- Admin-spezifischer Zoom-Control

---

## #213 — Area-Scan immersiver

**Zwei Änderungen im RadarRenderer / ScanAnimation:**

1. **Wellen-Radius:** Scan-Wellen breiten sich bis zum vollen sichtbaren Radar-Bereich aus (statt ~3 Sektoren)
2. **Brightness-Burst:** Frisch gescannte Sektoren leuchten 1–2s heller, klingen dann auf Normalwert ab (CSS-Animation oder Canvas-Alpha-Interpolation)

**Files:**
- `packages/client/src/canvas/RadarRenderer.ts`
- `packages/client/src/components/ScanScreen.tsx` (oder wo Scan-Animation getriggert wird)

---

## #216 — Trade UI Redesign

**Layout:** Zwei gleichbreite Spalten nebeneinander (CSS-Grid).

- **Station-Trade:** Links = Station-Inventar (NPC-Angebote), Rechts = Spieler-Inventar
- **Direkthandel:** Links = fremder Spieler, Rechts = eigener Spieler

Kauf/Tausch-Buttons in der Mitte zwischen den Panels. Jede Seite hat eigenen Scroll-Bereich. Logik bleibt unverändert — nur Layout-Umbau.

**Files:**
- `packages/client/src/components/TradeScreen.tsx`
- `packages/client/src/components/DirectTradeScreen.tsx` (falls separat)

---

## #214 — Quest Journal + Tracking

### Quest annehmen
- Neuer Status `accepted` in `player_quests` (oder `tracked`-Feld reicht)
- "ANNEHMEN"-Button im Quest-Detail-Panel
- Abgeschlossene Quests verschwinden automatisch aus dem Journal

### Journal-Tab
- Im QUESTS-Programm: neuer Tab **"JOURNAL"** ganz rechts in der Tab-Leiste
- Zeigt alle angenommenen Quests
- Filter-Optionen:
  - **In der Nähe** — Zielsektor innerhalb N Sektoren vom Spieler
  - **Nach Fraktion** — Dropdown auf Faction-ID
  - **Nach Art** — fetch / scan / delivery / bounty / story / community
- Bis zu **5 Quests** können als "verfolgt" markiert werden (Haken-Toggle)

### Kartenanzeige
- Verfolgte Quests → **blau pulsierender Rahmen** auf NAV-COM + QUAD-MAP am Zielort
- Ziel-Koordinaten aus Quest-Daten (bereits vorhanden)

### Rechter Rand (unter Bookmarks)
- Verfolgte Quests als Kurzzeilen (Typ + Kurzname)
- Klick → Popup mit vollständiger Aufgabenbeschreibung

### DB
- Migration: `player_quests` + `tracked BOOLEAN DEFAULT FALSE`

**Files:**
- `packages/server/src/db/migrations/047_quest_tracked.sql`
- `packages/server/src/db/queries.ts` (trackQuest, getTrackedQuests)
- `packages/server/src/rooms/services/QuestService.ts` (accept/track handler)
- `packages/client/src/components/QuestScreen.tsx` (Journal-Tab + Filter)
- `packages/client/src/components/QuestJournal.tsx` (neu)
- `packages/client/src/canvas/RadarRenderer.ts` (blauer Puls für Ziele)
- `packages/client/src/components/BookmarkPanel.tsx` (verfolgte Quests darunter)
- `packages/client/src/state/gameSlice.ts` (trackedQuests State)
- `packages/client/src/network/client.ts` (trackQuest message handler)

---

## Abhängigkeiten & Reihenfolge

```
#210 → #211 → #215 → #207 → #212 → #213 → #216 → #214
 (unabhängig voneinander, aber diese Reihenfolge ist sinnvoll)
```

Migrationen in Reihe: 045 → 046 → 047
