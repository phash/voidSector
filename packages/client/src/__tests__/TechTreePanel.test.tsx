import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TechTreePanel } from '../components/TechTreePanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendStartResearch: vi.fn(),
    sendCancelResearch: vi.fn(),
    sendClaimResearch: vi.fn(),
    sendActivateBlueprint: vi.fn(),
    requestResearchState: vi.fn(),
  },
}));

describe('TechTreePanel', () => {
  it('renders TECH header', () => {
    mockStoreState({
      research: { unlockedModules: [], blueprints: [], activeResearch: null },
      homeBase: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
    });
    render(<TechTreePanel />);
    expect(screen.getByText(/TECH/i)).toBeInTheDocument();
  });

  it('shows active research progress', () => {
    mockStoreState({
      research: {
        unlockedModules: [],
        blueprints: [],
        activeResearch: {
          moduleId: 'drive_mk2',
          startedAt: Date.now() - 60000,
          completesAt: Date.now() + 240000,
        },
      },
      homeBase: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
    });
    render(<TechTreePanel />);
    expect(screen.getByText('AKTIVE FORSCHUNG')).toBeInTheDocument();
    // drive_mk2 appears in the active research section and the list
    expect(screen.getAllByText(/ION DRIVE MK\.II/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows freely available modules', () => {
    mockStoreState({
      research: { unlockedModules: [], blueprints: [], activeResearch: null },
      homeBase: { x: 0, y: 0 },
      position: { x: 0, y: 0 },
    });
    render(<TechTreePanel />);
    // drive_mk1 is freely available — use exact match to avoid MK.II/MK.III
    expect(screen.getByText('ION DRIVE MK.I')).toBeInTheDocument();
  });
});
