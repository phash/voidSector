# UI Clarity — bigger fonts + disabled-action hints

**Date:** 2026-05-29 · **Status:** approved (design)

## Goal
Make the UI clearer: (1) larger, more legible default text with a user size control; (2) on-hover tooltips explaining why a core action is currently not possible.

## A) Typography
- **Bigger default:** `:root` font-size 23 → **25px** (`global.css`). All fonts are `rem`-anchored, so this scales the whole UI proportionally (the ~7 `px` outliers are intentional bezel chrome and stay).
- **Higher contrast:** `--color-dim` alpha 0.6 → **0.75** in `global.css` AND in all 4 profiles in `themes.ts` (color profiles override `--color-dim` at runtime, so both must change).
- **Size control:** new `fontScale` in `uiSlice` (localStorage `vs-font-scale`, default 1.0), applied in `GameScreen` via `document.documentElement.style.fontSize = ${BASE_FONT_PX * fontScale}px` (BASE_FONT_PX = 25). `SettingsPanel` gets an **S / M / L** segmented control → fontScale 0.92 / 1.0 / 1.16 (≈ 23 / 25 / 29px), default M. New i18n key `settings.fontSize`.

## B) Disabled-action hover hints
- New reusable **`Hint`** component (`components/Hint.tsx`): `<Hint reason={string|null}>{children}</Hint>`. When `reason` is set, wraps children in a relative hover span and shows a CRT-styled tooltip (dark bg, amber border, mono, small) above on hover. `reason == null` → renders children unchanged. The hover lives on the WRAPPER (disabled buttons don't emit hover events themselves).
- Applied to ~8 core actions, deriving a reason string from the existing disable conditions, reusing flat i18n `reasons.*` keys (`noAp`, `insufficientCredits`, `cargoFull`, `notAtStation`, `miningActive`, `outOfRange`) + new keys (`insufficientResources`, `insufficientWissen`, `techLocked`, `maxLevel`):
  - Navigate/Jump + Local/Area Scan (`NavControls`) — mining active / not enough AP
  - Mine (`MiningScreen`/mobile) — no minable resource / not enough AP / cargo full
  - Buy/Sell (`NpcTradeView`) — not enough credits / not enough goods
  - Station + module repair (`RepairPanel`) — not enough credits / resources
  - ACEP boost (`AcepTab`) — max level / not enough credits / Wissen
  - Research/buy tech (`TechScreen`) — not enough Wissen / tech locked
- A `reason` helper per site (small inline function) maps the booleans to a localized string. No global "disabled reason" engine (YAGNI).

## Testing
- `fontScale` application: GameScreen sets root font-size from the store value (unit/integration).
- `Hint`: renders children only when `reason` null; shows tooltip with the reason text on mouse-enter, hides on leave (RTL).
- One targeted test per touched screen asserting the disabled action carries a hint reason (where practical).

## Out of scope (YAGNI)
- Tooltips on every disabled button app-wide (only the core actions).
- Animations/transitions on the tooltip; tooltip auto-positioning/flipping (fixed above-center placement).
- Applying `brightness` to the DOM (pre-existing unused setting — untouched).
