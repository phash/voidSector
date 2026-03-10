import { describe, test, expect } from 'vitest';
import { civShipBus } from '../civShipBus.js';

describe('civShipBus', () => {
  test('emits civShipsTick event with correct data', () => {
    return new Promise<void>((resolve) => {
      const handler = (data: { qx: number; qy: number; ships: unknown[] }) => {
        expect(data.qx).toBe(1);
        expect(data.qy).toBe(0);
        expect(data.ships).toHaveLength(0);
        civShipBus.off('civShipsTick', handler);
        resolve();
      };
      civShipBus.on('civShipsTick', handler);
      civShipBus.broadcastTick({ qx: 1, qy: 0, ships: [] });
    });
  });
});
