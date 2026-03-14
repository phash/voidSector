export type DistanceTier = 1 | 2 | 3 | 4;
export interface StationItemConfig {
    itemId: string;
    label: string;
    category: 'RESSOURCEN' | 'MODULE' | 'AMMO';
    resourceCost: {
        ore?: number;
        gas?: number;
        crystal?: number;
    };
    durationSeconds: number;
    maxStock: number;
    buyPrice: number;
}
export interface StationTierConfig {
    tier: DistanceTier;
    distanceMin: number;
    distanceMax: number;
    moduleTierLabel: string;
    passiveGenPerHour: {
        ore: number;
        gas: number;
        crystal: number;
    };
    maxStockpilePerResource: number;
    items: StationItemConfig[];
}
export interface StationCurrentItem {
    itemId: string;
    startedAtMs: number;
    durationSeconds: number;
}
export interface StationProductionState {
    sectorX: number;
    sectorY: number;
    level: number;
    distanceTier: DistanceTier;
    moduleTierLabel: string;
    resourceStockpile: {
        ore: number;
        gas: number;
        crystal: number;
    };
    maxStockpile: {
        ore: number;
        gas: number;
        crystal: number;
    };
    currentItem: StationCurrentItem | null;
    upcomingQueue: string[];
    finishedGoods: Record<string, number>;
    maxFinishedGoods: Record<string, number>;
    ankaufPreise: {
        ore: number;
        gas: number;
        crystal: number;
    };
    kaufPreise: Record<string, number>;
}
export declare const BASE_ANKAUF_PREISE: {
    readonly ore: 8;
    readonly gas: 12;
    readonly crystal: 16;
};
export declare const STATION_TIERS: StationTierConfig[];
export declare function getDistanceTier(x: number, y: number): DistanceTier;
export declare function getTierConfig(tier: DistanceTier): StationTierConfig;
//# sourceMappingURL=stationProduction.d.ts.map