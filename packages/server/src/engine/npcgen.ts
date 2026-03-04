import { hashCoords } from './worldgen.js';
import { WORLD_SEED, NPC_FACTION_WEIGHTS } from '@void-sector/shared';
import type { NpcFactionId, StationNpc } from '@void-sector/shared';

const NPC_SEED_SALT = 7777;
const FACTION_SEED_SALT = 3333;

const FIRST_NAMES = [
  'Zar', 'Kira', 'Vex', 'Mira', 'Dax', 'Syla', 'Orn', 'Thex',
  'Luma', 'Kael', 'Nyx', 'Rho', 'Astra', 'Cyn', 'Jex', 'Tal',
];
const LAST_NAMES = [
  'Voss', 'Kren', 'Thane', 'Mox', 'Drex', 'Solen', 'Gar', 'Plex',
  'Nori', 'Wren', 'Kova', 'Strex', 'Lorn', 'Mace', 'Quill', 'Rune',
];

export function getStationFaction(x: number, y: number): NpcFactionId {
  const seed = hashCoords(x, y, WORLD_SEED + FACTION_SEED_SALT);
  const normalized = (seed >>> 0) / 0x100000000;
  let cumulative = 0;
  const factions = Object.entries(NPC_FACTION_WEIGHTS);
  for (const [factionId, weight] of factions) {
    cumulative += weight;
    if (normalized < cumulative) return factionId as NpcFactionId;
  }
  return 'independent';
}

export function generateStationNpcs(x: number, y: number): StationNpc[] {
  const baseSeed = hashCoords(x, y, WORLD_SEED + NPC_SEED_SALT);
  const npcCount = 1 + ((baseSeed >>> 0) % 3);
  const faction = getStationFaction(x, y);

  const npcs: StationNpc[] = [];
  for (let i = 0; i < npcCount; i++) {
    const npcSeed = hashCoords(x + i, y + i, WORLD_SEED + NPC_SEED_SALT + i);
    const unsignedSeed = npcSeed >>> 0;
    const firstIdx = unsignedSeed % FIRST_NAMES.length;
    const lastIdx = (unsignedSeed >>> 8) % LAST_NAMES.length;
    npcs.push({
      id: `npc_${x}_${y}_${i}`,
      name: `${FIRST_NAMES[firstIdx]} ${LAST_NAMES[lastIdx]}`,
      factionId: faction,
      personality: (unsignedSeed >>> 16) % 100,
    });
  }
  return npcs;
}

export function getPirateLevel(sectorX: number, sectorY: number): number {
  const distance = Math.sqrt(sectorX * sectorX + sectorY * sectorY);
  return Math.min(Math.floor(distance / 50) + 1, 10);
}
