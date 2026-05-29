export interface ModuleDefinition {
    id: string;
    name: string;
    category: string;
    tier: number;
    slot: string;
    costCredits: number;
    costOre: number;
    costGas: number;
    costCrystal: number;
    costArtefact: string;
    apCost: number;
    energyCost: number;
    hitpoints: number;
    stats: Record<string, number>;
    description: string;
    isFoundOnly: boolean;
    isUnique: boolean;
    prerequisiteModuleId?: string;
}
export declare const MODULE_DEFINITIONS: ModuleDefinition[];
/** Keyed lookup map for MODULE_DEFINITIONS by module id */
export declare const MODULE_MAP: Map<string, ModuleDefinition>;
//# sourceMappingURL=moduleDefinitions.d.ts.map