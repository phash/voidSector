import { describe, it, expect } from 'vitest';
import type { ResourceType, MineableResourceType, CargoState, StorageInventory } from '../types.js';
import { RESOURCE_TYPES, ARTEFACT_DROP_CHANCES, NPC_PRICES, SECTOR_RESOURCE_YIELDS } from '../constants.js';

describe('Artefact resource type', () => {
  it('ResourceType includes artefact', () => {
    const r: ResourceType = 'artefact';
    expect(r).toBe('artefact');
  });

  it('MineableResourceType excludes artefact', () => {
    const types: MineableResourceType[] = ['ore', 'gas', 'crystal'];
    expect(types).not.toContain('artefact');
  });

  it('RESOURCE_TYPES only contains mineable resources', () => {
    expect(RESOURCE_TYPES).toEqual(['ore', 'gas', 'crystal']);
    expect(RESOURCE_TYPES).not.toContain('artefact');
  });

  it('CargoState includes artefact field', () => {
    const cargo: CargoState = { ore: 0, gas: 0, crystal: 0, slates: 0, artefact: 5 };
    expect(cargo.artefact).toBe(5);
  });

  it('StorageInventory includes artefact field', () => {
    const storage: StorageInventory = { ore: 0, gas: 0, crystal: 0, artefact: 3 };
    expect(storage.artefact).toBe(3);
  });

  it('NPC_PRICES does not include artefact', () => {
    expect('artefact' in NPC_PRICES).toBe(false);
  });

  it('SECTOR_RESOURCE_YIELDS does not include artefact in any sector', () => {
    for (const yields of Object.values(SECTOR_RESOURCE_YIELDS)) {
      expect('artefact' in yields).toBe(false);
    }
  });

  it('ARTEFACT_DROP_CHANCES are valid probabilities', () => {
    for (const chance of Object.values(ARTEFACT_DROP_CHANCES)) {
      expect(chance).toBeGreaterThan(0);
      expect(chance).toBeLessThanOrEqual(1);
    }
  });
});
