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
    requestResearchStatus: vi.fn(),
    sendResearchStart: vi.fn(),
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
      cargo: { ore: 10, gas: 5, crystal: 3, slates: 0 },
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
      storage: { ore: 10, gas: 5, crystal: 2 },
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

  it('shows factory panel when factory structure exists', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'f1', type: 'factory', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      credits: 0,
      factoryStatus: null,
      unlockedRecipes: [],
    });
    render(<BaseScreen />);
    expect(screen.getByText('FABRIK')).toBeTruthy();
  });

  it('shows factory inactive state with no active recipe', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'f1', type: 'factory', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      credits: 0,
      factoryStatus: {
        structureId: 'f1',
        activeRecipeId: null,
        progress: 0,
        cycleSeconds: 0,
        output: { fuel_cell: 0, circuit_board: 0, alloy_plate: 0, void_shard: 0, bio_extract: 0 },
      },
      unlockedRecipes: [],
    });
    render(<BaseScreen />);
    expect(screen.getByText('INAKTIV')).toBeTruthy();
  });

  it('shows factory active recipe with progress', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'f1', type: 'factory', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      credits: 0,
      factoryStatus: {
        structureId: 'f1',
        activeRecipeId: 'fuel_cell_basic',
        progress: 0.5,
        cycleSeconds: 120,
        output: { fuel_cell: 2, circuit_board: 0, alloy_plate: 0, void_shard: 0, bio_extract: 0 },
      },
      unlockedRecipes: [],
    });
    render(<BaseScreen />);
    expect(screen.getByText(/TREIBSTOFFZELLE/)).toBeTruthy();
    expect(screen.getByText(/STOPPEN/)).toBeTruthy();
    expect(screen.getByText(/LAGER OUTPUT/)).toBeTruthy();
    expect(screen.getByText(/TREIBSTOFFZELLE: 2/)).toBeTruthy();
  });

  it('shows research lab panel when research_lab structure exists', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'r1', type: 'research_lab', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      credits: 0,
      unlockedRecipes: [],
      activeResearch: null,
    });
    render(<BaseScreen />);
    expect(screen.getByText('FORSCHUNGSLABOR')).toBeTruthy();
    expect(screen.getByText('FORSCHUNGSBAUM')).toBeTruthy();
  });

  it('shows active research progress in research lab', () => {
    const now = Date.now();
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'r1', type: 'research_lab', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      credits: 1000,
      unlockedRecipes: [],
      activeResearch: {
        recipeId: 'circuit_board_t1',
        startedAt: now - 15 * 60 * 1000,
        completesAt: now + 15 * 60 * 1000,
      },
    });
    render(<BaseScreen />);
    expect(screen.getByText(/CIRCUIT BOARD MK\.I/)).toBeTruthy();
  });

  it('shows unlocked research items as FREIGESCHALTET', () => {
    mockStoreState({
      baseStructures: [
        { id: 'b1', type: 'base', tier: 1, sector_x: 0, sector_y: 0 },
        { id: 'r1', type: 'research_lab', tier: 1, sector_x: 0, sector_y: 0 },
      ],
      credits: 5000,
      unlockedRecipes: ['circuit_board_t1'],
      activeResearch: null,
    });
    render(<BaseScreen />);
    expect(screen.getByText('[FREIGESCHALTET]')).toBeTruthy();
  });
});
