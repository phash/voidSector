import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the canvas component itself — canvas rendering isn't testable in jsdom
vi.mock('../components/TechTreeCanvas', () => ({
  TechTreeCanvas: () => <div data-testid="tech-tree-canvas">TECH TREE</div>,
}));

describe('TechTreeCanvas', () => {
  it('renders without crash', async () => {
    const { TechTreeCanvas } = await import('../components/TechTreeCanvas');
    render(<TechTreeCanvas />);
    expect(screen.getByTestId('tech-tree-canvas')).toBeTruthy();
  });
});
