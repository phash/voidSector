import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useStore } from '../state/store';

vi.mock('../network/client', () => ({
  network: {
    sendMine: vi.fn(),
    sendStopMine: vi.fn(),
    sendToggleMineAll: vi.fn(),
  },
}));

import { MiningScreen } from '../components/MiningScreen';

describe('MiningScreen live resource bars', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useStore.setState({
      currentSector: {
        x: 5, y: 5, type: 'asteroid', seed: 1,
        resources: { ore: 50, gas: 0, crystal: 0, maxOre: 100, maxGas: 0, maxCrystal: 0 },
      } as any,
      position: { x: 5, y: 5 },
      mining: {
        active: true,
        resource: 'ore',
        sectorX: 5, sectorY: 5,
        startedAt: Date.now() - 5000, // 5 seconds ago
        rate: 2, // 2 units/sec
        sectorYield: 50,
        mineAll: false,
      },
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      ship: { stats: { cargoCap: 100 } } as any,
      ap: { current: 10, max: 20, regenPerSecond: 0.01, lastTick: Date.now() } as any,
    });
  });

  it('shows decreased ore value during active mining', () => {
    render(<MiningScreen />);
    // 5 seconds at 2/sec = 10 mined, 50 - 10 = 40
    // The ResourceBar renders "ORE       ███░░░░░░░  40/100"
    const allOre = screen.getAllByText(/ORE/);
    // Find the ResourceBar element (contains the padded label + bar + value)
    const resourceBar = allOre.find((el) => el.textContent?.includes('40'));
    expect(resourceBar).toBeTruthy();
  });
});
