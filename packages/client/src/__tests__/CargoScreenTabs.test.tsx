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

  it('renders RESSOURCEN, MODULE, BLAUPAUSEN tabs', () => {
    render(<CargoScreen />);
    expect(screen.getByText('RESSOURCEN')).toBeDefined();
    expect(screen.getByText('MODULE')).toBeDefined();
    expect(screen.getByText('BLAUPAUSEN')).toBeDefined();
  });

  it('defaults to RESSOURCEN tab showing cargo bars', () => {
    render(<CargoScreen />);
    expect(screen.getAllByText(/ORE/).length).toBeGreaterThanOrEqual(1);
  });

  it('MODULE tab shows empty state when no modules', async () => {
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('MODULE'));
    expect(screen.getByText(/KEINE MODULE IM INVENTAR/)).toBeDefined();
  });

  it('BLAUPAUSEN tab shows empty state when no blueprints', async () => {
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('BLAUPAUSEN'));
    expect(screen.getByText(/KEINE BLAUPAUSEN IM INVENTAR/)).toBeDefined();
  });

  it('MODULE tab shows module with INSTALLIEREN button', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'module', itemId: 'drive_mk2', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('MODULE'));
    expect(screen.getByText(/DRIVE_MK2/)).toBeDefined();
    expect(screen.getByText('[INSTALLIEREN]')).toBeDefined();
  });

  it('BLAUPAUSEN tab shows blueprint with AKTIVIEREN and HERSTELLEN buttons', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'blueprint', itemId: 'shield_mk1', quantity: 2 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('BLAUPAUSEN'));
    expect(screen.getByText(/SHIELD_MK1/)).toBeDefined();
    expect(screen.getByText('[AKTIVIEREN]')).toBeDefined();
    expect(screen.getByText('[HERSTELLEN]')).toBeDefined();
  });

  it('INSTALLIEREN calls sendInstallModule', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'module', itemId: 'laser_mk1', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('MODULE'));
    await userEvent.click(screen.getByText('[INSTALLIEREN]'));
    expect(network.sendInstallModule).toHaveBeenCalled();
  });

  it('HERSTELLEN calls sendCraftModule', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'blueprint', itemId: 'engine_blueprint', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('BLAUPAUSEN'));
    await userEvent.click(screen.getByText('[HERSTELLEN]'));
    expect(network.sendCraftModule).toHaveBeenCalledWith('engine_blueprint');
  });

  it('AKTIVIEREN on blueprint calls sendActivateBlueprint', async () => {
    mockStoreState({
      cargo: { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 0 },
      inventory: [{ itemType: 'blueprint', itemId: 'cannon_blueprint', quantity: 1 }],
    });
    render(<CargoScreen />);
    await userEvent.click(screen.getByText('BLAUPAUSEN'));
    await userEvent.click(screen.getByText('[AKTIVIEREN]'));
    expect(network.sendActivateBlueprint).toHaveBeenCalledWith('cannon_blueprint');
  });

  it('requests inventory on mount', () => {
    render(<CargoScreen />);
    expect(network.requestInventory).toHaveBeenCalled();
  });
});
