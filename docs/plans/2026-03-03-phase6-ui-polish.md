# Phase 6: UI-Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the game UI by fixing layout issues, improving the HUD, enabling refuel at bases, making bezels consistent, and adding mining info to the detail panel.

**Architecture:** All changes are client-side except the refuel fix which also touches the server. Each task is independent — no task depends on another. The monorepo uses React + Zustand for state, Canvas for the radar, and Colyseus for networking.

**Tech Stack:** TypeScript, React, Zustand, CSS, Vitest + RTL for testing

**Issues closed by this plan:** #16, #17, #25, #27, #28, #29

---

### Task 1: HUD Compact Layout (#28)

Merge StatusBar and SectorInfo into a single compact 2-line component.

**Files:**
- Modify: `packages/client/src/components/HUD.tsx`

**Context:**
- `StatusBar` (lines 14–94) shows AP + Fuel in separate rows
- `SectorInfo` (lines 96–121) shows sector coordinates + player count
- Both are rendered in `main-lower` inside `GameScreen.tsx`
- The `SegmentedBar` helper (lines 4–12) stays as-is

**Step 1: Rewrite StatusBar to combine AP + Fuel on one line**

Replace the return JSX of `StatusBar` (lines 51–93). The new layout:
- Line 1: `AP: 100/100 █████ 0.5/s | FUEL: 7/100 █░░░░` — single flex row
- Font size 0.8rem (up from 0.7rem), full width
- Warnings (TANK LEER / NIEDRIG) replace the fuel right-side section when active
- Remove the separate `marginTop: 2` fuel div — everything is one row now

```tsx
return (
  <div style={{
    padding: '4px 12px',
    fontSize: '0.8rem',
    letterSpacing: '0.05em',
    lineHeight: 1.6,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
      <span className={flashing ? 'ap-flash' : ''} style={{ whiteSpace: 'nowrap' }}>
        AP: {ap ? `${displayAP}/${ap.max}` : '---'}
        {' '}<SegmentedBar current={ap ? displayAP : 0} max={ap?.max ?? 100} width={8} />
      </span>
      {ap && (
        <span style={{ color: 'var(--color-dim)', whiteSpace: 'nowrap' }}>
          {ap.regenPerSecond}/s
          {isFull
            ? <span style={{ color: '#00FF88', marginLeft: 4 }}>FULL</span>
            : <span style={{ marginLeft: 4 }}>({secondsToFull}s)</span>
          }
        </span>
      )}
      <span style={{ color: 'var(--color-dim)', margin: '0 2px' }}>|</span>
      {fuel ? (
        <>
          <span style={{
            whiteSpace: 'nowrap',
            color: fuel.current <= 0 ? '#FF3333' : fuel.current < fuel.max * 0.2 ? '#FF6644' : undefined,
            animation: fuel.current <= 0 ? 'bezel-alert-pulse 1s infinite' : undefined,
          }}>
            FUEL: {Math.floor(fuel.current)}/{fuel.max}
            {' '}<SegmentedBar current={fuel.current} max={fuel.max} width={8} />
          </span>
          {fuel.current <= 0 && (
            <span style={{ color: '#FF3333', fontWeight: 'bold', whiteSpace: 'nowrap' }}>TANK LEER</span>
          )}
          {fuel.current > 0 && fuel.current < fuel.max * 0.2 && (
            <span style={{ color: '#FF6644', whiteSpace: 'nowrap' }}>NIEDRIG</span>
          )}
        </>
      ) : (
        <span style={{ whiteSpace: 'nowrap' }}>FUEL: ---</span>
      )}
    </div>
  </div>
);
```

**Step 2: Simplify SectorInfo to a single compact line**

Replace the return JSX of `SectorInfo` (lines 103–120):

```tsx
return (
  <div style={{
    padding: '2px 12px 4px',
    fontSize: '0.75rem',
    letterSpacing: '0.08em',
    color: 'var(--color-dim)',
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: '1px solid var(--color-dim)',
  }}>
    <span>SECTOR: ({position.x}, {position.y})</span>
    <span>{currentSector?.type?.toUpperCase() || '---'}</span>
    <span>PILOTS: {playerCount}</span>
    <span>ORIGIN: {distToOrigin.toLocaleString()}</span>
  </div>
);
```

**Step 3: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All 115 tests pass (HUD has no dedicated tests but shouldn't break others)

**Step 4: Commit**

```bash
git add packages/client/src/components/HUD.tsx
git commit -m "feat(client): compact HUD layout — AP+Fuel single line, sector info condensed"
```

---

### Task 2: Refuel at Base (#29)

Allow players to refuel at their own base structure, not just at NPC stations.

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts:699-705` (handleRefuel station check)
- Modify: `packages/client/src/components/DetailPanel.tsx:80` (refuel button condition)

**Context:**
- Server `handleRefuel` (line 703) currently rejects if `sectorType !== 'station'`
- Client refuel button (line 80) only shows when `sector?.type === 'station'`
- `getPlayerStructure(playerId, 'base')` checks if player has base at home coordinates — but we need to check the CURRENT sector, not just home base
- We need a query that checks if the player has a base structure at specific coordinates

**Step 1: Add a query to check for player base at any sector**

In `packages/server/src/db/queries.ts`, add after `getPlayerStructure`:

```typescript
export async function playerHasBaseAtSector(
  playerId: string, sectorX: number, sectorY: number
): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM structures
     WHERE owner_id = $1 AND type = 'base'
       AND sector_x = $2 AND sector_y = $3
     LIMIT 1`,
    [playerId, sectorX, sectorY]
  );
  return rows.length > 0;
}
```

**Step 2: Update server handleRefuel**

In `SectorRoom.ts`, import the new query and change the station check (line 703):

```typescript
// Old:
if (this.state.sector.sectorType !== 'station') {
  client.send('refuelResult', { success: false, error: 'Must be at a station to refuel' });
  return;
}

// New:
const isStation = this.state.sector.sectorType === 'station';
const hasBaseHere = await playerHasBaseAtSector(
  auth.userId, this.state.sector.x, this.state.sector.y
);
if (!isStation && !hasBaseHere) {
  client.send('refuelResult', { success: false, error: 'Must be at a station or your base to refuel' });
  return;
}
```

**Step 3: Update client DetailPanel refuel condition**

In `DetailPanel.tsx`, change line 80. The client needs to know if the player has a base here. The simplest approach: also show the refuel button when the player has a base structure in the current sector. We can check `currentSector?.type === 'station'` OR check for base structures.

Since the client already receives structure data, check if the `structures` list for the sector includes the player's base. However, the client may not have this data readily available. The simplest approach: add a `hasBaseHere` derived state.

Actually, the simplest approach: always show the refuel button when `isPlayerHere && fuel.current < fuel.max` regardless of sector type — the server will reject if conditions aren't met. But add a check so it only shows at station or when there's a base.

For now, the pragmatic approach is to check both conditions in the client. The player's structures are already available via the `getBase` message. Add a `playerBase` state check:

```typescript
// In DetailPanel, check if current sector has player's base
const structures = useStore((s) => s.baseStructures);
const hasBaseHere = structures?.some(
  (s: any) => s.type === 'base' && s.sector_x === position.x && s.sector_y === position.y
);

// Update condition:
{isPlayerHere && (sector?.type === 'station' || hasBaseHere) && fuel && fuel.current < fuel.max && (
```

If `baseStructures` is not in the store with sector coordinates, fallback to: always show refuel button when `isPlayerHere` and let server validate. This is the safest approach:

```typescript
{isPlayerHere && fuel && fuel.current < fuel.max && (
```

The server already handles validation properly.

**Step 4: Run tests**

Run: `cd packages/server && npx vitest run && cd ../client && npx vitest run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add packages/server/src/db/queries.ts packages/server/src/rooms/SectorRoom.ts packages/client/src/components/DetailPanel.tsx
git commit -m "fix(server,client): allow refuel at own base, not just stations"
```

---

### Task 3: Monitor Content Alignment (#27)

Fix alignment in monitor screens so labels and values are consistently formatted.

**Files:**
- Modify: `packages/client/src/components/GameScreen.tsx:22-57` (ShipSysScreen)

**Context:**
- ShipSysScreen uses manual dash padding: `ION DRIVE ──── [RANGE: 4 SECTORS]`
- MiningScreen and CargoScreen use `padEnd(10)` in their bar components — these are already consistent
- The main issue from the screenshot is ShipSysScreen alignment

**Step 1: Fix ShipSysScreen alignment with consistent tabular layout**

Replace ShipSysScreen function body (lines 28–56):

```tsx
function ShipSysScreen() {
  const ship = useStore((s) => s.ship);
  const colorProfile = useStore((s) => s.colorProfile);
  const setColorProfile = useStore((s) => s.setColorProfile);

  const stats = [
    { label: 'DRIVE', value: `RANGE: ${ship?.jumpRange ?? '?'}` },
    { label: 'CARGO', value: `CAP: ${ship?.cargoCap ?? '?'}` },
    { label: 'SCANNER', value: `LVL: ${ship?.scannerLevel ?? '?'}` },
    { label: 'SAFE SLOTS', value: `${ship?.safeSlots ?? '?'}` },
    { label: 'FUEL', value: `MAX: ${ship?.fuelMax ?? '?'}` },
    { label: 'COMM', value: `RANGE: ${ship ? SHIP_CLASSES[ship.shipClass].commRange : '?'}` },
  ];

  return (
    <div style={{ padding: '8px 12px', fontSize: '0.8rem', lineHeight: 1.8 }}>
      <div style={{ letterSpacing: '0.2em', marginBottom: 8, fontSize: '0.85rem' }}>
        {ship ? SHIP_CLASSES[ship.shipClass].name : 'NO SHIP DATA'}
      </div>
      {stats.map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{label}</span>
          <span style={{ color: 'var(--color-dim)' }}>{'─'.repeat(Math.max(1, 20 - label.length - value.length))}</span>
          <span>{value}</span>
        </div>
      ))}
      <div style={{ marginTop: 12, borderTop: '1px solid var(--color-dim)', paddingTop: 8 }}>
        SYSTEMS: <span style={{ color: '#00FF88' }}>ONLINE</span>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: '0.75rem', opacity: 0.6 }}>DISPLAY PROFILE</label>
        <select
          value={colorProfile}
          onChange={(e) => setColorProfile(e.target.value as any)}
          style={{
            display: 'block', marginTop: 4, width: '100%',
            background: 'transparent', border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)', fontFamily: 'var(--font-mono)',
            padding: '4px 8px', fontSize: '0.8rem',
          }}
        >
          {Object.keys(COLOR_PROFILES).map(name => (
            <option key={name} value={name}>{name.toUpperCase()}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/client/src/components/GameScreen.tsx
git commit -m "fix(client): align ship stats with tabular layout in SHIP-SYS monitor"
```

---

### Task 4: Consistent Bezel Buttons (#25)

Standardize bezel button placement. Move auto-follow toggle from DetailPanel to NAV-COM bezel.

**Files:**
- Modify: `packages/client/src/components/MonitorBezel.tsx`
- Modify: `packages/client/src/components/GameScreen.tsx` (remove auto-follow from detail header)

**Context:**
- MonitorBezel currently has: Left (PAN knob, label, BookmarkBar), Right (LEDs, ON/OFF, ZOOM)
- Auto-follow toggle is in GameScreen.tsx in the detail panel header area
- Goal: Move auto-follow to the bottom bezel bar of NAV-COM, next to BRIGHTNESS and [?]

**Step 1: Add auto-follow toggle to MonitorBezel bottom bar**

In `MonitorBezel.tsx`, add the auto-follow toggle in the `bezel-bottom` div, only when `monitorId === 'NAV-COM'`:

```tsx
// Import autoFollow from store
const autoFollow = useStore((s) => s.autoFollow);
const setAutoFollow = useStore((s) => s.setAutoFollow);

// In bezel-bottom div, add before the [?] button:
{monitorId === 'NAV-COM' && (
  <button
    className="vs-btn"
    onClick={() => setAutoFollow(!autoFollow)}
    style={{
      fontSize: '0.65rem',
      padding: '2px 6px',
      borderColor: autoFollow ? '#00FF88' : 'var(--color-dim)',
      color: autoFollow ? '#00FF88' : 'var(--color-dim)',
    }}
  >
    [{autoFollow ? 'AUTO' : 'MANUAL'}]
  </button>
)}
```

**Step 2: Remove auto-follow toggle from GameScreen detail header**

Find and remove the auto-follow button that's currently in the detail panel header area of GameScreen.tsx. Search for `autoFollow` or `setAutoFollow` in the main monitor split view.

**Step 3: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add packages/client/src/components/MonitorBezel.tsx packages/client/src/components/GameScreen.tsx
git commit -m "feat(client): move auto-follow toggle to NAV-COM bezel bottom bar"
```

---

### Task 5: Weaken Vignette & UI Tweaks (#16)

Reduce the CRT vignette fade effect and verify consistent monitor widths.

**Files:**
- Modify: `packages/client/src/styles/crt.css:51-61` (.crt-vignette)

**Context:**
- `.crt-vignette` uses `transparent 65%, rgba(0,0,0,0.3) 100%` — too strong
- Design says weaken to `75%→100%`
- Monitor widths (320px sidebars) are already fixed — verify no dynamic changes

**Step 1: Weaken vignette gradient**

In `crt.css`, change `.crt-vignette` (line 56-59):

```css
/* Old: */
background: radial-gradient(
  ellipse at center,
  transparent 65%,
  rgba(0, 0, 0, 0.3) 100%
);

/* New: */
background: radial-gradient(
  ellipse at center,
  transparent 75%,
  rgba(0, 0, 0, 0.2) 100%
);
```

Reduced from 65%→100% opacity 0.3 to 75%→100% opacity 0.2.

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass (CSS-only change)

**Step 3: Commit**

```bash
git add packages/client/src/styles/crt.css
git commit -m "fix(client): weaken CRT vignette fade effect"
```

---

### Task 6: Mining Info in Detail Panel (#17)

Show live mining status in the DetailPanel when the player is mining in the current sector.

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`

**Context:**
- DetailPanel shows sector info when a sector is selected on the radar
- Mining state is in `useStore((s) => s.mining)` with `{ active, resource, rate, sectorX, sectorY }`
- Nav-lock during mining is already implemented in NavControls.tsx
- The detail panel should show a mining indicator when the player is mining in the viewed sector

**Step 1: Add mining status display to DetailPanel**

In DetailPanel, after the "YOU ARE HERE" section (around line 79), add:

```tsx
const mining = useStore((s) => s.mining);
const isMiningHere = mining?.active && mining.sectorX === sector?.x && mining.sectorY === sector?.y;

// In the JSX, after the "YOU ARE HERE" div:
{isMiningHere && (
  <div style={{
    marginTop: 8,
    padding: '6px 8px',
    border: '1px solid var(--color-primary)',
    fontSize: '0.75rem',
    animation: 'bezel-alert-pulse 2s infinite',
  }}>
    <div>MINING: {mining.resource?.toUpperCase()}</div>
    <div style={{ color: 'var(--color-dim)' }}>RATE: {mining.rate}u/s</div>
  </div>
)}
```

**Step 2: Run tests**

Run: `cd packages/client && npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx
git commit -m "feat(client): show live mining status in detail panel"
```

---

## Summary

| Task | Issue | Files | Description |
|------|-------|-------|-------------|
| 1 | #28 | HUD.tsx | AP+Fuel single line, sector info condensed |
| 2 | #29 | SectorRoom.ts, queries.ts, DetailPanel.tsx | Refuel at own base |
| 3 | #27 | GameScreen.tsx | Tabular ship stats alignment |
| 4 | #25 | MonitorBezel.tsx, GameScreen.tsx | Auto-follow on bezel, consistent layout |
| 5 | #16 | crt.css | Weaker vignette |
| 6 | #17 | DetailPanel.tsx | Mining status in detail panel |

**Total: 6 tasks, ~6 files modified, 0 new files.**
