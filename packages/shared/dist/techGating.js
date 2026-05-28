import { MODULE_DEFINITIONS, MODULE_MAP } from './moduleDefinitions.js';
export const RESEARCH_TIER_BASE_WISSEN = 15;
export function getResearchCost(targetTier) {
    return RESEARCH_TIER_BASE_WISSEN * (targetTier - 1);
}
const MAX_TIER_BY_CATEGORY = (() => {
    const m = {};
    for (const def of MODULE_DEFINITIONS) {
        m[def.category] = Math.max(m[def.category] ?? 1, def.tier);
    }
    return m;
})();
export function getMaxTier(category) {
    return MAX_TIER_BY_CATEGORY[category] ?? 1;
}
export function isModuleUnlocked(moduleId, categoryTiers, blueprints) {
    const def = MODULE_MAP.get(moduleId);
    if (!def)
        return false;
    if (def.isFoundOnly)
        return blueprints.includes(moduleId);
    const unlocked = categoryTiers[def.category] ?? 1;
    return def.tier <= unlocked;
}
//# sourceMappingURL=techGating.js.map