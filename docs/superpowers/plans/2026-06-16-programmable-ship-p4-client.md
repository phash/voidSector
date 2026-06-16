# Programmable Ship — Plan 4: Client UI + Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Ship the player-facing side: a new `AUTOMAT` cockpit program (script editor + level-aware command palette + template picker in Sec 2; status/log panel in Sec 3), the Zustand program slice + network wiring, a `first_automat` HelpSlice + `[?]` button, a Kompendium article with the **real** DSL guide + the 5 example scripts, the `computer` module artwork, and `computer_mk1` pre-installed on the starter ship — so new players can write and run a script in the browser.

**Architecture:** New components `AutomatScreen` (Sec 2) + `AutomatDetailPanel` (Sec 3), registered in the existing render switches; a `programSlice` (Zustand) holding the player's scripts + live run state + log; `GameNetwork` send/receive methods matching the Plan 3 server contract; help/compendium content using the REAL DSL. Template scripts live once in shared (`PROGRAM_TEMPLATES`) so screen + compendium + tests agree.

**Tech Stack:** React + Zustand, Vitest + jsdom + RTL. **Client is verified with vitest/Vite, NOT tsc** (~111 pre-existing tsc errors). shared changes still use real tsc.

**Spec:** `docs/superpowers/specs/2026-06-15-programmable-ship-design.md` (§5, §6). Builds on Plans 1-3 (server runtime live). **User requirement:** the help page must publish the simple example scripts + a good Anleitung.

---

## Real DSL contract (use EXACTLY this — not any other syntax)
Commands: `fly X:Y` · `scan` · `mine` / `mine until full` / `mine <n>` · `sell all` / `sell <resource>` (ore/gas/crystal). Control: `if <cond>:` / `else:` / `repeat:` / `repeat N times:` (indent = 2 spaces). Conditions: `resources` · `full` · `empty` · `station` · `fuel < N` · `at X:Y` · `not <cond>`.

**Level ladder** (`getShipComputerLevel(modules)` → 0 none / 1-5):
- **MK.I (1):** sequence only (`fly`/`scan`/`mine`/`sell`).
- **MK.II (2):** + `if`/`else`, infinite `repeat`, conditions `resources`/`full`/`empty`.
- **MK.III (3):** + `repeat N times`, nesting, `not`, conditions `fuel < N`/`at`/`station`.
- **MK.IV (4):** + offline execution. **MK.V (5):** longest programs + offline window.

## Server message contract (Plan 3 — match exactly)
Client → server: `saveProgram {name, source, mode}` · `listPrograms {}` · `deleteProgram {id}` · `setActiveProgram {id}` · `startProgram {id}` · `stopProgram {}`.
Server → client: `programSaved {id,...}` · `programList [rows]` · `programState {status, pc, log?}` · `programError {errors:[{line,message}]}` · `programLog {level,message}`.

## File Structure
| File | Action |
|---|---|
| `packages/shared/src/constants.ts` | add `MONITORS.AUTOMAT` + to `COCKPIT_PROGRAMS`/labels |
| `packages/shared/src/automation/templates.ts` (create) | `PROGRAM_TEMPLATES` (5 real scripts) |
| `packages/shared/src/index.ts` | export templates |
| `packages/client/src/state/programSlice.ts` (create) | scripts + run state + log |
| `packages/client/src/state/store.ts` | compose programSlice |
| `packages/client/src/network/client.ts` | 6 sends + 5 receive handlers |
| `packages/client/src/components/AutomatScreen.tsx` (create) | Sec 2: editor + palette + templates |
| `packages/client/src/components/AutomatDetailPanel.tsx` (create) | Sec 3: status + log |
| `packages/client/src/components/GameScreen.tsx` | render AutomatScreen |
| `packages/client/src/components/CockpitLayout.tsx` | render AutomatDetailPanel |
| `packages/client/src/state/helpSlice.ts` | `first_automat` tip |
| `packages/client/src/data/compendium.ts` | `schiffsprogrammierung` article |
| `packages/client/src/components/ModuleArtwork.tsx` | `computer` DrawFn |
| `packages/server/src/db/queries.ts` | starter ship `computer_mk1` |

**Test cmds:** shared `cd packages/shared && npx vitest run` + `npm run build`; client `cd packages/client && npx vitest run` (NOT tsc); server `cd packages/server && npx vitest run`.

---

### Task 1: Register AUTOMAT program + shared templates

**Files:** modify `packages/shared/src/constants.ts`, `packages/shared/src/index.ts`; create `packages/shared/src/automation/templates.ts`; test `packages/shared/src/automation/__tests__/templates.test.ts`.

- [ ] **Step 1: failing test** — `templates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { PROGRAM_TEMPLATES } from '../templates.js';
import { compileProgram, AUTOMATION_PROGRAM_LIMITS } from '../../index.js';

describe('PROGRAM_TEMPLATES', () => {
  it('has 5 templates, each compiling at its declared minLevel', () => {
    expect(PROGRAM_TEMPLATES).toHaveLength(5);
    for (const t of PROGRAM_TEMPLATES) {
      const res = compileProgram(t.source, { level: t.minLevel, maxLength: AUTOMATION_PROGRAM_LIMITS[t.minLevel] });
      expect(res.ok, `${t.name} should compile at MK.${t.minLevel}`).toBe(true);
    }
  });
  it('the MK.III loop template does NOT compile at MK.II (nesting gate)', () => {
    const loop = PROGRAM_TEMPLATES.find((t) => t.minLevel === 3)!;
    expect(compileProgram(loop.source, { level: 2, maxLength: 99 }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** — create `packages/shared/src/automation/templates.ts`:
```ts
export interface ProgramTemplate {
  name: string;
  minLevel: number;
  description: string;
  source: string;
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    name: 'Lieferlauf',
    minLevel: 1,
    description: 'Hinfliegen, volladen, heim, verkaufen — reine Sequenz (MK.I).',
    source: ['fly 5:5', 'scan', 'mine until full', 'fly 0:0', 'sell all'].join('\n'),
  },
  {
    name: 'Bedingter Abbau',
    minLevel: 2,
    description: 'Nur abbauen, wenn Rohstoffe da sind (MK.II).',
    source: ['fly 5:5', 'scan', 'if resources:', '  mine until full', 'else:', '  scan'].join('\n'),
  },
  {
    name: 'Autonomer Loop',
    minLevel: 3,
    description: 'Dauerschleife: suchen, abbauen, bei voll heim & verkaufen (MK.III).',
    source: [
      'repeat:',
      '  fly 3:5',
      '  scan',
      '  if resources:',
      '    mine until full',
      '  else:',
      '    fly 7:9',
      '    scan',
      '    mine until full',
      '  if full:',
      '    fly 0:0',
      '    sell all',
    ].join('\n'),
  },
  {
    name: 'Treibstoff-Wache',
    minLevel: 3,
    description: 'Tankt bei niedrigem Treibstoff nach (MK.III).',
    source: [
      'repeat 5 times:',
      '  if fuel < 500:',
      '    fly 0:0',
      '  scan',
      '  if resources:',
      '    mine until full',
      '  if full:',
      '    fly 0:0',
      '    sell all',
    ].join('\n'),
  },
  {
    name: 'Verkaufsrunde',
    minLevel: 3,
    description: 'Füllt den Frachtraum und verkauft an Stationen (MK.III).',
    source: [
      'repeat:',
      '  if not full:',
      '    mine until full',
      '  if station:',
      '    sell all',
      '  else:',
      '    fly 0:0',
    ].join('\n'),
  },
];
```
Then in `packages/shared/src/index.ts` add: `export { PROGRAM_TEMPLATES } from './automation/templates.js';` and `export type { ProgramTemplate } from './automation/templates.js';`

In `packages/shared/src/constants.ts`: add `AUTOMAT: 'AUTOMAT'` to the `MONITORS` object (near the other monitor ids ~743-763); append `MONITORS.AUTOMAT` to `COCKPIT_PROGRAMS` (after `MONITORS.XENO`); add `AUTOMAT: 'AUTOMAT'` to `COCKPIT_PROGRAM_LABELS`.

- [ ] **Step 4: run templates test → PASS; full shared suite → PASS; `npm run build` → exit 0.**

- [ ] **Step 5: commit**
```bash
git add packages/shared/src/constants.ts packages/shared/src/index.ts packages/shared/src/automation/templates.ts packages/shared/src/automation/__tests__/templates.test.ts packages/shared/dist
git commit -m "feat: register AUTOMAT program + shared PROGRAM_TEMPLATES (5 real scripts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: programSlice (client store)

**Files:** create `packages/client/src/state/programSlice.ts`; modify `packages/client/src/state/store.ts`; test `packages/client/src/__tests__/programSlice.test.ts`.

IMPORTANT: do NOT reuse `activeProgram`/`setActiveProgram` (those belong to uiSlice for the cockpit tab selector). Use distinct names.

- [ ] **Step 1: failing test** — `programSlice.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../state/store';

describe('programSlice', () => {
  beforeEach(() => {
    useStore.setState({ shipPrograms: [], activeShipProgramId: null, shipProgramRun: null, shipProgramLog: [] });
  });
  it('stores the program list and active id', () => {
    useStore.getState().setShipPrograms([{ id: 'p1', name: 'Loop', source: 'scan', mode: 'loop', is_active: true }] as any);
    expect(useStore.getState().shipPrograms).toHaveLength(1);
    useStore.getState().setActiveShipProgramId('p1');
    expect(useStore.getState().activeShipProgramId).toBe('p1');
  });
  it('tracks run state and appends capped log', () => {
    useStore.getState().setShipProgramRun({ status: 'running', pc: 0 });
    expect(useStore.getState().shipProgramRun?.status).toBe('running');
    for (let i = 0; i < 250; i++) useStore.getState().appendShipProgramLog('x');
    expect(useStore.getState().shipProgramLog.length).toBeLessThanOrEqual(200);
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** — `programSlice.ts`:
```ts
import type { StateCreator } from 'zustand';

export interface ShipProgramItem { id: string; name: string; source: string; mode: string; is_active: boolean; }
export interface ShipProgramRun { status: string; pc: number; }

export interface ProgramSlice {
  shipPrograms: ShipProgramItem[];
  activeShipProgramId: string | null;
  shipProgramRun: ShipProgramRun | null;
  shipProgramLog: string[];
  setShipPrograms: (p: ShipProgramItem[]) => void;
  setActiveShipProgramId: (id: string | null) => void;
  setShipProgramRun: (r: ShipProgramRun | null) => void;
  appendShipProgramLog: (line: string) => void;
}

export const createProgramSlice: StateCreator<ProgramSlice> = (set) => ({
  shipPrograms: [],
  activeShipProgramId: null,
  shipProgramRun: null,
  shipProgramLog: [],
  setShipPrograms: (shipPrograms) => set({ shipPrograms, activeShipProgramId: shipPrograms.find((p) => p.is_active)?.id ?? null }),
  setActiveShipProgramId: (activeShipProgramId) => set({ activeShipProgramId }),
  setShipProgramRun: (shipProgramRun) => set({ shipProgramRun }),
  appendShipProgramLog: (line) => set((s) => ({ shipProgramLog: [...s.shipProgramLog, line].slice(-200) })),
});
```
In `store.ts`: import `createProgramSlice, type ProgramSlice`; add `& ProgramSlice` to `StoreState`; spread `...createProgramSlice(...a)`.

- [ ] **Step 4: run → PASS (`cd packages/client && npx vitest run src/__tests__/programSlice.test.ts`).**

- [ ] **Step 5: commit**
```bash
git add packages/client/src/state/programSlice.ts packages/client/src/state/store.ts packages/client/src/__tests__/programSlice.test.ts
git commit -m "feat: client programSlice (scripts, run state, log)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Network wiring (sends + receives)

**Files:** modify `packages/client/src/network/client.ts`. Test: covered indirectly (network is hard to unit-test); add a tiny test asserting the send methods exist + call `room.send` with the right type via a mocked room if feasible, else SKIP and rely on the browser test.

- [ ] **Step 1: implement sends** — add to the `GameNetwork` class (match the existing `sendMine` guard style; the room handle field name — confirm it's `this.sectorRoom`):
```ts
sendSaveProgram(name: string, source: string, mode: string) { this.sectorRoom?.send('saveProgram', { name, source, mode }); }
sendListPrograms() { this.sectorRoom?.send('listPrograms', {}); }
sendDeleteProgram(id: string) { this.sectorRoom?.send('deleteProgram', { id }); }
sendSetActiveProgram(id: string) { this.sectorRoom?.send('setActiveProgram', { id }); }
sendStartProgram(id: string) { this.sectorRoom?.send('startProgram', { id }); }
sendStopProgram() { this.sectorRoom?.send('stopProgram', {}); }
```

- [ ] **Step 2: implement receives** — in `setupRoomListeners()` (where the other `room.onMessage(...)` are), add:
```ts
room.onMessage('programList', (rows: any[]) => { useStore.getState().setShipPrograms(rows ?? []); });
room.onMessage('programSaved', (_row: any) => { network.sendListPrograms(); useStore.getState().showTip?.('first_automat'); });
room.onMessage('programState', (data: { status: string; pc: number; log?: { level: string; message: string } }) => {
  useStore.getState().setShipProgramRun({ status: data.status, pc: data.pc });
  if (data.log) useStore.getState().appendShipProgramLog(data.log.message);
});
room.onMessage('programLog', (data: { level: string; message: string }) => { useStore.getState().appendShipProgramLog(data.message); });
room.onMessage('programError', (data: { errors?: Array<{ line: number; message: string }>; message?: string }) => {
  const msg = data.errors?.map((e) => `Zeile ${e.line}: ${e.message}`).join('\n') ?? data.message ?? 'Programmfehler';
  useStore.getState().setActionError?.({ code: 'PROGRAM', message: msg });
  useStore.getState().appendShipProgramLog(`FEHLER: ${msg}`);
});
```
> Confirm the exact field name of the room handle and the existing `setActionError`/`showTip` signatures; adapt. The server `programList` payload shape — confirm whether it sends the array directly or `{programs}` (Plan 3 `client.send('programList', rows)` sends the array; adapt if wrapped).

- [ ] **Step 3: verify** — `cd packages/client && npx vitest run` (full client suite) → no regressions (no new test required if a network unit test isn't feasible; the browser test in the final step validates end-to-end). If you add a small send test, keep it green.

- [ ] **Step 4: commit**
```bash
git add packages/client/src/network/client.ts
git commit -m "feat: client network wiring for ship programs (6 sends + 5 receives)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: AutomatScreen (Sec 2) — editor + palette + templates

**Files:** create `packages/client/src/components/AutomatScreen.tsx`; test `packages/client/src/__tests__/AutomatScreen.test.tsx`.

Behavior: textarea editor bound to local state; a name field; buttons NEU / SPEICHERN / START / STOP; a saved-program list (click to load; delete); a template picker (from `PROGRAM_TEMPLATES`, filtered/annotated by the player's computer level via `getShipComputerLevel(ship.modules)`); a level-aware command palette (insert at cursor; locked commands greyed with "ab MK.x"); a `[?]` button → `showTip('first_automat')`; an empty-state when computer level is 0 ("Kein Bordcomputer — baue MK.I in der FABRIK"). Save calls `network.sendSaveProgram(name, source, mode)`; START calls `sendSetActiveProgram(id)` then `sendStartProgram(id)` (save first if unsaved); STOP calls `sendStopProgram()`.

- [ ] **Step 1: failing test** — `AutomatScreen.test.tsx` (mock `../network/client` with the 6 sends; use the project's store-mock helper — confirm its path, e.g. `../test/mockStore`):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutomatScreen } from '../components/AutomatScreen';

vi.mock('../network/client', () => ({ network: {
  sendSaveProgram: vi.fn(), sendListPrograms: vi.fn(), sendDeleteProgram: vi.fn(),
  sendSetActiveProgram: vi.fn(), sendStartProgram: vi.fn(), sendStopProgram: vi.fn(),
} }));

import { useStore } from '../state/store';

describe('AutomatScreen', () => {
  beforeEach(() => {
    useStore.setState({ shipPrograms: [], activeShipProgramId: null, shipProgramRun: null, shipProgramLog: [], ship: { modules: [] } as any });
  });
  it('shows the empty-state when no computer is installed', () => {
    render(<AutomatScreen />);
    expect(screen.getByText(/Kein Bordcomputer/i)).toBeDefined();
  });
  it('shows the editor + templates when a computer is installed', () => {
    useStore.setState({ ship: { modules: [{ moduleId: 'computer_mk3', slotIndex: 9, source: 'standard' }] } as any });
    render(<AutomatScreen />);
    expect(screen.getByText(/Lieferlauf/)).toBeDefined(); // a template name
    expect(screen.getByText('[?]')).toBeDefined();
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** `AutomatScreen.tsx` using `getShipComputerLevel` from `@void-sector/shared`, `PROGRAM_TEMPLATES`, the `network` singleton, and store selectors (`shipPrograms`, `shipProgramRun`). Match the CRT styling (`vs-btn` etc.) used by sibling screens (read e.g. `MiningScreen.tsx`/`CargoScreen.tsx` for class names + layout). Keep it one focused component (~150-220 lines). Define the level-aware palette as a small local list keyed by minLevel using the real DSL commands.

- [ ] **Step 4: run AutomatScreen test → PASS; full client suite → no regressions.**

- [ ] **Step 5: commit**
```bash
git add packages/client/src/components/AutomatScreen.tsx packages/client/src/__tests__/AutomatScreen.test.tsx
git commit -m "feat: AutomatScreen — script editor, level-aware palette, templates

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: AutomatDetailPanel (Sec 3) + render registration

**Files:** create `packages/client/src/components/AutomatDetailPanel.tsx`; modify `GameScreen.tsx` (`renderScreen`) + `CockpitLayout.tsx` (`getDetailForProgram`); test `AutomatDetailPanel.test.tsx`.

Behavior: shows the computer MK badge + which features are unlocked; the run status (LÄUFT/PAUSIERT/INAKTIV/DRIFT) with the paused reason; a live execution log (from `shipProgramLog`, newest at bottom, scrollable, monospace). Auto-show `first_automat` on first open (mirror the CockpitLayout `showTip` useEffect pattern).

- [ ] **Step 1: failing test** — render with `shipProgramRun: { status: 'running', pc: 2 }` + a couple log lines + a `computer_mk2` module → assert it shows the status text and a log line and "MK.II".

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** `AutomatDetailPanel.tsx`; add `case MONITORS.AUTOMAT: return <AutomatScreen />;` in `GameScreen.tsx renderScreen()` (import AutomatScreen) and `case 'AUTOMAT': return <AutomatDetailPanel />;` in `CockpitLayout.tsx getDetailForProgram()` (import AutomatDetailPanel).

- [ ] **Step 4: run test → PASS; full client suite → no regressions.**

- [ ] **Step 5: commit**
```bash
git add packages/client/src/components/AutomatDetailPanel.tsx packages/client/src/components/GameScreen.tsx packages/client/src/components/CockpitLayout.tsx packages/client/src/__tests__/AutomatDetailPanel.test.tsx
git commit -m "feat: AutomatDetailPanel (status+log) + render registration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Onboarding — HelpSlice + Kompendium article (REAL DSL + 5 scripts)

**Files:** modify `packages/client/src/state/helpSlice.ts`, `packages/client/src/data/compendium.ts`; test `packages/client/src/__tests__/compendiumAutomat.test.ts`.

- [ ] **Step 1: failing test** — `compendiumAutomat.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getArticle } from '../data/compendium';
import { HELP_TIPS } from '../state/helpSlice';
import { PROGRAM_TEMPLATES } from '@void-sector/shared';

describe('AUTOMAT onboarding content', () => {
  it('has a first_automat help tip linking the compendium article', () => {
    const tip = HELP_TIPS.find((t) => t.id === 'first_automat')!;
    expect(tip).toBeTruthy();
    expect(tip.articleId).toBe('schiffsprogrammierung');
  });
  it('publishes a compendium article that contains the real DSL keywords and every template script', () => {
    const a = getArticle('schiffsprogrammierung')!;
    expect(a).toBeTruthy();
    for (const kw of ['fly ', 'mine until full', 'sell all', 'if ', 'repeat']) expect(a.body).toContain(kw);
    // the 5 example scripts are present (check a distinctive line from each)
    for (const t of PROGRAM_TEMPLATES) {
      const firstLine = t.source.split('\n')[0];
      expect(a.body, `article should include template "${t.name}"`).toContain(firstLine);
    }
  });
});
```

- [ ] **Step 2: run → FAIL.**

- [ ] **Step 3: implement** —
Add `first_automat` to `HELP_TIPS` (helpSlice.ts), German, ≤6 lines, with `articleId: 'schiffsprogrammierung'`:
```ts
{
  id: 'first_automat',
  title: '◈ AUTOMAT — SCHIFF PROGRAMMIEREN',
  body:
    'Lass dein Schiff Abläufe selbst erledigen.\n' +
    '→ Skript im Editor schreiben (z.B. fly 3:5; scan; mine until full)\n' +
    '→ Palette zeigt, was dein Bordcomputer kann (Level MK.I–V)\n' +
    '→ Vorlage laden oder eigenes Skript [SPEICHERN]\n' +
    '→ [START] führt es aus; das Log zeigt jeden Schritt\n' +
    '→ Ab MK.IV läuft es auch offline weiter',
  articleId: 'schiffsprogrammierung',
},
```
Add the `schiffsprogrammierung` article to `COMPENDIUM_ARTICLES` (compendium.ts), category `'technik'`, with a body that (a) explains the language, (b) lists the real commands + conditions + the MK ladder, and (c) includes ALL 5 template scripts verbatim. Build the script section programmatically from the shared templates so it can't drift — at top of compendium.ts import `PROGRAM_TEMPLATES` and interpolate:
```ts
import { PROGRAM_TEMPLATES } from '@void-sector/shared';
const TEMPLATE_DOCS = PROGRAM_TEMPLATES.map(
  (t) => `**${t.name}** (ab MK.${t.minLevel}) — ${t.description}\n\n\`\`\`\n${t.source}\n\`\`\``,
).join('\n\n');
```
Then in the article body string, include a fixed "Befehle/Bedingungen/Stufen" reference (real DSL) followed by `\n\n## Beispiel-Skripte\n\n${TEMPLATE_DOCS}`. Ensure the reference text contains the literal substrings the test checks (`fly `, `mine until full`, `sell all`, `if `, `repeat`).

- [ ] **Step 4: run test → PASS; full client suite → no regressions.**

- [ ] **Step 5: commit**
```bash
git add packages/client/src/state/helpSlice.ts packages/client/src/data/compendium.ts packages/client/src/__tests__/compendiumAutomat.test.ts
git commit -m "feat: AUTOMAT onboarding — first_automat tip + Kompendium guide with 5 example scripts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: computer module artwork + starter-ship computer_mk1

**Files:** modify `packages/client/src/components/ModuleArtwork.tsx`, `packages/server/src/db/queries.ts`; test `packages/server/src/__tests__/starterShipComputer.test.ts`.

- [ ] **Step 1: ModuleArtwork** — add a `computer` entry to the `DRAW_ROUTINES` record (fixes the tsc-incomplete Record from Plan 2; client is vite-verified so this was non-blocking, but complete it now):
```ts
  computer: (ctx, s) => {
    ctx.strokeRect(10 * s, 12 * s, 28 * s, 22 * s); // monitor
    ctx.strokeRect(13 * s, 15 * s, 22 * s, 16 * s); // screen
    for (let i = 0; i < 3; i++) ctx.fillRect(15 * s, (18 + i * 4) * s, 18 * s, 1 * s); // scan lines
    ctx.fillRect(22 * s, 36 * s, 4 * s, 2 * s); // stand
  },
```

- [ ] **Step 2: starter ship test** — `packages/server/src/__tests__/starterShipComputer.test.ts` (static check that the starter loadout includes computer_mk1; the initialModules array is in `queries.ts` `createPlayer`/starter setup — confirm the exact location):
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
describe('starter ship', () => {
  it('pre-installs computer_mk1 so new players can use AUTOMAT', () => {
    const src = readFileSync(join(__dirname, '../db/queries.ts'), 'utf-8');
    expect(src).toMatch(/computer_mk1[\s\S]*slotIndex:\s*9/);
  });
});
```
> If the starter modules live in a different file/shape, point the test there and assert accordingly.

- [ ] **Step 3: run → FAIL.**

- [ ] **Step 4: implement** — in `packages/server/src/db/queries.ts`, add to the starter `initialModules` array:
```ts
  { moduleId: 'computer_mk1', slotIndex: 9, source: 'standard', powerLevel: 'high', currentHp: 15 },
```
(slot 9 = first AUSBAU extra slot; the starter loadout is seeded directly so it bypasses ACEP-unlock validation. Confirm no other starter module already uses slotIndex 9.)

- [ ] **Step 5: run** — server test → PASS; `cd packages/server && npm run build` → exit 0; `cd packages/client && npx vitest run` → no regressions.

- [ ] **Step 6: commit**
```bash
git add packages/client/src/components/ModuleArtwork.tsx packages/server/src/db/queries.ts packages/server/src/__tests__/starterShipComputer.test.ts
git commit -m "feat: computer module artwork + computer_mk1 on starter ship

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (§5 UI, §6 onboarding + user's help-content ask):**
- AUTOMAT tab registered + rendered Sec2/Sec3 → T1, T5. ✅
- Editor + level-aware palette + template picker → T4. ✅
- Program slice + network wiring (real server contract) → T2, T3. ✅
- `first_automat` HelpSlice + `[?]` → T4, T6. ✅
- Kompendium article with real DSL guide + 5 example scripts (USER REQUIREMENT) → T6 (scripts sourced from shared `PROGRAM_TEMPLATES`, can't drift). ✅
- computer artwork + starter `computer_mk1` (early-game access) → T7. ✅

**Correctness guards:** real DSL only (no invented syntax); templates compile at their declared level (T1 test); `programSlice` names don't collide with uiSlice's `activeProgram`; network signatures match Plan 3 exactly.

**Placeholder notes:** T3/T4/T5 require confirming exact client field names (`this.sectorRoom`, `setActionError`/`showTip` signatures, store-mock helper path, sibling-screen CSS classes) and adapting — necessary verification, not vague TODO.

**Verification:** client via vitest/Vite (NOT tsc); shared + server via tsc. End-to-end validated by running the app in the browser (next step after this plan), then deploy to prod + test.
