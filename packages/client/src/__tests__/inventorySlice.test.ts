import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../state/store';

beforeEach(() => {
  // Reset inventory to empty before each test
  useStore.getState().setInventory([]);
});

describe('inventory state in gameSlice', () => {
  it('starts with empty inventory', () => {
    const items = useStore.getState().inventory;
    expect(items).toHaveLength(0);
  });

  it('setInventory updates inventory state', () => {
    const store = useStore.getState();
    store.setInventory([
      { itemType: 'resource', itemId: 'ore', quantity: 5 },
      { itemType: 'module', itemId: 'drive_mk2', quantity: 1 },
    ]);
    const items = useStore.getState().inventory;
    expect(items).toHaveLength(2);
    expect(items[0].itemId).toBe('ore');
  });

  it('setInventory replaces previous inventory', () => {
    useStore.getState().setInventory([{ itemType: 'resource', itemId: 'ore', quantity: 5 }]);
    useStore.getState().setInventory([{ itemType: 'module', itemId: 'shield_mk1', quantity: 2 }]);
    const items = useStore.getState().inventory;
    expect(items).toHaveLength(1);
    expect(items[0].itemId).toBe('shield_mk1');
  });

  it('setInventory can set blueprint items', () => {
    useStore.getState().setInventory([
      { itemType: 'blueprint', itemId: 'drive_mk3_blueprint', quantity: 1 },
    ]);
    const items = useStore.getState().inventory;
    expect(items[0].itemType).toBe('blueprint');
    expect(items[0].itemId).toBe('drive_mk3_blueprint');
    expect(items[0].quantity).toBe(1);
  });

  it('filters by itemType correctly', () => {
    useStore.getState().setInventory([
      { itemType: 'resource', itemId: 'ore', quantity: 10 },
      { itemType: 'module', itemId: 'laser_mk1', quantity: 1 },
      { itemType: 'blueprint', itemId: 'shield_blueprint', quantity: 2 },
    ]);
    const items = useStore.getState().inventory;
    const resources = items.filter((i) => i.itemType === 'resource');
    const modules = items.filter((i) => i.itemType === 'module');
    const blueprints = items.filter((i) => i.itemType === 'blueprint');
    expect(resources).toHaveLength(1);
    expect(modules).toHaveLength(1);
    expect(blueprints).toHaveLength(1);
  });
});
