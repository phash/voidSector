import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendBuyModule: vi.fn(),
  },
}));

vi.mock('@void-sector/shared', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    isModuleUnlocked: vi.fn().mockReturnValue(true),
  };
});

import { network } from '../network/client';
import { ShopTab } from '../components/ShopTab';

const baseStore = {
  ship: { id: 'ship-1', hullType: 'scout' as const, modules: [] } as any,
  credits: 9999,
  cargo: { ore: 99, gas: 99, crystal: 99, artefact: 99, slates: 0 } as any,
  research: { wissen: 0 } as any,
  currentSector: { type: 'station' } as any,
  baseStructures: [] as any[],
  setAcepHoveredModuleId: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState(baseStore);
});

describe('ShopTab', () => {
  it('shows unavailable message when not at station or base', () => {
    mockStoreState({ ...baseStore, currentSector: { type: 'empty' } as any, baseStructures: [] });
    render(<ShopTab />);
    expect(screen.getByText(/nur an Station/i)).toBeInTheDocument();
  });

  it('shows module list when at station', () => {
    render(<ShopTab />);
    // At least one [KAUFEN] button should exist (modules list is non-empty)
    const buyBtns = screen.getAllByText(/KAUFEN/i);
    expect(buyBtns.length).toBeGreaterThan(0);
  });

  it('shows module list when at home base', () => {
    mockStoreState({ ...baseStore, currentSector: { type: 'empty' } as any, baseStructures: [{ type: 'base' }] as any[] });
    render(<ShopTab />);
    const buyBtns = screen.getAllByText(/KAUFEN/i);
    expect(buyBtns.length).toBeGreaterThan(0);
  });

  it('KAUFEN calls sendBuyModule with module id', () => {
    render(<ShopTab />);
    const buyBtns = screen.getAllByText(/KAUFEN/i);
    fireEvent.click(buyBtns[0]);
    expect(network.sendBuyModule).toHaveBeenCalledTimes(1);
  });

  it('KAUFEN button is disabled when credits insufficient', () => {
    mockStoreState({ ...baseStore, credits: 0 });
    render(<ShopTab />);
    // All buttons should be disabled (no credits)
    const buyBtns = screen.getAllByRole('button', { name: /KAUFEN/i });
    expect(buyBtns.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });
});
