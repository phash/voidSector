# ACEP Program Selector Polish — Design Spec (#275)

## Goal

Improve readability and visual clarity of the program selector (Sec 1) and monitor labels.

## Scope

CSS-only changes in `packages/client/src/styles/crt.css`. No logic, no components, no server changes. Modul-Artworks ausgelagert in #301.

## Changes

| Selector | Property | Before | After |
|----------|----------|--------|-------|
| `.program-btn` | `font-size` | `0.75rem` | `0.9rem` |
| `.program-btn` | `color` | `var(--color-dim)` | `#777` |
| `.program-btn.active` | `background` | `rgba(255,176,0,0.08)` | `rgba(255,176,0,0.12)` |
| `.program-btn.active` | `box-shadow` | — | `inset 0 0 12px rgba(255,176,0,0.06)` |
| `.program-btn.active .program-led` | `box-shadow` | — | `0 0 4px currentColor` |
| `.unified-bezel-program-label` | `font-size` | `0.51rem` | `0.6rem` |
| `.unified-bezel-program-label` | `color` | `rgba(255,176,0,0.5)` | `rgba(255,176,0,0.65)` |
| `.unified-bezel-sidebar .unified-bezel-program-label` | `font-size` | `0.43rem` | `0.5rem` |

## Acceptance Criteria

- [ ] Program buttons are visibly larger and more readable
- [ ] Active program button has a clearly distinguishable glow effect
- [ ] Monitor header labels are larger and brighter
- [ ] No visual regressions in other cockpit sections
