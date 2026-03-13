# Quest UI Improvements — Design Spec (#283)

## Goal

Improve quest UX by enhancing the inline confirmation preview when accepting quests and adding objective-level progress to collapsed active quest cards.

## Context

The quest system already has:
- `useConfirm` hook providing two-click confirmation (arm → confirm)
- Armed-state showing objectives + rewards inline
- Expanded active quest view with full objective progress (resource amounts, bounty hints, target coords)

What's missing:
- Quest-type badge (FETCH, BOUNTY, SCAN...) for quick identification
- Structured sections (ZIELE / BELOHNUNG) in the armed confirmation
- Explicit [ABBRECHEN] button to disarm
- Collapsed active quests show only `[0/3] Title` — no next-objective hint

## Approach: Enhanced Inline Expansion (Option C)

No modal dialog. Build on the existing `useConfirm` pattern with richer content in the armed state, plus a compact second line in collapsed active quests.

## Changes

### 1. VERFÜGBAR Tab — Enhanced Armed-State

When a quest is armed (first click), the expanded preview becomes:

```
┌─────────────────────────────────────┐
│ Lieferung von GAS          [FETCH] │  ← Quest-Typ-Badge
│ Beschaffe 3 Einheiten GAS...       │
│─────────────────────────────────────│
│ ZIELE                               │  ← Section label
│  › Sammle GAS (3)                   │
│  › Liefere an Station               │
│ BELOHNUNG                           │  ← Section label
│  +27 CR | +11 XP | +5 REP          │
│─────────────────────────────────────│
│ [ANNEHMEN]          [ABBRECHEN]     │  ← Two explicit buttons
└─────────────────────────────────────┘
```

Details:
- **Quest-Typ-Badge**: Small bordered label (e.g., `FETCH`, `BOUNTY`, `SCAN`) using existing `QUEST_TYPE_LABELS` map. Positioned top-right of the quest card header.
- **Structured sections**: ZIELE and BELOHNUNG with dim section labels (`color: rgba(0,255,136,0.5)`, `font-size: 0.5rem`, `letter-spacing: 0.1em`).
- **Two buttons**: [ANNEHMEN] (green, flex:1) calls `network.sendAcceptQuest()`. [ABBRECHEN] (dim amber) calls `setPending(null)` to disarm. Replace the single toggle button.
- **Disarm mechanism**: Add a `disarm()` function to `useConfirm` hook that clears pending state and timer.

### 2. AUFTRÄGE Tab — Collapsed Objective Progress

Collapsed active quests get a compact second line showing the next unfulfilled objective:

```
[1/3] Kopfgeldjagd auf Rexx   [BOUNTY] ▼
      › GAS [0/3] | → (42, 17)
```

Details:
- **Quest-Typ-Badge**: Same style as armed-state, positioned between title and expand arrow.
- **Second line**: Shows the first unfulfilled objective's key info:
  - For fetch/delivery: Resource name + progress (`GAS [0/3]`)
  - For bounty_trail: Current hint text
  - For bounty_combat/scan: Target coords (`→ (x, y)`)
  - For generic: Description text truncated
- **Completed quests**: Show `✓ Alle Ziele erfüllt — Abgabe an Station` in green.
- **All done**: When all objectives fulfilled, second line is green.

### 3. Quest-Type Badge Helper

Extract a small `QuestTypeBadge` inline element (not a separate component file — just a helper function in QuestsScreen.tsx):

```tsx
function questTypeBadge(templateId: string, color: string) {
  const type = templateId.split('_')[0]; // e.g., "fetch", "bounty", "scan"
  const label = QUEST_TYPE_LABELS[type] || type.toUpperCase();
  return (
    <span style={{
      color: `${color}80`,
      fontSize: '0.5rem',
      border: `1px solid ${color}40`,
      padding: '0 3px',
    }}>
      {label}
    </span>
  );
}
```

### 4. Collapsed Objective Summary Helper

Extract a helper to compute the collapsed summary line:

```tsx
function collapsedObjectiveSummary(objectives: QuestObjective[]): string | null {
  const allDone = objectives.every(o => o.fulfilled);
  if (allDone) return null; // handled separately with green text

  const next = objectives.find(o => !o.fulfilled);
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
  return parts.join(' | ');
}
```

## Files Affected

- **Modify**: `packages/client/src/components/QuestsScreen.tsx` — all UI changes
- **Modify**: `packages/client/src/hooks/useConfirm.ts` — add `disarm()` function
- **Test**: `packages/client/src/__tests__/QuestsScreen.test.tsx` — new test cases

## No Changes Required

- No server changes
- No shared package changes
- No database migrations
- No new files (helpers are inline in QuestsScreen.tsx)

## Acceptance Criteria

- [ ] Armed-state shows quest-type badge, structured ZIELE/BELOHNUNG sections, and two buttons
- [ ] [ABBRECHEN] button disarms the quest without accepting
- [ ] Collapsed active quests show quest-type badge and next-objective summary line
- [ ] Completed quests show green "Alle Ziele erfüllt" message in collapsed state
- [ ] Works with all quest types (fetch, delivery, scan, bounty_chase with 3 objectives)
- [ ] Existing tests still pass
- [ ] New tests cover badge rendering and collapsed summary logic
