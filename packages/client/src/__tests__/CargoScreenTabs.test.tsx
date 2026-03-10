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

  it('renders RESOURCES, MODULES, BLUEPRINTS tabs', () => {
    render(<CargoScreen />);
    expect(screen.getByText('RESOURCES')).toBeDefined();
    expect(screen.getByText('MODULES')).toBeDefined();
    expect(screen.getByText('BLUEPRINTS')).toBeDefined();
  });

  it('defaults to RESOURCES tab showing cargo bars', () => {
    render(<CargoScreen />);
    expect(screen.getAllByText(/ORE/).length).toBeGreaterThanOrEqual(1);
  });

  it('MODULES tab shows empty state when no modules', async () => {
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('MODULES'));
    expect(screen.getByText(/NO MODULES/)).toBeDefined();
  });

  it('BLUEPRINTS tab shows empty state when no blueprints', async () => {
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('BLUEPRINTS'));
    expect(screen.getByText(/NO BLUEPRINTS/)).toBeDefined();
  });

  it('MODULES tab shows module with INSTALL button', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'module', itemId: 'drive_mk2', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('MODULES'));
    expect(screen.getByText(/DRIVE_MK2/)).toBeDefined();
    expect(screen.getByText('[INSTALL]')).toBeDefined();
  });

  it('BLUEPRINTS tab shows blueprint with ACTIVATE and CRAFT buttons', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'blueprint', itemId: 'shield_mk1', quantity: 2 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('BLUEPRINTS'));
    expect(screen.getByText(/SHIELD_MK1/)).toBeDefined();
    expect(screen.getByText('[ACTIVATE]')).toBeDefined();
    expect(screen.getByText('[CRAFT]')).toBeDefined();
  });

  it('INSTALL calls sendInstallModule', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'module', itemId: 'laser_mk1', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('MODULES'));
    await userEvent.click(screen.getByText('[INSTALL]'));
    expect(network.sendInstallModule).toHaveBeenCalled();
  });

  it('CRAFT calls sendCraftModule', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'blueprint', itemId: 'engine_blueprint', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('BLUEPRINTS'));
    await userEvent.click(screen.getByText('[CRAFT]'));
    expect(network.sendCraftModule).toHaveBeenCalledWith('engine_blueprint');
  });

  it('ACTIVATE on blueprint calls sendActivateBlueprint', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'blueprint', itemId: 'cannon_blueprint', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('BLUEPRINTS'));
    await userEvent.click(screen.getByText('[ACTIVATE]'));
    expect(network.sendActivateBlueprint).toHaveBeenCalledWith('cannon_blueprint');
  });

  it('requests inventory on mount', () => {
    render(<CargoScreen />);
    expect(network.requestInventory).toHaveBeenCalled();
  });
});
