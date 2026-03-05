import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BaseScreen } from '../components/BaseScreen';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    requestBase: vi.fn(),
    requestStorage: vi.fn(),
    requestCredits: vi.fn(),
    sendTransfer: vi.fn(),
    sendUpgradeStructure: vi.fn(),
    requestFactoryStatus: vi.fn(),
    sendFactorySetRecipe: vi.fn(),
    sendFactoryCollect: vi.fn(),
    sendFactoryTransfer: vi.fn(),
    requestKontorOrders: vi.fn(),
    sendKontorPlaceOrder: vi.fn(),
    sendKontorCancel: vi.fn(),
  },
}));

describe('BaseScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState({
      position: { x: 5000000, y: 5000000 },
      baseStructures: [
        { id: '1', type: 'base', sector_x: 0, sector_y: 0, created_at: '2026-01-01' },
        { id: '2', type: 'comm_relay', sector_x: 0, sector_y: 0, created_at: '2026-01-02' },
      ],
      cargo: { ore: 10, gas: 5, crystal: 3, slates: 0, artefact: 0 },
    });
  });

  it('renders base header', () => {
    render(<BaseScreen />);
    expect(screen.getByText(/BASE-LINK/)).toBeTruthy();
  });

  it('shows structures list', () => {
    render(<BaseScreen />);
    expect(screen.getByText(/KOMMANDO-KERN/i)).toBeTruthy();
    expect(screen.getByText(/COMM RELAY/i)).toBeTruthy();
  });

  it('shows empty state when no structures', () => {
    mockStoreState({ baseStructures: [] });
    render(<BaseScreen />);
    expect(screen.getByText(/NO BASE/i)).toBeTruthy();
  });

  it('shows credits', () => {
    mockStoreState({
      baseStructures: [{ id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 250,
    });
    render(<BaseScreen />);
    expect(screen.getByText(/CREDITS: 250/)).toBeTruthy();
  });

  it('shows storage section when storage built', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 's1', type: 'storage', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      storage: { ore: 10, gas: 5, crystal: 2, artefact: 0 },
      credits: 0,
    });
    render(<BaseScreen />);
    expect(screen.getAllByText(/LAGER/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ERZ: 10/)).toBeTruthy();
  });

  it('shows structure list with labels', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'c1', type: 'comm_relay', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      credits: 0,
    });
    render(<BaseScreen />);
    expect(screen.getByText('KOMMANDO-KERN')).toBeTruthy();
    expect(screen.getByText('COMM RELAY')).toBeTruthy();
  });

  it('shows factory section when factory is built', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'f1', type: 'factory', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      factoryState: {
        activeRecipe: {
          id: 'alloy_plate_basic',
          outputItem: 'alloy_plate',
          outputAmount: 1,
          cycleSeconds: 180,
        },
        progress: 0.6,
        completedCycles: 3,
        output: { alloy_plate: 3, fuel_cell: 0 },
      },
      credits: 0,
    });
    render(<BaseScreen />);
    expect(screen.getByText(/FACTORY — ACTIVE/)).toBeTruthy();
    expect(screen.getAllByText(/ALLOY PLATE/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/3 cycles ready/)).toBeTruthy();
    expect(screen.getByText('COLLECT')).toBeTruthy();
  });

  it('shows idle factory when no recipe selected', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'f1', type: 'factory', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      factoryState: {
        activeRecipe: null,
        progress: 0,
        completedCycles: 0,
        output: {},
      },
      credits: 0,
    });
    render(<BaseScreen />);
    expect(screen.getByText(/FACTORY — IDLE/)).toBeTruthy();
    expect(screen.getByText(/No recipe selected/)).toBeTruthy();
  });

  it('does not show factory section when no factory built', () => {
    mockStoreState({
      baseStructures: [{ id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 0,
    });
    render(<BaseScreen />);
    expect(screen.queryByText(/FACTORY/)).toBeNull();
  });

  it('shows kontor section when kontor is built', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'k1', type: 'kontor', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      kontorOrders: [
        {
          id: 'o1',
          ownerId: 'test-id',
          itemType: 'ore',
          amountWanted: 500,
          amountFilled: 210,
          pricePerUnit: 2,
          active: true,
        },
      ],
      credits: 100,
    });
    render(<BaseScreen />);
    // KONTOR appears both in structure list and as section header
    expect(screen.getAllByText('KONTOR').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/500u @2cr/)).toBeTruthy();
    expect(screen.getByText(/210\/500/)).toBeTruthy();
    expect(screen.getByText('CANCEL')).toBeTruthy();
  });

  it('does not show kontor section when no kontor built', () => {
    mockStoreState({
      baseStructures: [{ id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 }],
      credits: 0,
    });
    render(<BaseScreen />);
    expect(screen.queryByText('KONTOR')).toBeNull();
  });

  it('shows new order form in kontor section', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'k1', type: 'kontor', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      kontorOrders: [],
      credits: 100,
    });
    render(<BaseScreen />);
    expect(screen.getByText(/NEW ORDER/)).toBeTruthy();
    expect(screen.getByText('PLACE')).toBeTruthy();
  });
});
