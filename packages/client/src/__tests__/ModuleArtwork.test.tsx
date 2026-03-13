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
    expect(canvas!.getContext).toBeDefined();
  });

  it('renders canvas for both tier 1 and tier 5', () => {
    const { container: c1 } = render(<ModuleArtwork category="weapon" tier={1} />);
    const { container: c5 } = render(<ModuleArtwork category="weapon" tier={5} />);
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
