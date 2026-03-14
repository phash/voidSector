export type TechBranch = 'kampf' | 'ausbau' | 'intel' | 'explorer';
export type TechNodeType = 'branch' | 'module' | 'specialization' | 'leaf';
export type TechStatKey = 'weapon_damage' | 'weapon_range' | 'weapon_efficiency' | 'shield_strength' | 'shield_regen' | 'shield_efficiency' | 'cargo_capacity' | 'cargo_weight' | 'cargo_protection' | 'mining_yield' | 'mining_speed' | 'mining_range' | 'scan_range' | 'scan_detail' | 'scan_speed' | 'sensor_precision' | 'sensor_stealth' | 'sensor_range' | 'lab_wissen_rate' | 'lab_efficiency' | 'lab_capacity' | 'drive_ap_efficiency' | 'drive_speed' | 'drive_jump_range' | 'fuel_capacity' | 'fuel_consumption' | 'fuel_regen' | 'nav_autopilot' | 'nav_route_efficiency' | 'nav_discovery';
export interface TechEffect {
    type: 'unlock_tier' | 'stat_bonus';
    /** For unlock_tier: module category. For stat_bonus: stat key */
    target: string;
    /** For unlock_tier: tier number. For stat_bonus: bonus value (decimal, e.g. 0.15 = +15%) */
    value: number;
    /** Optional penalty for stat_bonus */
    penalty?: {
        target: TechStatKey;
        value: number;
    };
}
export interface TechTreeNode {
    id: string;
    type: TechNodeType;
    name: string;
    description: string;
    parent: string | null;
    exclusiveGroup?: string;
    maxLevel: number;
    baseCost: number;
    costPerLevel?: number[];
    effects: TechEffect[];
    branch: TechBranch;
    depth: number;
}
export declare const TECH_TREE_NODES: Record<string, TechTreeNode>;
export declare const TECH_TREE_NODE_COUNT: number;
export declare function getTechNode(id: string): TechTreeNode | undefined;
export declare function getChildNodes(parentId: string): TechTreeNode[];
export declare function getExclusiveGroup(nodeId: string): string | undefined;
export declare const BRANCH_COLORS: Record<TechBranch, string>;
/** Global cost escalation: +5% per researched node */
export declare const GLOBAL_COST_ESCALATION = 0.05;
/** Reset cooldown in milliseconds (24 hours) */
export declare const TECH_TREE_RESET_COOLDOWN_MS: number;
//# sourceMappingURL=techTree.d.ts.map