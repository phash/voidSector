# Phase 1 UX — Design Spec
*2026-03-10 · Brainstorming-Session mit 2D-Designer-Agent*

---

## Überblick

Phase 1 umfasst 5 Quick-Win-Items die unabhängig voneinander implementiert werden können. Alle bauen auf einer gemeinsamen Grundlage auf: dem zentralen `ui-strings.ts` System (P1-A), das von allen anderen Items genutzt wird.

**Implementierungs-Reihenfolge:** P1-A zuerst (Grundlage), dann P1-B/C/D/E parallel.

---

## P1-A — Zentrales UI-String-System (English Migration)

### Entscheidungen
- **Sprache:** Vollständig Englisch — alle UI-Strings
- **Scope:** UI only — Buttons, Labels, Tabs, leere Zustände, Status-Meldungen. Ausgenommen: Story-Text, Lore, NPC-Dialoge, Compendium-Artikel, Alien-Encounter-Narrativ
- **Architektur:** Zentrales Constants-File + Bracket-Helpers (kein i18n-Framework)
- **KONTOR** → `TRADING POST`

### Neues File: `packages/client/src/ui-strings.ts`

```ts
/** Wraps a string in CRT bracket notation: ACCEPT → [ACCEPT] */
export function btn(label: string): string {
  return `[${label}]`;
}

/** Wraps a disabled button label with the reason: JUMP → [JUMP — NO AP] */
export function btnDisabled(label: string, reason: string): string {
  return `[${label} — ${reason}]`;
}

/** Central UI string constants. No brackets — use btn()/btnDisabled() for actions. */
export const UI = {

  // ─── ACTIONS (use with btn() / btnDisabled()) ──────────────────────
  actions: {
    ACCEPT: 'ACCEPT',
    CANCEL: 'CANCEL',
    UNDOCK: 'UNDOCK',
    RENAME: 'RENAME',
    INSTALL: 'INSTALL',
    CRAFT: 'CRAFT',
    ACTIVATE: 'ACTIVATE',
    JETTISON: 'JETTISON',
    NAVIGATE: 'NAVIGATE',
    INVESTIGATE: 'INVESTIGATE',
    CREATE: 'CREATE',
    SELL: 'SELL',
    CLOSE: 'CLOSE',
    CLAIM: 'CLAIM',
    ABANDON: 'ABANDON',
    DISBAND: 'DISBAND',
    JUMP: 'JUMP',
    SCAN: 'SCAN',
    MINE: 'MINE',
    STOP: 'STOP',
    OK: 'OK',
  },

  // ─── TABS & SECTION HEADERS ────────────────────────────────────────
  tabs: {
    RESOURCES: 'RESOURCES',
    MODULES: 'MODULES',
    BLUEPRINTS: 'BLUEPRINTS',
    ACTIVE: 'ACTIVE',
    AVAILABLE: 'AVAILABLE',
    REPUTATION: 'REPUTATION',
    STORY: 'STORY',
    MARKET: 'MARKET',
    ROUTES: 'ROUTES',
    MEMBERS: 'MEMBERS',
    JOURNAL: 'JOURNAL',
    SETTINGS: 'SETTINGS',
    HANGAR: 'HANGAR',
    RESCUE: 'RESCUE',
    COMMUNITY: 'COMMUNITY',
  },

  // ─── STATUS & LABELS ───────────────────────────────────────────────
  status: {
    LOADING: 'LOADING...',
    ACTIVE: 'ACTIVE',
    IDLE: 'IDLE',
    COMPLETED: 'COMPLETED',
    AUTOPILOT_ACTIVE: 'AUTOPILOT ACTIVE',
    MINING_LOCKED: '⚠ MINING ACTIVE — NAV LOCKED',
    EMERGENCY_WARP: 'EMERGENCY WARP AVAILABLE',
    TRACKED: 'TRACKED',
    TARGET: 'TARGET',
    PROGRESS: 'PROGRESS',
    DEADLINE: 'DEADLINE',
    REWARD: 'REWARD',
    YIELD: 'YIELD',
    AMOUNT: 'AMOUNT',
    DIRECTION: 'DIRECTION',
    DISTANCE: 'DISTANCE',
    MEMBERS: 'MEMBERS',
    UPGRADE_TREE: 'UPGRADE TREE',
  },

  // ─── EMPTY STATES ─────────────────────────────────────────────────
  empty: {
    NO_QUESTS_FILTERED: 'NO QUESTS (FILTER ACTIVE)',
    NO_MODULES: 'NO MODULES IN INVENTORY',
    NO_BLUEPRINTS: 'NO BLUEPRINTS IN INVENTORY',
    NO_SHIP: 'NO SHIP',
    NO_TRADE: 'NO TRADING AVAILABLE',
    NO_COMMUNITY_QUEST: 'NO ACTIVE COMMUNITY QUEST',
    NO_CONTACTS: 'NO CONTACTS',
    NO_MESSAGES: 'NO MESSAGES ON THIS CHANNEL',
    NO_RESOURCES: 'NO RESOURCES IN THIS SECTOR',
    NO_ACTIVE_EVENTS: 'NO ACTIVE EVENTS',
  },

  // ─── PROGRAMS (ProgramSelector labels) ────────────────────────────
  programs: {
    NAV_COM: 'NAV-COM',
    MINING: 'MINING',
    CARGO: 'CARGO',
    QUESTS: 'QUESTS',
    FACTION: 'FACTION',
    COMMS: 'COMMS',
    TECH: 'TECH',
    BASE: 'BASE-LINK',
    QUAD_MAP: 'QUAD-MAP',
    TV: 'TV',
  },

  // ─── DISABLED REASONS (use with btnDisabled()) ────────────────────
  reasons: {
    NO_AP: 'NO AP',
    CARGO_FULL: 'CARGO FULL',
    NOT_AT_STATION: 'NOT AT STATION',
    MINING_ACTIVE: 'MINING ACTIVE',
    INSUFFICIENT_CREDITS: 'NO CREDITS',
    OUT_OF_RANGE: 'OUT OF RANGE',
    AP_COST: (n: number) => `COSTS ${n} AP`,
  },

} as const;
```

### Dynamische Strings
Interpolierte Strings (mit variablen Werten) bleiben inline im Component — kein Over-Engineering:
```ts
`DISTANCE: ~${n} SECTORS`   // bleibt im Component
`TRACKED: ${n}/${max}`       // bleibt im Component
btn(`JETTISON ${res}`)       // btn() mit Interpolation
btnDisabled('SCAN', UI.reasons.AP_COST(cost))  // reason mit Wert
```

### Verifikations-Script
`package.json` → neuer Script `"check:strings"`:
```bash
grep -rn --include="*.tsx" \
  -E "(Annehmen|Abdocken|Ressourcen|Aufträge|Fraktion|Bergbau|Fracht|Umbenennen|Abwerfen|Keine |Lade )" \
  packages/client/src/components/
# → 0 Matches = Migration vollständig ✓
```

### Bekannte Translations (Auszug, ~150–200 Strings total)
Wichtigste Komponenten mit Aufwand:
- `QuestsScreen.tsx` — ~35 Strings (größte Datei)
- `CargoScreen.tsx` — ~18 Strings
- `TradeScreen.tsx` — ~12 Strings
- `NavControls.tsx` — ~9 Strings
- `TechTreePanel.tsx` — ~15 Strings
- Alle weiteren Komponenten — je 3–6 Strings

---

## P1-B — Button-Label Standard

### Entscheidungen
- `HangarPanel` → **vollständig entfernen** (Konzept veraltet, ACEP ersetzt es)
- Bezel Mode-Toggle: `1` → `[DET]`, `2` → `[TV]`
- TerritoryPanel: `⬡ CLAIM` → `[CLAIM]`, `LIST` → `[LIST]`
- Alle via `btn()` aus P1-A

### Änderungen
| Datei | Vorher | Nachher |
|-------|--------|---------|
| `CockpitLayout.tsx` | Mode-Toggle `1` / `2` | `{btn('DET')}` / `{btn('TV')}` |
| `GameScreen.tsx` (Territory) | `⬡ CLAIM`, `LIST` | `{btn(UI.actions.CLAIM)}`, `{btn('LIST')}` |
| `HangarPanel.tsx` | — | Datei + alle Referenzen entfernen |

### Abhängigkeiten
- P1-A muss zuerst implementiert sein (`btn`, `UI.actions`)

---

## P1-C — Generisches Confirm-System (`useConfirm`)

### Entscheidungen
- **Pattern:** Two-Click Inline (kein Modal, kein Server-Undo)
- **Scope:** Alle destruktiven, irreversiblen Aktionen
- **Timeout:** 3000ms Auto-Reset
- **Generisch:** Ein Hook für alle Stellen

### Neues File: `packages/client/src/hooks/useConfirm.ts`

```ts
import { useState, useRef } from 'react';

export function useConfirm(timeout = 3000) {
  const [pending, setPending] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const confirm = (key: string, onConfirm: () => void) => {
    if (pending === key) {
      clearTimeout(timerRef.current!);
      setPending(null);
      onConfirm();
    } else {
      setPending(key);
      timerRef.current = setTimeout(() => setPending(null), timeout);
    }
  };

  const isArmed = (key: string) => pending === key;

  return { confirm, isArmed };
}
```

### Visuelles Verhalten
```
Normal:  [JETTISON ORE]              ← amber border, normale Farbe
Armed:   [JETTISON ORE — SURE?]     ← roter Border, rote Farbe, 3s Timer
```

### Verwendung (Beispiel CargoScreen)
```tsx
const { confirm, isArmed } = useConfirm();

<button
  onClick={() => confirm('jettison-ore', () => jettison('ore'))}
  style={{ borderColor: isArmed('jettison-ore') ? '#ff4444' : undefined,
           color: isArmed('jettison-ore') ? '#ff4444' : undefined }}
>
  {isArmed('jettison-ore')
    ? btnDisabled(btn('JETTISON ORE'), 'SURE?')  // [JETTISON ORE — SURE?]
    : btn('JETTISON ORE')}
</button>
```

### Alle betroffenen Aktionen
| Komponente | Aktion | Key |
|-----------|--------|-----|
| `CargoScreen` | Jettison ore/gas/crystal | `'jettison-ore'` etc. |
| `CargoScreen` | Jettison Artefact | `'jettison-artefact'` |
| `QuestsScreen` | Quest aufgeben | `'abandon-{questId}'` |
| `FactionScreen` | Fraktion auflösen | `'disband-faction'` |

### Nicht betroffen (reversibel)
`[UNDOCK]`, `[CANCEL AUTOPILOT]`, `[STOP MINING]`, `[KICK]` — keine Bestätigung nötig

---

## P1-D — StationTerminal Cleanup + NavCom-Vision

### Phase 1 (sofort)
- `StationTerminalOverlay.tsx`: `FORSCHUNG`-Menüpunkt entfernen
- `StationTerminalOverlay.tsx`: `HANGAR`-Menüpunkt entfernen
- Terminal verbleibend: **QUESTS** + **HANDEL** (temporär)

### Neue Architektur-Vision (Phase 2 — separates Ticket)

In der Brainstorming-Session hat sich ein fundamentaler UX-Paradigmenwechsel ergeben:

**NavCom-zentrische Interaktion:**
```
Fenster 2 (Radar)  → Sektor anklicken
Fenster 3 (Detail) → Objekte im Sektor (Station, Spieler, NPC, Gate...)
Objekt klicken     → Interaktion öffnet in Fenster 2
```

**Konsequenzen (Phase 2):**
- `StationTerminalOverlay` → komplett entfernen
- `TRADE`-Programm → aus ProgramSelector entfernen
- `ROUTEN`, `KONTOR` → entfernen
- Station-Quests erscheinen kontextuell in Fenster 3 wenn Spieler im Sektor mit Station ist
- Ein universelles Interaktionsmodell für Stationen, Spieler, NPCs, Jumpgates

**Ziel:** Kein Sonderfall für Stationen. Alles läuft über NavCom-Klick-Flow.

---

## P1-E — AP-Feedback + Disabled-Reason-System

### Entscheidungen
- Drei-Layer-Feedback bei AP = 0: StatusBar + AP-Balken + Button-Mutation
- Generisch: `btnDisabled()` + `UI.reasons` für alle Blockierungsgründe (nicht nur AP)
- Einmaliger HelpTip beim ersten AP-Erschöpfen (zusätzlich zu P2-F Onboarding)

### Layer A — StatusBar InlineError
Trigger: AP wird 0 ODER Spieler klickt disabled Button
```
⚡ NO AP — REGENERATING · FULL IN 47s
```
- Dauer: 3s, dann auto-dismiss
- Implementierung: bestehender `InlineError`-Mechanismus in Sektion 5
- AP-Regen-Countdown: aus `gameSlice` berechnen (`maxAp - ap`) / `apRegenRate`

### Layer B — AP-Balken Pulse
Trigger: AP = 0
- CSS-Animation: `ap-pulse` Keyframe, rote Farbe, 1.5s
- Auf dem AP-Balken in `StatusBar`

### Layer C — Button-Label-Mutation (Generisch)
Alle Buttons die auf `disabled` stehen zeigen ihren Grund:

| Button | Grund | Ergebnis |
|--------|-------|---------|
| `[JUMP]` | `ap < 1` | `[JUMP — NO AP]` |
| `[SCAN]` | `ap < cost` | `[SCAN — COSTS 3 AP]` |
| `[MINE ORE]` | `cargoFull` | `[MINE ORE — CARGO FULL]` |
| `[MINE ORE]` | `ap < 1` | `[MINE ORE — NO AP]` |
| `[HYPERJUMP]` | `outOfRange` | `[HYPERJUMP — OUT OF RANGE]` |
| `[NAVIGATE]` | `miningActive` | `[NAVIGATE — MINING ACTIVE]` |

Implementierung via `btnDisabled(label, reason)` aus P1-A — kein neues Konzept.

### Layer D — Einmaliger HelpTip
Trigger: AP erreicht erstmals 0 (localStorage-Flag `vs_ap_tip_seen`)
```
💡 AP powers all movement and actions — they regenerate automatically.
   Check the bar in the status panel.
```
- Einmalig, dismissible, verlinkt zum Compendium

---

## Abhängigkeits-Graph

```
P1-A (ui-strings.ts + btn + btnDisabled)
  ├── P1-B (btn für Mode-Toggle + TerritoryPanel)
  ├── P1-C (useConfirm — eigenständig, nutzt btnDisabled für [SURE?])
  ├── P1-D (Cleanup — eigenständig)
  └── P1-E (btnDisabled + UI.reasons — baut direkt auf P1-A auf)
```

**Implementierungs-Reihenfolge:**
1. `P1-A` — Grundlage, alle anderen warten darauf
2. `P1-C` — eigenständig, kann parallel zu P1-A starten (kein ui-strings Import nötig für den Hook selbst)
3. `P1-D` — eigenständig, 30min Arbeit
4. `P1-B + P1-E` — nach P1-A

---

## Was nicht in Phase 1 ist (aber entschieden wurde)

- **NavCom-Paradigma** (StationTerminal removal, TRADE removal) → Phase 2 neues Ticket
- **TRADE-Programm entfernen** → Phase 2
- **ROUTEN + KONTOR entfernen** → Phase 2 (zusammen mit TRADE)
- **HANGAR-Konzept** → komplett gestrichen (nicht Phase 2, einfach weg)
