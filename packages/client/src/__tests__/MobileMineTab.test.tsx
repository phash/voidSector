import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileMineTab } from '../components/MobileMineTab';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendMine: vi.fn(),
    sendStopMine: vi.fn(),
  },
}));

const asteroidSector = {
  x: 3, y: 3, type: 'asteroid_field', seed: 1,
  discoveredBy: null, discoveredAt: null, metadata: {}, environment: 'asteroid',
  contents: [],
  resources: { ore: 5, gas: 3, crystal: 1, maxOre: 10, maxGas: 8, maxCrystal: 4 },
};

const baseState = {
  currentSector: asteroidSector,
  mining: null,
  cargo: { ore: 0, gas: 0, crystal: 0, materials: [] },
  ship: { stats: { cargoCap: 50 } },
  position: { x: 3, y: 3 },
};

describe('MobileMineTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState(baseState as any);
  });

  it('renders ORE, GAS, CRYSTAL resource cards', () => {
    render(<MobileMineTab />);
    expect(screen.getByText(/ORE/i)).toBeInTheDocument();
    expect(screen.getByText(/GAS/i)).toBeInTheDocument();
    expect(screen.getByText(/CRYSTAL/i)).toBeInTheDocument();
  });

  it('shows current/max for each resource', () => {
    render(<MobileMineTab />);
    expect(screen.getByText(/5\s*\/\s*10/)).toBeInTheDocument(); // ore
    expect(screen.getByText(/3\s*\/\s*8/)).toBeInTheDocument();  // gas
  });

  it('renders MINE button for available resources', () => {
    render(<MobileMineTab />);
    const mineButtons = screen.getAllByRole('button', { name: /^MINE$/i });
    expect(mineButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('MINE button calls sendMine with resource', async () => {
    const { network } = await import('../network/client');
    render(<MobileMineTab />);
    const [firstMineBtn] = screen.getAllByRole('button', { name: /^MINE$/i });
    await userEvent.click(firstMineBtn);
    expect(network.sendMine).toHaveBeenCalledWith(expect.any(String), false);
  });

  it('shows STOP button when mining is active on a resource', () => {
    mockStoreState({
      ...baseState,
      mining: { active: true, resource: 'ore', rate: 1, sectorYield: 10, startedAt: Date.now() },
    } as any);
    render(<MobileMineTab />);
    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('STOP button calls sendStopMine', async () => {
    const { network } = await import('../network/client');
    mockStoreState({
      ...baseState,
      mining: { active: true, resource: 'ore', rate: 1, sectorYield: 10, startedAt: Date.now() },
    } as any);
    render(<MobileMineTab />);
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    expect(network.sendStopMine).toHaveBeenCalled();
  });

  it('renders Mine-All button', () => {
    render(<MobileMineTab />);
    expect(screen.getByRole('button', { name: /mobile\.mineAll/i })).toBeInTheDocument();
  });

  it('Mine-All calls sendMine with mineAll=true', async () => {
    const { network } = await import('../network/client');
    render(<MobileMineTab />);
    await userEvent.click(screen.getByRole('button', { name: /mobile\.mineAll/i }));
    expect(network.sendMine).toHaveBeenCalledWith(expect.any(String), true);
  });

  it('shows no-mining message when sector is not mineable', () => {
    mockStoreState({
      ...baseState,
      currentSector: { ...asteroidSector, type: 'station', resources: undefined },
    } as any);
    render(<MobileMineTab />);
    expect(screen.getByText(/mobile\.noMiningInSector/i)).toBeInTheDocument();
  });

  it('disables MINE button when resource is depleted (value 0)', () => {
    mockStoreState({
      ...baseState,
      currentSector: {
        ...asteroidSector,
        resources: { ore: 0, gas: 3, crystal: 1, maxOre: 10, maxGas: 8, maxCrystal: 4 },
      },
    } as any);
    render(<MobileMineTab />);
    // Find ORE card's button — should be disabled
    // gas and crystal should have enabled buttons
    const mineButtons = screen.getAllByRole('button', { name: /^MINE$/i });
    expect(mineButtons.length).toBe(2); // only gas and crystal
  });
});
