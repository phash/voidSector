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
import type { CargoState } from '@void-sector/shared';

const fullCargo: CargoState = {
  ore: 99,
  gas: 99,
  crystal: 99,
  artefact: 99,
  slates: 0,
  artefact_drive: 0,
  artefact_cargo: 0,
  artefact_scanner: 0,
  artefact_armor: 0,
  artefact_weapon: 0,
  artefact_shield: 0,
  artefact_defense: 0,
  artefact_special: 0,
  artefact_mining: 0,
};

const baseStore = {
  ship: { id: 'ship-1', modules: [] } as any,
  credits: 9999,
  cargo: fullCargo,
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

  it('ore: 0 in cargo does not disable buttons for modules that do not require ore (undefined !== 0)', () => {
    // cargo.ore = 0 but credits are sufficient
    // Modules whose cost.ore is undefined should still be purchasable
    // This test ensures costLabel/canAfford use !== undefined, not truthy checks
    mockStoreState({ ...baseStore, credits: 9999, cargo: { ...fullCargo, ore: 0 } });
    render(<ShopTab />);
    const buyBtns = screen.getAllByRole('button', { name: /KAUFEN/i });
    // At least some buttons should be enabled (those whose cost.ore is undefined)
    expect(buyBtns.some((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('mouseEnter on module item calls setAcepHoveredModuleId with the module id', () => {
    const setHovered = vi.fn();
    mockStoreState({ ...baseStore, setAcepHoveredModuleId: setHovered });
    render(<ShopTab />);
    // Get the first module item row (parent div of the first KAUFEN button)
    const buyBtns = screen.getAllByText(/KAUFEN/i);
    const moduleRow = buyBtns[0].closest('div[style*="border"]') ?? buyBtns[0].parentElement!;
    fireEvent.mouseEnter(moduleRow);
    expect(setHovered).toHaveBeenCalledTimes(1);
    expect(setHovered).toHaveBeenCalledWith(expect.any(String));
  });
});
