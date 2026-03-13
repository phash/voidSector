# Modul-Artworks im ACEP Detail-Panel — Design Spec (#301)

## Goal

Procedural Canvas pixel-art (48×48px) per module category with tier-dependent glow in the AcepDetailPanel.

## Scope

New React component `ModuleArtwork.tsx` + integration into `AcepDetailPanel.tsx`. No server changes.

## Architecture

### New File: `packages/client/src/components/ModuleArtwork.tsx`

React component using `<canvas>` element (48×48 CSS pixels, 96×96 actual for retina).

**Props:**
- `category: ModuleCategory` — one of 11 categories
- `tier: number` — 1–5, controls glow intensity

**Tier → Glow Mapping:**

| Tier | Glow Intensity (shadowBlur) | Color Brightness |
|------|----------------------------|-----------------|
| 1 | 0.15 (≈3px blur) | 50% — dim, barely visible |
| 2 | 0.30 (≈6px blur) | 65% |
| 3 | 0.45 (≈9px blur) | 75% |
| 4 | 0.60 (≈12px blur) | 90% |
| 5 | 0.75 (≈15px blur) | 100% — full bright, strong glow |

**Category Color:** Amber `#FFB000` base for all categories (CRT theme). Glow uses same color with alpha.

### 11 Draw Routines

Each category gets a distinct silhouette drawn with simple geometric shapes (rects, arcs, lines):

| Category | Icon Concept |
|----------|-------------|
| drive | Thruster nozzle with exhaust lines |
| cargo | Container/crate outline |
| scanner | Radar dish with sweep arc |
| armor | Chevron/plate layers |
| weapon | Barrel with muzzle flash |
| shield | Dome/bubble arc |
| defense | Turret with rotation base |
| special | Diamond/crystal shape |
| mining | Drill bit with particles |
| generator | Lightning bolt / energy cell |
| repair | Wrench / tool cross |

### Integration: `AcepDetailPanel.tsx`

Insert `<ModuleArtwork>` above the module name, centered:

```tsx
<ModuleArtwork category={mod.category} tier={mod.tier} />
<div className="module-name">{mod.name}</div>
```

The component renders inside the existing SHOP/MODULE detail view when a module is hovered/selected.

## Acceptance Criteria

- [ ] Canvas renders 48×48px artwork for each of the 11 categories
- [ ] Glow intensity scales with tier (T1 dim → T5 bright)
- [ ] Artwork is centered above module name in AcepDetailPanel
- [ ] No visual regressions in other ACEP panel sections
- [ ] CRT amber color scheme maintained
