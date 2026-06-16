export const SELLABLE_RESOURCES = ['ore', 'gas', 'crystal'];
/** Default program-length limits per computer level (MK.I-V). Server may override via game_config. */
export const AUTOMATION_PROGRAM_LIMITS = {
    1: 10,
    2: 25,
    3: 50,
    4: 75,
    5: 120,
};
/** Offline-execution window (hours) per computer tier. Server may override via game_config. */
export const AUTOMATION_OFFLINE_WINDOW_HOURS_MK4 = 4;
export const AUTOMATION_OFFLINE_WINDOW_HOURS_MK5 = 12;
/** Offline-scheduler safety caps (used by Plan 3). Server may override via game_config. */
export const AUTOMATION_MAX_CONCURRENT_OFFLINE = 50;
export const AUTOMATION_TICK_WORK_BUDGET = 200;
export const AUTOMATION_SCHEDULER_INTERVAL_MS = 1000;
//# sourceMappingURL=types.js.map