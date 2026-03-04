# Sprint A — UI Polish Plan
# Issues: #50, #51, #52, #53
# Branch: fix/sprint-a-ui-polish

---

## Task 1: #50 — Zoom-4 (3×3) larger text + weaker CRT fade

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/styles/crt.css`

**Goal:** In the 3×3 detail view (zoom level 4), text and icons are too small. Also the CRT vignette fade is too strong globally.

### Changes to RadarRenderer.ts

In the zoom-4 block (around line 52-58), the CELL_SIZES for zoom 4 are computed dynamically. The font sizes used in the detail view section need to be larger.

Find the `isDetailView` block (zoom 4) and increase:
- Sector type label (currently fontSize ~14): increase to 20px
- Resource lines (Ore/Gas/Cry, currently 10px): increase to 13px
- Discovery age line (currently 10px): increase to 12px
- Hull icon pixel size for zoom 4: `2 + state.zoomLevel` = 6 → use `Math.max(8, 2 + state.zoomLevel)` → 8px

Specifically, find the detail view rendering section that draws:
- Sector type text at top of cell
- Ore/Gas/Crystal values
- Discovery age

And update the `ctx.font` calls to use larger sizes.

Also: in zoom 4, the cell-type symbol is drawn at the CELL_SIZES fontSize (which for zoom 4 is derived dynamically, likely 14px). For zoom 4 specifically, use 22px for the main type symbol.

### Changes to crt.css

Find the CRT vignette overlay. It is a pseudo-element or a div with a radial gradient. Change:
- `rgba(0, 0, 0, 0.2)` → `rgba(0, 0, 0, 0.06)` (much more subtle)
- If gradient goes from transparent at 75% to black at 100%, keep the 75% stop but reduce the endpoint opacity

**Test:** `cd packages/client && npx vitest run`

**Commit:** `fix: larger text/icons in zoom-4 detail view, reduce CRT vignette (#50)`

---

## Task 2: #52 — Active sector pulsing + bookmark colored borders

**Files:**
- Modify: `packages/client/src/canvas/RadarRenderer.ts`
- Modify: `packages/client/src/components/RadarCanvas.tsx`

**Goal:**
1. The player's current sector gets a thick (4px) animated pulsing border
2. Each bookmarked sector gets a thin colored border matching its bookmark slot color
3. The selected sector gets a slightly thicker highlighted border (already partially exists)

### Bookmark colors (7 slots)

```ts
const BOOKMARK_COLORS: Record<number, string> = {
  0: '#33FF33',   // HOME
  1: '#FF6644',   // Slot 1 — red-orange
  2: '#44AAFF',   // Slot 2 — blue
  3: '#FFDD22',   // Slot 3 — yellow
  4: '#44FF88',   // Slot 4 — green
  5: '#FF44FF',   // Slot 5 — magenta
  6: '#FFAA33',   // SHIP (slot 6 or -1 — use own position, skip)
};
```

Bookmark `slot` values from the `Bookmark` interface:
- `slot: 0` = HOME
- `slot: 1-5` = custom slots

### Changes to RadarState interface

Add to `RadarState`:
```ts
bookmarks?: Array<{ slot: number; sectorX: number; sectorY: number }>;
animTime?: number; // performance.now() for pulse animation
```

### Changes to RadarCanvas.tsx

In the `draw` callback, pass additional data to `drawRadar`:
```ts
bookmarks: state.bookmarks,
animTime: performance.now(),
```

### Changes to RadarRenderer.ts

1. Add `BOOKMARK_COLORS` constant at top of file.

2. Build a lookup map at the start of `drawRadar`:
```ts
const bookmarkMap = new Map<string, number>(); // key → slot number
for (const bm of (state.bookmarks ?? [])) {
  bookmarkMap.set(`${bm.sectorX},${bm.sectorY}`, bm.slot);
}
```

3. In the cell rendering loop, after checking `isPlayer`:
```ts
const bmSlot = bookmarkMap.get(`${sx},${sy}`);
```

4. After drawing the cell fill, draw bookmark border if present:
```ts
if (bmSlot !== undefined && BOOKMARK_COLORS[bmSlot]) {
  ctx.strokeStyle = BOOKMARK_COLORS[bmSlot];
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cellX - CELL_W/2 + 1, cellY - CELL_H/2 + 1, CELL_W - 2, CELL_H - 2);
}
```

5. For the player sector pulsing border, replace the current plain border with:
```ts
if (isPlayer) {
  const t = state.animTime ?? 0;
  const pulse = 0.6 + 0.4 * Math.sin(t / 400); // 0.6–1.0, ~1.5Hz
  const borderAlpha = Math.round(pulse * 255).toString(16).padStart(2, '0');
  ctx.strokeStyle = state.themeColor + borderAlpha;
  ctx.lineWidth = 3 + pulse * 1.5; // 3–4.5px, pulsing
  ctx.strokeRect(cellX - CELL_W/2 + 1, cellY - CELL_H/2 + 1, CELL_W - 2, CELL_H - 2);
}
```

**Test:** `cd packages/client && npx vitest run`

**Commit:** `feat: pulsing active sector border and bookmark-colored borders (#52)`

---

## Task 3: #53 — Radar legend X-button + item click popup

**Files:**
- Modify: `packages/client/src/components/LegendOverlay.tsx`

**Goal:**
1. Add an X button (top-right corner of the legend box)
2. When clicking on a legend item, show an expanded popup with a description

### X-button

Add a close button at top-right of the legend panel:
```tsx
<button
  onClick={onClose}
  style={{
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'none',
    border: 'none',
    color: 'var(--color-primary)',
    fontSize: '1rem',
    cursor: 'pointer',
    lineHeight: 1,
    fontFamily: 'var(--font-mono)',
  }}
  title="Schließen"
>✕</button>
```

The legend container needs `position: 'relative'`.

### Item click popup

Descriptions for each legend item:

```ts
const LEGEND_DESCRIPTIONS: Record<string, string> = {
  'YOUR SHIP': 'Dein Raumschiff. Bewege dich mit Klick auf benachbarte Sektoren.',
  'HOME BASE': 'Deine Heimatbasis. Starte hier Upgrades und lagere Ressourcen.',
  'OTHER PLAYER': 'Ein anderer Spieler ist in diesem Sektor.',
  'empty': 'Leerer Sektor. Kein bekannter Inhalt.',
  'station': 'Raumstation. Handel, Reparatur, Schiffs-Upgrades.',
  'asteroid_field': 'Asteroidenfeld. Enthält Erz-Ressourcen zum Mining.',
  'nebula': 'Nebula. Enthält Gas-Ressourcen. Area-Scan zeigt nur Nebel.',
  'anomaly': 'Anomalie. Seltenes Ereignis mit Erfahrungs- und Ruf-Boni.',
  'pirate': 'Piraten-Territorium. Hohes Kampfrisiko.',
};
```

Add `selectedItem: string | null` local state. On click of a legend item, set `selectedItem`. Show popup below the item with the description. Click elsewhere or on X closes the popup.

**Test:** `cd packages/client && npx vitest run`

**Commit:** `feat: legend X-close button and item description popup (#53)`

---

## Task 4: #51 — Rotary knobs → CRT vertical sliders

**Files:**
- Modify: `packages/client/src/components/BezelKnob.tsx`
- Modify: `packages/client/src/styles/crt.css` (optional: slider styles)

**Goal:** Replace the rotary knob interaction (drag up/down) with a proper vertical HTML range slider styled in CRT aesthetic.

### New BezelKnob implementation

The component keeps the same props interface but renders a vertical `<input type="range">` instead of the circular knob:

```tsx
export function BezelKnob({ label, value, min, max, step = 0.01, onChange }: BezelKnobProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      userSelect: 'none',
    }}>
      <span style={{
        fontSize: '0.55rem',
        color: 'var(--color-dim)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          writingMode: 'vertical-lr',
          direction: 'rtl',
          height: '80px',
          width: '20px',
          cursor: 'pointer',
          accentColor: 'var(--color-primary)',
          background: 'transparent',
        }}
      />
      <span style={{
        fontSize: '0.55rem',
        color: 'var(--color-primary)',
        letterSpacing: '0.05em',
      }}>{typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : value}</span>
    </div>
  );
}
```

IMPORTANT: Check the current `BezelKnobProps` interface in BezelKnob.tsx first and preserve all existing props. The `step` for ZOOM is 1 (integer steps 0–4), for PAN it's 1, for BRIGHTNESS it's 0.01.

For ZOOM: step=1, min=0, max=4, value=zoomLevel (integer)
For PAN: step=1, min=-3, max=3 (or whatever range is used)
For BRIGHTNESS: step=0.05, min=0.5, max=1.5

**Test:** `cd packages/client && npx vitest run`

**Commit:** `feat: replace rotary knobs with CRT vertical sliders (#51)`

---

## Task 5: Run full suite + close issues + push

```bash
cd packages/shared && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

Close issues:
```bash
gh issue close 50 --comment "Done: larger text/icons in 3×3 zoom view, CRT vignette reduced."
gh issue close 52 --comment "Done: pulsing thick border on player sector, bookmark-colored borders on grid."
gh issue close 53 --comment "Done: X-close button on legend, item click popup with descriptions."
gh issue close 51 --comment "Done: rotary knobs replaced with CRT vertical range sliders."
```

Push:
```bash
git push -u origin fix/sprint-a-ui-polish
```
