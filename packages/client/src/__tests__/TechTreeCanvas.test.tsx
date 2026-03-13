import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TechTreeCanvas } from '../components/TechTreeCanvas';
import { mockStoreState } from '../test/mockStore';

// Polyfill ResizeObserver for jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  }
  // Polyfill requestAnimationFrame / cancelAnimationFrame
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(cb, 0)) as any;
    globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as any;
  }
});

vi.mock('../network/client', () => ({
  network: {
    researchTechNode: vi.fn(),
    resetTechTree: vi.fn(),
    getTechTree: vi.fn(),
  },
}));

describe('TechTreeCanvas', () => {
  beforeEach(() => {
    mockStoreState({
      techTree: {
        researchedNodes: { kampf: 1 },
        totalResearched: 1,
        resetCooldownRemaining: 0,
      },
      research: {
        unlockedModules: [],
        blueprints: [],
        wissen: 500,
      },
    });
  });

  it('renders canvas element', () => {
    render(<TechTreeCanvas />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('shows WISSEN display', () => {
    render(<TechTreeCanvas />);
    expect(screen.getByText(/WISSEN/i)).toBeTruthy();
  });

  it('shows TECH TREE header', () => {
    render(<TechTreeCanvas />);
    expect(screen.getByText(/TECH TREE \/\/\/ FORSCHUNGSBAUM/)).toBeTruthy();
  });

  it('shows FORSCHUNGSBAUM header', () => {
    render(<TechTreeCanvas />);
    expect(screen.getByText(/FORSCHUNGSBAUM/i)).toBeTruthy();
  });

  it('displays researched count', () => {
    render(<TechTreeCanvas />);
    expect(screen.getByText(/ERFORSCHT: 1/i)).toBeTruthy();
  });

  it('displays escalation percentage', () => {
    render(<TechTreeCanvas />);
    // 1 researched * 5% = 5%
    expect(screen.getByText(/\+5%/i)).toBeTruthy();
  });

  it('shows reset button when cooldown is 0', () => {
    render(<TechTreeCanvas />);
    expect(screen.getByText('[RESET TECH TREE]')).toBeTruthy();
  });

  it('shows reset cooldown timer when cooldown > 0', () => {
    mockStoreState({
      techTree: {
        researchedNodes: { kampf: 1 },
        totalResearched: 1,
        resetCooldownRemaining: 3600000, // 1 hour
      },
      research: {
        unlockedModules: [],
        blueprints: [],
        wissen: 500,
      },
    });
    render(<TechTreeCanvas />);
    expect(screen.getByText(/RESET: 01:00:00/)).toBeTruthy();
  });

  it('shows branch color legend', () => {
    render(<TechTreeCanvas />);
    expect(screen.getByText('KAMPF')).toBeTruthy();
    expect(screen.getByText('AUSBAU')).toBeTruthy();
    expect(screen.getByText('INTEL')).toBeTruthy();
    expect(screen.getByText('EXPLORER')).toBeTruthy();
  });

  it('renders with null techTree state', () => {
    mockStoreState({
      techTree: null,
      research: {
        unlockedModules: [],
        blueprints: [],
        wissen: 0,
      },
    });
    render(<TechTreeCanvas />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(screen.getByText(/ERFORSCHT: 0/)).toBeTruthy();
  });

  it('shows ANSICHT reset view button', () => {
    render(<TechTreeCanvas />);
    expect(screen.getByText('[ANSICHT]')).toBeTruthy();
  });
});
