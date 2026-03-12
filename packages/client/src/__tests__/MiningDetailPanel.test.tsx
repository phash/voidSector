import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useStore } from '../state/store';

vi.mock('../network/client', () => ({ network: {} }));

import { MiningDetailPanel } from '../components/MiningDetailPanel';

describe('MiningDetailPanel', () => {
  it('shows "MINE TO BEGIN" when storyIndex is 0', () => {
    useStore.setState({ mining: null, miningStoryIndex: 0 });
    render(<MiningDetailPanel />);
    expect(screen.getByText(/MINE TO BEGIN/)).toBeTruthy();
  });

  it('shows the correct story fragment for storyIndex', () => {
    useStore.setState({
      mining: { active: true, resource: 'ore', sectorX: 0, sectorY: 0, startedAt: Date.now(), rate: 1, sectorYield: 50, mineAll: false },
      miningStoryIndex: 1,
    });
    render(<MiningDetailPanel />);
    expect(screen.getByText(/KEINE PANIK/)).toBeTruthy();
    expect(screen.getByText(/FRAGMENT 1/)).toBeTruthy();
  });

  it('shows THE END when story is complete', () => {
    useStore.setState({ mining: null, miningStoryIndex: 999 });
    render(<MiningDetailPanel />);
    expect(screen.getByText(/THE END/)).toBeTruthy();
  });
});
