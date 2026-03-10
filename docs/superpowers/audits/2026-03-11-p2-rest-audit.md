# P2-Rest — Implementierungs-Audit
*2026-03-11 · Stand: master nach PR #251 + PR #253*

---

## P2-E — QuestsScreen: 9 Tabs → 4 Tabs

**Status: ✅ Vollständig**

Spec-konform:
- Tab-State: `'auftraege' | 'verfuegbar' | 'reputation' | 'story'` ✅
- Tab-Bar: `flexWrap: 'nowrap'`, `width: '25%'` pro Button ✅
- `[ALLE]` / `[RETTUNG]` Sub-Filter im AUFTRÄGE-Tab ✅
- STORY-Tab, REPUTATION-Tab (inkl. Alien-Rep) ✅

**Kleinere Abweichung:**
VERFÜGBAR-Tab hat keinen Empty-State wenn `filteredAvailable.length === 0`.
Spec fordert `"NO QUESTS AVAILABLE"` + "Dock at a station" + nächste Station. → **Ticket #A**

---

## P2-F — First-Run-Experience (5-Step-Onboarding)

**Status: ✅ Vollständig**

- `onboardingStep: number | null` in `helpSlice.ts` ✅
- `vs_first_run` localStorage-Check bei Initialisierung ✅
- 5 Steps mit `spotlight`-IDs in `HelpOverlay.tsx` ✅
- Auto-advance nach 3s + `[WEITER]`-Button ✅
- `[ÜBERSPRINGEN]`-Link setzt `onboardingStep = null` sofort ✅
- Spotlight via `box-shadow: 0 0 0 9999px rgba(0,0,0,0.7)` ✅
- Programm-Puls auf NAV-COM/MINING/CARGO mit `isProgramPulsing()` + localStorage-Keys ✅

---

## P2-G — Contextual Empty States

**Status: ⚠ Teilweise**

| Screen | Status |
|--------|--------|
| `TradeScreen` | ✅ "NO TRADING AVAILABLE" + nächste Station + `[NAVIGATE]` |
| `MiningScreen` | ✅ "NO RESOURCES IN THIS SECTOR" + `[OPEN RADAR]` |
| `CargoScreen` | ✅ "CARGO HOLD EMPTY" + `[OPEN MINING]` |
| `FactionScreen` | ✅ "NOT IN A FACTION" + `[OPEN QUESTS]` |
| `CommsScreen` | ✅ "NO CONTACTS" + Radar-Hinweis |
| `QuestsScreen` VERFÜGBAR | ❌ kein Empty State |

**Fehlt:** QuestsScreen VERFÜGBAR-Tab — kein Empty-State wenn keine Quests verfügbar. → **Ticket #A**

---

## P2-H — Mining-LED im ProgramSelector

**Status: ✅ Vollständig**

- LED grün (`#0f0`) wenn `miningActive === true` ✅
- LED orange (`#f80`) wenn `cargoPercent >= 0.9` ✅
- `@keyframes led-pulse` 1s in `global.css` ✅
- Cargo-full Toast via `useEffect` in `CockpitLayout.tsx` (Zeilen 69–77) ✅

---

## P2-I — BookmarkBar: Lesbarkeit & Interaktion

**Status: ⚠ Fast vollständig — eine Verletzung**

- `onContextMenu`-Handler vollständig entfernt ✅
- `[X]`-Button pro Slot, bei Hover sichtbar ✅
- `TrackedQuestPanel` auf Hover mit 150ms Hide-Delay ✅
- Font-Size: überwiegend `0.75rem` ✅

**Verletzung:**
`BookmarkBar.tsx` Zeile 74: `fontSize: '0.6rem'` — unter dem Spec-Minimum `0.75rem`.
Betroffen: Zieldistanz-Anzeige im TrackedQuestPanel. → **Ticket #B**

---

## P2-J — Back-Button & Breadcrumbs

**Status: ⚠ Infrastruktur komplett, UI-Integration lückenhaft**

Implementiert:
- `breadcrumbStack: Array<{label, program}>` in `uiSlice.ts` ✅
- `pushBreadcrumb` (ersetzt letzten Eintrag bei max 3) ✅
- `popBreadcrumb`, `clearBreadcrumbs` ✅
- `setActiveProgram` leert `breadcrumbStack` + `navReturnProgram: null` ✅
- Breadcrumb-Header in `DetailPanel.tsx`: letzte Crumb grün/nicht-klickbar, vorherige dimmed/klickbar ✅
- `TechTreePanel.tsx`: `pushBreadcrumb({ label: mod.name, program: 'TECH' })` ✅

**Fehlende Call Sites (spec-explizit):**
| Datei | Trigger | Status |
|-------|---------|--------|
| `QuestsScreen.tsx` | Quest-Item → Detail | ❌ kein Fenster-3-Drill-Down |
| `FactionScreen.tsx` | Detail-View | ❌ kein Fenster-3-Drill-Down |
| `CommsScreen.tsx` | Kontakt → Chat-Detail | ❌ kein Fenster-3-Drill-Down |
| `CargoScreen.tsx` | Modul → Detail | ❌ kein Fenster-3-Drill-Down |

**Kontext:** Diese Screens expandieren aktuell inline (nicht nach Fenster 3).
Breadcrumbs dort wären erst sinnvoll wenn diese Sub-Views nach Fenster 3 navigieren.
Architekturentscheidung nötig. → **Ticket #D**

---

## P2-K — Comms-Channel-Switcher in CommsScreen

**Status: ✅ Vollständig**

- Channel-Buttons aus `HardwareControls.tsx` entfernt ✅
- 4-Button-Gruppe `QUADRANT / FACTION / DIRECT / SYSTEM` oben in `CommsScreen.tsx` ✅
- Keyboard-Shortcuts `q/f/d/s` als `keydown`-Handler in CommsScreen erhalten ✅
- Server: `VALID_CHANNELS` → `['direct', 'faction', 'quadrant', 'system']` (war `sector`) ✅
- "NO CONTACTS" + Radar-Hinweis ✅

---

## P2-L — Statusbar-Duplikate bereinigen

**Status: ⚠ Fast vollständig — ein toter Selector**

- HYPER-Block aus dem Render-JSX von `HUD.tsx` entfernt ✅
- AP: `SegmentedBar` ✅ · FUEL: `SegmentedBar` ✅

**Problem:**
`HUD.tsx` Zeile 32: `const hyperdrive = useStore((s) => s.hyperdriveState)` — Selector importiert aber nie genutzt.
Toter Code, kein funktionaler Schaden. → **Ticket #C**

**Offene Frage:**
Spec forderte Cargo + HP als SegmentedBar in StatusBar. Cargo ist im CargoScreen, HP im ShipStatusPanel —
diese Werte waren nie in HUD.tsx. Keine Implementierung; Spec-Anforderung war möglicherweise unscharf.

---

## Gesamtübersicht

| Item | Status | Kritikalität |
|------|--------|-------------|
| P2-E | ✅ vollständig (1 Minor) | Gering |
| P2-F | ✅ vollständig | — |
| P2-G | ⚠ VERFÜGBAR-Tab Empty State fehlt | Mittel |
| P2-H | ✅ vollständig | — |
| P2-I | ⚠ `0.6rem` in TrackedQuestPanel | Gering |
| P2-J | ⚠ Infrastruktur da, Call Sites fehlen | Mittel |
| P2-K | ✅ vollständig | — |
| P2-L | ⚠ toter `hyperdrive`-Selector | Gering |

**~85% spec-konform.** 4 von 8 Items vollständig. 4 Items mit konkreten, dokumentierten Lücken.

---

## Roadmap — Offene Tickets

### #A — QuestsScreen VERFÜGBAR: Empty State (Priorität 1)
- Datei: `packages/client/src/components/QuestsScreen.tsx`
- Was: Im VERFÜGBAR-Tab, wenn keine Quests vorhanden: `"NO QUESTS AVAILABLE"` + `"Dock at a station"` + nächste Station aus `discoveredSectors`
- Aufwand: ~30 min

### #B — BookmarkBar: font-size 0.6rem → 0.75rem (Priorität 1)
- Datei: `packages/client/src/components/BookmarkBar.tsx` Zeile 74
- Was: `fontSize: '0.6rem'` → `'0.75rem'` (Zieldistanz im TrackedQuestPanel)
- Aufwand: ~5 min

### #C — HUD.tsx: toter hyperdrive-Selector entfernen (Priorität 2)
- Datei: `packages/client/src/components/HUD.tsx` Zeile 32
- Was: `const hyperdrive = useStore((s) => s.hyperdriveState)` löschen
- Aufwand: ~5 min

### #D — Breadcrumb Call Sites: Architekturentscheidung (Priorität 3)
Voraussetzung: Screens brauchen echte Fenster-3-Drill-Downs.

**Option A:** Quest-Detail, Kontakt-Detail, Modul-Detail nach Fenster 3 auslagern → dann `pushBreadcrumb` sinnvoll. Große Änderung.

**Option B:** Breadcrumbs nur für TechTree belassen (aktueller Stand). Kleinere UX-Inkonsequenz, aber ehrlicher.

### #E — Phase 3-N Nacharbeiten (Kontext-Update)
- FactionScreen "NOT IN A FACTION" Empty State: durch neues Recruiting-System (`is_recruiting`, Migration 051) teilweise überholt. Text sollte auf das neue System verweisen statt auf Quests.
- FactionDetailPanel + ShipDetailPanel (Phase 3-N): Breadcrumb-Integration wäre naheliegend (P2-J Erweiterung).
