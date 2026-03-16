import type { ShipModule, ShipStats, AcepXpSnapshot } from './types.js';
/** Returns ACEP level (1–5) for a given XP value. */
export declare function getAcepLevel(xp: number): number;
/** Returns the number of extra slots unlocked based on ausbau XP. */
export declare function getExtraSlotCount(ausbauXp: number): number;
/**
 * Calculates ship stats from installed modules using MODULE_DEFINITIONS.
 */
export declare function calculateShipStats(installedModules: Array<{
    moduleId: string;
    slot?: string;
    slotIndex?: number;
    currentHp?: number;
    source?: string;
    powerLevel?: string;
}>, acepXp?: AcepXpSnapshot | {
    ausbau?: number;
    intel?: number;
    kampf?: number;
    explorer?: number;
}): ShipStats;
export declare function validateModuleInstall(currentModules: ShipModule[], moduleId: string, slotIndex: number, acepXp?: AcepXpSnapshot): {
    valid: boolean;
    error?: string;
};
/** Returns all active runtime drawback IDs from installed modules.
 *  NOTE: New MODULE_DEFINITIONS don't have drawbacks — this returns [] for now.
 */
export declare function getActiveDrawbacks(_modules: ShipModule[]): string[];
export type DamageState = 'intact' | 'light' | 'heavy' | 'destroyed';
/** Derives damage state from currentHp/maxHp ratio */
export declare function getDamageState(currentHp: number, maxHp: number): DamageState;
/** Returns effective power level after applying damage state caps */
export declare function getModuleEffectivePowerLevel(mod: ShipModule): 'off' | 'low' | 'mid' | 'high';
/** Calculates AP/s based on installed generator module + base hull regen */
export declare function calculateApRegen(modules: ShipModule[]): number;
//# sourceMappingURL=shipCalculator.d.ts.map