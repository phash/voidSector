# P2-NavCom — Design Spec
*2026-03-10 · Brainstorming-Session*

---

## Überblick

Fundamentaler UX-Paradigmenwechsel: Statt separater Programme (TRADE, StationTerminal) wird alles über NAV-COM getriggert. Der Spieler klickt Sektoren auf dem Radar → sieht Objekte in Fenster 3 → klickt Objekte → Interaktion öffnet als NAV-COM Sub-Mode in Fenster 2.

---

## Entschiedene Design-Fragen

| Frage | Entscheidung |
|-------|-------------|
| Station-Interaction | Hub (Action-Menü: [TRADE] [QUESTS] [INFO]) |
| Proximity | Nur lokal — Interaktion nur wenn Spieler im selben Sektor |
| Ausnahme | Spieler können von überall angeschrieben werden ([CHAT]) |
| Fenster 3 Inhalt | Kontextuell: immer Objekte anzeigen, nur lokal klickbar |
| Back-Navigation | [← RADAR] Button + [X] im Hub-Header |
| Asteroid/Mining | Kein Hub — direkt in navcom:mining (nur eine Aktion) |
| Architektur | navcomMode + navcomTarget in uiSlice (Option A) |
| Sub-Mode Header | navcomHeader prop auf TradeScreen/MiningScreen |

---

## State-Architektur

### uiSlice Erweiterung

```ts
type NavcomMode = 'radar' | 'hub' | 'trade' | 'mining' | 'quests';
// Kein 'jump' Mode — Jump-Bestätigung läuft inline im NavComHub (jumpgate case)

interface NavcomTarget {
  type: 'station' | 'asteroid' | 'nebula' | 'jumpgate';
  x: number;
  y: number;
  name: string;        // z.B. "TRADING POST ALPHA", "ASTEROID FIELD"
}

// Neue Felder in UiState
navcomMode: NavcomMode;        // default: 'radar'
navcomTarget: NavcomTarget | null;  // default: null

// Neue Actions
setNavcomMode(mode: NavcomMode): void;
openNavcomTarget(target: NavcomTarget, mode: NavcomMode): void;
resetNavcom(): void;  // → mode:'radar', target:null
```

---

## Interaktions-Flows

### Station-Besuch (2 Klicks)

```
1. Radar-Klick auf Sektor       → Fenster 3 zeigt Sektor-Objekte
2. Klick auf Station (lokal)    → openNavcomTarget({type:'station',...}, 'hub')
3. Fenster 2 zeigt NavComHub    → [TRADE] [QUESTS] [INFO] + [X] + [← RADAR]
4. Klick [TRADE]                → setNavcomMode('trade')
5. Fenster 2: TradeScreen       → Header: "TRADING WITH TRADING POST ALPHA"
                                → [← HUB] links, [← RADAR] rechts
```

### Mining (1 Klick)

```
1. Radar-Klick auf Sektor       → Fenster 3 zeigt Sektor-Objekte
2. Klick auf Asteroid (lokal)   → openNavcomTarget({type:'asteroid',...}, 'mining')
3. Fenster 2: MiningScreen      → Header: "MINING: ASTEROID FIELD (12, 7)"
                                → [← RADAR] oben rechts
```

### Jumpgate (1 Klick)

```
1. Klick auf Jumpgate (lokal)   → openNavcomTarget({type:'jumpgate',...}, 'hub')
2. Fenster 2: NavComHub         → zeigt Ziel-Quadrant, AP-Kosten, [JUMP] Button inline
                                → [X] / [← RADAR]
```

### Spieler (immer)

```
Remote oder lokal:              → [CHAT]-Button in Fenster 3
Klick [CHAT]                    → öffnet CommsScreen mit vorausgewähltem Spieler
```

---

## Fenster 3 — Sektor-Objekt-Anzeige

### Remote-Sektor (Spieler ist woanders)

```
◈ SEKTOR (12, 7) · ASTEROID FIELD
DISTANZ: ~5 SEKTOREN

OBJEKTE
⬡ ASTEROID FIELD         ORE · GAS      —
● LARS (Spieler)                         [CHAT]
⚔ NPC PIRATE                            —

Navigiere hierher um zu interagieren.
```

### Lokaler Sektor (Spieler ist hier)

```
◈ SEKTOR (12, 7) · ASTEROID FIELD   ● HIER
RESSOURCEN: ORE · GAS

OBJEKTE
⬡ ASTEROID FIELD ›                   klicken
● LARS (Spieler)                     [CHAT]
⚔ NPC PIRATE ›                       klicken

Klicke ein Objekt um zu interagieren.
```

### Objekt-Typen

| Icon | Typ | Lokal → Öffnet | Remote |
|------|-----|----------------|--------|
| ◈ | Station | Hub → [TRADE] [QUESTS] [INFO] | Nur Anzeige |
| ⬡ | Asteroid / Nebula | navcom:mining direkt | Nur Anzeige |
| ⟁ | Jumpgate | Hub → Jump-Bestätigung inline | Nur Anzeige |
| ⚔ | NPC | Bestehender Combat-Flow | Nur Anzeige |
| ● | Spieler | [CHAT] | [CHAT] — immer |

**Datenquellen:** `sectorCache`, `discoveredSectors`, `onlinePlayers` aus `gameSlice` — kein neuer Server-Request nötig. NPCs sind Teil von `currentSector.npcs` (nur im lokalen Sektor) — remote keine NPC-Daten vorhanden, NPC-Zeile wird nur im lokalen Sektor gerendert.

**Name-Quelle:** `navcomTarget.name` kommt immer aus `sectorCache` / `currentSector` — nie synthetisiert.

---

## CockpitLayout — Rendering-Logik (Sec 2)

```tsx
// CockpitLayout.tsx — Sec 2 Rendering wenn activeProgram === 'NAV-COM'
switch (navcomMode) {
  case 'radar':   return <RadarCanvas />;
  case 'hub':     return <NavComHub target={navcomTarget} />;  // station + jumpgate
  case 'trade':   return <TradeScreen navcomHeader={`TRADING WITH ${navcomTarget?.name}`} />;
  case 'mining':  return <MiningScreen navcomHeader={`MINING: ${navcomTarget?.name}`} />;
  case 'quests':  return <QuestsScreen navcomFilter={navcomTarget} />;
}
// Kein 'jump' Case — Jump-Bestätigung ist inline in NavComHub (jumpgate case)
```

---

## Neue Komponente: NavComHub

**Datei:** `packages/client/src/components/NavComHub.tsx`

- Props: `target: NavcomTarget`
- Rendert abhängig von `target.type`:
  - `station` → Action-Menü: [TRADE] [QUESTS] [INFO] Buttons + Stations-Name, Fraktion
  - `jumpgate` → Inline Jump-Bestätigung: Ziel-Quadrant, AP-Kosten, [JUMP →] Button
- Station-Hub Actions:
  - `[TRADE]` → `setNavcomMode('trade')`
  - `[QUESTS]` → `setNavcomMode('quests')` (QuestsScreen gefiltert auf diese Station)
  - `[INFO]` → Stations-Details inline im Hub (Name, Fraktion, Faction-Rep)
- Jumpgate-Hub Action:
  - `[JUMP → Q(x,y)]` → `gameNetwork.sendMessage('jumpGate', { sectorX, sectorY })` aufrufen → `resetNavcom()`
- Navigation: `[X]` und `[← RADAR]` → `resetNavcom()`

---

## Geänderte Komponenten

### TradeScreen / MiningScreen

```tsx
interface Props {
  navcomHeader?: string;  // z.B. "TRADING WITH TRADING POST ALPHA"
}
// Wenn navcomHeader gesetzt: Header-Zeile mit Titel + [← HUB] / [← RADAR] anzeigen
//   [← RADAR] → resetNavcom()  |  [← HUB] → setNavcomMode('hub')
// Wenn nicht gesetzt: bisheriges Verhalten unverändert (~10 Zeilen Änderung pro Screen)
```

### Fenster 3 (Detail-Monitor) — NavComSectorDetail

**Datei:** `packages/client/src/components/NavComSectorDetail.tsx` (neue Komponente)

Wird in `CockpitLayout.tsx` Sec 3 gerendert wenn `activeProgram === 'NAV-COM'` (ersetzt bisherigen Detail-Monitor für dieses Programm):
- Zeigt Sektor-Header: Koordinaten, Typ, Distanz / "● HIER"
- Zeigt Objekt-Liste aus `sectorCache[selectedSector]` + `onlinePlayers`
- Lokalitäts-Check: `selectedSector.x === position.x && selectedSector.y === position.y`
- Remote: Objekte mit Icon + Name, kein Click-Handler außer Spieler → [CHAT]
- Lokal: Objekte klickbar → `openNavcomTarget()` mit passendem Mode

### QuestsScreen

```tsx
interface Props {
  navcomFilter?: NavcomTarget;  // wenn gesetzt: nur Quests dieser Station anzeigen
}
```
- Wenn `navcomFilter` gesetzt: Tab "VERFÜGBAR" filtert auf `stationX/stationY === navcomFilter.x/y`
- Wenn nicht gesetzt: bisheriges Verhalten unverändert

---

## Entfernte Komponenten / Programme

| Was | Wo | Aktion |
|-----|-----|--------|
| `StationTerminalOverlay.tsx` | `packages/client/src/components/overlays/` | **Vollständig entfernen** |
| TRADE im ProgramSelector | `ProgramSelector.tsx` + `programs`-Array | **Entfernen** |
| ROUTEN-Tab | `TradeScreen.tsx` | **Entfernen** |
| KONTOR-Tab / KONTOR-Begriff | `TradeScreen.tsx` | **Entfernen, → "TRADING POST"** |
| `StationTerminalOverlay` Import | `CockpitLayout.tsx` | **Entfernen** |
| KONTOR-Label | `TradeScreen.tsx` | **Nur UI-Label-Änderung** — kein DB/Server-Rename |

**Bleibt erhalten:**
- MINING im ProgramSelector (Direktzugang: öffnet MiningScreen ohne navcomTarget — zeigt aktuellen Sektor oder leer-State wenn nicht in Asteroid-Sektor)
- TradeScreen, MiningScreen (nur Header-Erweiterung)
- Bestehender Combat-Flow (NPC-Klick triggert ihn, Entry-Point verschiebt sich)

---

## Was nicht in P2-NavCom ist

- SCAN-Programm bleibt als separates Programm (kein NavCom-Sub-Mode)
- FACTION, TECH, COMMS, CARGO, QUESTS bleiben eigenständige Programme
- MINING im ProgramSelector bleibt als Direktzugang
- Alien-Encounter-Flow: bleibt unverändert (Toast-basiert, kein Fenster-3-Objekt)
