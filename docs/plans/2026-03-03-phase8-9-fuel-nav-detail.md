# Phase 8 & 9: Fuel-System, Quick Fixes, Nav Overhaul & Detail Views

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish fuel/refuel system, add credits display + alien credits, rename jettison, rework nav grid with coordinate frame, add zoom-dependent detail levels, and build main-window detail view with CRT pixel art.

**Architecture:** Phase 8 adds fuel-per-jump to hull system, reputation-based pricing, partial refuel UI, and HUD enhancements. Phase 9 reworks the radar canvas to use 80% of space with a coordinate frame, adds zoom-dependent sector detail, and introduces a detail-view overlay in the main window area that shows CRT pixel art when items are clicked in the DetailPanel.

**Tech Stack:** TypeScript, React, Zustand, Canvas 2D, Colyseus, PostgreSQL, Redis

**Issues covered:** #34, #36, #33, #35 (Phase 8), #38, #37, #32 (Phase 9)

---

## Phase 8: Quick Fixes & Fuel System

### Task 0: Rename Jettison to ABWERFEN (#34)

**Files:**
- Modify: `packages/client/src/components/CargoScreen.tsx:173`

**Step 1: Rename the button text**

In `CargoScreen.tsx` line 173, change:
```tsx
[JETTISON {res.toUpperCase()}]
```
to:
```tsx
[ABWERFEN {res.toUpperCase()}]
```

**Step 2: Verify the app builds**

Run: `cd packages/client && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add packages/client/src/components/CargoScreen.tsx
git commit -m "fix(client): rename JETTISON to ABWERFEN (#34)"
```

---

### Task 1: Credits Display in HUD (#36)

**Files:**
- Modify: `packages/client/src/components/HUD.tsx:73-94` (StatusBar)

**Context:** The StatusBar currently shows `AP: X/Y ████ | FUEL: X/Y ████`. We add credits after the fuel section, separated by `|`. The store already has `credits: number` in gameSlice.

**Step 1: Add credits to StatusBar**

In `HUD.tsx`, add `credits` to the store subscription at the top of `StatusBar()`:
```tsx
const credits = useStore((s) => s.credits);
```

After the closing `</>` of the fuel block (after line 94), add a new section:
```tsx
<span style={{ color: 'var(--color-dim)' }}>|</span>
<span>
  CR: {credits.toLocaleString()}
</span>
```

**Step 2: Verify visually**

Run: `npm run dev:client`
Check that the HUD now shows `AP: X/Y ████ 0.5/s | FUEL: X/Y ████ | CR: 99,999`

**Step 3: Commit**

```bash
git add packages/client/src/components/HUD.tsx
git commit -m "feat(client): display credits in HUD status bar (#36)"
```

---

### Task 2: Alien Credits Infrastructure (#36)

**Files:**
- Modify: `packages/server/src/db/migrations/011_ship_designer.sql` (append)
- Create: `packages/server/src/db/migrations/012_alien_credits.sql`
- Modify: `packages/shared/src/types.ts` (PlayerData)
- Modify: `packages/server/src/db/queries.ts` (new queries)
- Modify: `packages/client/src/state/gameSlice.ts` (add alienCredits)
- Modify: `packages/client/src/network/client.ts` (receive handler)
- Modify: `packages/server/src/rooms/SectorRoom.ts` (send on join)
- Modify: `packages/client/src/components/HUD.tsx` (display)

**Step 1: Create migration 012**

Create `packages/server/src/db/migrations/012_alien_credits.sql`:
```sql
-- Phase 8: Alien Credits currency
ALTER TABLE players ADD COLUMN IF NOT EXISTS alien_credits INTEGER NOT NULL DEFAULT 0;
```

**Step 2: Add alienCredits to shared types**

In `packages/shared/src/types.ts`, add to the `PlayerData` interface:
```ts
alienCredits?: number;
```

**Step 3: Add server queries**

In `packages/server/src/db/queries.ts`, add:
```ts
export async function getAlienCredits(playerId: string): Promise<number> {
  const { rows } = await query<{ alien_credits: number }>(
    'SELECT alien_credits FROM players WHERE id = $1',
    [playerId]
  );
  return rows[0]?.alien_credits ?? 0;
}

export async function addAlienCredits(playerId: string, amount: number): Promise<number> {
  const { rows } = await query<{ alien_credits: number }>(
    'UPDATE players SET alien_credits = alien_credits + $2 WHERE id = $1 RETURNING alien_credits',
    [playerId, amount]
  );
  return rows[0]?.alien_credits ?? 0;
}

export async function deductAlienCredits(playerId: string, amount: number): Promise<boolean> {
  const { rows } = await query<{ alien_credits: number }>(
    'UPDATE players SET alien_credits = alien_credits - $2 WHERE id = $1 AND alien_credits >= $2 RETURNING alien_credits',
    [playerId, amount]
  );
  return rows.length > 0;
}
```

**Step 4: Add alienCredits to client store**

In `packages/client/src/state/gameSlice.ts`, add to interface and defaults:
```ts
alienCredits: number;  // in interface
alienCredits: 0,       // in defaults
```

**Step 5: Send alienCredits on join + receive handler**

In `SectorRoom.ts` `onJoin`, after sending `creditsUpdate`, also send:
```ts
const alienCredits = await getAlienCredits(auth.userId);
client.send('alienCreditsUpdate', { alienCredits });
```

In `packages/client/src/network/client.ts`, add handler:
```ts
room.onMessage('alienCreditsUpdate', (data: { alienCredits: number }) => {
  useStore.setState({ alienCredits: data.alienCredits });
});
```

**Step 6: Display in HUD**

In `HUD.tsx`, after the credits display, add alien credits with distinct color:
```tsx
{alienCredits > 0 && (
  <>
    <span style={{ color: 'var(--color-dim)' }}>|</span>
    <span style={{ color: '#00BFFF' }}>
      A-CR: {alienCredits.toLocaleString()}
    </span>
  </>
)}
```

**Step 7: Run tests and verify**

Run: `cd packages/server && npx vitest run`
Run: `cd packages/client && npx vitest run`
Expected: All existing tests pass

**Step 8: Commit**

```bash
git add packages/server/src/db/migrations/012_alien_credits.sql packages/shared/src/types.ts packages/server/src/db/queries.ts packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts packages/server/src/rooms/SectorRoom.ts packages/client/src/components/HUD.tsx
git commit -m "feat: add alien credits currency infrastructure (#36)"
```

---

### Task 3: Fuel Per Jump on Hull + Display (#33)

**Files:**
- Modify: `packages/shared/src/types.ts` (HullDefinition, ShipStats)
- Modify: `packages/shared/src/constants.ts` (HULLS)
- Modify: `packages/shared/src/shipCalculator.ts` (calculateShipStats)
- Modify: `packages/server/src/rooms/SectorRoom.ts` (handleJump, handleFarJump)
- Modify: `packages/client/src/components/HUD.tsx` (show fuel/jump)
- Modify: `packages/client/src/components/NavControls.tsx` (cost tooltip)
- Test: `packages/shared/src/shipCalculator.test.ts`

**Context:** Currently `fuelCost = 1` is hardcoded in SectorRoom.ts:676. We need fuel cost per jump to vary by hull type. The old `SHIP_CLASSES` already had `fuelPerJump` (5 for scout, 3 for seeker), but the new system doesn't. Add `baseFuelPerJump` to `HullDefinition`, `fuelPerJump` to `ShipStats`, and use it in jump handlers.

**Step 1: Write tests for fuelPerJump in stat calculator**

In `packages/shared/src/shipCalculator.test.ts`, add:
```ts
it('should include fuelPerJump in calculated stats', () => {
  const stats = calculateShipStats('scout', []);
  expect(stats.fuelPerJump).toBe(1);
});

it('should have higher fuelPerJump for heavy hulls', () => {
  const freighterStats = calculateShipStats('freighter', []);
  const scoutStats = calculateShipStats('scout', []);
  expect(freighterStats.fuelPerJump).toBeGreaterThan(scoutStats.fuelPerJump);
});
```

Run: `cd packages/shared && npx vitest run`
Expected: FAIL (fuelPerJump not in ShipStats)

**Step 2: Add fuelPerJump to types**

In `packages/shared/src/types.ts`:
- Add `baseFuelPerJump: number;` to `HullDefinition` interface (after `baseApPerJump`)
- Add `fuelPerJump: number;` to `ShipStats` interface (after `apCostJump`)

**Step 3: Add baseFuelPerJump to HULLS**

In `packages/shared/src/constants.ts`, add `baseFuelPerJump` to each hull in HULLS:
```
scout:      baseFuelPerJump: 1,   // cheap
freighter:  baseFuelPerJump: 2,   // heavy
cruiser:    baseFuelPerJump: 1,   // efficient
explorer:   baseFuelPerJump: 1,   // efficient
battleship: baseFuelPerJump: 3,   // expensive
```

**Step 4: Update calculateShipStats**

In `packages/shared/src/shipCalculator.ts`, add to the stat calculation:
```ts
fuelPerJump: hull.baseFuelPerJump,
```
Note: No modules modify fuelPerJump for now (YAGNI — can add fuel recycler module later).

**Step 5: Run tests**

Run: `cd packages/shared && npx vitest run`
Expected: PASS

**Step 6: Use fuelPerJump in server jump handlers**

In `packages/server/src/rooms/SectorRoom.ts`:

Line 676, replace:
```ts
const fuelCost = 1;
```
with:
```ts
const ship = this.getShipForClient(client.sessionId);
const fuelCost = ship.fuelPerJump;
```

Line 812, replace:
```ts
const fuelCost = distance;
```
with:
```ts
const ship = this.getShipForClient(client.sessionId);
const fuelCost = distance * ship.fuelPerJump;
```

**Step 7: Display fuel/jump in HUD**

In `HUD.tsx`, after the fuel bar, add fuel-per-jump indicator:
```tsx
<span style={{ fontSize: '0.7rem', color: 'var(--color-dim)' }}>
  {ship?.stats.fuelPerJump ?? 1}/J
</span>
```

Add to store subscription:
```tsx
const ship = useStore((s) => s.ship);
```

**Step 8: Update NavControls jump button tooltips**

In `NavControls.tsx`, update the jump button title from:
```ts
title={`Jump: ${AP_COSTS.jump} AP`}
```
to:
```ts
title={`Jump: ${ship?.stats.apCostJump ?? 1} AP, ${ship?.stats.fuelPerJump ?? 1} Fuel`}
```

Add ship to store subscription at top of NavControls:
```tsx
const ship = useStore((s) => s.ship);
```

**Step 9: Update ClientShipData stats access in all components**

Search for any component that accesses `ship.stats` — `fuelPerJump` is a new field, so existing components won't break, but verify `CargoScreen`, `DetailPanel`, and `GameScreen.tsx` (ShipSysScreen schematic) display fuelPerJump where relevant.

In `GameScreen.tsx` `SchematicView`, add a `FUEL/J` line to the stats display alongside the existing FUEL, CARGO, JUMP, AP/J, SCAN, HP, COMM lines.

**Step 10: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 11: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts packages/shared/src/shipCalculator.ts packages/shared/src/shipCalculator.test.ts packages/server/src/rooms/SectorRoom.ts packages/client/src/components/HUD.tsx packages/client/src/components/NavControls.tsx packages/client/src/components/GameScreen.tsx
git commit -m "feat: add fuel-per-jump to hull system and display in HUD (#33)"
```

---

### Task 4: Free Refuel at Home Base (#33)

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts` (handleRefuel)
- Modify: `packages/client/src/components/DetailPanel.tsx` (refuel button label)
- Modify: `packages/shared/src/constants.ts` (new constant)
- Test: `packages/server/src/__tests__/` (refuel test)

**Context:** Issue #33 says refuel at home base should be free for the first 3 ships. Interpretation: if the player owns ≤3 ships total, refueling at their home base costs 0 credits. Players with >3 ships pay normal price at base.

**Step 1: Add constant**

In `packages/shared/src/constants.ts`:
```ts
export const FREE_REFUEL_MAX_SHIPS = 3;
```

**Step 2: Modify handleRefuel in SectorRoom.ts**

In `handleRefuel` (line 894-936), after the station/base check, add logic:

```ts
// Check if refuel is free (at home base, player has ≤ FREE_REFUEL_MAX_SHIPS ships)
const isHomeBase = this.state.sector.x === 0 && this.state.sector.y === 0; // TODO: use player's actual homeBase
let isFreeRefuel = false;
if (hasBaseHere || isHomeBase) {
  const playerShips = await getPlayerShips(auth.userId);
  if (playerShips.length <= FREE_REFUEL_MAX_SHIPS) {
    isFreeRefuel = true;
  }
}

const amount = Math.min(data.amount, tankSpace);
const cost = isFreeRefuel ? 0 : Math.ceil(amount * FUEL_COST_PER_UNIT);
```

Remove the existing cost calculation and credits check, replace with:
```ts
if (cost > 0) {
  const credits = await getPlayerCredits(auth.userId);
  if (credits < cost) {
    client.send('refuelResult', { success: false, error: 'Not enough credits' });
    return;
  }
  await deductCredits(auth.userId, cost);
}
```

**Step 3: Update DetailPanel refuel button label**

In `DetailPanel.tsx`, update the refuel button (line 107) to show "GRATIS" when at home base with ≤3 ships. The client doesn't know the ship count easily, so simplify: show "(X CR)" normally, and the server handles the free logic. The client can check:

```tsx
const shipList = useStore((s) => s.shipList);
const isHomeBase = position.x === homeBase.x && position.y === homeBase.y;
const isFreeRefuel = isHomeBase && shipList.length <= FREE_REFUEL_MAX_SHIPS;
```

Update button label:
```tsx
REFUEL {isFreeRefuel ? '(GRATIS)' : `(${Math.ceil((fuel.max - fuel.current) * FUEL_COST_PER_UNIT)} CR)`}
```

Import `FREE_REFUEL_MAX_SHIPS` from shared.

**Step 4: Run tests**

Run: `npm test`
Expected: All pass

**Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/server/src/rooms/SectorRoom.ts packages/client/src/components/DetailPanel.tsx
git commit -m "feat: free refuel at home base for players with ≤3 ships (#33)"
```

---

### Task 5: Partial Refuel + Reputation-Based Pricing (#35)

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx` (refuel UI)
- Modify: `packages/server/src/rooms/SectorRoom.ts` (handleRefuel pricing)
- Modify: `packages/shared/src/constants.ts` (if needed)

**Context:** Currently the refuel button fills the entire tank in one click. Issue #35 wants partial refueling and reputation-based pricing at stations. `REP_PRICE_MODIFIERS` already exists in shared constants (hostile=1.5, friendly=0.9, honored=0.75).

**Step 1: Add refuel slider UI to DetailPanel**

Replace the single refuel button with a refuel section. In `DetailPanel.tsx`, replace the refuel button block (lines 93-109) with:

```tsx
{isPlayerHere && fuel && fuel.current < fuel.max && (
  <RefuelPanel fuel={fuel} ship={ship} isFreeRefuel={isFreeRefuel} />
)}
```

Create a `RefuelPanel` component (inline in DetailPanel.tsx or as separate file):
```tsx
function RefuelPanel({ fuel, ship, isFreeRefuel }: {
  fuel: FuelState;
  ship: ClientShipData | null;
  isFreeRefuel: boolean;
}) {
  const [amount, setAmount] = useState(fuel.max - fuel.current);
  const tankSpace = fuel.max - fuel.current;
  const reputations = useStore((s) => s.reputations);
  const currentSector = useStore((s) => s.currentSector);

  // Find station faction reputation for price modifier
  const factionRep = currentSector?.faction
    ? reputations.find(r => r.factionId === currentSector.faction)
    : null;
  const repTier = factionRep?.tier ?? 'neutral';
  const priceModifier = REP_PRICE_MODIFIERS[repTier] ?? 1.0;
  const unitCost = isFreeRefuel ? 0 : Math.ceil(FUEL_COST_PER_UNIT * priceModifier);
  const totalCost = isFreeRefuel ? 0 : Math.ceil(amount * FUEL_COST_PER_UNIT * priceModifier);

  return (
    <div style={{ marginTop: 8, border: '1px solid var(--color-dim)', padding: '6px 8px' }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', marginBottom: 4 }}>
        REFUEL — {isFreeRefuel ? 'GRATIS' : `${unitCost} CR/u (${repTier.toUpperCase()})`}
      </div>
      <input
        type="range"
        min={1}
        max={tankSpace}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--color-primary)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginTop: 2 }}>
        <span>+{Math.floor(amount)} FUEL</span>
        <span>{totalCost > 0 ? `${totalCost} CR` : 'GRATIS'}</span>
      </div>
      <button
        className="vs-btn"
        style={{ width: '100%', marginTop: 4, fontSize: '0.75rem' }}
        onClick={() => network.sendRefuel(Math.floor(amount))}
      >
        [REFUEL]
      </button>
    </div>
  );
}
```

**Step 2: Add reputation-based pricing on server**

In `SectorRoom.ts` `handleRefuel`, after calculating `isFreeRefuel`, add reputation pricing:

```ts
// Apply reputation price modifier at stations
let priceModifier = 1.0;
if (isStation && !isFreeRefuel) {
  const sectorFaction = this.state.sector.faction;
  if (sectorFaction) {
    const rep = await getPlayerReputation(auth.userId, sectorFaction);
    const tier = getReputationTier(rep);
    priceModifier = REP_PRICE_MODIFIERS[tier] ?? 1.0;
  }
}

const cost = isFreeRefuel ? 0 : Math.ceil(amount * FUEL_COST_PER_UNIT * priceModifier);
```

Import `REP_PRICE_MODIFIERS` from shared and `getPlayerReputation` + helper to calculate tier from queries.

**Step 3: Run tests**

Run: `npm test`
Expected: All pass

**Step 4: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: partial refuel slider with reputation-based pricing (#35)"
```

---

## Phase 9: Nav & Detail Overhaul

### Task 6: Nav Grid 80% + Coordinate Frame (#38)

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts` (drawRadar)

**Context:** Currently the radar grid fills the entire canvas. Issue #38 wants max 80% of space used, with a coordinate frame like a chessboard (numbers on left, letters on bottom). The frame shows relative row/column labels for the visible grid.

**Step 1: Calculate grid bounds with margins**

In `drawRadar` (RadarRenderer.ts), after calculating `centerX`, `centerY`, add margin calculation:

```ts
// Coordinate frame margins
const FRAME_LEFT = 32;   // space for row numbers
const FRAME_BOTTOM = 20; // space for column letters
const FRAME_PAD = 8;     // padding on right/top

// Grid area bounded to ~80% of canvas
const gridLeft = FRAME_LEFT;
const gridTop = FRAME_PAD;
const gridRight = w - FRAME_PAD;
const gridBottom = h - FRAME_BOTTOM;
const gridW = gridRight - gridLeft;
const gridH = gridBottom - gridTop;

// Recalculate visible cells based on grid area (not full canvas)
const visibleCols = Math.floor(gridW / CELL_W);
const visibleRows = Math.floor(gridH / CELL_H);
const radiusX = Math.floor(visibleCols / 2);
const radiusY = Math.floor(visibleRows / 2);

// Grid center within bounded area
const gridCenterX = gridLeft + gridW / 2;
const gridCenterY = gridTop + gridH / 2;
```

Replace all references to `centerX`/`centerY` in the cell drawing loop with `gridCenterX`/`gridCenterY`.

Remove the old `calculateVisibleRadius` call and use the new `radiusX`/`radiusY`.

**Step 2: Draw coordinate frame**

After the main grid loop, draw the frame:

```ts
// Draw coordinate frame
ctx.font = `${coordSize}px 'Share Tech Mono', monospace`;
ctx.fillStyle = state.dimColor;
ctx.textBaseline = 'middle';
ctx.textAlign = 'right';

// Row numbers (left side) — use galaxy Y coordinates
for (let dy = -radiusY; dy <= radiusY; dy++) {
  const sy = viewY + dy;
  const cellY = gridCenterY + dy * CELL_H;
  ctx.fillText(String(sy), FRAME_LEFT - 4, cellY);
}

// Column letters (bottom) — use galaxy X coordinates
ctx.textAlign = 'center';
ctx.textBaseline = 'top';
for (let dx = -radiusX; dx <= radiusX; dx++) {
  const sx = viewX + dx;
  const cellX = gridCenterX + dx * CELL_W;
  ctx.fillText(String(sx), cellX, gridBottom + 2);
}

// Frame border lines
ctx.strokeStyle = state.dimColor.replace(/[\d.]+\)$/, '0.6)');
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(gridLeft - 1, gridTop - 1);
ctx.lineTo(gridRight + 1, gridTop - 1);
ctx.lineTo(gridRight + 1, gridBottom + 1);
ctx.lineTo(gridLeft - 1, gridBottom + 1);
ctx.closePath();
ctx.stroke();
```

**Step 3: Update calculateVisibleRadius export**

Update the exported `calculateVisibleRadius` to account for margins (used by other components to calculate visible sector count):

```ts
export function calculateVisibleRadius(canvasW: number, canvasH: number, zoomLevel: number): { radiusX: number; radiusY: number } {
  const { w, h } = CELL_SIZES[zoomLevel] ?? CELL_SIZES[2];
  const gridW = canvasW - 40; // FRAME_LEFT + FRAME_PAD
  const gridH = canvasH - 28; // FRAME_BOTTOM + FRAME_PAD
  const radiusX = Math.max(2, Math.floor(gridW / w / 2));
  const radiusY = Math.max(2, Math.floor(gridH / h / 2));
  return { radiusX, radiusY };
}
```

**Step 4: Verify visually**

Run: `npm run dev:client`
Check that the radar grid has a coordinate frame with galaxy coordinates on left and bottom, grid uses ~80% of canvas.

**Step 5: Run tests**

Run: `npm test`
Expected: All pass

**Step 6: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat(client): add coordinate frame and 80% grid layout to radar (#38)"
```

---

### Task 7: Dynamic Detail Level by Zoom (#37)

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts` (sector cell rendering)

**Context:** Currently all zoom levels show the same info per cell (symbol + label at zoom≥1, feature dots at zoom≥2, other players at zoom≥3). Issue #37 wants more granularity:

| Zoom | Detail |
|------|--------|
| 0 | Sector type symbol only, no labels, no coordinates per cell |
| 1 | + Sector label below symbol, coordinates per cell |
| 2 | + Feature dots, structure indicators, resource type icon |
| 3 | + Other players, sector border glow for structures, full detail |

**Step 1: Refactor sector cell rendering**

In `drawRadar`, reorganize the cell rendering within the main loop. The key changes:

**Zoom 0 — minimal:**
- Draw sector type symbol only (centered, no label)
- Skip per-cell `(x,y)` coordinates (the frame handles this now)
- Skip feature dots, player icons
- Use smaller symbol

**Zoom 1 — labeled:**
- Draw sector type symbol + label ("STATION", "ASTEROID" etc.)
- Per-cell coords shown
- Skip feature dots

**Zoom 2 — detailed:**
- All of zoom 1 plus:
- Feature dots (jumpgate, scan events)
- If sector has structures (mining_station, comm_relay etc.), draw a small `◊` indicator
- If sector has resources, show resource type initial (O/G/C) in corner

**Zoom 3 — full:**
- All of zoom 2 plus:
- Other player hull icons
- Sector border highlighted for sectors with structures (subtle glow)
- Player names shown next to hull icons

Implement by wrapping existing blocks in `if (state.zoomLevel >= N)` conditions, adjusting what's shown at each level.

**Step 2: Remove per-cell coordinates at zoom 0**

The current code draws `(sx,sy)` in every cell at line 115. Wrap this in `if (state.zoomLevel >= 1)`.

**Step 3: Add structure indicators at zoom 2+**

After the feature dots block, add:
```ts
// Structure indicators — zoom >= 2
if (state.zoomLevel >= 2 && sector && sector.structures && sector.structures.length > 0) {
  ctx.font = `${coordSize}px 'Share Tech Mono', monospace`;
  ctx.fillStyle = '#FFB000';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('◊', cellX + CELL_W / 2 - 3, cellY - CELL_H / 2 + 3);
}
```

Note: Check if `sector.structures` exists in the `SectorData` type. If not, this data may need to come from the discovery data. Use what's available — if structures aren't in SectorData, skip this sub-step and add it when structures are part of discovery data.

**Step 4: Add player names at zoom 3**

In the other-players block (line 185+), after drawing the hull icon, add player name:
```ts
if (state.zoomLevel >= 3) {
  ctx.font = COORD_FONT;
  ctx.fillStyle = otherColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(player.username?.slice(0, 8) ?? '', px + 10, py);
}
```

**Step 5: Verify each zoom level visually**

Run: `npm run dev:client`
Use BezelKnob to cycle through zoom 0→3 and verify each level shows progressively more detail.

**Step 6: Commit**

```bash
git add packages/client/src/canvas/RadarRenderer.ts
git commit -m "feat(client): zoom-dependent detail levels in radar grid (#37)"
```

---

### Task 8: Detail View Overlay System (#32)

**Files:**
- Modify: `packages/client/src/state/uiSlice.ts` (add detailView state)
- Modify: `packages/client/src/components/DesktopLayout.tsx` (overlay rendering)
- Create: `packages/client/src/components/DetailViewOverlay.tsx`
- Modify: `packages/client/src/components/DetailPanel.tsx` (clickable items)

**Context:** Issue #32 wants: clicking an item in the DetailPanel opens a full detail view in the main window area (where NAV grid normally is). The view shows CRT pixel art + info, with an X button to close. This is an overlay on top of the main grid, not a monitor switch.

**Step 1: Add detailView state to uiSlice**

In `packages/client/src/state/uiSlice.ts`, add:

Interface:
```ts
detailView: { type: string; data?: any } | null;
setDetailView: (view: { type: string; data?: any } | null) => void;
```

Implementation:
```ts
detailView: null,
setDetailView: (view) => set({ detailView: view }),
```

Types for `type` will be: `'planet'`, `'station'`, `'asteroid'`, `'nebula'`, `'ship'`, `'empty'`, `'home_base'`.

**Step 2: Create DetailViewOverlay component**

Create `packages/client/src/components/DetailViewOverlay.tsx`:

```tsx
import { useStore } from '../state/store';

const SECTOR_ART: Record<string, string[]> = {
  station: [
    '         ╔═══╗         ',
    '    ═════╣   ╠═════    ',
    '    ║    ║   ║    ║    ',
    '    ║  ╔═╩═══╩═╗  ║    ',
    '    ╚══╣ DOCK  ╠══╝    ',
    '       ║  BAY  ║       ',
    '    ╔══╣       ╠══╗    ',
    '    ║  ╚═╦═══╦═╝  ║    ',
    '    ║    ║   ║    ║    ',
    '    ═════╣   ╠═════    ',
    '         ╚═══╝         ',
  ],
  asteroid: [
    '                        ',
    '       ╱▓▓▓▓╲          ',
    '     ╱▓▓░░▓▓▓╲         ',
    '    │▓▓░░░░▓▓▓│        ',
    '    │▓░░▓▓░░▓▓│        ',
    '    │▓▓░░░░▓▓│         ',
    '     ╲▓▓▓▓▓▓╱          ',
    '       ╲▓▓╱            ',
    '                        ',
  ],
  nebula: [
    '   ·  .  ·    ·  .     ',
    '  . ·░░░░░·  ·  .  ·   ',
    ' ·░░░▒▒▒░░░░·    .     ',
    '░░▒▒▒▓▓▓▒▒░░░  ·   ·  ',
    '░▒▓▓▓████▓▒▒░░░  .     ',
    '░░▒▒▓▓▓▓▒▒░░░  ·   .  ',
    '  ·░░░▒▒░░░·    ·      ',
    '   · .░░░·  .  ·   ·   ',
    '    ·   .   ·     .    ',
  ],
  planet: [
    '        ╭──────╮        ',
    '      ╭─┤░░░░░░├─╮      ',
    '    ╭─┤░░▒▒▒▒░░░░├─╮    ',
    '    │░░░▒▒████▒▒░░░│    ',
    '    │░░▒▒████████▒░│    ',
    '    │░░░▒▒████▒▒░░░│    ',
    '    ╰─┤░░▒▒▒▒░░░░├─╯    ',
    '      ╰─┤░░░░░░├─╯      ',
    '        ╰──────╯        ',
  ],
  empty: [
    '                        ',
    '    ·       ·     ·     ',
    '        ·        ·      ',
    '   ·        ·           ',
    '       · VOID ·         ',
    '    ·        ·      ·   ',
    '        ·       ·       ',
    '   ·        ·     ·     ',
    '                        ',
  ],
  home_base: [
    '         ╔═╗            ',
    '       ╔═╝ ╚═╗          ',
    '     ╔═╝ H B ╚═╗        ',
    '   ══╣  HOME   ╠══      ',
    '     ║  BASE   ║        ',
    '   ══╣         ╠══      ',
    '     ╚═╗     ╔═╝        ',
    '       ╚═╗ ╔═╝          ',
    '         ╚═╝            ',
  ],
  ship: [
    '          ╱╲            ',
    '         ╱  ╲           ',
    '        ╱ ◊◊ ╲          ',
    '       ┌──────┐         ',
    '     ══╡ SHIP ╞══       ',
    '       │      │         ',
    '       └──┬┬──┘         ',
    '          ╲╱            ',
    '                        ',
  ],
};

export function DetailViewOverlay() {
  const detailView = useStore((s) => s.detailView);
  const setDetailView = useStore((s) => s.setDetailView);
  const currentSector = useStore((s) => s.currentSector);

  if (!detailView) return null;

  const art = SECTOR_ART[detailView.type] ?? SECTOR_ART.empty;
  const sectorType = detailView.type.toUpperCase().replace('_', ' ');

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(5, 5, 5, 0.95)',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
    }}>
      {/* Close button */}
      <button
        className="vs-btn"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          fontSize: '1rem',
          padding: '2px 8px',
          zIndex: 11,
        }}
        onClick={() => setDetailView(null)}
      >
        [X]
      </button>

      {/* Header */}
      <div style={{
        fontSize: '0.9rem',
        letterSpacing: '0.2em',
        marginBottom: 16,
        borderBottom: '1px solid var(--color-dim)',
        paddingBottom: 8,
      }}>
        DETAIL VIEW — {sectorType}
      </div>

      {/* ASCII Art */}
      <div style={{
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        fontSize: '1.1rem',
        lineHeight: 1.4,
        color: 'var(--color-primary)',
        textAlign: 'center',
        marginBottom: 16,
        textShadow: '0 0 8px var(--color-primary)',
      }}>
        {art.map((line, i) => (
          <div key={i} style={{ whiteSpace: 'pre' }}>{line}</div>
        ))}
      </div>

      {/* Info panel */}
      <div style={{
        fontSize: '0.8rem',
        letterSpacing: '0.1em',
        color: 'var(--color-dim)',
        lineHeight: 1.6,
      }}>
        {detailView.data?.name && (
          <div>NAME: <span style={{ color: 'var(--color-primary)' }}>{detailView.data.name}</span></div>
        )}
        {detailView.data?.faction && (
          <div>FACTION: <span style={{ color: 'var(--color-primary)' }}>{detailView.data.faction}</span></div>
        )}
        {detailView.data?.resources && (
          <div>RESOURCES: <span style={{ color: 'var(--color-primary)' }}>{detailView.data.resources}</span></div>
        )}
        {detailView.data?.description && (
          <div style={{ marginTop: 8 }}>{detailView.data.description}</div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Integrate overlay into DesktopLayout**

In `packages/client/src/components/DesktopLayout.tsx`, the main grid area needs to support the overlay. Modify `GameScreen.tsx` instead — wrap the gridArea's inner content:

In `GameScreen.tsx`, modify `gridArea`:
```tsx
const gridArea = (
  <MonitorBezel monitorId="NAV-COM">
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <RadarCanvas />
      </div>
      <DetailViewOverlay />
    </div>
  </MonitorBezel>
);
```

Import `DetailViewOverlay` at top of GameScreen.tsx.

**Step 4: Make DetailPanel items clickable**

In `DetailPanel.tsx`, the sector type label and any notable features should be clickable. Find where sector type is displayed and wrap it:

```tsx
<span
  style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
  onClick={() => setDetailView({
    type: currentSector?.type ?? 'empty',
    data: {
      name: currentSector?.type?.toUpperCase(),
      faction: currentSector?.faction,
      resources: currentSector?.resource,
    },
  })}
>
  {currentSector?.type?.toUpperCase() || '---'}
</span>
```

Add store access: `const setDetailView = useStore((s) => s.setDetailView);`

For players in the sector, make their names clickable to show the ship detail:
```tsx
onClick={() => setDetailView({ type: 'ship', data: { name: player.username } })}
```

**Step 5: Verify visually**

Run: `npm run dev:client`
Click on sector type in detail panel → overlay should appear with ASCII art.
Click [X] → overlay should close.

**Step 6: Run tests**

Run: `npm test`
Expected: All pass

**Step 7: Commit**

```bash
git add packages/client/src/state/uiSlice.ts packages/client/src/components/DetailViewOverlay.tsx packages/client/src/components/GameScreen.tsx packages/client/src/components/DetailPanel.tsx
git commit -m "feat(client): add detail view overlay with CRT ASCII art (#32)"
```

---

## Summary

| Task | Issue | What |
|------|-------|------|
| 0 | #34 | Rename JETTISON → ABWERFEN |
| 1 | #36 | Credits display in HUD |
| 2 | #36 | Alien credits infrastructure (DB, types, store, UI) |
| 3 | #33 | Fuel per jump per hull type + display |
| 4 | #33 | Free refuel at home base (≤3 ships) |
| 5 | #35 | Partial refuel slider + reputation pricing |
| 6 | #38 | Nav grid 80% + coordinate frame |
| 7 | #37 | Zoom-dependent detail levels |
| 8 | #32 | Detail view overlay with CRT ASCII art |

**Total: 9 tasks across Phase 8 (tasks 0-5) and Phase 9 (tasks 6-8).**
