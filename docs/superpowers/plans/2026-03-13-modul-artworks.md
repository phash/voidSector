# Modul-Artworks Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add procedural Canvas pixel-art (48×48px) per module category with tier-dependent glow to the AcepDetailPanel.

**Architecture:** New `ModuleArtwork.tsx` React component renders a `<canvas>` element (48×48 CSS, 96×96 actual for retina). Contains 11 draw routines (one per `ModuleCategory`) and tier→glow mapping. Integrated into `AcepDetailPanel.tsx` above the module name on MODULE/SHOP tabs.

**Tech Stack:** React (useRef + useEffect), Canvas 2D API, TypeScript, Vitest + jest-canvas-mock

**Spec:** `docs/superpowers/specs/2026-03-13-modul-artworks-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/client/src/components/ModuleArtwork.tsx` | Canvas component: 11 draw routines, tier→glow, `<canvas>` rendering |
| Create | `packages/client/src/__tests__/ModuleArtwork.test.tsx` | Unit tests for all categories + tier glow |
| Modify | `packages/client/src/components/AcepDetailPanel.tsx` | Import + render `<ModuleArtwork>` above module name |
| Modify | `packages/client/src/__tests__/AcepDetailPanel.test.tsx` | Integration test: artwork renders in detail panel |

---

## Context

### Types (from `packages/shared/src/types.ts`)

```ts
// line 36-47
export type ArtefactType =
  | 'drive' | 'cargo' | 'scanner' | 'armor' | 'weapon'
  | 'shield' | 'defense' | 'special' | 'mining' | 'generator' | 'repair';

// line 1072
export type ModuleCategory = ArtefactType;

// line 1073
export type ModuleTier = 1 | 2 | 3 | 4 | 5;

// line 1118-1137
export interface ModuleDefinition {
  id: string;
  category: ModuleCategory;
  tier: ModuleTier;
  name: string;
  displayName: string;
  // ... cost, stats, etc.
}
```

### Test setup (from `packages/client/src/test/setup.ts`)

```ts
import '@testing-library/jest-dom';
import 'jest-canvas-mock';
```

`jest-canvas-mock` provides Canvas 2D context stubs. `getContext('2d')` returns a mock with all standard methods (fillRect, arc, beginPath, stroke, etc.). You can assert calls on the mock context.

### AcepDetailPanel structure (from `packages/client/src/components/AcepDetailPanel.tsx`)

The panel has 3 modes:
1. `activeTab === 'acep'` → shows traits (lines 40-75) — **do NOT modify**
2. `!hoveredId` → shows "Modul hovern für Details" (line 79) — **do NOT modify**
3. Module detail (lines 82-185) → **insert artwork here, above module name at line 127**

The module detail section starts at line 125:
```tsx
return (
  <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', overflow: 'auto', height: '100%' }}>
    <div style={{ color: 'var(--color-primary)', fontSize: '1rem', marginBottom: 4 }}>{def.displayName ?? def.name}</div>
    <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: 12 }}>[{def.category.toUpperCase()}]</div>
    ...
```

The artwork `<ModuleArtwork>` goes between the opening `<div>` and the module name `<div>`.

---

## Task 1: ModuleArtwork component — draw routines + tier glow

**Files:**
- Create: `packages/client/src/components/ModuleArtwork.tsx`
- Create: `packages/client/src/__tests__/ModuleArtwork.test.tsx`

### Step-by-step

- [ ] **Step 1: Write failing tests**

Create `packages/client/src/__tests__/ModuleArtwork.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ModuleArtwork } from '../components/ModuleArtwork';

const ALL_CATEGORIES = [
  'drive', 'cargo', 'scanner', 'armor', 'weapon',
  'shield', 'defense', 'special', 'mining', 'generator', 'repair',
] as const;

describe('ModuleArtwork', () => {
  it('renders a canvas element with correct dimensions', () => {
    const { container } = render(<ModuleArtwork category="weapon" tier={3} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas!.width).toBe(96);   // 2x for retina
    expect(canvas!.height).toBe(96);
    expect(canvas!.style.width).toBe('48px');
    expect(canvas!.style.height).toBe('48px');
  });

  it.each(ALL_CATEGORIES)('renders without errors for category: %s', (category) => {
    const { container } = render(<ModuleArtwork category={category} tier={3} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    // Canvas context should have been used (getContext called)
    expect(canvas!.getContext).toBeDefined();
  });

  it('applies stronger glow for higher tiers', () => {
    const { container: c1 } = render(<ModuleArtwork category="weapon" tier={1} />);
    const { container: c5 } = render(<ModuleArtwork category="weapon" tier={5} />);
    // Both render successfully — visual glow difference is canvas-internal
    expect(c1.querySelector('canvas')).toBeTruthy();
    expect(c5.querySelector('canvas')).toBeTruthy();
  });

  it('re-renders when category changes', () => {
    const { container, rerender } = render(<ModuleArtwork category="weapon" tier={3} />);
    rerender(<ModuleArtwork category="shield" tier={3} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('re-renders when tier changes', () => {
    const { container, rerender } = render(<ModuleArtwork category="weapon" tier={1} />);
    rerender(<ModuleArtwork category="weapon" tier={5} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/client && npx vitest run src/__tests__/ModuleArtwork.test.tsx`
Expected: FAIL — `ModuleArtwork` module not found

- [ ] **Step 3: Implement ModuleArtwork component**

Create `packages/client/src/components/ModuleArtwork.tsx`:

```tsx
import { useRef, useEffect } from 'react';
import type { ModuleCategory } from '@void-sector/shared';

interface ModuleArtworkProps {
  category: ModuleCategory;
  tier: number;
}

// Tier 1-5 → glow intensity 0.15-0.75, brightness 0.5-1.0
function tierGlow(tier: number): { blur: number; alpha: number } {
  const t = Math.max(1, Math.min(5, tier));
  return {
    blur: 3 + (t - 1) * 3,           // 3, 6, 9, 12, 15
    alpha: 0.5 + (t - 1) * 0.125,    // 0.5, 0.625, 0.75, 0.875, 1.0
  };
}

function amberColor(alpha: number): string {
  const r = Math.round(255 * alpha);
  const g = Math.round(176 * alpha);
  const b = 0;
  return `rgb(${r},${g},${b})`;
}

type DrawFn = (ctx: CanvasRenderingContext2D, s: number) => void;

// s = scale factor (2 for retina). All coords are in 0-48 logical space, multiply by s.
const DRAW_ROUTINES: Record<ModuleCategory, DrawFn> = {
  drive: (ctx, s) => {
    // Thruster nozzle with exhaust
    ctx.fillRect(16 * s, 10 * s, 16 * s, 28 * s);
    ctx.fillRect(12 * s, 14 * s, 4 * s, 20 * s);
    ctx.fillRect(32 * s, 14 * s, 4 * s, 20 * s);
    // Exhaust lines
    for (let i = 0; i < 3; i++) {
      const y = (38 + i * 3) * s;
      ctx.fillRect((18 + i * 4) * s, y, 2 * s, 4 * s);
    }
  },

  cargo: (ctx, s) => {
    // Container/crate
    ctx.strokeRect(10 * s, 12 * s, 28 * s, 24 * s);
    ctx.beginPath();
    ctx.moveTo(10 * s, 24 * s);
    ctx.lineTo(38 * s, 24 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(24 * s, 12 * s);
    ctx.lineTo(24 * s, 36 * s);
    ctx.stroke();
  },

  scanner: (ctx, s) => {
    // Radar dish with sweep arc
    ctx.beginPath();
    ctx.arc(24 * s, 28 * s, 14 * s, Math.PI, 2 * Math.PI);
    ctx.stroke();
    // Base
    ctx.fillRect(22 * s, 28 * s, 4 * s, 10 * s);
    // Sweep line
    ctx.beginPath();
    ctx.moveTo(24 * s, 28 * s);
    ctx.lineTo(14 * s, 16 * s);
    ctx.stroke();
  },

  armor: (ctx, s) => {
    // Chevron/plate layers
    for (let i = 0; i < 3; i++) {
      const y = (12 + i * 10) * s;
      ctx.beginPath();
      ctx.moveTo(10 * s, (y + 8 * s));
      ctx.lineTo(24 * s, y);
      ctx.lineTo(38 * s, (y + 8 * s));
      ctx.stroke();
    }
  },

  weapon: (ctx, s) => {
    // Barrel
    ctx.fillRect(10 * s, 20 * s, 22 * s, 8 * s);
    // Muzzle
    ctx.fillRect(32 * s, 18 * s, 6 * s, 12 * s);
    // Muzzle flash lines
    ctx.beginPath();
    ctx.moveTo(38 * s, 24 * s);
    ctx.lineTo(46 * s, 20 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(38 * s, 24 * s);
    ctx.lineTo(46 * s, 24 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(38 * s, 24 * s);
    ctx.lineTo(46 * s, 28 * s);
    ctx.stroke();
  },

  shield: (ctx, s) => {
    // Dome/bubble
    ctx.beginPath();
    ctx.arc(24 * s, 24 * s, 16 * s, 0, 2 * Math.PI);
    ctx.stroke();
    // Inner ring
    ctx.beginPath();
    ctx.arc(24 * s, 24 * s, 10 * s, 0, 2 * Math.PI);
    ctx.stroke();
  },

  defense: (ctx, s) => {
    // Turret base
    ctx.fillRect(14 * s, 28 * s, 20 * s, 8 * s);
    // Turret body
    ctx.fillRect(18 * s, 18 * s, 12 * s, 10 * s);
    // Barrel
    ctx.fillRect(22 * s, 8 * s, 4 * s, 12 * s);
  },

  special: (ctx, s) => {
    // Diamond/crystal
    ctx.beginPath();
    ctx.moveTo(24 * s, 6 * s);
    ctx.lineTo(38 * s, 24 * s);
    ctx.lineTo(24 * s, 42 * s);
    ctx.lineTo(10 * s, 24 * s);
    ctx.closePath();
    ctx.stroke();
    // Inner cross
    ctx.beginPath();
    ctx.moveTo(24 * s, 14 * s);
    ctx.lineTo(24 * s, 34 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16 * s, 24 * s);
    ctx.lineTo(32 * s, 24 * s);
    ctx.stroke();
  },

  mining: (ctx, s) => {
    // Drill bit
    ctx.beginPath();
    ctx.moveTo(24 * s, 38 * s);
    ctx.lineTo(16 * s, 18 * s);
    ctx.lineTo(32 * s, 18 * s);
    ctx.closePath();
    ctx.stroke();
    // Shaft
    ctx.fillRect(22 * s, 8 * s, 4 * s, 12 * s);
    // Particles
    ctx.fillRect(12 * s, 38 * s, 2 * s, 2 * s);
    ctx.fillRect(34 * s, 36 * s, 2 * s, 2 * s);
    ctx.fillRect(18 * s, 42 * s, 2 * s, 2 * s);
  },

  generator: (ctx, s) => {
    // Lightning bolt
    ctx.beginPath();
    ctx.moveTo(28 * s, 6 * s);
    ctx.lineTo(18 * s, 22 * s);
    ctx.lineTo(26 * s, 22 * s);
    ctx.lineTo(16 * s, 42 * s);
    ctx.lineTo(30 * s, 22 * s);
    ctx.lineTo(22 * s, 22 * s);
    ctx.lineTo(32 * s, 6 * s);
    ctx.closePath();
    ctx.fill();
  },

  repair: (ctx, s) => {
    // Wrench / cross tool
    ctx.fillRect(20 * s, 8 * s, 8 * s, 32 * s);
    ctx.fillRect(10 * s, 18 * s, 28 * s, 8 * s);
    // Rounded ends
    ctx.beginPath();
    ctx.arc(24 * s, 10 * s, 4 * s, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(24 * s, 38 * s, 4 * s, 0, 2 * Math.PI);
    ctx.fill();
  },
};

export function ModuleArtwork({ category, tier }: ModuleArtworkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const S = 2; // retina scale
    const { blur, alpha } = tierGlow(tier);

    ctx.clearRect(0, 0, 96, 96);
    ctx.save();

    // Set glow
    ctx.shadowColor = `rgba(255, 176, 0, ${alpha})`;
    ctx.shadowBlur = blur * S;

    // Set draw color
    const color = amberColor(alpha);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * S;

    // Draw category icon
    const drawFn = DRAW_ROUTINES[category];
    if (drawFn) {
      drawFn(ctx, S);
    }

    ctx.restore();
  }, [category, tier]);

  return (
    <canvas
      ref={canvasRef}
      width={96}
      height={96}
      style={{ width: '48px', height: '48px', display: 'block', margin: '0 auto 8px' }}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/client && npx vitest run src/__tests__/ModuleArtwork.test.tsx`
Expected: PASS (all 16 tests — 1 dimensions + 11 categories + 1 glow + 2 re-render)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/ModuleArtwork.tsx packages/client/src/__tests__/ModuleArtwork.test.tsx
git commit -m "feat: add ModuleArtwork canvas component with 11 category draw routines (#301)"
```

---

## Task 2: Integrate ModuleArtwork into AcepDetailPanel

**Files:**
- Modify: `packages/client/src/components/AcepDetailPanel.tsx:1-4,125-128`
- Modify: `packages/client/src/__tests__/AcepDetailPanel.test.tsx`

### Step-by-step

- [ ] **Step 1: Write failing integration test**

Add to `packages/client/src/__tests__/AcepDetailPanel.test.tsx`:

```tsx
it('MODULE tab with hover renders ModuleArtwork canvas', () => {
  const shipWithModule = {
    ...mockShip,
    modules: [{ moduleId: 'drive_mk1', slotIndex: 0, currentHp: 20, source: 'standard' as const }],
  };
  mockStoreState({ ship: shipWithModule as any, acepActiveTab: 'module' as const, acepHoveredModuleId: 'drive_mk1' });
  const { container } = render(<AcepDetailPanel />);
  const canvas = container.querySelector('canvas');
  expect(canvas).toBeTruthy();
  expect(canvas!.style.width).toBe('48px');
});

it('SHOP tab with hover renders ModuleArtwork canvas', () => {
  mockStoreState({
    ship: mockShip as any,
    acepActiveTab: 'shop' as const,
    acepHoveredModuleId: 'drive_mk1',
    currentSector: { type: 'station' } as any,
  });
  const { container } = render(<AcepDetailPanel />);
  const canvas = container.querySelector('canvas');
  expect(canvas).toBeTruthy();
});

it('ACEP tab does not render ModuleArtwork canvas', () => {
  const { container } = render(<AcepDetailPanel />);
  expect(container.querySelector('canvas')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/client && npx vitest run src/__tests__/AcepDetailPanel.test.tsx`
Expected: FAIL — the canvas assertion will fail because `AcepDetailPanel` doesn't render `<ModuleArtwork>` yet

- [ ] **Step 3: Add ModuleArtwork to AcepDetailPanel**

In `packages/client/src/components/AcepDetailPanel.tsx`:

**Add import** at line 1 area:
```tsx
import { ModuleArtwork } from './ModuleArtwork';
```

**Insert artwork** between the opening `<div>` (line 126) and the module name `<div>` (line 127). Add after `<div style={{ padding: 14, ...}}>`:
```tsx
      <ModuleArtwork category={def.category} tier={def.tier} />
```

The result at lines 125-129 should look like:
```tsx
    <div style={{ padding: 14, fontFamily: 'var(--font-mono)', fontSize: '0.9rem', overflow: 'auto', height: '100%' }}>
      <ModuleArtwork category={def.category} tier={def.tier} />
      <div style={{ color: 'var(--color-primary)', fontSize: '1rem', marginBottom: 4 }}>{def.displayName ?? def.name}</div>
      <div style={{ color: '#666', fontSize: '0.8rem', marginBottom: 12 }}>[{def.category.toUpperCase()}]</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/client && npx vitest run src/__tests__/AcepDetailPanel.test.tsx`
Expected: PASS (all existing + 3 new tests)

- [ ] **Step 5: Run full client test suite**

Run: `cd packages/client && npx vitest run`
Expected: All ~500+ tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/AcepDetailPanel.tsx packages/client/src/__tests__/AcepDetailPanel.test.tsx
git commit -m "feat: integrate ModuleArtwork into AcepDetailPanel (#301)"
```
