import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FabrikScreen } from '../FabrikScreen';
import { mockStoreState } from '../../test/mockStore';

vi.mock('../../network/client', () => ({
  network: {
    getStationProduction: vi.fn(),
    buyFromStation: vi.fn(),
    sellToStation: vi.fn(),
  },
}));

import { network } from '../../network/client';

const baseProductionState = {
  sectorX: 5,
  sectorY: 3,
  level: 2,
  distanceTier: 1 as const,
  moduleTierLabel: 'MK1',
  resourceStockpile: { ore: 50, gas: 20, crystal: 10 },
  maxStockpile: { ore: 100, gas: 100, crystal: 100 },
  currentItem: null,
  upcomingQueue: [],
  finishedGoods: { fuel: 5, ammo_basic: 3 },
  maxFinishedGoods: { fuel: 50, ammo_basic: 20 },
  ankaufPreise: { ore: 8, gas: 12, crystal: 16 },
  kaufPreise: { fuel: 80, ammo_basic: 25, module_cargo_mk1: 240, module_scanner_mk1: 280, module_drive_mk1: 320 },
};

describe('FabrikScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      stationProductionState: null,
      credits: 500,
    } as any);
  });

  it('shows loading when stationProductionState is null', () => {
    render(<FabrikScreen />);
    expect(screen.getByText(/LADE STATIONSDATEN/)).toBeDefined();
  });

  it('calls getStationProduction on mount', () => {
    render(<FabrikScreen />);
    expect(network.getStationProduction).toHaveBeenCalledOnce();
  });

  describe('when state is loaded', () => {
    beforeEach(() => {
      mockStoreState({
        stationProductionState: baseProductionState,
        credits: 500,
      } as any);
    });

    it('shows station header with level, sector and module tier', () => {
      render(<FabrikScreen />);
      expect(screen.getByText(/STATION LVL 2/)).toBeDefined();
      expect(screen.getByText(/SEKTOR 5,3/)).toBeDefined();
      expect(screen.getByText(/MODUL-TIER: MK1/)).toBeDefined();
    });

    it('shows PRODUKTION section', () => {
      render(<FabrikScreen />);
      expect(screen.getByText('PRODUKTION')).toBeDefined();
    });

    it('shows no active order when currentItem is null', () => {
      render(<FabrikScreen />);
      expect(screen.getByText(/KEIN AKTIVER AUFTRAG/)).toBeDefined();
    });

    it('shows current production item with progress bar', () => {
      mockStoreState({
        stationProductionState: {
          ...baseProductionState,
          currentItem: {
            itemId: 'fuel',
            startedAtMs: Date.now() - 30000,
            durationSeconds: 60,
          },
        },
        credits: 500,
      } as any);
      render(<FabrikScreen />);
      expect(screen.getByText(/FUEL/)).toBeDefined();
      // Progress bar uses block chars — multiple bars exist, so use getAllByText
      expect(screen.getAllByText(/[█░]/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows LAGER section with default RESSOURCEN tab', () => {
      render(<FabrikScreen />);
      expect(screen.getByText('LAGER')).toBeDefined();
      // Tab buttons are present
      expect(screen.getByText('[RESSOURCEN]')).toBeDefined();
      expect(screen.getByText('[MODULE]')).toBeDefined();
      expect(screen.getByText('[AMMO]')).toBeDefined();
    });

    it('RESSOURCEN tab shows fuel item (category RESSOURCEN)', () => {
      render(<FabrikScreen />);
      // On RESSOURCEN tab, Treibstoff should be visible
      expect(screen.getByText('TREIBSTOFF')).toBeDefined();
    });

    it('tab switching: MODULE tab shows module items', async () => {
      render(<FabrikScreen />);
      await userEvent.click(screen.getByText('[MODULE]'));
      expect(screen.getByText('FRACHTRAUM MK1')).toBeDefined();
      expect(screen.getByText('SCANNER MK1')).toBeDefined();
    });

    it('tab switching: AMMO tab hides RESSOURCEN items', async () => {
      render(<FabrikScreen />);
      await userEvent.click(screen.getByText('[AMMO]'));
      // Fuel is in RESSOURCEN category, not AMMO
      expect(screen.queryByText('TREIBSTOFF')).toBeNull();
      // Munition is AMMO
      expect(screen.getByText('MUNITION')).toBeDefined();
    });

    it('[KAUFEN] button is disabled when stock is 0', () => {
      mockStoreState({
        stationProductionState: {
          ...baseProductionState,
          finishedGoods: { fuel: 0 },
        },
        credits: 500,
      } as any);
      render(<FabrikScreen />);
      // Fuel has 0 stock — should show dimmed span, not a button
      // The kaufen text should still appear but as a non-button span
      const kaufenElements = screen.getAllByText(/\[KAUFEN\]/);
      // None should be a button when stock=0
      const buttons = kaufenElements.filter((el) => el.tagName === 'BUTTON');
      expect(buttons.length).toBe(0);
    });

    it('[KAUFEN] button calls buyFromStation when clicked', async () => {
      render(<FabrikScreen />);
      // fuel has stock=5 and credits=500 >= price=80
      const kaufenBtns = screen.getAllByRole('button', { name: /KAUFEN/ });
      expect(kaufenBtns.length).toBeGreaterThanOrEqual(1);
      await userEvent.click(kaufenBtns[0]);
      expect(network.buyFromStation).toHaveBeenCalled();
    });

    it('shows ROHSTOFFE section with ORE, GAS, CRYSTAL rows', () => {
      render(<FabrikScreen />);
      expect(screen.getByText('ROHSTOFFE (LIEFERN)')).toBeDefined();
      expect(screen.getByText('ORE')).toBeDefined();
      expect(screen.getByText('GAS')).toBeDefined();
      expect(screen.getByText('CRYSTAL')).toBeDefined();
    });

    it('[VERKAUFEN] calls sellToStation', async () => {
      render(<FabrikScreen />);
      const verkaufenBtns = screen.getAllByText('[VERKAUFEN]');
      await userEvent.click(verkaufenBtns[0]);
      expect(network.sellToStation).toHaveBeenCalled();
    });

    it('shows double star when ankaufPreis >= base * 1.4', () => {
      mockStoreState({
        stationProductionState: {
          ...baseProductionState,
          ankaufPreise: { ore: 12, gas: 12, crystal: 16 }, // 12 >= 8*1.4=11.2
        },
        credits: 500,
      } as any);
      render(<FabrikScreen />);
      expect(screen.getByText('★★')).toBeDefined();
    });

    it('shows single star when ankaufPreis >= base * 1.1', () => {
      mockStoreState({
        stationProductionState: {
          ...baseProductionState,
          ankaufPreise: { ore: 9, gas: 12, crystal: 16 }, // 9 >= 8*1.1=8.8
        },
        credits: 500,
      } as any);
      render(<FabrikScreen />);
      expect(screen.getByText('★')).toBeDefined();
    });
  });
});
