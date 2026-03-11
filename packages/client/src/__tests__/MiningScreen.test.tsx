import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiningScreen } from '../components/MiningScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendMine: vi.fn(),
    sendStopMine: vi.fn(),
  },
}));

import { network } from '../network/client';

const sectorWithResources = {
  x: 0,
  y: 0,
  type: 'asteroid_field' as const,
  seed: 42,
  discoveredBy: null,
  discoveredAt: null,
  metadata: {},
  environment: 'empty' as const,
  contents: ['asteroid_field' as const],
  resources: { ore: 20, gas: 2, crystal: 3 },
};

describe('MiningScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({ currentSector: sectorWithResources });
  });

  it('shows resource labels', () => {
    render(<MiningScreen />);
    // Multiple elements match /ORE/ (resource bar + mine button), so use getAllByText
    expect(screen.getAllByText(/ORE/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/GAS/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CRYSTAL/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows mine buttons for available resources', () => {
    render(<MiningScreen />);
    expect(screen.getByText('[MINE ORE]')).toBeInTheDocument();
    expect(screen.getByText('[MINE GAS]')).toBeInTheDocument();
    expect(screen.getByText('[MINE CRYSTAL]')).toBeInTheDocument();
  });

  it('calls sendMine on button click', async () => {
    render(<MiningScreen />);
    await userEvent.click(screen.getByText('[MINE ORE]'));
    expect(network.sendMine).toHaveBeenCalledWith('ore', false);
  });

  it('disables mine buttons when mining is active', () => {
    mockStoreState({
      currentSector: sectorWithResources,
      mining: {
        active: true,
        resource: 'ore',
        sectorX: 0,
        sectorY: 0,
        startedAt: Date.now(),
        rate: 0.1,
        sectorYield: 20,
      },
    });
    render(<MiningScreen />);
    const oreBtn = screen.getByText('[MINE ORE]').closest('button');
    expect(oreBtn).toBeDisabled();
  });

  it('disables mine button when resource yield is 0', () => {
    mockStoreState({
      currentSector: {
        ...sectorWithResources,
        resources: { ore: 0, gas: 5, crystal: 5 },
      },
    });
    render(<MiningScreen />);
    const oreBtn = screen.getByText('[MINE ORE]').closest('button');
    expect(oreBtn).toBeDisabled();

    const gasBtn = screen.getByText('[MINE GAS]').closest('button');
    expect(gasBtn).not.toBeDisabled();
  });

  it('shows STOP button disabled when mining is NOT active', () => {
    render(<MiningScreen />);
    const stopBtn = screen.getByText('[STOP]').closest('button');
    expect(stopBtn).toBeDisabled();
  });

  it('shows STOP button enabled when mining is active', () => {
    mockStoreState({
      currentSector: sectorWithResources,
      mining: {
        active: true,
        resource: 'ore',
        sectorX: 0,
        sectorY: 0,
        startedAt: Date.now(),
        rate: 0.1,
        sectorYield: 20,
      },
    });
    render(<MiningScreen />);
    const stopBtn = screen.getByText('[STOP]').closest('button');
    expect(stopBtn).not.toBeDisabled();
  });

  it('calls sendStopMine on STOP click', async () => {
    mockStoreState({
      currentSector: sectorWithResources,
      mining: {
        active: true,
        resource: 'ore',
        sectorX: 0,
        sectorY: 0,
        startedAt: Date.now(),
        rate: 0.1,
        sectorYield: 20,
      },
    });
    render(<MiningScreen />);
    await userEvent.click(screen.getByText('[STOP]'));
    expect(network.sendStopMine).toHaveBeenCalled();
  });

  it('displays mining status when active', () => {
    mockStoreState({
      currentSector: sectorWithResources,
      mining: {
        active: true,
        resource: 'ore',
        sectorX: 0,
        sectorY: 0,
        startedAt: Date.now(),
        rate: 0.1,
        sectorYield: 20,
      },
    });
    render(<MiningScreen />);
    // New live-flow display shows ASTEROID and CARGO labels
    expect(screen.getAllByText(/ASTEROID/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CARGO/).length).toBeGreaterThanOrEqual(1);
  });

  it('displays IDLE status when not mining', () => {
    render(<MiningScreen />);
    expect(screen.getByText(/IDLE/)).toBeInTheDocument();
  });
});
