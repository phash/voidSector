/**
 * Create a new HyperdriveState from ship stats.
 * Charge starts at maxCharge (fully charged).
 */
export function createHyperdriveState(stats, now) {
    const timestamp = now ?? Date.now();
    return {
        charge: stats.hyperdriveRange,
        maxCharge: stats.hyperdriveRange,
        regenPerSecond: stats.hyperdriveRegen,
        lastTick: timestamp,
    };
}
/**
 * Lazy-evaluate current hyperdrive charge based on elapsed time.
 * Follows the same pattern as AP lazy evaluation:
 * charge + elapsed * regenPerSecond, clamped to [0, maxCharge].
 */
export function calculateCurrentCharge(state, now) {
    const timestamp = now ?? Date.now();
    const elapsedSeconds = Math.max(0, (timestamp - state.lastTick) / 1000);
    const rawCharge = state.charge + elapsedSeconds * state.regenPerSecond;
    return Math.min(rawCharge, state.maxCharge);
}
/**
 * Attempt to spend hyperdrive charge for a jump.
 * Returns updated HyperdriveState on success, or null if insufficient charge.
 */
export function spendCharge(state, amount, now) {
    const timestamp = now ?? Date.now();
    const current = calculateCurrentCharge(state, timestamp);
    if (current < amount)
        return null;
    return {
        charge: current - amount,
        maxCharge: state.maxCharge,
        regenPerSecond: state.regenPerSecond,
        lastTick: timestamp,
    };
}
//# sourceMappingURL=hyperdriveCalc.js.map