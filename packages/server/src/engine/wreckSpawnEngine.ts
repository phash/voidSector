// packages/server/src/engine/wreckSpawnEngine.ts
import type { WreckItem, WreckSize } from '@void-sector/shared';
import {
  WRECK_BASE_DIFFICULTY,
  WRECK_SIZE_ITEM_COUNT,
  WRECK_EXPLORER_CHANCE_PER_XP,
  WRECK_HELION_ARTEFACT_MIN_CHANCE,
  WRECK_DIFFICULTY_MIN,
  WRECK_DIFFICULTY_MAX,
} from '@void-sector/shared';
import {
  getActiveWreckCount,
  insertWreck,
  pickRandomWreckableSector,
} from '../db/wreckQueries.js';
import { getAllQuadrantControls } from '../db/queries.js';
import { logger } from '../utils/logger.js';

const ARTEFACT_IDS = [
  'artefact_drive', 'artefact_cargo', 'artefact_scanner',
  'artefact_armor', 'artefact_weapon', 'artefact_shield',
  'artefact_defense', 'artefact_special', 'artefact_mining',
  'artefact_generator', 'artefact_repair',
];

const RESOURCE_IDS = ['ore', 'gas', 'crystal'];

const MODULES_BY_TIER: Record<number, string[]> = {
  1: ['drive_mk1', 'scanner_mk1'],
  2: ['drive_mk2', 'scanner_mk2', 'cargo_mk1'],
  3: ['drive_mk3', 'scanner_mk3', 'laser_mk2', 'cargo_mk2'],
  4: ['laser_mk3', 'shield_mk2', 'armor_mk2', 'railgun_mk2'],
  5: ['laser_mk3', 'shield_mk3', 'armor_mk3', 'quantum_scanner', 'point_defense'],
};

const BLUEPRINTS_BY_TIER: Record<number, string[]> = {
  2: ['drive_mk2', 'scanner_mk2'],
  3: ['drive_mk3', 'laser_mk2', 'cargo_mk2'],
  4: ['laser_mk3', 'shield_mk2', 'railgun_mk2'],
  5: ['laser_mk3', 'shield_mk3', 'quantum_scanner', 'point_defense', 'ecm_suite'],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function calcSpawnChance(qx: number, qy: number): number {
  const dist = Math.sqrt(qx ** 2 + qy ** 2);
  return Math.min(0.02 + dist * 0.0025, 0.20);
}

export function calcWreckTier(qx: number, qy: number): number {
  const dist = Math.sqrt(qx ** 2 + qy ** 2);
  if (dist < 5) return 1;
  if (dist < 15) return 2;
  if (dist < 30) return 3;
  if (dist < 60) return 4;
  return 5;
}

function pickSize(tier: number): WreckSize {
  const r = Math.random();
  if (tier <= 2) return r < 0.6 ? 'small' : r < 0.9 ? 'medium' : 'large';
  if (tier <= 4) return r < 0.3 ? 'small' : r < 0.7 ? 'medium' : 'large';
  return r < 0.2 ? 'small' : r < 0.5 ? 'medium' : 'large';
}

export function generateWreckItems(tier: number, size: WreckSize): WreckItem[] {
  const [minItems, maxItems] = WRECK_SIZE_ITEM_COUNT[size];
  const count = randInt(minItems, maxItems);
  const items: WreckItem[] = [];

  for (let i = 0; i < count; i++) {
    const itemType = pickItemType(tier);
    let itemId: string;
    let baseDifficulty: number;
    let quantity = 1;

    if (itemType === 'resource') {
      const isArtefact = tier >= 3 && Math.random() < 0.1 * tier;
      if (isArtefact) {
        itemId = pick(ARTEFACT_IDS);
        baseDifficulty = WRECK_BASE_DIFFICULTY['artefact'];
      } else {
        itemId = pick(RESOURCE_IDS);
        baseDifficulty = WRECK_BASE_DIFFICULTY['resource'];
        quantity = randInt(5, 5 + tier * 10);
      }
    } else if (itemType === 'module') {
      const pool = MODULES_BY_TIER[Math.min(tier, 5)] ?? MODULES_BY_TIER[1];
      itemId = pick(pool);
      baseDifficulty = WRECK_BASE_DIFFICULTY['module'];
    } else if (itemType === 'blueprint') {
      const pool = BLUEPRINTS_BY_TIER[Math.min(tier, 5)] ?? BLUEPRINTS_BY_TIER[2];
      itemId = pick(pool);
      baseDifficulty = WRECK_BASE_DIFFICULTY['blueprint'];
    } else {
      // data_slate — generates a random far sector with optional jumpgate
      itemId = `slate_${Math.random().toString(36).slice(2, 10)}`;
      baseDifficulty = WRECK_BASE_DIFFICULTY['data_slate'];
    }

    items.push({ itemType, itemId, quantity, baseDifficulty, salvaged: false });
  }

  return items;
}

function pickItemType(tier: number): WreckItem['itemType'] {
  const r = Math.random();
  if (tier === 1) {
    return r < 0.85 ? 'resource' : 'module';
  } else if (tier === 2) {
    return r < 0.60 ? 'resource' : r < 0.85 ? 'module' : 'blueprint';
  } else if (tier === 3) {
    return r < 0.40 ? 'resource' : r < 0.65 ? 'module' : r < 0.85 ? 'blueprint' : 'data_slate';
  } else if (tier === 4) {
    return r < 0.25 ? 'resource' : r < 0.50 ? 'module' : r < 0.70 ? 'blueprint' : r < 0.85 ? 'data_slate' : 'resource';
  } else {
    // tier 5
    return r < 0.20 ? 'resource' : r < 0.40 ? 'blueprint' : r < 0.65 ? 'data_slate' : 'resource';
  }
}

export function calcSalvageChance(
  baseDifficulty: number,
  modifier: number,
  explorerXp: number,
  helionDecoder = false,
): number {
  const base = 1.0 - baseDifficulty;
  const explorerBonus = Math.min(explorerXp * WRECK_EXPLORER_CHANCE_PER_XP, 0.25);
  const modBonus = modifier * 0.15;
  const chance = base + explorerBonus - modBonus;
  const clamped = Math.max(0.05, Math.min(0.95, chance));
  if (helionDecoder && baseDifficulty === WRECK_BASE_DIFFICULTY['artefact']) {
    return Math.max(WRECK_HELION_ARTEFACT_MIN_CHANCE, clamped);
  }
  return clamped;
}

export async function tickWreckSpawns(): Promise<void> {
  try {
    const quadrants = await getAllQuadrantControls();
    for (const q of quadrants) {
      const count = await getActiveWreckCount(q.qx, q.qy);
      if (count >= 2) continue;

      const spawnChance = calcSpawnChance(q.qx, q.qy);
      if (Math.random() > spawnChance) continue;

      const sector = await pickRandomWreckableSector(q.qx, q.qy);
      if (!sector) continue;

      const tier = calcWreckTier(q.qx, q.qy);
      const size = pickSize(tier);
      const items = generateWreckItems(tier, size);
      await insertWreck({
        quadrantX: q.qx,
        quadrantY: q.qy,
        sectorX: sector.sectorX,
        sectorY: sector.sectorY,
        tier,
        size,
        items,
      });
      logger.debug({ qx: q.qx, qy: q.qy, tier, size }, 'Wreck spawned');
    }
  } catch (err) {
    logger.error({ err }, 'tickWreckSpawns failed');
  }
}
