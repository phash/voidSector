export const BASE_ANKAUF_PREISE = { ore: 8, gas: 12, crystal: 16 };
export const STATION_TIERS = [
    {
        tier: 1,
        distanceMin: 0,
        distanceMax: 15,
        moduleTierLabel: 'MK1',
        passiveGenPerHour: { ore: 2, gas: 1, crystal: 0 },
        maxStockpilePerResource: 100,
        items: [
            { itemId: 'fuel', label: 'Treibstoff', category: 'RESSOURCEN', resourceCost: { gas: 3, crystal: 1 }, durationSeconds: 60, maxStock: 50, buyPrice: 80 },
            { itemId: 'ammo_basic', label: 'Munition', category: 'AMMO', resourceCost: { ore: 5 }, durationSeconds: 30, maxStock: 20, buyPrice: 25 },
            { itemId: 'module_cargo_mk1', label: 'Frachtraum MK1', category: 'MODULE', resourceCost: { ore: 20, gas: 10 }, durationSeconds: 180, maxStock: 5, buyPrice: 240 },
            { itemId: 'module_scanner_mk1', label: 'Scanner MK1', category: 'MODULE', resourceCost: { ore: 15, crystal: 8 }, durationSeconds: 180, maxStock: 5, buyPrice: 280 },
            { itemId: 'module_drive_mk1', label: 'Antrieb MK1', category: 'MODULE', resourceCost: { ore: 25, gas: 15 }, durationSeconds: 240, maxStock: 5, buyPrice: 320 },
        ],
    },
    {
        tier: 2,
        distanceMin: 15,
        distanceMax: 40,
        moduleTierLabel: 'MK2',
        passiveGenPerHour: { ore: 4, gas: 2, crystal: 1 },
        maxStockpilePerResource: 150,
        items: [
            { itemId: 'fuel', label: 'Treibstoff', category: 'RESSOURCEN', resourceCost: { gas: 3, crystal: 1 }, durationSeconds: 60, maxStock: 40, buyPrice: 80 },
            { itemId: 'ammo_basic', label: 'Munition', category: 'AMMO', resourceCost: { ore: 5 }, durationSeconds: 30, maxStock: 15, buyPrice: 25 },
            { itemId: 'rocket_basic', label: 'Rakete', category: 'AMMO', resourceCost: { ore: 10, crystal: 3 }, durationSeconds: 120, maxStock: 10, buyPrice: 90 },
            { itemId: 'module_cargo_mk2', label: 'Frachtraum MK2', category: 'MODULE', resourceCost: { ore: 50, gas: 25 }, durationSeconds: 360, maxStock: 5, buyPrice: 580 },
            { itemId: 'module_scanner_mk2', label: 'Scanner MK2', category: 'MODULE', resourceCost: { ore: 40, crystal: 20 }, durationSeconds: 360, maxStock: 5, buyPrice: 640 },
            { itemId: 'module_drive_mk2', label: 'Antrieb MK2', category: 'MODULE', resourceCost: { ore: 60, gas: 35 }, durationSeconds: 480, maxStock: 5, buyPrice: 720 },
        ],
    },
    {
        tier: 3,
        distanceMin: 40,
        distanceMax: 100,
        moduleTierLabel: 'MK3',
        passiveGenPerHour: { ore: 6, gas: 3, crystal: 2 },
        maxStockpilePerResource: 200,
        items: [
            { itemId: 'fuel', label: 'Treibstoff', category: 'RESSOURCEN', resourceCost: { gas: 3, crystal: 1 }, durationSeconds: 60, maxStock: 30, buyPrice: 80 },
            { itemId: 'rocket_basic', label: 'Rakete', category: 'AMMO', resourceCost: { ore: 10, crystal: 3 }, durationSeconds: 120, maxStock: 15, buyPrice: 90 },
            { itemId: 'module_cargo_mk3', label: 'Frachtraum MK3', category: 'MODULE', resourceCost: { ore: 120, gas: 60, crystal: 20 }, durationSeconds: 900, maxStock: 3, buyPrice: 1400 },
            { itemId: 'module_scanner_mk3', label: 'Scanner MK3', category: 'MODULE', resourceCost: { ore: 100, crystal: 50, gas: 15 }, durationSeconds: 900, maxStock: 3, buyPrice: 1600 },
            { itemId: 'module_drive_mk3', label: 'Antrieb MK3', category: 'MODULE', resourceCost: { ore: 150, gas: 80, crystal: 25 }, durationSeconds: 1200, maxStock: 3, buyPrice: 1800 },
            { itemId: 'module_shield_mk3', label: 'Schild MK3', category: 'MODULE', resourceCost: { ore: 80, gas: 40, crystal: 60 }, durationSeconds: 1200, maxStock: 3, buyPrice: 2000 },
        ],
    },
    {
        tier: 4,
        distanceMin: 100,
        distanceMax: Infinity,
        moduleTierLabel: 'MK4',
        passiveGenPerHour: { ore: 8, gas: 4, crystal: 3 },
        maxStockpilePerResource: 300,
        items: [
            { itemId: 'fuel', label: 'Treibstoff', category: 'RESSOURCEN', resourceCost: { gas: 3, crystal: 1 }, durationSeconds: 60, maxStock: 20, buyPrice: 80 },
            { itemId: 'rocket_basic', label: 'Rakete', category: 'AMMO', resourceCost: { ore: 10, crystal: 3 }, durationSeconds: 120, maxStock: 20, buyPrice: 90 },
            { itemId: 'module_cargo_mk4', label: 'Frachtraum MK4', category: 'MODULE', resourceCost: { ore: 300, gas: 150, crystal: 60 }, durationSeconds: 2400, maxStock: 2, buyPrice: 3500 },
            { itemId: 'module_scanner_mk4', label: 'Scanner MK4', category: 'MODULE', resourceCost: { ore: 250, crystal: 120, gas: 40 }, durationSeconds: 2400, maxStock: 2, buyPrice: 4000 },
            { itemId: 'module_drive_mk4', label: 'Antrieb MK4', category: 'MODULE', resourceCost: { ore: 380, gas: 200, crystal: 70 }, durationSeconds: 3000, maxStock: 2, buyPrice: 4500 },
            { itemId: 'module_shield_mk4', label: 'Schild MK4', category: 'MODULE', resourceCost: { ore: 200, gas: 100, crystal: 150 }, durationSeconds: 3000, maxStock: 2, buyPrice: 5000 },
        ],
    },
];
export function getDistanceTier(x, y) {
    const dist = Math.sqrt(x * x + y * y);
    if (dist < 15)
        return 1;
    if (dist < 40)
        return 2;
    if (dist < 100)
        return 3;
    return 4;
}
export function getTierConfig(tier) {
    return STATION_TIERS[tier - 1];
}
//# sourceMappingURL=stationProduction.js.map