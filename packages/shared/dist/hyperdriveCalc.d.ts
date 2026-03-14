import type { HyperdriveState, ShipStats } from './types.js';
/**
 * Create a new HyperdriveState from ship stats.
 * Charge starts at maxCharge (fully charged).
 */
export declare function createHyperdriveState(stats: Pick<ShipStats, 'hyperdriveRange' | 'hyperdriveRegen'>, now?: number): HyperdriveState;
/**
 * Lazy-evaluate current hyperdrive charge based on elapsed time.
 * Follows the same pattern as AP lazy evaluation:
 * charge + elapsed * regenPerSecond, clamped to [0, maxCharge].
 */
export declare function calculateCurrentCharge(state: HyperdriveState, now?: number): number;
/**
 * Attempt to spend hyperdrive charge for a jump.
 * Returns updated HyperdriveState on success, or null if insufficient charge.
 */
export declare function spendCharge(state: HyperdriveState, amount: number, now?: number): HyperdriveState | null;
//# sourceMappingURL=hyperdriveCalc.d.ts.map