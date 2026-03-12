# Spec: voidSector Mobile — UI/UX Konzept

**Date:** 2026-03-12
**Status:** Approved

---

## Overview

Mobile-optimierte Variante von voidSector als Idle-Companion. Primäre Nutzung: kurze Sessions unterwegs (2–5 Min.), Status checken, Mining starten/stoppen, Quests annehmen, zu Bookmarked Mining-Spots navigieren. Kernmechanik: Slow Flight als neue automatische Intra-Quadrant-Navigation, ergänzend zum bestehenden Hyperjump.

---

## App-Struktur

### Bottom Tab Bar (5 Tabs, persistent)

| Tab | Icon | Inhalt |
|-----|------|--------|
| HOME | 🏠 | Dashboard — Status-Karten |
| NAV | 🗺 | Radar + Bookmarks + Modus-Toggle |
| MINE | ⛏ | Mining-Controls |
| QUESTS | 📋 | Aktive + verfügbare Quests (Alert-Badge) |
| MEHR | ··· | Grid aller weiteren Programme |

Die Tab Bar ist auf allen Screens sichtbar. Alert-Badges (roter Dot) erscheinen auf QUESTS und MEHR wenn neue Inhalte vorhanden sind.

Der bestehende mobile Layout-Breakpoint (max-width: 1023px) bleibt erhalten. Die neuen Tabs ersetzen die bisherige 5-Tab-Struktur (`useMobileTabs.ts`: NAV, SHIP, CARGO/TRADE, COMMS, MEHR).

**Migration bisheriger Inhalte:**
- SHIP-SYS → wandert in MEHR-Grid
- COMMS → wandert in MEHR-Grid (Alert-Badge auf MEHR wenn neue Chat-Nachricht)
- CARGO/TRADE (kontextuell) → MINE-Tab zeigt Cargo-Info inline; TRADE bleibt in MEHR

---

## Screens

### 1. HOME — Dashboard

Einstiegspunkt beim App-Öffnen. Zeigt aktuelle Spielerzustand auf einen Blick.

**Karten (vertikal gestapelt, scrollbar):**

**Mining-Card** (amber-border wenn aktiv):
- Status: AKTIV + laufende Timer-Anzeige (MM:SS) oder INAKTIV
- Ressource + Modus (z.B. "ORE · Mine-All")
- Progress-Bar: Sektor-Yield verbraucht
- Wenn aktiv: roter STOP-Button inline

**Cargo-Card:**
- Anzeige: `[used] / [cap]`
- Progress-Bar (orange → rot bei >80%)
- Wenn an Station: VERKAUFEN-Button

**Nächstes-Ziel-Card** (zeigt den obersten Bookmark):
- Name + Koordinaten des Bookmarks
- FLIEGEN →-Button → öffnet NAV-Tab mit vorausgewähltem Ziel

**Slow-Flight-Card** (nur sichtbar wenn Slow Flight aktiv):
- "✈ SLOW FLIGHT" Titel + roter STOP-Button
- Zielkoordinaten + ETA
- Progress-Bar: zurückgelegte / verbleibende Sektoren

**AP-Bar:**
- Horizontal, immer sichtbar
- Label "AP", Wert rechts

---

### 2. NAV — Navigation

**Modus-Toggle (ganz oben, full-width):**
```
[ 🐌 SLOW | ⚡ JUMP ]
```
- Zwei gleichgroße Buttons, aktiver Modus farblich hervorgehoben (amber)
- Persistiert in localStorage (`vs_mobile_nav_mode`)
- SLOW: automatische Sektor-für-Sektor-Navigation im Quadrant
- JUMP: bestehender Hyperjump (auch Cross-Quadrant)

**Radar-Canvas:**
- Full-width, ca. 40% der Screenheight
- Bestehende Pointer-Events (Pan, Tap-to-select, Double-tap recenter) bleiben
- Zoom-Buttons (⊕ ⊖) bleiben als Overlay
- Tap auf Sektor → navigiert im aktiven Modus (kein Popup, direkt ausführen)

**Bookmarks-Liste (darunter, scrollbar):**
- Alle gesetzten Bookmarks als kompakte Zeilen: `[Name] [Koordinaten] [→ GO]`
- GO-Button fliegt im aktiv gewählten Modus zum Bookmark
- "⭐ BOOKMARKS" als Label-Header
- Bookmark hinzufügen/entfernen: über MEHR → NAV-COM (bestehend)

**Wenn Slow Flight aktiv:**
- Auf dem Radar: Pfad-Visualisierung (gedimmte Linie von Position zu Ziel)
- Unter Radar: Fortschritts-Anzeige `[Aktuelle Pos] → [Ziel] · [N Sektoren] · ~Xs`
- STOP-Button inline

---

### 3. MINE — Mining

**Sektor-Header:**
- Sektor-Typ + Koordinaten (z.B. "ASTEROID (3/4)")
- Wenn kein minable Sektor: "Kein Mining in diesem Sektor" + NAV-Hinweis

**Ressourcen-Cards** (eine pro Ressource: ORE, GAS, CRYSTAL):
- Ressourcen-Name + `[aktuell] / [max]`
- Progress-Bar (Sektor-Yield)
- MINE-Button wenn > 0 verfügbar, disabled wenn 0 oder Mining läuft
- Wenn Mining aktiv auf dieser Ressource: Timer + STOP-Button statt MINE

**Mine-All-Zeile (unten):**
- Label "MINE-ALL" + Button "▶ ALLE ABBAUEN"
- Durchläuft alle verfügbaren Ressourcen automatisch (bestehende Logik)

---

### 4. QUESTS — Aufträge

Bestehender QuestsScreen, angepasst für mobile Touch-Targets. Keine strukturellen Änderungen. Alert-Badge auf Tab wenn neue Quests verfügbar.

---

### 5. MEHR — Weitere Programme

Bestehender MEHR/MehrOverlay mit 3×3 Grid aller restlichen Programme (TECH, TRADE, FACTION, ACEP, QUAD-MAP, BASE-LINK, LOG, NEWS, HANGAR). Keine Änderungen.

---

## Neue Mechanik: Slow Flight

### Konzept

Slow Flight ist automatische Punkt-zu-Punkt-Navigation innerhalb eines Quadranten. Der Spieler wählt ein Ziel (per Radar-Tap oder Bookmark-GO) im Slow-Modus; der Server bewegt den Spieler automatisch Sektor für Sektor entlang des direkten Pfads.

Unterschied zu Hyperjump:
- **Slow Flight**: sequentiell, Sektor für Sektor, nur intra-Quadrant, keine spezielle AP-Anforderung
- **Hyperjump**: instantan zu beliebigem Sektor, auch cross-Quadrant, benötigt ausreichend AP

### Server-Seite

Slow Flight **erweitert den bestehenden Autopiloten** in `NavigationService.ts`. Der vorhandene Mechanismus (`this.ctx.autopilotTimers`, `setInterval` pro Session, `calculateAutopilotPath`, `autopilotStart` / `autopilotUpdate` / `autopilotComplete` Messages) bleibt vollständig erhalten. Slow Flight ist ein neuer Einstiegspunkt in denselben Mechanismus.

**Neuer Message-Handler** `handleSlowFlight` in `NavigationService.ts`:
- Empfängt: `startSlowFlight { targetX, targetY }`
- Validiert: Ziel im gleichen Quadrant (kein Cross-Quadrant, `qx`/`qy` muss übereinstimmen)
- Lehnt ab wenn `this.ctx.autopilotTimers.has(client.sessionId)` (bestehender Autopilot oder Slow Flight bereits aktiv)
- Berechnet Pfad mit dem bestehenden `calculateAutopilotPath(fromX, fromY, targetX, targetY)`
- Startet `setInterval` mit **3000ms** (statt hyperdrive-basiertem `autopilotMs`)
- Pro Tick: bewegt einen Sektor (nutzt bestehende `handleMoveSector`-Logik intern), deducted `ship.apCostJump` AP pro Schritt
- Stoppt wenn AP < `ship.apCostJump`
- Sendet die **bestehenden Messages**: `autopilotStart`, `autopilotUpdate`, `autopilotComplete` — kein neues Message-Format nötig
- Timer läuft scoped in der Colyseus-Room-Instanz → direkter Zugriff auf `client.send()` via `this.ctx`

**Bestehender Handler** `stopAutopilot` bricht Slow Flight genauso ab wie den regulären Autopiloten.

**AP-Kosten:** `ship.apCostJump` pro Sektor-Schritt — identisch zu manuellem Sprung. Slow Flight stoppt automatisch wenn `updated.current < ship.apCostJump`.

### Client-Seite

**Modus-Toggle:** Zustand `navMode: 'slow' | 'jump'` in localStorage (`vs_mobile_nav_mode`).

**Autopilot-State im Store:** Slow Flight nutzt den **bestehenden** `autopilot`-State in `gameSlice` (der bereits `autopilotStart` / `autopilotUpdate` / `autopilotComplete` verarbeitet). Kein neuer State nötig — die vorhandenen `setAutopilot` / `autopilot.active` Felder werden für die Dashboard-Card und NAV-Progress ausgelesen.

**Radar-Tap-Handler:** Wenn `navMode === 'slow'`, sendet `startSlowFlight { targetX, targetY }` statt `jump`. Wenn `navMode === 'jump'`: bestehender Hyperjump.

**Bookmark-GO-Button:** Sendet `startSlowFlight` oder `jump` je nach aktivem `navMode`.

**`autopilotStart`-Handler (bestehend):** Zeigt Slow-Flight-Card auf Dashboard wenn Ursache `slowFlight` ist — unterscheidbar über ein optionales `source: 'slow_flight'` Feld in der Message.

**`autopilotComplete`-Handler (bestehend):** Wenn `source === 'slow_flight'` und Ziel-Sektor ist Asteroid-Feld: automatisch MINE-Tab öffnen.

**Radar-Pfad-Visualisierung:** `RadarRenderer` bekommt optionales `slowFlightPath: [x, y][]` Prop. Wenn gesetzt: gedimmte Linie von aktueller Position zu Ziel einzeichnen (amber, 30% Opacity).

---

## Änderungsübersicht

| Typ | Komponente |
|-----|-----------|
| NEU | Slow Flight Server-Handler (`NavigationService.ts`) |
| NEU | Slow Flight Redis-State + Tick-Integration |
| NEU | Dashboard Home-Screen-Komponente |
| NEU | Modus-Toggle (SLOW/JUMP) in NAV-Tab |
| NEU | `navMode` localStorage + `source: 'slow_flight'` Feld in autopilot Messages |
| NEU | Bookmark-GO-Buttons in NAV-Tab |
| ÜBERARBEITET | Bottom Tab Bar (neue 5 Tabs) |
| ÜBERARBEITET | NAV-Tab: Bookmarks + Radar + Toggle |
| ÜBERARBEITET | MINE-Tab: Ressourcen-Cards statt bisheriger Mining-Screen-Einbettung |
| ÜBERARBEITET | `RadarRenderer.ts`: optionales `slowFlightPath` Prop für Pfad-Visualisierung |
| BLEIBT | MEHR-Overlay (+ SHIP-SYS und COMMS wandern dorthin) |
| BLEIBT | CRT-Aesthetik, Amber, Share Tech Mono |
| BLEIBT | 44px Touch-Targets |
| BLEIBT | Radar Pointer-Events (Pan, Zoom, Double-Tap) |
| BLEIBT | Alle bestehenden Server-Mechaniken |

---

## Out of Scope

- Native App (iOS/Android) — bleibt Web/PWA
- Landscape-Orientierung — Portrait only auf Mobile
- Push Notifications — kein Service Worker
- Offline-Modus
- Änderungen am Desktop-Layout

---

## Success Criteria

- Dashboard zeigt Mining-, Cargo- und Flug-Status ohne Tab-Wechsel
- Slow Flight startet per Bookmark-GO oder Radar-Tap im SLOW-Modus und bewegt Spieler automatisch
- Slow Flight stoppt bei Zielankunft, AP-Leerstand oder manuellem STOP
- Nach Ankunft an Asteroid-Sektor öffnet MINE-Tab automatisch
- Modus-Toggle persistiert zwischen Sessions
- Alle Touch-Targets ≥ 44px
