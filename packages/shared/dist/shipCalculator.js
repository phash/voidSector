import { ACEP_LEVEL_THRESHOLDS, ACEP_EXTRA_SLOT_THRESHOLDS, getAcepUnlockedSlots, SPECIALIZED_SLOT_CATEGORIES, UNIQUE_MODULE_CATEGORIES, BASE_HULL_AP_REGEN, BASE_SCANNER_MEMORY, FUEL_MIN_TANK, BASE_FUEL_CAPACITY, BASE_FUEL_PER_JUMP, BASE_CARGO, BASE_HP, BASE_JUMP_RANGE, BASE_ENGINE_SPEED, BASE_COMM_RANGE, BASE_SCANNER_LEVEL, } from './constants.js';
import { MODULE_MAP } from './moduleDefinitions.js';
/** Returns ACEP level (1–5) for a given XP value. */
export function getAcepLevel(xp) {
    let level = 1;
    for (const [lvl, threshold] of Object.entries(ACEP_LEVEL_THRESHOLDS)) {
        if (xp >= threshold) {
            level = Number(lvl);
        }
    }
    return level;
}
/** Returns the number of extra slots unlocked based on ausbau XP. */
export function getExtraSlotCount(ausbauXp) {
    return ACEP_EXTRA_SLOT_THRESHOLDS.filter((t) => ausbauXp >= t).length;
}
// ─── V2 calculateShipStats (new module system) ────────────────────────────────
/**
 * Calculates ship stats from installed modules using MODULE_DEFINITIONS.
 */
export function calculateShipStats(installedModules, acepXp) {
    return _calculateShipStatsV2(installedModules, acepXp);
}
/** V2 calculator — uses MODULE_DEFINITIONS (new module system). */
function _calculateShipStatsV2(installedModules, acepXp) {
    const stats = {
        // Legacy fields (kept for backward compat)
        fuelMax: BASE_FUEL_CAPACITY,
        cargoCap: BASE_CARGO,
        jumpRange: BASE_JUMP_RANGE,
        apCostJump: 1,
        fuelPerJump: BASE_FUEL_PER_JUMP,
        hp: BASE_HP,
        commRange: BASE_COMM_RANGE,
        scannerLevel: BASE_SCANNER_LEVEL,
        damageMod: 1.0,
        shieldHp: 0,
        shieldRegen: 0,
        weaponAttack: 0,
        weaponType: 'none',
        weaponPiercing: 0,
        pointDefense: 0,
        ecmReduction: 0,
        engineSpeed: BASE_ENGINE_SPEED,
        artefactChanceBonus: 0,
        safeSlotBonus: 0,
        hyperdriveRange: 0,
        hyperdriveSpeed: 0,
        hyperdriveRegen: 0,
        hyperdriveFuelEfficiency: 0,
        miningBonus: 0,
        generatorEpPerRound: 0,
        repairHpPerRound: 0,
        repairHpPerSecond: 0,
        memory: BASE_SCANNER_MEMORY,
        // V2 new fields
        apRegen: 0,
        energyBudget: 0,
        jumpDistance: 0,
        rechargeRate: 0,
        fuelCapacity: 0,
        fuelPerSector: 0,
        msPerSector: 0,
        scanRange: 0,
        miningSpeed: 0,
        armorHp: 0,
        maxHp: 0,
    };
    for (const mod of installedModules) {
        const def = MODULE_MAP.get(mod.moduleId);
        if (!def)
            continue;
        // Accumulate total HP
        const currentHp = mod.currentHp ?? def.hitpoints;
        stats.maxHp = (stats.maxHp ?? 0) + def.hitpoints;
        const category = def.category;
        if (category === 'generator') {
            // apCost is negative for generators → apRegen = |apCost|
            stats.apRegen = (stats.apRegen ?? 0) + Math.abs(def.apCost);
            // energyCost is negative for generators → energyBudget = |energyCost|
            stats.energyBudget = (stats.energyBudget ?? 0) + Math.abs(def.energyCost);
        }
        else if (category === 'drive') {
            stats.jumpDistance = def.stats['jumpDistance'] ?? 0;
            stats.rechargeRate = def.stats['rechargeRate'] ?? 0;
            stats.fuelCapacity = def.stats['fuelCapacity'] ?? 0;
            stats.fuelPerSector = def.stats['fuelPerSector'] ?? 0;
            stats.msPerSector = def.stats['msPerSector'] ?? 0;
            // Map V2 stats to legacy fields used by hyperjump system
            stats.hyperdriveRange = def.stats['jumpDistance'] ?? 0;
            stats.hyperdriveSpeed = def.stats['msPerSector'] ?? 0;
            stats.hyperdriveRegen = def.stats['rechargeRate'] ?? 0;
            stats.fuelMax = Math.max(stats.fuelMax, def.stats['fuelCapacity'] ?? 0);
        }
        else if (category === 'scanner') {
            stats.scanRange = def.stats['scanRange'] ?? 0;
        }
        else if (category === 'mining') {
            const speed = def.stats['miningSpeed'] ?? 0;
            stats.miningSpeed = (stats.miningSpeed ?? 0) + speed;
            stats.miningBonus = stats.miningSpeed; // used for laser detection + rate calc
        }
        else if (category === 'cargo') {
            // base 20 + module cargoCapacity
            stats.cargoCap = BASE_CARGO + (def.stats['cargoCapacity'] ?? 0);
        }
        else if (category === 'shield') {
            stats.shieldHp = (stats.shieldHp ?? 0) + (def.stats['shield'] ?? 0);
            stats.shieldRegen = (stats.shieldRegen ?? 0) + (def.stats['regen'] ?? 0);
        }
        else if (category === 'armor') {
            stats.armorHp = (stats.armorHp ?? 0) + def.hitpoints;
        }
        // repair, weapon_*, defense: no exploration stats, only combat (handled via energyCost/stats)
    }
    // Ensure fuelMax reflects fuelCapacity
    if ((stats.fuelCapacity ?? 0) > 0) {
        stats.fuelMax = Math.max(FUEL_MIN_TANK, stats.fuelCapacity ?? 0);
    }
    else {
        stats.fuelMax = Math.max(FUEL_MIN_TANK, stats.fuelMax);
    }
    return stats;
}
export function validateModuleInstall(currentModules, moduleId, slotIndex, acepXp = { ausbau: 0, intel: 0, kampf: 0, explorer: 0, defense: 0, trader: 0, miner: 0 }) {
    const moduleDef = MODULE_MAP.get(moduleId);
    if (!moduleDef)
        return { valid: false, error: 'Unbekanntes Modul' };
    const category = moduleDef.category;
    const specializedSlotCount = SPECIALIZED_SLOT_CATEGORIES.length; // 9 (incl factory)
    const isSpecializedSlot = slotIndex < specializedSlotCount;
    const isExtraSlot = slotIndex >= specializedSlotCount;
    // Specialized Slot: nur passende Kategorie.
    // The 'weapon' base slot is a meta-category that accepts every weapon_* sub-category
    // (weapon_energy/weapon_kinetic/weapon_missile) — otherwise no weapon fits the base slot.
    if (isSpecializedSlot) {
        const expectedCategory = SPECIALIZED_SLOT_CATEGORIES[slotIndex];
        const matchesSlot = expectedCategory === category ||
            (expectedCategory === 'weapon' && category.startsWith('weapon_'));
        if (expectedCategory && !matchesSlot) {
            return { valid: false, error: `Slot ${slotIndex} ist für '${expectedCategory}' reserviert` };
        }
    }
    // Extra-Slot (ACEP path slots): check if unlocked and category allowed
    if (isExtraSlot) {
        const unlockedSlots = getAcepUnlockedSlots(acepXp);
        const extraIndex = slotIndex - specializedSlotCount;
        if (extraIndex >= unlockedSlots.length) {
            return { valid: false, error: `Slot ${slotIndex} noch nicht freigeschaltet` };
        }
        const slotDef = unlockedSlots[extraIndex];
        if (!slotDef.categories.includes(category)) {
            return { valid: false, error: `${slotDef.label}-Slot erlaubt nur: ${slotDef.categories.join(', ')}` };
        }
    }
    // Unique-Enforcement: only factory stays unique
    if (moduleDef.isUnique || UNIQUE_MODULE_CATEGORIES.includes(category)) {
        const alreadyInstalled = currentModules.some((m) => {
            const existingDef = MODULE_MAP.get(m.moduleId);
            return existingDef?.category === category;
        });
        if (alreadyInstalled) {
            return { valid: false, error: `${category} — nur 1× pro Schiff erlaubt` };
        }
    }
    // Slot already occupied?
    if (currentModules.some((m) => m.slotIndex === slotIndex)) {
        return { valid: false, error: 'Slot bereits belegt' };
    }
    return { valid: true };
}
/** Returns all active runtime drawback IDs from installed modules.
 *  NOTE: New MODULE_DEFINITIONS don't have drawbacks — this returns [] for now.
 */
export function getActiveDrawbacks(_modules) {
    return [];
}
/** Derives damage state from currentHp/maxHp ratio */
export function getDamageState(currentHp, maxHp) {
    if (maxHp <= 0)
        return 'destroyed';
    const ratio = currentHp / maxHp;
    if (ratio > 0.75)
        return 'intact';
    if (ratio > 0.50)
        return 'light';
    if (ratio > 0.25)
        return 'heavy';
    return 'destroyed';
}
/** Returns effective power level after applying damage state caps */
export function getModuleEffectivePowerLevel(mod) {
    const requested = mod.powerLevel ?? 'high';
    const def = MODULE_MAP.get(mod.moduleId);
    if (!def)
        return requested;
    const maxHp = def.hitpoints ?? 20;
    const currentHp = mod.currentHp ?? maxHp;
    const state = getDamageState(currentHp, maxHp);
    if (state === 'destroyed')
        return 'off';
    if (state === 'heavy' && (requested === 'high' || requested === 'mid'))
        return 'low';
    if (state === 'light' && requested === 'high')
        return 'mid';
    return requested;
}
/** Power-level multipliers for AP regen calculation */
const POWER_LEVEL_MULTIPLIERS = {
    off: 0.0, low: 0.4, mid: 0.7, high: 1.0,
};
/** Calculates AP/s based on installed generator module + base hull regen */
export function calculateApRegen(modules) {
    let regen = BASE_HULL_AP_REGEN;
    for (const mod of modules) {
        const def = MODULE_MAP.get(mod.moduleId);
        if (!def || def.category !== 'generator')
            continue;
        const apPerSecond = def.stats['apRegen'] ?? Math.abs(def.apCost) ?? 0;
        const effectivePower = getModuleEffectivePowerLevel(mod);
        const multiplier = POWER_LEVEL_MULTIPLIERS[effectivePower] ?? 0;
        const maxHp = def.hitpoints ?? 20;
        const currentHp = mod.currentHp ?? maxHp;
        const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
        regen += apPerSecond * multiplier * hpRatio;
    }
    return regen;
}
/** Highest tier among installed `computer` modules (the ship-computer level); 0 if none. */
export function getShipComputerLevel(modules) {
    let level = 0;
    for (const m of modules) {
        const def = MODULE_MAP.get(m.moduleId);
        if (def?.category === 'computer' && def.tier > level)
            level = def.tier;
    }
    return level;
}
//# sourceMappingURL=shipCalculator.js.map