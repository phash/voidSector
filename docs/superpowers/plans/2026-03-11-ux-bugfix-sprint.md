# UX Bugfix Sprint — P2-Rest + Phase-3-N Nacharbeiten

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all open issues from the P2-Rest and Phase-3-N UX audits — bugs, broken navigation, missing content, language inconsistency.

**Architecture:** Pure client-side fixes for 6 of 7 tasks. Task 6 adds two fields (`is_recruiting`, `slogan`) to the server's `factionData` message — requires a small server change, a type extension in `gameSlice.ts`, and ManagementTab initialization.

**Tech Stack:** React, Zustand, TypeScript, Vitest + RTL, Colyseus (server message for Task 6)

**Specs:** `docs/superpowers/audits/2026-03-11-phase3-n-ux-audit.md`, `docs/superpowers/audits/2026-03-11-p2-rest-audit.md`

---

## File Map

| File | Changes |
|------|---------|
| `packages/client/src/components/BookmarkBar.tsx:74` | Modify: `0.6rem` → `0.75rem` |
| `packages/client/src/components/HUD.tsx:32` | Modify: remove dead `hyperdrive` selector |
| `packages/client/src/components/ShipDetailPanel.tsx` | Modify: generation display, title-case modules, trait colors, correct slot count |
| `packages/client/src/components/FactionDetailPanel.tsx` | Modify: next-upgrade shows option names, member upgrades show effects, fix broken nav button, "NO OPEN RECRUITMENT" text |
| `packages/client/src/components/FactionScreen.tsx` | Modify: InfoTab content, language → English, MGMT tab leaders-only, `[LEAVE]` in Members tab |
| `packages/client/src/components/QuestsScreen.tsx` | Modify: VERFÜGBAR empty state when at station but no quests |
| `packages/server/src/rooms/services/FactionService.ts` | Modify: add `isRecruiting`, `slogan` to `sendFactionData` |
| `packages/client/src/state/gameSlice.ts` | Modify: add `isRecruiting?: boolean; slogan?: string | null` to faction state type |
| `packages/client/src/network/client.ts` | Modify: set `isRecruiting` + `slogan` from `factionData` message |
| `packages/client/src/__tests__/ShipDetailPanel.test.tsx` | Modify: update/add tests |
| `packages/client/src/__tests__/FactionDetailPanel.test.tsx` | Modify: update/add tests |
| `packages/client/src/__tests__/FactionScreen.test.tsx` | Modify: update string expectations for English |

---

## Chunk 1: Quick Wins + ShipDetailPanel + FactionDetailPanel

---

### Task 1: Trivial One-Liners (BookmarkBar + HUD)

**Files:**
- Modify: `packages/client/src/components/BookmarkBar.tsx:74`
- Modify: `packages/client/src/components/HUD.tsx:32`

No new tests needed — these are 1-line style/dead-code fixes.

- [ ] **Step 1: Fix BookmarkBar font-size**

In `BookmarkBar.tsx` line 74, change:
```tsx
fontSize: '0.6rem',
```
to:
```tsx
fontSize: '0.75rem',
```

- [ ] **Step 2: Remove dead hyperdrive selector in HUD**

In `HUD.tsx` line 32, delete:
```tsx
const hyperdrive = useStore((s) => s.hyperdriveState);
```

- [ ] **Step 3: Run tests to confirm nothing broken**

```bash
cd packages/client && npx vitest run --reporter=dot
```
Expected: all pass (same count as before).

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/BookmarkBar.tsx \
        packages/client/src/components/HUD.tsx
git commit -m "fix: BookmarkBar font-size 0.6→0.75rem; remove dead hyperdrive selector in HUD"
```

---

### Task 2: ShipDetailPanel Polish

**Files:**
- Modify: `packages/client/src/components/ShipDetailPanel.tsx`
- Modify: `packages/client/src/__tests__/ShipDetailPanel.test.tsx`

**Context:** `ClientShipData` (in `gameSlice.ts`) has:
- `hullType: HullType` — used to look up base slot count from `HULLS[hullType].slots`
- `acepEffects?.extraModuleSlots` — ACEP bonus slots
- `acepGeneration?: number` — generation number (1 by default, >1 after permadeath)
- `acepTraits?: string[]` — trait names: `'veteran' | 'reckless' | 'cautious' | 'ancient-touched' | 'scarred' | 'curious'`
- `modules: ShipModule[]` — installed modules, each has `moduleId: string`

`HULLS` is exported from `@void-sector/shared` and has `slots: number` per hull type.

- [ ] **Step 1: Write failing tests**

In `packages/client/src/__tests__/ShipDetailPanel.test.tsx`, add these test cases (alongside existing tests):

```tsx
it('shows generation when acepGeneration > 1', () => {
  mockStoreState({
    ship: { ...baseShip, acepGeneration: 3 },
    setMonitorMode: vi.fn(),
  } as any);
  render(<ShipDetailPanel />);
  expect(screen.getByText(/GEN 3/)).toBeDefined();
});

it('does not show generation for gen 1', () => {
  mockStoreState({
    ship: { ...baseShip, acepGeneration: 1 },
    setMonitorMode: vi.fn(),
  } as any);
  render(<ShipDetailPanel />);
  expect(screen.queryByText(/GEN/)).toBeNull();
});

it('shows correct slot count from hull definition', () => {
  // scout hull has 3 base slots; 0 extraModuleSlots → 3 total
  mockStoreState({
    ship: { ...baseShip, hullType: 'scout', modules: [], acepEffects: { extraModuleSlots: 0 } },
    setMonitorMode: vi.fn(),
  } as any);
  render(<ShipDetailPanel />);
  expect(screen.getByText(/0\/3 SLOTS/)).toBeDefined();
});

it('adds extraModuleSlots to hull base slots', () => {
  mockStoreState({
    ship: { ...baseShip, hullType: 'scout', modules: [], acepEffects: { extraModuleSlots: 2 } },
    setMonitorMode: vi.fn(),
  } as any);
  render(<ShipDetailPanel />);
  expect(screen.getByText(/0\/5 SLOTS/)).toBeDefined();
});

it('shows module names in Title Case', () => {
  // baseShip already has modules: [{ moduleId: 'mining_laser_mk1', slotIndex: 0 }, ...]
  // toTitleCase('mining_laser_mk1') → 'Mining Laser Mk1'
  mockStoreState({ ship: baseShip, monitorModes: {}, setMonitorMode: vi.fn() } as any);
  render(<ShipDetailPanel />);
  expect(screen.getByText(/Mining Laser Mk1/)).toBeDefined();
});

it('shows veteran trait in cyan', () => {
  mockStoreState({
    ship: { ...baseShip, acepTraits: ['veteran'] },
    monitorModes: {}, setMonitorMode: vi.fn(),
  } as any);
  const { container } = render(<ShipDetailPanel />);
  const traitEl = container.querySelector('[data-trait="veteran"]');
  expect(traitEl).not.toBeNull();
  expect((traitEl as HTMLElement).style.color).not.toBe('rgb(255, 68, 68)');
});
```

**Note:** `baseShip` already has `hullType: 'scout'` and `modules: [{moduleId: 'mining_laser_mk1', slotIndex: 0}, ...]` — no extra setup needed.

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd packages/client && npx vitest run src/__tests__/ShipDetailPanel.test.tsx --reporter=verbose
```
Expected: new tests FAIL (generation, slots, title-case, trait color).

- [ ] **Step 3: Implement changes in ShipDetailPanel.tsx**

Replace the entire file with the updated version:

```tsx
import { useStore } from '../state/store';
import { MONITORS, HULLS } from '@void-sector/shared';

const ACEP_DETAIL_PATHS = [
  { key: 'ausbau'   as const, label: 'CNST', color: '#ffaa00' },
  { key: 'intel'    as const, label: 'INTL', color: '#00ffcc' },
  { key: 'kampf'    as const, label: 'CMBT', color: '#ff4444' },
  { key: 'explorer' as const, label: 'EXPL', color: '#8888ff' },
];

const TRAIT_COLORS: Record<string, string> = {
  veteran:         '#00ffcc',  // positive — cyan
  'ancient-touched': '#cc88ff', // achievement — purple
  curious:         '#8888ff',  // explorer — soft purple
  cautious:        '#44cc88',  // defensive — green
  reckless:        '#ff8800',  // risky — orange
  scarred:         '#ff8800',  // risky — orange
};

function acepBar(xp: number, max = 50): string {
  const filled = Math.round((xp / max) * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function toTitleCase(moduleId: string): string {
  return moduleId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ShipDetailPanel() {
  const ship = useStore((s) => s.ship);
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  if (!ship) return null;

  const xp = ship.acepXp;
  const traits = ship.acepTraits ?? [];
  const installedModules = ship.modules ?? [];
  const baseSlots = HULLS[ship.hullType]?.slots ?? 3;
  const extraSlots = ship.acepEffects?.extraModuleSlots ?? 0;
  const maxSlots = baseSlots + extraSlots;
  const freeSlots = maxSlots - installedModules.length;
  const gen = ship.acepGeneration;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px', fontSize: '0.78rem' }}>
      {/* Header */}
      <div style={{ fontSize: '0.7rem', letterSpacing: '2px', color: '#888', marginBottom: '8px' }}>
        ⬡ {ship.name}{gen && gen > 1 ? ` · GEN ${gen}` : ''}
      </div>

      {/* ACEP Paths */}
      <div style={{ background: '#0a0a0a', border: '1px solid #222', padding: '6px 8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '1px', color: '#555', marginBottom: '6px' }}>
          ACEP PATHS
        </div>
        {ACEP_DETAIL_PATHS.map(({ key, label, color }) => {
          const val = xp ? xp[key] : 0;
          return (
            <div
              key={key}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '3px' }}
            >
              <span style={{ color, width: '32px' }}>{label}</span>
              <span style={{ color, letterSpacing: '-1px', flex: 1, margin: '0 6px' }}>{acepBar(val)}</span>
              <span style={{ color: '#555', width: '24px', textAlign: 'right' }}>{val}</span>
            </div>
          );
        })}
        {/* Traits */}
        <div style={{ borderTop: '1px solid #1a1a1a', marginTop: '5px', paddingTop: '5px', fontSize: '0.67rem' }}>
          {traits.length > 0 ? (
            traits.map((t, i) => (
              <span key={t}>
                {i > 0 && <span style={{ color: '#333' }}> · </span>}
                <span data-trait={t} style={{ color: TRAIT_COLORS[t] ?? '#aaa' }}>
                  ⬡ {t.toUpperCase()}
                </span>
              </span>
            ))
          ) : (
            <span style={{ color: '#444' }}>NO TRAITS ACTIVE YET</span>
          )}
        </div>
      </div>

      {/* Modules */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '0.6rem', letterSpacing: '1px', color: '#555', marginBottom: '4px' }}>
          MODULES · {installedModules.length}/{maxSlots} SLOTS
        </div>
        {installedModules.length > 0 ? (
          <div style={{ color: '#aaa', fontSize: '0.68rem', lineHeight: 1.4 }}>
            {installedModules.map((m) => toTitleCase(m.moduleId)).join(' · ')}
          </div>
        ) : (
          <div style={{ color: '#444', fontSize: '0.65rem' }}>No modules installed</div>
        )}
        <div style={{ color: '#444', fontSize: '0.65rem', marginTop: '2px' }}>
          {freeSlots} slot{freeSlots !== 1 ? 's' : ''} free
        </div>
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: '4px', marginTop: 'auto' }}>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.SHIP_SYS, 'acep')}
        >
          [ACEP →]
        </button>
        <button
          className="vs-btn"
          style={{ flex: 1, fontSize: '0.65rem' }}
          onClick={() => setMonitorMode(MONITORS.SHIP_SYS, 'modules')}
        >
          [MODULES →]
        </button>
      </div>
    </div>
  );
}
```

**Verify `HULLS` is exported from `@void-sector/shared`:**
```bash
grep -n "^export.*HULLS" packages/shared/src/constants.ts
```
Expected: `export const HULLS: Record<HullType, HullDefinition> = {`

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/ShipDetailPanel.test.tsx --reporter=verbose
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/ShipDetailPanel.tsx \
        packages/client/src/__tests__/ShipDetailPanel.test.tsx
git commit -m "feat: ShipDetailPanel — generation display, title-case modules, trait colors, correct slot count"
```

---

### Task 3: FactionDetailPanel Improvements

**Files:**
- Modify: `packages/client/src/components/FactionDetailPanel.tsx`
- Modify: `packages/client/src/__tests__/FactionDetailPanel.test.tsx`

**Context:**
- `FACTION_UPGRADE_TIERS[n]` has `optionA: { name, effect }`, `optionB: { name, effect }`, `cost: number`
- `factionUpgrades: FactionUpgrade[]` each has `tier: number`, `choice: 'A' | 'B'`
- `recruitingFactions: RecruitingFaction[]` — may be empty if no factions currently recruiting
- The `[→]` button currently calls `setMonitorMode(MONITORS.FACTION, 'info')` which opens FactionTabView — but the user has no faction so FactionScreen shows `NoFactionView` instead. Fix: call `setActiveProgram('FACTION')` to switch to FACTION program.

- [ ] **Step 1: Write failing tests**

Add to `packages/client/src/__tests__/FactionDetailPanel.test.tsx`:

```tsx
// In FactionMemberPanel describe block:
it('shows next upgrade with both option names', () => {
  // tier 1 not yet chosen
  mockStoreState({
    faction: baseFaction,
    factionMembers: [{ playerId: 'p1', playerName: 'P', rank: 'leader' as const, joinedAt: 0 }],
    factionUpgrades: [],
    playerId: 'p1',
    setMonitorMode: vi.fn(),
  } as any);
  render(<FactionDetailPanel />);
  // should show both option names for tier 1
  expect(screen.getByText(/MINING BOOST/)).toBeDefined();
  expect(screen.getByText(/CARGO EXPANSION/)).toBeDefined();
});

it('shows active upgrade effects, not just names', () => {
  mockStoreState({
    faction: baseFaction,
    factionMembers: [{ playerId: 'p1', playerName: 'P', rank: 'leader' as const, joinedAt: 0 }],
    factionUpgrades: [{ tier: 1, choice: 'A' as const }],
    playerId: 'p1',
    setMonitorMode: vi.fn(),
  } as any);
  render(<FactionDetailPanel />);
  // effect text from FACTION_UPGRADE_TIERS[1].optionA.effect
  expect(screen.getByText(/\+15% mining rate/)).toBeDefined();
});

// In FactionRecruitPanel describe block:
it('shows NO OPEN RECRUITMENT when recruitingFactions empty', () => {
  mockStoreState({
    faction: null, humanityReps: {}, recruitingFactions: [],
    setMonitorMode: vi.fn(), setActiveProgram: vi.fn(),
  } as any);
  render(<FactionDetailPanel />);
  expect(screen.getByText(/NO OPEN RECRUITMENT/)).toBeDefined();
});

it('recruit panel button calls setActiveProgram FACTION', async () => {
  const setActiveProgram = vi.fn();
  mockStoreState({
    faction: null,
    humanityReps: {},
    recruitingFactions: [{ factionId: 'f1', name: 'STAR CORP', color: null, slogan: 'We recruit', memberCount: 5 }],
    setMonitorMode: vi.fn(),
    setActiveProgram,
  } as any);
  render(<FactionDetailPanel />);
  await userEvent.click(screen.getByText(/\[STAR CORP →\]/));
  expect(setActiveProgram).toHaveBeenCalledWith('FACTION');
});
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd packages/client && npx vitest run src/__tests__/FactionDetailPanel.test.tsx --reporter=verbose
```
Expected: new tests FAIL.

- [ ] **Step 3: Update FactionDetailPanel.tsx**

Three changes:

**A) `FactionMemberPanel` — show upgrade effects and next-upgrade option names:**

```tsx
// Replace the activeUpgrades block:
const activeUpgrades = factionUpgrades.map((u) => {
  const tierDef = FACTION_UPGRADE_TIERS[u.tier];
  const opt = u.choice === 'A' ? tierDef.optionA : tierDef.optionB;
  return opt.effect;  // was: opt.name — now show effect ("+15% mining rate")
});

// Replace the nextTierDef block (around line 56):
{nextTierDef && nextTierNum && (
  <div style={{ marginBottom: '8px' }}>
    <div style={{ fontSize: '0.6rem', color: '#555', marginBottom: '2px' }}>NEXT UPGRADE</div>
    <div style={{ color: '#ffb000', fontSize: '0.68rem' }}>
      → TIER {nextTierNum}: {nextTierDef.optionA.name} vs {nextTierDef.optionB.name}
    </div>
    <div style={{ color: '#555', fontSize: '0.62rem' }}>
      Cost: {nextTierDef.cost} CR
    </div>
  </div>
)}
```

**B) `FactionRecruitPanel` — fix broken button + fix misleading text:**

`FactionRecruitPanel` starts around line 85. Add `setActiveProgram` alongside the existing `setMonitorMode` selector (line 88), and change the button's `onClick`:

```tsx
function FactionRecruitPanel() {
  const humanityReps = useStore((s) => s.humanityReps);
  const recruitingFactions = useStore((s) => s.recruitingFactions);
  const setMonitorMode = useStore((s) => s.setMonitorMode);  // keep — may still be used
  const setActiveProgram = useStore((s) => s.setActiveProgram);  // ADD THIS LINE
  const [cardIdx, setCardIdx] = useState(0);
  // ... rest of component unchanged until the button:

  // Button (was: onClick={() => setMonitorMode(MONITORS.FACTION, 'info')}):
  onClick={() => setActiveProgram('FACTION')}
```

Replace the "NO CONNECTION TO NETWORK..." string:
```tsx
// was: 'NO CONNECTION TO NETWORK...'
// new:
'NO OPEN RECRUITMENT'
```

**C) Update section label from German "AKTIVE UPGRADES" to English in `FactionMemberPanel`:**
```tsx
// was: 'AKTIVE UPGRADES'
// new: 'ACTIVE UPGRADES'
```

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/FactionDetailPanel.test.tsx --reporter=verbose
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/FactionDetailPanel.tsx \
        packages/client/src/__tests__/FactionDetailPanel.test.tsx
git commit -m "fix: FactionDetailPanel — upgrade effects, next-upgrade options, recruit button nav, NO OPEN RECRUITMENT text"
```

---

## Chunk 2: FactionScreen + QuestsScreen

---

### Task 4: FactionScreen — InfoTab content + language + MGMT visibility

**Files:**
- Modify: `packages/client/src/components/FactionScreen.tsx`
- Modify: `packages/client/src/__tests__/FactionScreen.test.tsx`

**Context:**
- `FactionTabView` currently shows 4 tabs to all members: `[INFO]`, `[MEMBERS]`, `[UPGRADES]`, `[MGMT]`
- Non-leaders see `[MGMT]` but only get `[LEAVE]` — misleading
- `InfoTab` shows only join mode + member count — barely useful
- All string content is German; tab labels are English — inconsistent
- `getPlayerFaction` query uses `SELECT f.*` so `factionRow` already contains `is_recruiting`, `slogan`, `created_at` — but only `name`, `tag`, `leader_id`, `join_mode`, `invite_code`, `member_count`, `created_at` are forwarded in `sendFactionData`. `invite_code` IS forwarded so leaders can see it.

**Language decision:** Use English throughout — the cockpit uses English everywhere else.

- [ ] **Step 1: Write failing tests**

Replace the `FactionScreen — in faction` describe block in `packages/client/src/__tests__/FactionScreen.test.tsx`:

```tsx
describe('FactionScreen — in faction', () => {
  beforeEach(() => { vi.clearAllMocks(); factionState('info'); });

  it('shows faction name in header on info tab', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/\[TST\] Test Faction/)).toBeDefined();
  });

  it('shows join mode and member count in info tab', () => {
    render(<FactionScreen />);
    expect(screen.getByText(/INVITE/)).toBeDefined();
    expect(screen.getByText(/3 Members/)).toBeDefined();
  });

  it('shows only INFO/MEMBERS/UPGRADES tabs for non-leader', () => {
    factionState('info', { playerId: 'p2' }); // p2 is member, not leader
    render(<FactionScreen />);
    expect(screen.getByText('[INFO]')).toBeDefined();
    expect(screen.getByText('[MEMBERS]')).toBeDefined();
    expect(screen.getByText('[UPGRADES]')).toBeDefined();
    expect(screen.queryByText('[MGMT]')).toBeNull();
  });

  it('shows MGMT tab for leader', () => {
    render(<FactionScreen />); // p1 is leader
    expect(screen.getByText('[MGMT]')).toBeDefined();
  });

  it('shows [LEAVE] button in members tab for non-leader', () => {
    factionState('members', { playerId: 'p2' });
    render(<FactionScreen />);
    expect(screen.getByText('[LEAVE]')).toBeDefined();
  });

  it('tab buttons call setMonitorMode', async () => {
    const setMonitorMode = vi.fn();
    factionState('info', { setMonitorMode });
    render(<FactionScreen />);
    await userEvent.click(screen.getByText('[MEMBERS]'));
    expect(setMonitorMode).toHaveBeenCalledWith('FACTION', 'members');
  });

  it('shows member list on members tab', () => {
    factionState('members');
    render(<FactionScreen />);
    expect(screen.getByText(/TestPlayer/)).toBeDefined();
    expect(screen.getByText(/Member1/)).toBeDefined();
  });

  it('shows upgrade tree on upgrades tab', () => {
    factionState('upgrades');
    render(<FactionScreen />);
    expect(screen.getByText(/UPGRADE TREE/)).toBeDefined();
  });

  it('shows management controls for leader on management tab', () => {
    factionState('management');
    render(<FactionScreen />);
    expect(screen.getByText(/\[INVITE\]/)).toBeDefined();
    expect(screen.getByText(/\[MODE\]/)).toBeDefined();
    expect(screen.getByText(/\[DISBAND\]/)).toBeDefined();
  });

  it('shows invite code in management tab for code mode', () => {
    factionState('management', {
      faction: { ...baseFaction, joinMode: 'code' as const, inviteCode: 'ABC123' },
    });
    render(<FactionScreen />);
    expect(screen.getByText(/ABC123/)).toBeDefined();
  });

  it('shows recruiting toggle in management tab for leader', () => {
    factionState('management');
    render(<FactionScreen />);
    expect(screen.getByText(/ACTIVE RECRUITING/)).toBeDefined();
  });
});
```

Also update the `no faction` describe block to use English strings:
```tsx
it('shows create/join when not in faction', () => {
  render(<FactionScreen />);
  expect(screen.getByText(/NOT IN A FACTION/)).toBeDefined();
  expect(screen.getByText('[FOUND]')).toBeDefined();
  expect(screen.getByText('[JOIN]')).toBeDefined();
});

// invites test:
expect(screen.getByText('[YES]')).toBeDefined();
expect(screen.getByText('[NO]')).toBeDefined();
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
cd packages/client && npx vitest run src/__tests__/FactionScreen.test.tsx --reporter=verbose
```
Expected: multiple failures (string mismatches, MGMT tab visibility).

- [ ] **Step 3: Update FactionScreen.tsx**

**A) FactionTabView — show MGMT tab only for leaders; show [LEAVE] in Members tab for non-leaders:**

```tsx
function FactionTabView() {
  const faction = useStore((s) => s.faction)!;
  const members = useStore((s) => s.factionMembers);
  const playerId = useStore((s) => s.playerId);
  const tab = (useStore((s) => s.monitorModes[MONITORS.FACTION]) ?? 'info') as FactionTab;
  const setMonitorMode = useStore((s) => s.setMonitorMode);

  const myRank = members.find((m) => m.playerId === playerId)?.rank ?? 'member';
  const isLeader = myRank === 'leader';
  const isOfficer = myRank === 'officer';

  const tabs: { id: FactionTab; label: string }[] = [
    { id: 'info', label: '[INFO]' },
    { id: 'members', label: '[MEMBERS]' },
    { id: 'upgrades', label: '[UPGRADES]' },
    ...(isLeader || isOfficer ? [{ id: 'management' as FactionTab, label: '[MGMT]' }] : []),
  ];
  // ... rest unchanged
}
```

**B) InfoTab — add useful content:**

```tsx
function InfoTab({ faction }: { faction: any }) {
  const members = useStore((s) => s.factionMembers);
  const playerId = useStore((s) => s.playerId);
  const myRank = members.find((m) => m.playerId === playerId)?.rank ?? 'member';

  return (
    <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ opacity: 0.7 }}>
        Mode: {faction.joinMode.toUpperCase()} · {faction.memberCount} Members
      </div>
      <div style={{ opacity: 0.5, fontSize: '0.75rem' }}>
        Rank: {myRank.toUpperCase()}
      </div>
      {faction.joinMode === 'code' && faction.inviteCode && myRank !== 'member' && (
        <div style={{ opacity: 0.6, fontSize: '0.75rem' }}>
          Invite Code: <span style={{ color: '#ffb000' }}>{faction.inviteCode}</span>
        </div>
      )}
    </div>
  );
}
```

**C) MembersTab — add `[LEAVE]` for regular members (non-leader, non-officer):**

Officers have `[MGMT]` tab access but can also leave — add `[LEAVE]` for both non-leaders:

```tsx
function MembersTab({ isLeader, isOfficer }: { isLeader: boolean; isOfficer: boolean }) {
  const members = useStore((s) => s.factionMembers);
  const playerId = useStore((s) => s.playerId);

  return (
    <div>
      <div style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '4px' }}>MEMBERS</div>
      {members.map((m) => (
        // ... existing member rows unchanged — copy from current MembersTab
      ))}
      {!isLeader && (
        <div style={{ marginTop: '12px', borderTop: '1px solid var(--color-dim)', paddingTop: '8px' }}>
          <button className="vs-btn" onClick={() => network.sendFactionAction('leave')}>
            [LEAVE]
          </button>
        </div>
      )}
    </div>
  );
}
```

**D) UpgradesTab — rename header to English:**

```tsx
// was: 'VERBESSERUNGSBAUM'
// new: 'UPGRADE TREE'
```

**E) ManagementTab — Englishify all strings + remove [VERLASSEN]:**

Non-leaders no longer see this tab (handled by MGMT tab visibility). The `[VERLASSEN]` button in ManagementTab must be removed — `[LEAVE]` lives in MembersTab now.

```tsx
// In ManagementTab, remove the entire non-leader [VERLASSEN] block:
// DELETE: {!isLeader && (<button className="vs-btn" onClick={() => network.sendFactionAction('leave')}>[VERLASSEN]</button>)}

// Rename remaining strings:
// [AUFLÖSEN] → [DISBAND]
// [EINLADEN] → [INVITE]
// [MODUS] → [MODE]
// RECRUITING section: AKTIV REKRUTIEREN → ACTIVE RECRUITING
//                     Slogan (max 160 Zeichen): → SLOGAN (max 160 chars):
//                     [SPEICHERN] → [SAVE]
```

**F) NoFactionView — Englishify:**

```tsx
// [GRÜNDEN] → [FOUND]
// [BEITRETEN] → [JOIN]
// [FRAKTION GRÜNDEN] → [FOUND FACTION]
// Fraktionsname → Faction name
// Tag (3-5 Zeichen) → Tag (3-5 chars)
// [JA] → [YES]
// [NEIN] → [NO]
// von → from
// Einladungscode eingeben → Enter invite code:
// Einladungen → INVITATIONS
// EINLADUNGEN → INVITATIONS
// InviteButton: [EINLADEN] → [INVITE], Spielername → Player name
// JoinModeSelector: [MODUS] → [MODE], Offen → OPEN, Einladungscode → CODE, Nur Einladung → INVITE
```

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/FactionScreen.test.tsx --reporter=verbose
```
Expected: all pass.

- [ ] **Step 5: Run full client suite to catch any cascading failures**

```bash
cd packages/client && npx vitest run --reporter=dot
```
Expected: all pass. If `FactionUpgradeTree.test.tsx` fails (it references "VERBESSERUNGSBAUM"), update it to "UPGRADE TREE".

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/FactionScreen.tsx \
        packages/client/src/__tests__/FactionScreen.test.tsx \
        packages/client/src/__tests__/FactionUpgradeTree.test.tsx
git commit -m "fix: FactionScreen — InfoTab content, English strings, MGMT tab leaders-only, [LEAVE] in Members tab"
```

---

### Task 5: QuestsScreen VERFÜGBAR Empty State

**Files:**
- Modify: `packages/client/src/components/QuestsScreen.tsx`

**Context:** Looking at lines 763–810: when `isAtStation === false` the screen already shows "NO QUESTS AVAILABLE". But when `isAtStation === true` AND `availableQuests.length === 0` AND NPCs have loaded, there's no "no quests here" message — the list just silently disappears after the NPC names.

No new test file needed — QuestsScreen tests are complex integration tests. A snapshot/manual test is sufficient here.

- [ ] **Step 1: Locate the correct spot**

In `packages/client/src/components/QuestsScreen.tsx` around line 785:

```tsx
{availableQuests.length > 0 && (
  <>
    <div style={{ color: '#FFB000', marginTop: '8px', marginBottom: '4px' }}>
      AVAILABLE QUESTS:
    </div>
    {availableQuests.map(...)}
  </>
)}
```

- [ ] **Step 2: Add empty state below the existing block**

After the `availableQuests.length > 0` block, add:

```tsx
{isAtStation && stationNpcs.length > 0 && availableQuests.length === 0 && (
  <div style={{ color: 'rgba(255,176,0,0.4)', fontSize: '0.75rem', marginTop: '8px' }}>
    NO QUESTS AVAILABLE FROM THIS STATION
  </div>
)}
```

- [ ] **Step 3: Run tests**

```bash
cd packages/client && npx vitest run --reporter=dot
```
Expected: all pass (no tests reference this string, so no regressions).

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/QuestsScreen.tsx
git commit -m "fix: QuestsScreen VERFÜGBAR — empty state when at station with no quests"
```

---

## Chunk 3: Server — ManagementTab Recruiting State

---

### Task 6: ManagementTab Recruiting State from Server

**Files:**
- Modify: `packages/server/src/rooms/services/FactionService.ts`
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`
- Modify: `packages/client/src/components/FactionScreen.tsx`
- Modify: `packages/client/src/__tests__/FactionScreen.test.tsx`

**Context:**
- Migration 051 (PR #253, already merged) added `is_recruiting BOOLEAN`, `slogan VARCHAR(160)`, `color VARCHAR(7)` to the `factions` table — DB columns exist.
- `getPlayerFaction()` uses `SELECT f.*` — `factionRow.is_recruiting` and `factionRow.slogan` are already available in `sendFactionData` but not forwarded in the sent object.
- Client `gameSlice.ts` has a `faction` field typed as `any` (implicit). No type change needed — just pass the values through.
- `ManagementTab` currently uses `useState(false)` and `useState('')` — must init from stored faction data.
- `client.ts` line ~831: `room.onMessage('factionData', (data) => { store.setFaction(data.faction); ... })` — passes whole object through, no change needed there.
- In `FactionScreen.test.tsx`, `baseFaction` is already defined at the top of the file and `factionState()` is a helper that uses it. The test should use `factionState()` with overrides.

- [ ] **Step 1: Write failing test**

In `packages/client/src/__tests__/FactionScreen.test.tsx`, add to `FactionScreen — in faction` describe. `baseFaction` is defined at top of the test file; `factionState()` is the existing helper:

```tsx
it('management tab shows current recruiting state from server', () => {
  factionState('management', {
    faction: { ...baseFaction, isRecruiting: true, slogan: 'We mine together' },
  });
  render(<FactionScreen />);
  const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
  expect(checkbox.checked).toBe(true);
  expect(screen.getByDisplayValue('We mine together')).toBeDefined();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd packages/client && npx vitest run src/__tests__/FactionScreen.test.tsx -t "management tab shows current" --reporter=verbose
```
Expected: FAIL (checkbox.checked is false, value is empty string).

- [ ] **Step 3: Forward fields in server FactionService**

In `packages/server/src/rooms/services/FactionService.ts`, in `sendFactionData` (around line 53), add to the faction object sent:

```ts
this.ctx.send(client, 'factionData', {
  faction: {
    id: factionRow.id,
    name: factionRow.name,
    tag: factionRow.tag,
    leaderId: factionRow.leader_id,
    leaderName: factionRow.leader_name,
    joinMode: factionRow.join_mode,
    inviteCode: factionRow.invite_code,
    memberCount: Number(factionRow.member_count),
    createdAt: new Date(factionRow.created_at).getTime(),
    isRecruiting: factionRow.is_recruiting ?? false,  // NEW
    slogan: factionRow.slogan ?? null,                // NEW
  },
  // ... rest unchanged
```

- [ ] **Step 4: Add fields to client faction state**

In `packages/client/src/state/gameSlice.ts`, find where `faction` is stored. It's currently typed loosely. Find the existing faction-related state setter (search for `setFaction` or `factionData` handler). Add `isRecruiting` and `slogan` to whatever object is stored.

Search for the faction state field definition. If it uses `any`, add an explicit type comment:
```ts
// In GameState, faction field stores:
// { id, name, tag, leaderId, joinMode, inviteCode, memberCount, createdAt, isRecruiting, slogan }
```

No structural change needed if faction is `any` — the handler will pass the values through automatically once the server sends them.

- [ ] **Step 5: Verify client.ts factionData handler passes through new fields**

In `packages/client/src/network/client.ts`, find the `factionData` handler (search for `room.onMessage('factionData'`). Check that it calls `setFaction(data.faction)` or equivalent — if it passes the whole object through, no change needed.

```bash
grep -n "factionData\|setFaction" packages/client/src/network/client.ts | head -10
```

If the handler destructures specific fields and reconstructs: add `isRecruiting` and `slogan` to the destructuring.

- [ ] **Step 6: Initialize ManagementTab from store**

In `packages/client/src/components/FactionScreen.tsx`, update `ManagementTab`:

```tsx
function ManagementTab({ isLeader }: { isLeader: boolean }) {
  const faction = useStore((s) => s.faction)!;
  const [recruiting, setRecruiting] = useState<boolean>(faction.isRecruiting ?? false);
  const [slogan, setSlogan] = useState<string>(faction.slogan ?? '');
  // ... rest unchanged
```

- [ ] **Step 7: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/FactionScreen.test.tsx --reporter=verbose
```
Expected: all pass including new recruiting-state test.

- [ ] **Step 8: Run server tests to confirm no regression**

```bash
cd packages/server && npx vitest run --reporter=dot
```
Expected: same failures as before (9 pre-existing failures in acepBoost + scanInventory), no new failures.

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/rooms/services/FactionService.ts \
        packages/client/src/state/gameSlice.ts \
        packages/client/src/network/client.ts \
        packages/client/src/components/FactionScreen.tsx \
        packages/client/src/__tests__/FactionScreen.test.tsx
git commit -m "fix: ManagementTab recruiting state initialized from server (is_recruiting, slogan)"
```

---

### Task 7: Final Verification + PR

- [ ] **Step 1: Run full client suite**

```bash
cd packages/client && npx vitest run --reporter=verbose 2>&1 | tail -5
```
Expected: all tests pass (should be ≥617).

- [ ] **Step 2: Run server tests — confirm pre-existing failures only**

```bash
cd packages/server && npx vitest run --reporter=dot 2>&1 | tail -5
```
Expected: same 9 pre-existing failures, no new failures.

- [ ] **Step 3: Manual smoke-check list**

Verify in the running game:
- [ ] SHIP-SYS Section 3: ship name shows `· GEN 2` after permadeath, `veteran` trait is cyan not red, modules show `Mining Laser` not `mining laser`, slot count matches hull + ACEP bonus
- [ ] FACTION Section 3 (no faction): "NO OPEN RECRUITMENT" when empty, recruit button switches to FACTION program
- [ ] FACTION Section 3 (member): active upgrades show effects (`+15% mining rate`), next-upgrade shows option names
- [ ] FactionScreen tabs: non-leader sees no `[MGMT]` tab, sees `[LEAVE]` in Members tab
- [ ] FactionScreen Management tab: leader sees real recruiting state (checkbox reflects DB state, slogan pre-filled)
- [ ] FactionScreen language: all strings English
- [ ] QuestsScreen VERFÜGBAR: at station with no quests → "NO QUESTS AVAILABLE FROM THIS STATION"
- [ ] BookmarkBar: close button font-size visually matches surrounding text

- [ ] **Step 4: Create PR**

```bash
git push -u origin <branch-name>
gh pr create --title "fix: UX Bugfix Sprint — P2-Rest + Phase-3-N Nacharbeiten" --body "$(cat <<'EOF'
## Summary

- ShipDetailPanel: generation display, title-case module names, semantic trait colors, correct slot count (from HULLS + acepEffects)
- FactionDetailPanel: active upgrades show effects, next-upgrade shows option names, recruit panel button fixed, "NO OPEN RECRUITMENT" text
- FactionScreen: English strings throughout, InfoTab with real content, MGMT tab leaders-only, [LEAVE] in Members tab
- ManagementTab: recruiting checkbox + slogan textarea initialized from server state (is_recruiting, slogan now forwarded in factionData message)
- QuestsScreen: empty state when at station with no quests
- BookmarkBar: font-size 0.6rem → 0.75rem (Zeile 74)
- HUD: remove dead hyperdrive selector

## Test Plan
- [ ] `cd packages/client && npx vitest run` — all pass
- [ ] `cd packages/server && npx vitest run` — same 9 pre-existing failures only
- [ ] Manual: ShipDetailPanel slot count, trait colors, generation
- [ ] Manual: FactionDetailPanel recruit button navigates to FACTION program
- [ ] Manual: ManagementTab shows real is_recruiting + slogan from server
EOF
)"
```
