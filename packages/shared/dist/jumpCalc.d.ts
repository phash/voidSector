export declare function calcHyperjumpAP(engineSpeed: number): number;
export declare function calcHyperjumpFuel(fuelPerJump: number, distance: number): number;
/**
 * V2 fuel formula (#291): only hyperjumps cost fuel.
 * cost = ceil(BASE_FUEL_PER_JUMP * distance * (1 - driveEfficiency))
 * @param baseFuelPerSector  BASE_FUEL_PER_JUMP (100)
 * @param distance           sector distance of hyperjump
 * @param driveEfficiency    0..1 — better drives reduce cost (0 = no reduction)
 */
export declare function calcHyperjumpFuelV2(baseFuelPerSector: number, distance: number, driveEfficiency: number): number;
export declare function getEngineSpeed(moduleId: string | null): number;
//# sourceMappingURL=jumpCalc.d.ts.map