const STATION_PREFIXES = [
    'Arcturus',
    'Nexus',
    'Vega',
    'Helios',
    'Omega',
    'Proxima',
    'Zenith',
    'Pulsar',
    'Nova',
    'Cygnus',
    'Orion',
    'Lyra',
    'Sirius',
    'Kepler',
    'Draco',
    'Altair',
];
const STATION_SUFFIXES = [
    'Station',
    'Outpost',
    'Hub',
    'Dock',
    'Terminal',
    'Port',
    'Relay',
    'Depot',
];
function hashStationCoords(x, y) {
    let h = ((x | 0) + 0x9e3779b9) | 0;
    h = Math.imul(h ^ ((y | 0) + 0x517cc1b7), 0x85ebca6b);
    h = h ^ (h >>> 16);
    h = Math.imul(h, 0xc2b2ae35);
    h = h ^ (h >>> 16);
    return h >>> 0;
}
export function generateStationName(x, y) {
    if (x === 0 && y === 0)
        return 'Zuhause';
    const hash = hashStationCoords(x, y);
    const prefix = STATION_PREFIXES[hash % STATION_PREFIXES.length];
    const suffix = STATION_SUFFIXES[(hash >>> 8) % STATION_SUFFIXES.length];
    const designation = ((hash >>> 16) % 99) + 1;
    return `${prefix} ${suffix}-${designation}`;
}
//# sourceMappingURL=stationNames.js.map