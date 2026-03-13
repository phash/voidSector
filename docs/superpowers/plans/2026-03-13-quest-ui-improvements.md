# Quest UI Improvements Implementation Plan (#283)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance quest confirmation preview and add objective-level progress to collapsed active quests.

**Architecture:** Client-only changes. Enhance the armed-state inline expansion in VERFÜGBAR tab with structured sections and explicit cancel. Add a compact second line to collapsed active quests in AUFTRÄGE tab showing the next unfulfilled objective. Add `disarm()` to `useConfirm` hook.

**Tech Stack:** React, TypeScript, Vitest, @testing-library/react

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/client/src/hooks/useConfirm.ts` | Modify | Add `disarm()` function to clear pending state |
| `packages/client/src/components/QuestsScreen.tsx` | Modify | Enhanced armed-state, collapsed progress, quest-type badge |
| `packages/client/src/__tests__/QuestsScreen.test.tsx` | Modify | New tests for badge, collapsed summary, cancel button |

---

## Chunk 1: Implementation

### Task 0: Create feature branch

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feat/quest-ui-improvements-283
```

---

### Task 1: Add `disarm()` to useConfirm hook

**Files:**
- Modify: `packages/client/src/hooks/useConfirm.ts`
- Test: `packages/client/src/__tests__/QuestsScreen.test.tsx` (tested via integration)

- [ ] **Step 1: Add disarm function to useConfirm**

In `packages/client/src/hooks/useConfirm.ts`, add a `disarm` function that clears pending state and timer. Return it alongside `confirm` and `isArmed`.

```ts
// Current return (line 26):
//   return { confirm, isArmed };
// Change to:

const disarm = () => {
  if (timerRef.current) clearTimeout(timerRef.current);
  setPending(null);
};

return { confirm, isArmed, disarm };
```

- [ ] **Step 2: Run existing tests to verify no regression**

```bash
cd packages/client && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: All existing tests pass (useConfirm is already tested via QuestsScreen integration tests).

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/hooks/useConfirm.ts
git commit -m "feat(quest-ui): add disarm() to useConfirm hook (#283)"
```

---

### Task 2: Quest-type badge helper + collapsed objective summary

**Files:**
- Modify: `packages/client/src/components/QuestsScreen.tsx` (add two helper functions near top, around line 27)
- Modify: `packages/client/src/__tests__/QuestsScreen.test.tsx` (new tests)

- [ ] **Step 1: Write tests for collapsed objective summary in active quests**

Add to `packages/client/src/__tests__/QuestsScreen.test.tsx`:

```tsx
it('shows quest-type badge and collapsed objective summary for active quest', () => {
  mockStoreState({
    activeQuests: [
      {
        id: 'q1',
        templateId: 'fetch_gas_1',
        npcName: 'Zar',
        npcFactionId: 'traders',
        title: 'Gas Delivery',
        description: 'Deliver gas',
        stationX: 10,
        stationY: 20,
        objectives: [
          {
            type: 'fetch',
            description: 'Collect GAS',
            resource: 'gas',
            amount: 3,
            progress: 1,
            fulfilled: false,
          },
        ],
        rewards: { credits: 30, xp: 10, reputation: 5 },
        status: 'active',
        acceptedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      },
    ],
  });
  render(<QuestsScreen />);
  // Quest-type badge visible in collapsed state
  expect(screen.getByText('DELIVERY')).toBeDefined();
  // Collapsed objective summary: resource progress
  expect(screen.getByText(/GAS \[1\/3\]/)).toBeDefined();
});

it('shows BOUNTY badge for bounty_chase quest and target coords in summary', () => {
  mockStoreState({
    activeQuests: [
      {
        id: 'q3',
        templateId: 'pirates_bounty_chase_1',
        npcName: 'Blackbeard',
        npcFactionId: 'pirates',
        title: 'Hunt Rexx',
        description: 'Track and eliminate',
        stationX: 10,
        stationY: 10,
        objectives: [
          { type: 'bounty_trail', description: 'Follow trail', fulfilled: true },
          {
            type: 'bounty_combat',
            description: 'Eliminate Rexx',
            targetX: 42,
            targetY: 17,
            fulfilled: false,
          },
          { type: 'bounty_deliver', description: 'Return proof', fulfilled: false },
        ],
        rewards: { credits: 150, xp: 30, reputation: 10 },
        status: 'active',
        acceptedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      },
    ],
  });
  render(<QuestsScreen />);
  // Badge shows BOUNTY (not PIRATES)
  expect(screen.getByText('BOUNTY')).toBeDefined();
  // Collapsed summary shows next unfulfilled objective with coords
  expect(screen.getByText(/Eliminate Rexx/)).toBeDefined();
  expect(screen.getByText(/42.*17/)).toBeDefined();
});

it('shows completed hint for fully fulfilled quest in collapsed state', () => {
  mockStoreState({
    activeQuests: [
      {
        id: 'q2',
        templateId: 'scan_sector_1',
        npcName: 'Dr. X',
        npcFactionId: 'scientists',
        title: 'Scan Mission',
        description: 'Scan sectors',
        stationX: 5,
        stationY: 5,
        objectives: [
          {
            type: 'scan',
            description: 'Scan target',
            fulfilled: true,
          },
        ],
        rewards: { credits: 20, xp: 8, reputation: 3 },
        status: 'active',
        acceptedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      },
    ],
  });
  render(<QuestsScreen />);
  expect(screen.getByText('SCAN')).toBeDefined();
  expect(screen.getByText(/Alle Ziele erfüllt/)).toBeDefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/client && npx vitest run src/__tests__/QuestsScreen.test.tsx --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL — no "DELIVERY" badge or "GAS [1/3]" text rendered yet.

- [ ] **Step 3: Add helper functions to QuestsScreen.tsx**

Add after the `QUEST_TYPE_LABELS` constant (around line 26) in `packages/client/src/components/QuestsScreen.tsx`:

```tsx
function getQuestTypeLabel(templateId: string): string {
  const id = templateId ?? '';
  // Check for known quest-type keywords anywhere in templateId
  // (bounty templateIds start with faction: "pirates_bounty_chase")
  if (id.includes('bounty')) return 'BOUNTY';
  if (id.includes('diplomacy')) return 'DIPLOMACY';
  if (id.includes('war_support')) return 'WAR';
  // Fall back to first segment lookup
  const first = id.split('_')[0];
  return QUEST_TYPE_LABELS[first] || first.toUpperCase();
}

function questTypeBadge(templateId: string, color: string) {
  const label = getQuestTypeLabel(templateId);
  if (!label) return null;
  return (
    <span
      style={{
        color: `${color}80`,
        fontSize: '0.5rem',
        border: `1px solid ${color}40`,
        padding: '0 3px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function collapsedObjectiveSummary(
  objectives: Array<{ type: string; description: string; resource?: string; amount?: number; progress?: number; fulfilled: boolean; targetX?: number; targetY?: number; currentHint?: string }>,
): { text: string; done: boolean } | null {
  const allDone = objectives.every((o) => o.fulfilled);
  if (allDone) return { text: 'Alle Ziele erfüllt — Abgabe an Station', done: true };

  const next = objectives.find((o) => !o.fulfilled);
  if (!next) return null;

  const parts: string[] = [];
  if ((next.type === 'fetch' || next.type === 'delivery') && next.resource && next.amount != null) {
    parts.push(`${next.resource.toUpperCase()} [${next.progress ?? 0}/${next.amount}]`);
  } else if (next.type === 'bounty_trail' && next.currentHint) {
    parts.push(next.currentHint);
  } else {
    parts.push(next.description);
  }
  if (next.targetX != null && next.targetY != null) {
    parts.push(`→ (${innerCoord(next.targetX)}, ${innerCoord(next.targetY)})`);
  }
  return { text: `› ${parts.join(' | ')}`, done: false };
}
```

- [ ] **Step 4: Add badge + summary to collapsed active quest header**

In `packages/client/src/components/QuestsScreen.tsx`, find the collapsed active quest header (around line 626–648). The existing code inside `activeQuests.map((q) => { ... })` already computes these variables:
```tsx
const isExpanded = expandedQuestId === q.id;
const doneCount = q.objectives.filter((o) => o.fulfilled).length;
const allDone = doneCount === q.objectives.length;
```
Modify to add the badge next to the expand arrow and the summary line below the header:

**In the header row** (the `<div onClick={() => setExpandedQuestId(...)}>` around line 627), change the right-side span from just the arrow to include the badge:

```tsx
{/* Replace the existing right-side arrow span */}
<span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
  {questTypeBadge(q.templateId, allDone ? '#00FF88' : '#FFB000')}
  <span style={{ color: 'rgba(255,176,0,0.4)', fontSize: '0.5rem' }}>
    {isExpanded ? '▲' : '▼'}
  </span>
</span>
```

**Below the header row, before the expanded block** (before the `{isExpanded && (` around line 651), add the collapsed summary:

```tsx
{!isExpanded && (() => {
  const summary = collapsedObjectiveSummary(q.objectives);
  if (!summary) return null;
  return (
    <div
      style={{
        padding: '0 8px 5px 20px',
        color: summary.done ? 'rgba(0,255,136,0.4)' : 'rgba(255,176,0,0.4)',
        fontSize: '0.5rem',
      }}
    >
      {summary.text}
    </div>
  );
})()}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/client && npx vitest run src/__tests__/QuestsScreen.test.tsx --reporter=verbose 2>&1 | tail -15
```

Expected: All tests PASS including the two new ones.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/QuestsScreen.tsx packages/client/src/__tests__/QuestsScreen.test.tsx
git commit -m "feat(quest-ui): quest-type badge + collapsed objective summary (#283)"
```

---

### Task 3: Enhanced armed-state with structured sections and cancel button

**Files:**
- Modify: `packages/client/src/components/QuestsScreen.tsx` (VERFÜGBAR tab armed block, around lines 856–890)
- Modify: `packages/client/src/__tests__/QuestsScreen.test.tsx` (new tests)

- [ ] **Step 1: Write test for enhanced armed-state with cancel**

Add to `packages/client/src/__tests__/QuestsScreen.test.tsx`:

```tsx
it('shows structured armed preview with cancel button for available quest', async () => {
  mockStoreState({
    activeQuests: [],
    currentSector: { type: 'station', x: 5, y: 5 },
    position: { x: 5, y: 5 },
  });
  render(<QuestsScreen />);
  // Switch to VERFÜGBAR tab
  await userEvent.click(screen.getByText('VERFÜGBAR'));

  // Need to simulate stationNpcsResult event to populate available quests
  const event = new CustomEvent('stationNpcsResult', {
    detail: {
      npcs: [{ id: 'n1', name: 'Zar', factionId: 'traders' }],
      quests: [
        {
          templateId: 'fetch_gas_1',
          npcName: 'Zar',
          npcFactionId: 'traders',
          title: 'Gas Delivery',
          description: 'Deliver gas to station',
          objectives: [
            { type: 'fetch', description: 'Collect GAS', resource: 'gas', amount: 3, fulfilled: false },
          ],
          rewards: { credits: 27, xp: 11, reputation: 5 },
          requiredTier: 'neutral',
        },
      ],
    },
  });
  window.dispatchEvent(event);

  // Click accept to arm
  await userEvent.click(screen.getByText('[ACCEPT]'));

  // Armed state shows structured sections
  expect(screen.getByText('ZIELE')).toBeDefined();
  expect(screen.getByText('BELOHNUNG')).toBeDefined();
  expect(screen.getByText('DELIVERY')).toBeDefined();

  // Cancel button visible
  expect(screen.getByText('[ABBRECHEN]')).toBeDefined();

  // Click cancel to disarm
  await userEvent.click(screen.getByText('[ABBRECHEN]'));
  expect(network.sendAcceptQuest).not.toHaveBeenCalled();

  // Armed state gone — sections no longer visible
  expect(screen.queryByText('ZIELE')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/QuestsScreen.test.tsx --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL — no "ZIELE" section label, no "[ABBRECHEN]" button.

- [ ] **Step 3: Implement enhanced armed-state**

In `packages/client/src/components/QuestsScreen.tsx`:

1. Destructure `disarm` from `useConfirm`:

```tsx
// Around line 479, change:
const { confirm, isArmed } = useConfirm();
// To:
const { confirm, isArmed, disarm } = useConfirm();
```

2. In the VERFÜGBAR quest card header (around line 852), add the badge when armed:

```tsx
{/* Replace the title div with a flex row including badge when armed */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <span style={{ color: '#FFB000' }}>{q.title}</span>
  {armed && questTypeBadge(q.templateId, '#00FF88')}
</div>
```

3. Replace the armed confirmation block (around lines 857–870) with structured sections:

```tsx
{armed && (
  <div style={{ marginTop: '4px', borderTop: '1px solid rgba(0,255,136,0.2)', paddingTop: '4px' }}>
    <div style={{ color: 'rgba(0,255,136,0.5)', fontSize: '0.5rem', letterSpacing: '0.1em', marginBottom: '3px' }}>
      ZIELE
    </div>
    {q.objectives?.map((obj: any, i: number) => (
      <div key={i} style={{ color: 'rgba(0,255,136,0.7)', fontSize: '0.5rem', paddingLeft: '6px' }}>
        › {obj.description}
        {obj.amount != null && ` (${obj.amount})`}
      </div>
    ))}
    <div style={{ color: 'rgba(0,255,136,0.5)', fontSize: '0.5rem', letterSpacing: '0.1em', marginTop: '6px', marginBottom: '3px' }}>
      BELOHNUNG
    </div>
    <div style={{ color: '#00FF88', fontSize: '0.5rem', paddingLeft: '6px' }}>
      +{q.rewards.credits} CR | +{q.rewards.xp} XP
      {q.rewards.reputation > 0 && ` | +${q.rewards.reputation} REP`}
    </div>
  </div>
)}
```

4. Replace the single accept button (around lines 876–890) with two buttons:

```tsx
{armed ? (
  <div style={{ marginTop: '6px', display: 'flex', gap: '6px' }}>
    <button
      onClick={() => { disarm(); network.sendAcceptQuest(q.templateId, position.x, position.y); }}
      style={{
        background: 'rgba(0,255,136,0.15)',
        color: '#00FF88',
        border: '1px solid #00FF88',
        padding: '3px 6px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.55rem',
        flex: 1,
      }}
    >
      [ANNEHMEN]
    </button>
    <button
      onClick={() => disarm()}
      style={{
        background: 'transparent',
        color: 'rgba(255,176,0,0.5)',
        border: '1px solid rgba(255,176,0,0.3)',
        padding: '3px 6px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.55rem',
      }}
    >
      [ABBRECHEN]
    </button>
  </div>
) : (
  <button
    onClick={() => confirm(`accept-${q.templateId}`, () => network.sendAcceptQuest(q.templateId, position.x, position.y))}
    style={{
      background: '#1a1a1a',
      color: '#00FF88',
      border: '1px solid rgba(0,255,136,0.5)',
      padding: '3px 6px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: '0.55rem',
      marginTop: '2px',
    }}
  >
    {btn(UI.actions.ACCEPT)}
  </button>
)}
```

Note: In the armed state, clicking [ANNEHMEN] calls `disarm()` to clear pending/timer state, then `sendAcceptQuest`. Clicking [ABBRECHEN] calls `disarm()` to cancel without accepting.

- [ ] **Step 4: Run all tests to verify**

```bash
cd packages/client && npx vitest run src/__tests__/QuestsScreen.test.tsx --reporter=verbose 2>&1 | tail -15
```

Expected: All tests PASS.

- [ ] **Step 5: Run full client test suite**

```bash
cd packages/client && npx vitest run --reporter=verbose 2>&1 | tail -5
```

Expected: All client tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/QuestsScreen.tsx packages/client/src/__tests__/QuestsScreen.test.tsx
git commit -m "feat(quest-ui): enhanced armed confirmation with cancel button (#283)"
```
