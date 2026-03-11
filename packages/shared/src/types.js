export const ARTEFACT_TYPES = [
    'drive',
    'cargo',
    'scanner',
    'armor',
    'weapon',
    'shield',
    'defense',
    'special',
    'mining',
    'generator',
    'repair',
];
/** Maps module category name to its matching ArtefactType (1:1) */
export const ARTEFACT_TYPE_FOR_CATEGORY = {
    drive: 'drive',
    cargo: 'cargo',
    scanner: 'scanner',
    armor: 'armor',
    weapon: 'weapon',
    shield: 'shield',
    defense: 'defense',
    special: 'special',
    mining: 'mining',
    generator: 'generator',
    repair: 'repair',
};
/** Derive legacy SectorType from environment + contents (for backward compat) */
export function legacySectorType(env, contents) {
    if (contents.includes('pirate_zone') && contents.includes('asteroid_field'))
        return 'pirate';
    if (contents.includes('station'))
        return 'station';
    if (contents.includes('anomaly'))
        return 'anomaly';
    if (contents.includes('asteroid_field'))
        return 'asteroid_field';
    if (contents.includes('pirate_zone'))
        return 'pirate';
    if (env === 'nebula')
        return 'nebula';
    return 'empty';
}
/** Derive environment from legacy SectorType */
export function deriveEnvironment(type) {
    return type === 'nebula' ? 'nebula' : 'empty';
}
/** Returns true if a sector environment can be entered/traversed by a ship */
export function isTraversable(env) {
    return env !== 'star' && env !== 'black_hole';
}
/** Returns true if an environment is a planet type */
export function isPlanetEnvironment(env) {
    return env === 'planet';
}
/** Derive contents from legacy SectorType */
export function deriveContents(type) {
    switch (type) {
        case 'asteroid_field':
            return ['asteroid_field'];
        case 'station':
            return ['station'];
        case 'anomaly':
            return ['anomaly'];
        case 'pirate':
            return ['pirate_zone', 'asteroid_field'];
        default:
            return [];
    }
}
//# sourceMappingURL=types.js.map