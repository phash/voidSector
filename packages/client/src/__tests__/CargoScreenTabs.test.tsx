import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CargoScreen } from '../components/CargoScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendJettison: vi.fn(),
    requestMySlates: vi.fn(),
    sendActivateSlate: vi.fn(),
    sendNpcBuyback: vi.fn(),
    sendCreateSlate: vi.fn(),
    requestInventory: vi.fn(),
    sendInstallModule: vi.fn(),
    sendActivateBlueprint: vi.fn(),
    sendCraftModule: vi.fn(),
  },
}));

import { network } from '../network/client';

describe('CargoScreen inventory tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [],
    });
  });

  it('renders RESOURCES, MODULES, BLUEPRINTS, SLATES tabs', () => {
    render(<CargoScreen />);
    expect(screen.getByText('tabs.resources')).toBeDefined();
    expect(screen.getByText('tabs.modules')).toBeDefined();
    expect(screen.getByText('tabs.blueprints')).toBeDefined();
    expect(screen.getByText('SLATES')).toBeDefined();
  });

  it('defaults to RESOURCES tab showing cargo bars', () => {
    render(<CargoScreen />);
    expect(screen.getAllByText(/ORE/).length).toBeGreaterThanOrEqual(1);
  });

  it('MODULES tab shows empty state when no modules', async () => {
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('tabs.modules'));
    expect(screen.getByText(/empty.noModules/)).toBeDefined();
  });

  it('BLUEPRINTS tab shows empty state when no blueprints', async () => {
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('tabs.blueprints'));
    expect(screen.getByText(/empty.noBlueprints/)).toBeDefined();
  });

  it('MODULES tab shows module with INSTALL button', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      // Unknown ids fall back to UPPERCASE with underscores replaced by spaces.
      inventory: [{ itemType: 'module', itemId: 'drive_mk2', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('tabs.modules'));
    expect(screen.getByText(/DRIVE MK2/)).toBeDefined();
    expect(screen.getByText('[actions.install]')).toBeDefined();
  });

  it('BLUEPRINTS tab shows blueprint with ACTIVATE button (CRAFT moved to FabrikPanel)', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'blueprint', itemId: 'shield_mk1', quantity: 2 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('tabs.blueprints'));
    expect(screen.getByText(/SHIELD MK1/)).toBeDefined();
    expect(screen.getByText('[actions.activate]')).toBeDefined();
    expect(screen.queryByText('[actions.craft]')).toBeNull();
  });

  it('INSTALL calls sendInstallModule', async () => {
    // INSTALL now auto-resolves a valid slot via validateModuleInstall, so it
    // needs a ship and a real, installable module id (unknown ids find no slot).
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'module', itemId: 'cargo_bay_mk1', quantity: 1 }],
      ship: {
        id: 's1',
        modules: [],
        acepXp: { ausbau: 0, intel: 0, kampf: 0, explorer: 0 },
        stats: { cargoCap: 50 },
      } as any,
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('tabs.modules'));
    await userEvent.click(screen.getByText('[actions.install]'));
    expect(network.sendInstallModule).toHaveBeenCalled();
  });

  it('CRAFT moved to FabrikPanel — sendCraftModule not in CargoScreen', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'blueprint', itemId: 'engine_blueprint', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('tabs.blueprints'));
    expect(screen.queryByText('[actions.craft]')).toBeNull();
  });

  it('ACTIVATE on blueprint calls sendActivateBlueprint', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'blueprint', itemId: 'cannon_blueprint', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('tabs.blueprints'));
    await userEvent.click(screen.getByText('[actions.activate]'));
    expect(network.sendActivateBlueprint).toHaveBeenCalledWith('cannon_blueprint');
  });

  it('requests inventory on mount', () => {
    render(<CargoScreen />);
    expect(network.requestInventory).toHaveBeenCalled();
  });
});
