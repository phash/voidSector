import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CargoScreen } from '../components/CargoScreen';

vi.mock('../network/client', () => ({
  network: {
    sendJettison: vi.fn(),
    requestMySlates: vi.fn(),
    requestInventory: vi.fn(),
  },
}));

vi.mock('../state/store', () => ({
  useStore: vi.fn((selector) =>
    selector({
      cargo: { ore: 5, gas: 0, crystal: 0, slates: 0, artefact: 0,
        artefact_drive: 0, artefact_cargo: 0, artefact_scanner: 0,
        artefact_armor: 0, artefact_weapon: 0, artefact_shield: 0,
        artefact_defense: 0, artefact_special: 0, artefact_mining: 0 },
      ship: { name: 'Scout', stats: { cargoCap: 50 } },
      mySlates: [],
      inventory: [],
      credits: 100,
      alienCredits: 0,
      setActiveProgram: vi.fn(),
    })
  ),
}));

import { network } from '../network/client';

describe('CargoScreen jettison single-click', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls sendJettison on single click when cargo > 0', () => {
    render(<CargoScreen />);
    const btn = screen.getByRole('button', { name: /JETTISON ORE/i });
    fireEvent.click(btn);
    expect(network.sendJettison).toHaveBeenCalledWith('ore');
  });

  it('does NOT show SURE? after click (no two-click confirm)', () => {
    render(<CargoScreen />);
    const btn = screen.getByRole('button', { name: /JETTISON ORE/i });
    fireEvent.click(btn);
    expect(screen.queryByText(/SURE/i)).toBeNull();
  });
});
