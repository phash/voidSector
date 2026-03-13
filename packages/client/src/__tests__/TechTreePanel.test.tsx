import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TechTreePanel } from '../components/TechTreePanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendActivateBlueprint: vi.fn(),
    requestResearchState: vi.fn(),
    getTechTree: vi.fn(),
  },
}));

describe('TechTreePanel', () => {
  it('renders TECH header', () => {
    mockStoreState({
      research: {
        unlockedModules: [],
        blueprints: [],
        wissen: 0,
      },
      position: { x: 0, y: 0 },
    });
    render(<TechTreePanel />);
    expect(screen.getByText(/tech\.techTree/i)).toBeInTheDocument();
  });

  it('shows freely available modules', () => {
    mockStoreState({
      research: {
        unlockedModules: [],
        blueprints: [],
        wissen: 0,
      },
      position: { x: 0, y: 0 },
    });
    render(<TechTreePanel />);
    // drive_mk1 is freely available — use exact match to avoid MK.II/MK.III
    expect(screen.getByText('ION DRIVE MK.I')).toBeInTheDocument();
  });
});
