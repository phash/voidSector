# voidSector — UX Roadmap

*Erstellt: 2026-03-10 | Basis: vollständiger 2D-Designer-Audit aller Client-Komponenten*

---

## UX-Philosophie: "Terminal kennt seinen Pilot"

Die UI passt sich dem Erfahrungsstand des Spielers an:
- **Kontextueller State** statt toter Panels — leere Zustände bieten immer einen nächsten Schritt
- **Progressive Disclosure** — nicht alle 12 Programme beim ersten Login, stufenweise freigeschaltet
- **Ein kanonisches System** — keine Dual-UI zwischen Cockpit und StationTerminal

---

## Phase 1 — Sofortmaßnahmen (Quick Wins, ~3–5 Tage)

### P1-A: Typos & Sprachkonsistenz
- `QuestsScreen.tsx:692` — `"VERFUGBARE QUESTS"` → `"VERFÜGBARE QUESTS"`
- `TradeScreen.tsx:77` — "Navigate to a station or your home base to trade." → "Navigiere zu einer Station oder deiner Heimatbasis."
- `CommsScreen.tsx` — alle englischen Strings eingedeutschen:
  - "NO MESSAGES ON THIS CHANNEL" → "KEINE NACHRICHTEN AUF DIESEM KANAL"
  - "NO RECENT CONTACTS" → "KEINE KONTAKTE"
  - "Type message..." → "Nachricht eingeben..."

### P1-B: Button-Label-Standard `[AKTION]` überall
- `HangarPanel.tsx` — `OK` → `[OK]`, `X` → `[X]`, `UMBENENNEN` → `[UMBENENNEN]`
- `GameScreen.tsx` (TerritoryPanel) — `⬡ CLAIM` → `[CLAIM]`, `LIST` → `[LIST]`
- `CockpitLayout.tsx` (Mode-Toggle Bezel) — `1` → `[DET]`, `2` → `[TV]`
- Ziel: Das `[AKTIONSNAME]`-Schema überall lückenlos durchsetzen

### P1-C: Abwurf-Bestätigung in CargoScreen
- `CargoScreen.tsx` — `[ABWERFEN X]`-Buttons bekommen Zwei-Klick-Bestätigung:
  - Klick 1: Button ändert sich zu `[ABWERFEN ORE — SICHER?]`
  - Klick 2: Aktion ausführen
  - 3s Timeout: Button resettet automatisch wenn kein zweiter Klick

### P1-D: StationTerminal Cleanup
- `FORSCHUNG`-Menüpunkt aus StationTerminalOverlay entfernen
- `HANGAR`-Menüpunkt aus StationTerminalOverlay entfernen (Konzept gestrichen)
- Terminal verbleibt temporär mit: QUESTS + HANDEL
- Vollständige Ablösung in Phase 2 (siehe P2-NavCom)

### P1-E: AP-Feedback + Generisches Disabled-Reason-System
Drei-Layer-Feedback bei AP = 0:
- **A — StatusBar Flash:** `⚡ NO AP — REGENERATING · FULL IN Xs` (3s, InlineError)
- **B — AP-Balken Pulse:** rote Pulse-Animation (1.5s) auf AP-Bar in StatusBar
- **C — Button-Mutation (generisch):** `btnDisabled(label, reason)` → `[JUMP — NO AP]`
  - Alle Buttons zeigen Grund: `NO AP`, `CARGO FULL`, `OUT OF RANGE`, `MINING ACTIVE`, `COSTS N AP`
  - Implementierung via `btnDisabled()` + `UI.reasons` aus P1-A
- **D — Einmaliger HelpTip:** beim ersten AP=0: "AP powers all actions — regenerates automatically"

---

## Phase 2 — Strukturelle Verbesserungen (2–3 Wochen)

### P2-NavCom: NavCom-zentrische Interaktion (aus Brainstorming Phase 1)
Fundamentaler Paradigmenwechsel — entschieden in Brainstorming-Session 2026-03-10:

**Neues Modell:**
```
Fenster 2 (Radar)  → Sektor anklicken
Fenster 3 (Detail) → Objekte im Sektor (Station, Spieler, NPC, Gate...)
Objekt klicken     → Interaktion öffnet in Fenster 2
```
Gilt universal für Stationen, Spieler, NPCs, Jumpgates — kein Sonderfall.

**Konsequenzen:**
- `StationTerminalOverlay` → komplett entfernen
- `TRADE`-Programm → aus ProgramSelector entfernen
- `ROUTEN` + `KONTOR` → entfernen
- Station-Quests erscheinen kontextuell in Fenster 3 wenn Spieler im Sektor mit Station ist
- `HangarPanel` → bereits gestrichen (P1-B)

### P2-E: QuestsScreen — 9 Tabs → 4 Tabs
Neue Taxonomie:
| Neuer Tab | Enthält bisher |
|-----------|----------------|
| **AUFTRÄGE** | AKTIV + JOURNAL (Tracking integriert) + RETTUNG (als Filter) |
| **VERFÜGBAR** | STATION + COMMUNITY + EVENTS (kontextabhängig) |
| **REPUTATION** | REP + ALIEN REP (zusammengeführt) |
| **STORY** | STORY (wie bisher) |

- Tab-Leiste: feste Breite pro Tab, kein `flexWrap` mehr
- EVENTS thematisch richtig eingeordnet (kein eigener Top-Tab)
- ALIEN REP aus QUESTS heraus — konzeptuell zu REPUTATION

### P2-F: First-Run-Experience — 5-Step-Onboarding
Implementierung in `helpSlice.ts` + `HelpOverlay.tsx`:
- Flag in localStorage (`vs_first_run`) nach erstem Login
- Sequenzielle HelpOverlay-Queue, auto-advance nach 3s oder Klick:
  1. "RADAR — Dein Universum. Klicke auf Sektoren für Details." *(Sektion 2 hervorheben)*
  2. "D-PAD — Steuere dein Schiff. 1 AP pro Sprung." *(Sektion 5 D-Pad hervorheben)*
  3. "AP — Action Points: die Kern-Ressource. Sie regenerieren automatisch."
  4. "ZIEL: Finde einen Asteroiden-Sektor und starte MINING."
  5. "Kompendium [◈] für alle Details. Viel Erfolg, Pilot."
- Im ProgramSelector: erste 3 Programme mit subtil pulsierender Markierung bis erstmals benutzt

### P2-G: Contextual Empty States mit Aktions-Links
Jeder blockierte Zustand muss einen Handlungsweg anbieten:
- `TradeScreen.tsx` — "KEIN HANDEL VERFÜGBAR": nächste Station aus Discovery-Cache + `[NAVIGIEREN]`-Button
- `MiningScreen.tsx` — "KEINE RESSOURCEN": "Navigiere zu einem ASTEROID oder NEBEL" + `[RADAR ÖFFNEN]`
- `QuestsScreen.tsx` (VERFÜGBAR-Tab) — wenn nicht an Station: "Docke an einer Station an" + nächste Station anzeigen

### P2-H: Mining-LED im ProgramSelector
- `ProgramSelector.tsx` — MINING-Button LED:
  - Grün blinkend: wenn `mining?.active === true`
  - Orange blinkend: wenn Cargo ≥ 90% voll
- Toast wenn Cargo beim Mining voll wird (kein stilles Stop)

### P2-I: BookmarkBar — Lesbarkeit & Interaktion
- Alle Texte in `BookmarkBar.tsx`: minimum `font-size: 0.75rem`
- Rechtsklick-Löschen ersetzen durch sichtbaren `[X]`-Button pro belegtem Slot (on Hover sichtbar)
- Tracked-Quest-Items: Sidebar-Panel statt absolut positionierter Tooltip

### P2-J: Back-Button & Breadcrumbs — Einheitliche Drill-Down-Navigation
- Screen-Header jedes Detail-Panels mit Breadcrumb-Zeile ausstatten: `[QUESTS] › [STATION] › [DETAIL]`
- Jedes Breadcrumb-Element klickbar (springt direkt zu dieser Ebene)
- Sektion 3 (Detail-Monitor): Back-Button als erstes Element wenn Drill-Down aktiv ist
- `navReturnProgram` konsistent setzen in allen Flows die Drill-Downs erzeugen

### P2-K: Comms-Channel-Switcher in CommsScreen integrieren
- Channel-Selector (`[q] [s] [f] [d]`) aus der Hardware-Controls-Strip herauslösen
- Als Tab-Leiste oder Button-Gruppe oben im CommsScreen anzeigen — neben dem Chat-Fenster
- Kontakt-Hinweis bei "KEINE KONTAKTE": "Rechtsklicke einen Spieler auf dem Radar um ihn zu kontaktieren."

### P2-L: Statusbar-Duplikate bereinigen
- HYPER-Status erscheint in StatusBar UND NavControls — an einer Stelle entfernen
- Globale Entscheidung: ASCII-Bars (`█░` SegmentedBar) oder CSS-div-Balken — einheitlich durchsetzen

---

## Phase 3 — Polishing (ab Sprint 6+)

### P3-J: StationTerminal — abgelöst durch P2-NavCom
- ~~StationTerminalOverlay Integration~~ → ersetzt durch NavCom-Paradigma (P2-NavCom)
- Wenn P2-NavCom implementiert: StationTerminalOverlay komplett entfernen

### P3-K: CombatV2Dialog — Taktischer Kontext
- HP-Gradient: unter 30% HP orange, unter 15% rot + Pulse-Animation
- Unter 25% HP: Hinweis "KRITISCH — DEFENSIV oder FLUCHT ratsam" (kleiner roter Text)
- Sichtbare Shortcut-Legende am unteren Rand: `[1] ANGRIFF | [2] AUSGEWOGEN | [3] DEFENSIV | [ESC] FLUCHT`
- NOTAUSSTIEG-Button: keine Überraschung — vorab subtil anzeigen (gegraut bis < 15 HP)

### P3-L: AlienEncounterToast — Countdown-Timer
- Sichtbarer Countdown-Balken für Auto-Dismiss (8s Abbau)
- Position überprüfen: aus Bezel-Hardware-Strip-Overlap-Zone heraus
- Interaktive Encounters: optionaler Timer wenn Response-Deadline existiert

### P3-M: ACEP-Panel — Mehr Prominenz
- `GameScreen.tsx:51-109` — Font-Größe auf minimum `0.75rem` anheben
- Label "ACEP" durch Tooltip ergänzen: "Schiffs-Persönlichkeit — dein Schiff wächst durch Erfahrung"
- Aktive Trait-Namen sichtbar machen (aktuell nur Effekte, keine Trait-Namen)

### P3-N: Fehlende Detail-Panels für FACTION und SHIP-SYS
- `CockpitLayout.tsx` — `getDetailForProgram()` erweitern:
  - FACTION → `FactionDetailPanel` (Mitglied-Info, Rang-Erklärung, Upgrade-Tooltips)
  - SHIP-SYS → `ShipDetailPanel` (aktive Module im Überblick, ACEP-Pfad-Details)

### P3-O: Koordinaten-Tooltips & Orientierungshilfe
- Überall wo `innerCoord(x), innerCoord(y)` angezeigt wird: Hover-Tooltip "Sektor-Koordinate im aktuellen Quadranten"
- ORIGIN-Anzeige in StatusBar: Tooltip "Entfernung vom Startpunkt (0,0)"
- StoryEventOverlay: "Kapitel X" → "Kapitel X von 9" (Fortschrittskontext)

### P3-P: Monitor-Power-Off entdeckbar machen
- Power-Button in Sektion 3 ist aktuell unsichtbar — kein Spieler findet ihn
- Entscheidung: Feature prominent machen (sichtbarer Toggle in Bezel-Chrome) oder komplett entfernen

---

## Priorisierungs-Matrix

| Problem | Schwere | Aufwand | ROI |
|---------|---------|---------|-----|
| Typos + Sprachmix (P1-A) | P2 | Minimal | Sehr hoch |
| Button-Labels (P1-B) | P1 | Niedrig | Hoch |
| AP-Feedback (P1-E) | P0 | Niedrig | Hoch |
| Abwurf-Bestätigung (P1-C) | P1 | Niedrig | Hoch |
| Leere States (P2-G) | P1 | Niedrig | Hoch |
| Mining-LED (P2-H) | P1 | Niedrig | Mittel |
| BookmarkBar (P2-I) | P1 | Niedrig | Mittel |
| Back-Button / Breadcrumbs (P2-J) | P1 | Mittel | Mittel |
| Comms-Channel (P2-K) | P1 | Mittel | Mittel |
| Statusbar-Duplikate (P2-L) | P2 | Niedrig | Mittel |
| Quest-Tabs 9→4 (P2-E) | P0 | Mittel | Hoch |
| Onboarding-Sequenz (P2-F) | P0 | Mittel | Sehr hoch |
| Combat-Kontext (P3-K) | P1 | Mittel | Mittel |
| AlienToast-Timer (P3-L) | P2 | Niedrig | Mittel |
| ACEP-Panel (P3-M) | P2 | Niedrig | Mittel |
| Faction/Ship Detail-Panels (P3-N) | P2 | Mittel | Mittel |
| Dual-UI Integration (P3-J) | P0 | Hoch | Hoch |
