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
    expect(screen.getByText(/shop\.onlyAtStation/i)).toBeInTheDocument();
  });

  it('shows module list when at station', () => {
    render(<ShopTab />);
    // At least one shop.buy button should exist (modules list is non-empty)
    const buyBtns = screen.getAllByText(/shop\.buy/i);
    expect(buyBtns.length).toBeGreaterThan(0);
  });

  it('shows module list when at home base', () => {
    mockStoreState({ ...baseStore, currentSector: { type: 'empty' } as any, baseStructures: [{ type: 'base' }] as any[] });
    render(<ShopTab />);
    const buyBtns = screen.getAllByText(/shop\.buy/i);
    expect(buyBtns.length).toBeGreaterThan(0);
  });

  it('KAUFEN opens confirm modal, then confirming calls sendBuyModule', () => {
    // Buying now goes through a confirmation modal: the list "buy" button
    // opens the modal, and the modal's confirm "buy" button calls sendBuyModule.
    render(<ShopTab />);
    const listBuyBtns = screen.getAllByText(/shop\.buy/i);
    fireEvent.click(listBuyBtns[0]);
    // Clicking the list button only opens the modal — no purchase yet.
    expect(network.sendBuyModule).not.toHaveBeenCalled();
    // Now a second shop.buy button (the modal confirm) appears.
    const allBuyBtns = screen.getAllByText(/shop\.buy/i);
    expect(allBuyBtns.length).toBeGreaterThan(listBuyBtns.length);
    fireEvent.click(allBuyBtns[allBuyBtns.length - 1]);
    expect(network.sendBuyModule).toHaveBeenCalledTimes(1);
    expect(network.sendBuyModule).toHaveBeenCalledWith(expect.any(String));
  });

  it('KAUFEN button is disabled when credits insufficient', () => {
    mockStoreState({ ...baseStore, credits: 0 });
    render(<ShopTab />);
    // With no credits, all modules that cost credits must be disabled.
    // (A free module like factory_mk1 stays enabled — so assert "some" not "all".)
    const buyBtns = screen.getAllByRole('button', { name: /shop\.buy/i });
    expect(buyBtns.some((b) => (b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('ore: 0 in cargo does not disable buttons for modules that do not require ore (undefined !== 0)', () => {
    // cargo.ore = 0 but credits are sufficient
    // Modules whose cost.ore is undefined should still be purchasable
    // This test ensures costLabel/canAfford use !== undefined, not truthy checks
    mockStoreState({ ...baseStore, credits: 9999, cargo: { ...fullCargo, ore: 0 } });
    render(<ShopTab />);
    const buyBtns = screen.getAllByRole('button', { name: /shop\.buy/i });
    // At least some buttons should be enabled (those whose cost.ore is undefined)
    expect(buyBtns.some((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('mouseEnter on module item calls setAcepHoveredModuleId with the module id', () => {
    const setHovered = vi.fn();
    mockStoreState({ ...baseStore, setAcepHoveredModuleId: setHovered });
    render(<ShopTab />);
    // Get the first module item row (parent div of the first shop.buy button)
    const buyBtns = screen.getAllByText(/shop\.buy/i);
    const moduleRow = buyBtns[0].closest('div[style*="border"]') ?? buyBtns[0].parentElement!;
    fireEvent.mouseEnter(moduleRow);
    expect(setHovered).toHaveBeenCalledTimes(1);
    expect(setHovered).toHaveBeenCalledWith(expect.any(String));
  });
});
