import { describe, it, expect } from 'vitest';
import { resolveOwnStationRefuel } from '../stationRefuelDecision.js';

describe('resolveOwnStationRefuel', () => {
  it('refuels from owned station fuel, capped by tank space', () => {
    const r = resolveOwnStationRefuel({ owner_id: 'o1', cargo_contents: { fuel: 500 } }, 'o1', 200);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.amount).toBe(200); expect(r.newStationFuel).toBe(300); }
  });
  it('caps at the station fuel when less than tank space', () => {
    const r = resolveOwnStationRefuel({ owner_id: 'o1', cargo_contents: { fuel: 40 } }, 'o1', 200);
    expect(r.ok && r.amount).toBe(40);
  });
  it('is not applicable for a non-owner', () => {
    expect(resolveOwnStationRefuel({ owner_id: 'o2', cargo_contents: { fuel: 500 } }, 'o1', 200).ok).toBe(false);
  });
  it('is not applicable when the station has no fuel', () => {
    expect(resolveOwnStationRefuel({ owner_id: 'o1', cargo_contents: {} }, 'o1', 200).ok).toBe(false);
  });
  it('is not applicable when there is no station', () => {
    expect(resolveOwnStationRefuel(null, 'o1', 200).ok).toBe(false);
  });
});
