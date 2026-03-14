/** Returns true if a module is available without research (no researchCost) */
export declare function isModuleFreelyAvailable(moduleId: string): boolean;
/** Returns true if a module is unlocked (freely available, blueprint + tier, or tech-tree tier) */
export declare function isModuleUnlocked(moduleId: string, mod: {
    category: string;
    tier: number;
}, researchedNodes: Record<string, number>, blueprints: string[]): boolean;
//# sourceMappingURL=research.d.ts.map