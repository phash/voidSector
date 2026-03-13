import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepairPanel } from '../components/RepairPanel';
import { mockStoreState } from '../test/mockStore';

vi.mock('../network/client', () => ({
  network: {
    sendRepairModule: vi.fn(),
    sendStationRepair: vi.fn(),
  },
}));

import { network } from '../network/client';

// ─── Mock ship data helpers ───────────────────────────────────────────────────

/**
 * A repair drone MK.I (tier 1, repair category).
 * MODULES['repair_mk1'].maxHp = 20 (from constants).
 * Set currentHp to 20 so getDamageState(20, 20) = intact.
 */
const repairDroneMk1 = {
  moduleId: 'repair_mk1',
  category: 'repair',
  tier: 1,
  currentHp: 20,  // = maxHp from constants → intact
  maxHp: 20,
  powerLevel: 'high' as const,
};

/**
 * A repair drone MK.III (tier 3).
 * MODULES['repair_mk3'].maxHp = 55 (from constants).
 * Set currentHp to 55 so getDamageState(55, 55) = intact.
 */
const repairDroneMk3 = {
  moduleId: 'repair_mk3',
  category: 'repair',
  tier: 3,
  currentHp: 55,  // = maxHp from constants → intact
  maxHp: 55,
  powerLevel: 'high' as const,
};

/** A laser MK.1 at full health (intact). maxHp = 25 from constants. */
const laserIntact = {
  moduleId: 'laser_mk1',
  category: 'weapon',
  tier: 1,
  currentHp: 25,
  maxHp: 25,
  powerLevel: 'high' as const,
};

/** A laser MK.1 at light damage (60% = 15/25). */
const laserLightDamage = {
  ...laserIntact,
  currentHp: 15,  // 60% → light
};

/** A laser MK.1 at heavy damage (35% = 9/25). */
const laserHeavyDamage = {
  ...laserIntact,
  currentHp: 9,  // 36% → heavy
};

/** A laser MK.1 destroyed (20% = 5/25). */
const laserDestroyed = {
  ...laserIntact,
  currentHp: 5,  // 20% → destroyed
};

const baseShip = {
  id: 'ship-1',
  ownerId: 'player-1',
  name: 'TEST SHIP',
  modules: [] as typeof laserIntact[],
  stats: {
    hp: 100,
    engineSpeed: 1,
    scannerLevel: 1,
    jumpRange: 3,
    fuelMax: 100,
    cargoCap: 10,
    miningPower: 0,
    repairHpPerRound: 0,
    repairHpPerSecond: 0,
    apRegen: 1,
    shieldCapacity: 0,
    shieldRechargeRate: 0,
    pointDefenseChance: 0,
    ecmJamChance: 0,
    combatDamageBonus: 0,
  },
  fuel: 100,
  active: true,
};

const defaultCargo = {
  ore: 0,
  gas: 0,
  crystal: 0,
  slates: 0,
  artefact: 0,
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

const emptyStation = {
  x: 5, y: 5,
  type: 'station' as const,
  seed: 1,
  discoveredBy: null,
  discoveredAt: null,
  metadata: {},
  environment: 'station' as const,
  contents: [],
};

const emptySector = {
  x: 1, y: 1,
  type: 'empty' as const,
  seed: 42,
  discoveredBy: null,
  discoveredAt: null,
  metadata: {},
  environment: 'empty' as const,
  contents: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RepairPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows NO SHIP DATA when ship is null', () => {
    mockStoreState({ ship: null, currentSector: emptySector });
    render(<RepairPanel />);
    expect(screen.getByText(/ship\.noShipData/i)).toBeInTheDocument();
  });

  it('shows KEIN REPARATUR-MODUL INSTALLIERT when no repair module is equipped', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [laserIntact] },
      cargo: { ...defaultCargo },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    expect(screen.getByTestId('no-repair-module')).toBeInTheDocument();
  });

  it('renders intact module with INTAKT label and no repair button', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk1, laserIntact] },
      cargo: { ...defaultCargo },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    expect(screen.getByTestId('damage-state-laser_mk1')).toHaveTextContent('repair.damageState.intact');
    expect(screen.queryByTestId('repair-btn-laser_mk1')).not.toBeInTheDocument();
  });

  it('shows LEICHT damage state for a lightly damaged module', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk1, laserLightDamage] },
      cargo: { ...defaultCargo },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    expect(screen.getByTestId('damage-state-laser_mk1')).toHaveTextContent('repair.damageState.light');
  });

  it('shows repair button with cost for light damage when repair module is installed', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk1, laserLightDamage] },
      cargo: { ...defaultCargo, ore: 10 },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    // Repair button should be present
    expect(screen.getByTestId('repair-btn-laser_mk1')).toBeInTheDocument();
    // Cost: tier 1 × 5 ore = 5 ore for light → intact (shown as "5 resources.ore" from i18n mock)
    expect(screen.getByText(/5 resources\.ore/i)).toBeInTheDocument();
  });

  it('calls sendRepairModule when repair button is clicked', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk1, laserLightDamage] },
      cargo: { ...defaultCargo, ore: 10 },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    fireEvent.click(screen.getByTestId('repair-btn-laser_mk1'));
    expect(network.sendRepairModule).toHaveBeenCalledWith('laser_mk1');
  });

  it('disables repair button when insufficient resources', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk1, laserLightDamage] },
      cargo: { ...defaultCargo, ore: 0 },  // 0 ore — not enough for repair
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    const btn = screen.getByTestId('repair-btn-laser_mk1');
    expect(btn).toBeDisabled();
  });

  it('shows SCHWER damage and requires T3 for Tier 1 repair drone', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk1, laserHeavyDamage] },
      cargo: { ...defaultCargo, ore: 20, crystal: 20 },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    expect(screen.getByTestId('damage-state-laser_mk1')).toHaveTextContent('repair.damageState.heavy');
    // No repair button — T1 can't do heavy
    expect(screen.queryByTestId('repair-btn-laser_mk1')).not.toBeInTheDocument();
    // Shows "repair.needsT3Drone" key
    expect(screen.getByText(/repair\.needsT3Drone/i)).toBeInTheDocument();
  });

  it('allows heavy repair with T3 repair drone', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk3, laserHeavyDamage] },
      cargo: { ...defaultCargo, ore: 20, crystal: 20 },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    expect(screen.getByTestId('repair-btn-laser_mk1')).toBeInTheDocument();
    // Cost: tier 3 × 3 ore + tier 3 × 2 crystal = 9 ore + 6 crystal
    // With i18n mock: "9 resources.ore" and "6 resources.crystal"
    expect(screen.getAllByText(/9 resources\.ore/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/6 resources\.crystal/i).length).toBeGreaterThanOrEqual(1);
  });

  it('shows ZERSTÖRT damage state', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk3, laserDestroyed] },
      cargo: { ...defaultCargo, crystal: 20 },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    expect(screen.getByTestId('damage-state-laser_mk1')).toHaveTextContent('repair.damageState.destroyed');
    // Cost: tier 3 × 5 crystal = 15 crystal (shown as "15 resources.crystal")
    expect(screen.getByText(/15 resources\.crystal/i)).toBeInTheDocument();
  });

  it('does not show station repair button when not at station', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk1, laserLightDamage] },
      cargo: { ...defaultCargo },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    expect(screen.queryByTestId('station-repair-btn')).not.toBeInTheDocument();
  });

  it('shows station repair button when at station with damage', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [laserLightDamage] },  // no repair drone needed for station
      cargo: { ...defaultCargo },
      currentSector: emptyStation,
      credits: 500,
    });
    render(<RepairPanel />);
    expect(screen.getByTestId('station-repair-btn')).toBeInTheDocument();
  });

  it('calls sendStationRepair when station repair button is clicked', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [laserLightDamage] },
      cargo: { ...defaultCargo },
      currentSector: emptyStation,
      credits: 500,
    });
    render(<RepairPanel />);
    fireEvent.click(screen.getByTestId('station-repair-btn'));
    expect(network.sendStationRepair).toHaveBeenCalled();
  });

  it('disables station repair when credits are insufficient', () => {
    mockStoreState({
      ship: { ...baseShip, modules: [laserLightDamage] },
      cargo: { ...defaultCargo },
      currentSector: emptyStation,
      credits: 0,  // can't afford
    });
    render(<RepairPanel />);
    expect(screen.getByTestId('station-repair-btn')).toBeDisabled();
  });

  it('shows all modules in the module list', () => {
    // Use two different module IDs to avoid React key collision warning
    const railgunIntact = {
      moduleId: 'railgun_mk1',
      category: 'weapon',
      tier: 1,
      currentHp: 20,
      maxHp: 20,
      powerLevel: 'high' as const,
    };
    mockStoreState({
      ship: { ...baseShip, modules: [repairDroneMk1, laserIntact, railgunIntact] },
      cargo: { ...defaultCargo },
      currentSector: emptySector,
      credits: 500,
    });
    render(<RepairPanel />);
    expect(screen.getByTestId('module-row-repair_mk1')).toBeInTheDocument();
    expect(screen.getByTestId('module-row-laser_mk1')).toBeInTheDocument();
    expect(screen.getByTestId('module-row-railgun_mk1')).toBeInTheDocument();
  });
});
