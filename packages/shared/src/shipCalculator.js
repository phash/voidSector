import { HULLS, MODULES, ACEP_LEVEL_THRESHOLDS, ACEP_LEVEL_MULTIPLIERS, ACEP_EXTRA_SLOT_THRESHOLDS, DEFENSE_ONLY_CATEGORIES, SPECIALIZED_SLOT_CATEGORIES, UNIQUE_MODULE_CATEGORIES, BASE_HULL_AP_REGEN, POWER_LEVEL_MULTIPLIERS, BASE_SCANNER_MEMORY, } from './constants.js';
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
export function calculateShipStats(hullType, modules, acepXp) {
    const hull = HULLS[hullType];
    const stats = {
        fuelMax: hull.baseFuel,
        cargoCap: hull.baseCargo,
        jumpRange: hull.baseJumpRange,
        apCostJump: hull.baseApPerJump,
        fuelPerJump: hull.baseFuelPerJump,
        hp: hull.baseHp,
        commRange: hull.baseCommRange,
        scannerLevel: hull.baseScannerLevel,
        damageMod: 1.0,
        // Combat v2
        shieldHp: 0,
        shieldRegen: 0,
        weaponAttack: 0,
        weaponType: 'none',
        weaponPiercing: 0,
        pointDefense: 0,
        ecmReduction: 0,
        engineSpeed: hull.baseEngineSpeed,
        artefactChanceBonus: 0,
        safeSlotBonus: 0,
        // Hyperdrive
        hyperdriveRange: hull.baseHyperdriveRange,
        hyperdriveSpeed: hull.baseHyperdriveSpeed,
        hyperdriveRegen: hull.baseHyperdriveRegen,
        hyperdriveFuelEfficiency: hull.baseHyperdriveFuelEfficiency,
        miningBonus: 0,
        generatorEpPerRound: 0,
        repairHpPerRound: 0,
        repairHpPerSecond: 0,
        memory: BASE_SCANNER_MEMORY,
    };
    // Pre-compute ACEP levels per path
    const levels = acepXp
        ? {
            ausbau: getAcepLevel(acepXp.ausbau),
            intel: getAcepLevel(acepXp.intel),
            kampf: getAcepLevel(acepXp.kampf),
            explorer: getAcepLevel(acepXp.explorer),
        }
        : {};
    for (const mod of modules) {
        const def = MODULES[mod.moduleId];
        if (!def)
            continue;
        // Determine multiplier: highest level among module's ACEP paths
        const modPaths = def.acepPaths ?? [];
        const multiplier = modPaths.length > 0 && acepXp
            ? Math.max(...modPaths.map((p) => ACEP_LEVEL_MULTIPLIERS[levels[p]] ?? 1.0))
            : 1.0;
        for (const [key, value] of Object.entries(def.effects)) {
            if (typeof value !== 'number') {
                // e.g. weaponType — not a number, assign directly
                stats[key] = value;
                continue;
            }
            if (key === 'damageMod') {
                // damageMod is always additive, never multiplied
                stats.damageMod += value;
            }
            else {
                // Positive values are multiplied by ACEP multiplier; negatives are not
                stats[key] += value > 0 ? value * multiplier : value;
            }
        }
    }
    // Clamp minimums
    stats.apCostJump = Math.max(0.5, stats.apCostJump);
    stats.jumpRange = Math.max(1, stats.jumpRange);
    stats.damageMod = Math.max(0.25, stats.damageMod);
    stats.engineSpeed = Math.max(1, Math.min(5, stats.engineSpeed));
    stats.hyperdriveFuelEfficiency = Math.max(0, Math.min(1, stats.hyperdriveFuelEfficiency));
    stats.memory = Math.max(0, Math.round(stats.memory));
    return stats;
}
export function validateModuleInstall(hullType, currentModules, moduleId, slotIndex, acepXp = { ausbau: 0, intel: 0, kampf: 0, explorer: 0 }) {
    const moduleDef = MODULES[moduleId];
    if (!moduleDef)
        return { valid: false, error: 'Unbekanntes Modul' };
    const category = moduleDef.category;
    const specializedSlotCount = SPECIALIZED_SLOT_CATEGORIES.length; // 8
    const isSpecializedSlot = slotIndex < specializedSlotCount;
    const isExtraSlot = slotIndex >= specializedSlotCount;
    const extraSlotCount = getExtraSlotCount(acepXp.ausbau);
    const maxAllowedSlotIndex = specializedSlotCount + extraSlotCount - 1; // z.B. bei 1 extra slot = max index 8
    // defense/special nur in Extra-Slots
    if (DEFENSE_ONLY_CATEGORIES.includes(category) && isSpecializedSlot) {
        return { valid: false, error: `${category}-Module können nur in Extra-Slots installiert werden` };
    }
    // Specialized Slot: nur passende Kategorie
    if (isSpecializedSlot) {
        const expectedCategory = SPECIALIZED_SLOT_CATEGORIES[slotIndex];
        if (expectedCategory && expectedCategory !== category && !DEFENSE_ONLY_CATEGORIES.includes(category)) {
            return { valid: false, error: `Specialized Slot ${slotIndex} ist für '${expectedCategory}' reserviert` };
        }
    }
    // Extra-Slot: AUSBAU-Gate
    if (isExtraSlot) {
        if (extraSlotCount === 0 || slotIndex > maxAllowedSlotIndex) {
            return { valid: false, error: `Extra-Slot ${slotIndex} noch nicht freigeschaltet — benötigt höheres AUSBAU-Level` };
        }
    }
    // Unique-Enforcement: max 1× pro Schiff (auch in Extra-Slots)
    if (moduleDef.isUnique || UNIQUE_MODULE_CATEGORIES.includes(category)) {
        const alreadyInstalled = currentModules.some((m) => {
            const existingDef = MODULES[m.moduleId];
            return existingDef?.category === category;
        });
        if (alreadyInstalled) {
            return { valid: false, error: `Unique-Modul: ${category} bereits installiert. Nur 1× pro Schiff erlaubt.` };
        }
    }
    // Slot bereits belegt?
    if (currentModules.some((m) => m.slotIndex === slotIndex)) {
        return { valid: false, error: 'Slot bereits belegt' };
    }
    return { valid: true };
}
/** Returns all active runtime drawback IDs from installed modules */
export function getActiveDrawbacks(modules) {
    const effects = [];
    for (const mod of modules) {
        const def = MODULES[mod.moduleId];
        if (!def?.drawbacks)
            continue;
        for (const drawback of def.drawbacks) {
            if (drawback.runtimeEffect)
                effects.push(drawback.runtimeEffect);
        }
    }
    return effects;
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
    const def = MODULES[mod.moduleId];
    if (!def)
        return requested;
    const maxHp = def.maxHp ?? 20;
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
/** Calculates AP/s based on installed generator module + base hull regen */
export function calculateApRegen(modules) {
    let regen = BASE_HULL_AP_REGEN;
    for (const mod of modules) {
        const def = MODULES[mod.moduleId];
        if (!def || def.category !== 'generator')
            continue;
        const apPerSecond = def.effects.apRegenPerSecond ?? 0;
        const effectivePower = getModuleEffectivePowerLevel(mod);
        const multiplier = POWER_LEVEL_MULTIPLIERS[effectivePower] ?? 0;
        const maxHp = def.maxHp ?? 20;
        const currentHp = mod.currentHp ?? maxHp;
        const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
        regen += apPerSecond * multiplier * hpRatio;
    }
    return regen;
}
//# sourceMappingURL=shipCalculator.js.map