# Phase 2 UX Rest — Design Spec
*2026-03-10 · Brainstorming-Session*

Umfasst: P2-E · P2-F · P2-G · P2-H · P2-I · P2-J · P2-K · P2-L

---

## P2-E — QuestsScreen: 9 Tabs → 4 Tabs

### Neue Tab-Taxonomie

| Neuer Tab | Enthält (bisher) |
|-----------|-----------------|
| **AUFTRÄGE** | AKTIV + JOURNAL + RETTUNG (als Filter-Badge, kein eigener Tab) |
| **VERFÜGBAR** | STATION + COMMUNITY + EVENTS (kontextabhängig sichtbar) |
| **REPUTATION** | REP + ALIEN REP (zusammengeführt) |
| **STORY** | STORY (wie bisher) |

### Implementierung

- `QuestsScreen.tsx`: `activeTab` State auf 4 Werte reduzieren
- Tab-Leiste: feste Breite pro Tab (`width: 25%`), kein `flexWrap` mehr
- AUFTRÄGE-Tab: interner Filter-Toggle `[ALLE] [RETTUNG]` statt eigenem Tab
- VERFÜGBAR-Tab: EVENTS-Einträge erscheinen als Teil der Liste (kein eigener Tab)
- REPUTATION-Tab: REP + ALIEN REP in einer scrollbaren Liste mit Sektions-Header
- Bestehende Tab-Inhalts-Komponenten bleiben, werden nur neu zusammengeführt

---

## P2-F — First-Run-Experience (5-Step-Onboarding)

### State

```ts
// helpSlice.ts — neue Felder
onboardingStep: number | null;  // null = abgeschlossen, 0–4 = aktiver Step
// Initialisierung: prüft localStorage 'vs_first_run' — fehlt = 0, vorhanden = null
```

### 5-Step-Sequenz

| Step | Text | Spotlight |
|------|------|-----------|
| 0 | "RADAR — Dein Universum. Klicke auf Sektoren für Details." | Sec 2 (Radar) |
| 1 | "D-PAD — Steuere dein Schiff. 1 AP pro Sprung." | Sec 5 (D-Pad) |
| 2 | "AP — Action Points: die Kern-Ressource. Sie regenerieren automatisch." | keins |
| 3 | "ZIEL: Finde einen Asteroiden-Sektor und starte MINING." | keins |
| 4 | "Kompendium [◈] für alle Details. Viel Erfolg, Pilot." | Compendium-Button |

### HelpOverlay Verhalten

- Auto-advance nach 3s oder Klick auf [WEITER]
- `[ÜBERSPRINGEN]`-Link (klein, rechts unten) — überspringt alle Steps, setzt `onboardingStep = null` sofort
- Spotlight: semitransparentes Overlay (`background: rgba(0,0,0,0.7)`) mit `box-shadow: 0 0 0 9999px` Cutout für hervorgehobene Sektion
- Nach Step 4: `onboardingStep = null`, `localStorage.setItem('vs_first_run', '1')`
- `HelpOverlay.tsx`: bereits vorhanden — neue `onboardingStep`-Logik hinzufügen

### Programm-Puls

- Erste 3 Programme im ProgramSelector (NAV-COM, MINING, CARGO) erhalten subtile Puls-Animation bis erstmals benutzt
- Flag pro Programm: `localStorage` Keys `vs_prog_used_navcom`, `vs_prog_used_mining`, `vs_prog_used_cargo`
- CSS: `@keyframes prog-pulse` auf dem Button-Border, gedimmt (opacity 0.5→1, 2s Intervall)

---

## P2-G — Contextual Empty States

### Betroffene Screens

| Screen | Leerer Zustand | Action-Link |
|--------|---------------|-------------|
| `TradeScreen` | `"NO TRADING AVAILABLE"` | Nächste Station aus `discoveredSectors` + `[NAVIGATE]` |
| `MiningScreen` | `"NO RESOURCES IN THIS SECTOR"` | `"Navigate to ASTEROID or NEBULA"` + `[OPEN RADAR]` |
| `QuestsScreen` (VERFÜGBAR) | `"NO QUESTS AVAILABLE"` | `"Dock at a station"` + Name der nächsten Station |
| `CargoScreen` | `"CARGO HOLD EMPTY"` | `[OPEN MINING]` |
| `CommsScreen` | `"NO CONTACTS"` | `"Right-click a player on the radar to contact them."` |
| `FactionScreen` | `"NOT IN A FACTION"` | `"Open QUESTS to find faction recruitment missions."` |

### Pattern

```tsx
// Einheitliches Empty-State-Pattern in jedem Screen
<div className="empty-state">
  <div className="empty-state-message">{message}</div>
  <div className="empty-state-action">{actionText}</div>
  {actionButton && <button onClick={actionHandler}>{btn(actionButton)}</button>}
</div>
```

- `[NAVIGATE]`: setzt NavCom-Ziel via `openNavcomTarget()` auf nächste Station
- `[OPEN RADAR]`: setzt `activeProgram('NAV-COM')` + `resetNavcom()`
- `[OPEN MINING]`: setzt `activeProgram('MINING')`
- Nächste Station: aus `discoveredSectors` gefiltert nach `type === 'station'`, sortiert nach Distanz zu `position`

---

## P2-H — Mining-LED im ProgramSelector

### LED-Verhalten

| Zustand | Farbe | Animation |
|---------|-------|-----------|
| `mining?.active === true` | `#0f0` (grün) | `@keyframes led-pulse` 1s |
| `cargo >= cargoMax * 0.9` | `#f80` (orange) | `@keyframes led-pulse` 1s |
| Normal | — | keine LED |

### Toast bei vollem Cargo

- Trigger: `cargo >= cargoMax` während `mining.active === true` — d.h. Cargo füllt sich WÄHREND Mining läuft und erreicht 100%
- Nicht: wenn Mining startet während Cargo bereits voll ist (das verhindert der bestehende `canAddResource`-Guard)
- Toast-Text: `"⚠ CARGO FULL — MINING STOPPED"`
- Implementierung: `useEffect` in `CockpitLayout.tsx` der `cargo/cargoMax/miningActive` beobachtet

### Implementierung

- `ProgramSelector.tsx`: `miningActive` + `cargoPercent` aus `gameSlice` selektieren
- LED als `<span>` mit `className={ledClass}` adjacent zum Programm-Label
- CSS: `@keyframes led-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`

---

## P2-I — BookmarkBar: Lesbarkeit & Interaktion

### Änderungen

1. **Font-Size**: alle Texte in `BookmarkBar.tsx` auf `font-size: 0.75rem` minimum
2. **[X]-Button**: pro belegtem Slot ein `[X]`-Button, `opacity: 0` default → `opacity: 0.8` on hover (CSS `:hover`)
3. **Rechtsklick-Löschen entfernen**: `onContextMenu`-Handler entfernen
4. **Quest-Detail-Panel** statt absolutem Tooltip:

```tsx
// Hover auf tracked-quest-Slot → zeigt Panel
interface QuestDetailPanelProps {
  quest: TrackedQuest;
  anchorRef: RefObject<HTMLElement>;
}
// TrackedQuest: bestehender Typ aus gameSlice (tracked quests im bookmarkSlice / helpSlice)
// Inhalt: Quest-Titel, Objective-Text, Fortschritt (progress/amount), Station-Koordinaten + Distanz
// Position: absolut, adjacent zum Slot, feste Breite 180px
// Sichtbar: onMouseEnter Slot → show
// onMouseLeave Slot → hide mit 150ms delay
// WICHTIG: [X]-Button ist Teil des Slot-Elements — kein Hide wenn Maus zu [X] wandert
// (beide Hover-Bereiche gehören zum gleichen onMouseLeave-Event des Slot-Containers)
```

---

## P2-J — Back-Button & Breadcrumbs

### Breadcrumb-Header (Fenster 3)

Wird gerendert wenn `navReturnProgram !== null` in uiSlice:

```tsx
// Breadcrumb-Zeile in Sec 3 Header
<div className="breadcrumbs">
  {breadcrumbs.map((crumb, i) => (
    i < breadcrumbs.length - 1
      ? <button key={i} onClick={() => navigateTo(crumb)}>{crumb.label}</button>
      : <span key={i} className="current">{crumb.label}</span>
  ))}
</div>
```

- Trennzeichen: `›` zwischen Breadcrumbs
- Letztes Element: nicht klickbar, heller (`color: #0f0`)
- Vorherige Elemente: klickbar, gedimmt (`color: #555`)

### State

```ts
// uiSlice — bereits vorhanden: navReturnProgram
// Erweiterung: breadcrumbStack
breadcrumbStack: Array<{ label: string; program: string }>;
// Kein subState — Navigation restauriert nur das Programm, nicht interne Sub-States

// Actions
pushBreadcrumb(crumb: { label: string; program: string }): void;
// → appends to breadcrumbStack. Max 3 Einträge — zusätzliche pushes ersetzen den letzten Eintrag

popBreadcrumb(): void;
// → entfernt letzten Eintrag, setzt activeProgram auf crumb.program

clearBreadcrumbs(): void;
// → breadcrumbStack = [], navReturnProgram = null
// → wird aufgerufen wenn setActiveProgram() auf ein top-level Programm springt
```

### Konkrete Call Sites (pushBreadcrumb)

| Datei | Trigger | Breadcrumb-Label |
|-------|---------|-----------------|
| `QuestsScreen.tsx` | Quest-Item onClick → Detail-View | `quest.title` |
| `TechTreePanel.tsx` | Tech-Node onClick → Node-Detail | `node.name` |
| `FactionScreen.tsx` | Detail-View öffnen | `faction.name` |
| `CommsScreen.tsx` | Kontakt-Item onClick → Chat-Detail | `contact.name` |
| `CargoScreen.tsx` | Modul-Item onClick → Modul-Detail | `module.name` |

### clearBreadcrumbs auslösen

`setActiveProgram()` Action ruft automatisch `clearBreadcrumbs()` auf — Breadcrumbs sind programmspezifisch und werden bei jedem Programm-Wechsel zurückgesetzt.

---

## P2-K — Comms-Channel-Switcher in CommsScreen

### Änderungen

- **Entfernen**: Channel-Buttons `[q] [s] [f] [d]` aus `HardwareControls.tsx` (Sec 5)
- **Hinzufügen**: Channel-Button-Gruppe oben in `CommsScreen.tsx` (Sec 6)

### CommsScreen — neue Struktur

```tsx
// Oben: Channel-Button-Gruppe
<div className="channel-switcher">
  {['QUADRANT', 'FACTION', 'DIRECT', 'SYSTEM'].map(ch => (
    <button
      key={ch}
      className={activeChannel === ch ? 'active' : ''}
      onClick={() => setChannel(ch)}
    >
      {ch}
    </button>
  ))}
</div>
// Darunter: Chat-Fenster (wie bisher)
```

- Keyboard-Shortcuts `[q][s][f][d]` bleiben funktional (in `HardwareControls.tsx` als Key-Handler ohne Button)
- Kontakt-Hinweis bei "NO CONTACTS": `"Right-click a player on the radar to contact them."`

---

## P2-L — Statusbar-Duplikate bereinigen

### Änderungen

- **HYPER-Status**: aus `StatusBar.tsx` entfernen — bleibt nur in `NavControls.tsx`
- **Balken-Standard**: einheitlich ASCII-Segmentbalken (`█░` SegmentedBar) für AP + HP + Cargo in `StatusBar.tsx`
  - Betroffene Dateien: `StatusBar.tsx` (AP-Balken, HP-Balken, Cargo-Balken)
  - `SegmentedBar`-Komponente bereits vorhanden im Projekt — CSS-div-Balken in diesen drei Stellen ersetzen

---

## Abhängigkeiten zwischen Items

```
P2-G (Empty States)
  └── nutzt openNavcomTarget() aus P2-NavCom (für [NAVIGATE]-Action)
      Fallback wenn P2-NavCom noch nicht gemergt: [NAVIGATE] setzt stattdessen
      activeProgram('NAV-COM') + selectedSector auf nächste Station (bestehende Mechanismen)

P2-J (Breadcrumbs)
  └── NavCom Sub-Modes bereits in P2-NavCom Spec abgedeckt — hier nur restliche Programme

P2-F (Onboarding)
  └── unabhängig, kann parallel implementiert werden

P2-E, P2-H, P2-I, P2-K, P2-L
  └── alle unabhängig voneinander
```

---

## Was nicht in Phase 2 Rest ist

- P2-NavCom (eigene Spec: `2026-03-10-p2-navcom-design.md`)
- Phase 1 Items (P1-A bis P1-E) — separater Plan vorhanden
- Phase 3 Items (Combat-Kontext, ACEP-Panel, etc.)
