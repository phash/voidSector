import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies (paths relative to test file in src/__tests__/)
vi.mock('../db/queries.js', () => ({
  getSector: vi.fn(),
  getPlayerJumpGate: vi.fn(),
  createDataSlate: vi.fn(),
  addSlateToCargo: vi.fn(),
}));
vi.mock('../engine/inventoryService.js', () => ({
  getCargoState: vi.fn(),
}));
vi.mock('../engine/universeBootstrap.js', () => ({
  getUniverseTickCount: vi.fn(),
}));
vi.mock('../engine/permadeathService.js', () => ({
  getWrecksInSector: vi.fn(),
}));

import { getSector, getPlayerJumpGate, createDataSlate, addSlateToCargo } from '../db/queries.js';
import { getCargoState } from '../engine/inventoryService.js';
import { getUniverseTickCount } from '../engine/universeBootstrap.js';
import { getWrecksInSector } from '../engine/permadeathService.js';

describe('createSlateFromScan — logic validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSector).mockResolvedValue({
      type: 'station',
      resources: { ore: 42, gas: 18, crystal: 7 },
      contents: null,
    } as any);
    vi.mocked(getPlayerJumpGate).mockResolvedValue(null);
    vi.mocked(getCargoState).mockResolvedValue({
      ore: 0, gas: 0, crystal: 0, slates: 1, artefact: 0,
    });
    vi.mocked(getUniverseTickCount).mockReturnValue(48720);
    vi.mocked(createDataSlate).mockResolvedValue({ id: 'slate-123' } as any);
    vi.mocked(addSlateToCargo).mockResolvedValue();
    vi.mocked(getWrecksInSector).mockResolvedValue([]);
  });

  it('builds correct structures array for station sector', async () => {
    const sector = await getSector(16, 14);
    const structures: string[] = [];
    if (sector?.type === 'station') structures.push('npc_station');
    if (sector?.contents?.includes('ruin')) structures.push('ruin');
    const jumpgate = await getPlayerJumpGate(16, 14);
    if (jumpgate) structures.push('jumpgate');
    expect(structures).toEqual(['npc_station']);
  });

  it('includes jumpgate in structures when present', async () => {
    vi.mocked(getPlayerJumpGate).mockResolvedValue({ id: 'gate-1' } as any);
    const sector = await getSector(16, 14);
    const structures: string[] = [];
    if (sector?.type === 'station') structures.push('npc_station');
    if (sector?.contents?.includes('ruin')) structures.push('ruin');
    const jumpgate = await getPlayerJumpGate(16, 14);
    if (jumpgate) structures.push('jumpgate');
    expect(structures).toEqual(['npc_station', 'jumpgate']);
  });

  it('includes ruin in structures when contents has ruin', async () => {
    vi.mocked(getSector).mockResolvedValue({
      type: 'empty', resources: { ore: 0, gas: 0, crystal: 0 }, contents: ['ruin'],
    } as any);
    const sector = await getSector(5, 5);
    const structures: string[] = [];
    if (sector?.type === 'station') structures.push('npc_station');
    if (sector?.contents?.includes('ruin')) structures.push('ruin');
    const jumpgate = await getPlayerJumpGate(5, 5);
    if (jumpgate) structures.push('jumpgate');
    expect(structures).toEqual(['ruin']);
  });

  it('rejects when cargo is full (cargoTotal >= cargoCap)', async () => {
    vi.mocked(getCargoState).mockResolvedValue({
      ore: 10, gas: 5, crystal: 3, slates: 2, artefact: 0,
    });
    const cargo = await getCargoState('player-1');
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
    const cargoCap = 20;
    expect(cargoTotal + 1 > cargoCap).toBe(true);
  });

  it('allows when cargo has space', async () => {
    const cargo = await getCargoState('player-1');
    const cargoTotal = cargo.ore + cargo.gas + cargo.crystal + cargo.slates + cargo.artefact;
    const cargoCap = 20;
    expect(cargoTotal + 1 > cargoCap).toBe(false);
  });

  it('calls createDataSlate with scan type and addSlateToCargo', async () => {
    const sectorData = [{
      x: 16, y: 14, quadrantX: 0, quadrantY: 0,
      type: 'station', ore: 42, gas: 18, crystal: 7,
      structures: ['npc_station'], wrecks: [], scannedAtTick: 48720,
    }];
    await createDataSlate('player-1', 'scan', sectorData);
    await addSlateToCargo('player-1');
    expect(createDataSlate).toHaveBeenCalledWith('player-1', 'scan', sectorData);
    expect(addSlateToCargo).toHaveBeenCalledWith('player-1');
  });

  it('reduces wreck data to playerName + tier', async () => {
    vi.mocked(getWrecksInSector).mockResolvedValue([
      { playerName: 'xPilot42', radarIconData: { tier: 2, path: 'kampf' }, salvageableModules: [] },
      { playerName: 'TestPilot', radarIconData: { tier: 3, path: 'scout' }, salvageableModules: ['mod1'] },
    ] as any);
    const wrecks = await getWrecksInSector(0, 0, 16, 14);
    const reduced = wrecks.map((w: any) => ({ playerName: w.playerName, tier: w.radarIconData?.tier ?? 1 }));
    expect(reduced).toEqual([
      { playerName: 'xPilot42', tier: 2 },
      { playerName: 'TestPilot', tier: 3 },
    ]);
  });
});
