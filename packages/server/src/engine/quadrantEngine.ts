import { hashCoords } from './worldgen.js';
import {
  QUADRANT_SIZE,
  QUADRANT_NAME_MIN_LENGTH,
  QUADRANT_NAME_MAX_LENGTH,
  WORLD_SEED,
} from '@void-sector/shared';
import type { QuadrantConfig, QuadrantData } from '@void-sector/shared';
import {
  getQuadrant,
  upsertQuadrant,
  addPlayerKnownQuadrant,
  quadrantNameExists,
  updateQuadrantName,
} from '../db/quadrantQueries.js';

// --------------------------------------------------------------------------
// Pure functions
// --------------------------------------------------------------------------

export function sectorToQuadrant(x: number, y: number): { qx: number; qy: number } {
  return {
    qx: Math.floor(x / QUADRANT_SIZE),
    qy: Math.floor(y / QUADRANT_SIZE),
  };
}

export function generateQuadrantConfig(qx: number, qy: number): QuadrantConfig {
  const seed = hashCoords(qx, qy, WORLD_SEED ^ 0x51ad8a47);
  // Use different bits of the seed for each factor
  const normalized = (bit: number) => {
    const shifted = (seed >>> bit) & 0xff;
    return 0.5 + shifted / 255; // 0.5 to ~1.5
  };
  return {
    seed,
    resourceFactor: normalized(0),
    stationDensity: normalized(4),
    pirateDensity: normalized(8),
    nebulaThreshold: normalized(12),
    emptyRatio: normalized(16),
  };
}

// Syllable-based auto-name generator
const SYLLABLES = [
  'al',
  'an',
  'ar',
  'as',
  'at',
  'ax',
  'ba',
  'be',
  'bi',
  'bo',
  'ca',
  'ce',
  'ci',
  'co',
  'da',
  'de',
  'di',
  'do',
  'el',
  'en',
  'er',
  'es',
  'ex',
  'fa',
  'fi',
  'ga',
  'go',
  'ha',
  'he',
  'hi',
  'in',
  'ir',
  'is',
  'ka',
  'ke',
  'ki',
  'ko',
  'la',
  'le',
  'li',
  'lo',
  'lu',
  'ma',
  'me',
  'mi',
  'mo',
  'mu',
  'na',
  'ne',
  'ni',
  'no',
  'nu',
  'or',
  'os',
  'pa',
  'pe',
  'pi',
  'ra',
  're',
  'ri',
  'ro',
  'ru',
  'sa',
  'se',
  'si',
  'so',
  'su',
  'ta',
  'te',
  'ti',
  'to',
  'tu',
  'un',
  'ur',
  'us',
  'va',
  've',
  'vi',
  'vo',
  'xa',
  'xe',
  'ya',
  'za',
  'ze',
  'zi',
  'zo',
];

export function generateQuadrantName(seed: number): string {
  // Generate 2-4 syllable name from seed
  const numSyllables = 2 + (((seed >>> 24) & 0x3) % 3); // 2-4
  let name = '';
  for (let i = 0; i < numSyllables; i++) {
    const idx = ((seed >>> (i * 7)) & 0x7f) % SYLLABLES.length;
    name += SYLLABLES[idx];
  }
  // Capitalize first letter + add a sector suffix like "-7" from seed
  const suffix = ((seed >>> 20) & 0xf) + 1;
  return name.charAt(0).toUpperCase() + name.slice(1) + '-' + suffix;
}

export function validateQuadrantName(name: string): { valid: boolean; error?: string } {
  if (!name || name.length < QUADRANT_NAME_MIN_LENGTH) {
    return { valid: false, error: `Name must be at least ${QUADRANT_NAME_MIN_LENGTH} characters` };
  }
  if (name.length > QUADRANT_NAME_MAX_LENGTH) {
    return { valid: false, error: `Name must be at most ${QUADRANT_NAME_MAX_LENGTH} characters` };
  }
  if (!/^[a-zA-Z0-9 '\-]+$/.test(name)) {
    return {
      valid: false,
      error: 'Name can only contain letters, numbers, spaces, hyphens, and apostrophes',
    };
  }
  return { valid: true };
}

// --------------------------------------------------------------------------
// DB-backed functions
// --------------------------------------------------------------------------

export async function getOrCreateQuadrant(
  qx: number,
  qy: number,
  discoveredByPlayerId?: string,
): Promise<QuadrantData> {
  let quadrant = await getQuadrant(qx, qy);
  if (quadrant) return quadrant;

  const config = generateQuadrantConfig(qx, qy);
  quadrant = {
    qx,
    qy,
    seed: config.seed,
    name: generateQuadrantName(config.seed),
    discoveredBy: discoveredByPlayerId ?? null,
    discoveredAt: new Date().toISOString(),
    config,
  };
  await upsertQuadrant(quadrant);
  if (discoveredByPlayerId) {
    await addPlayerKnownQuadrant(discoveredByPlayerId, qx, qy);
  }
  return quadrant;
}

export const QUADRANT_NAMING_WINDOW_MS = 60_000;

export async function nameQuadrant(
  qx: number,
  qy: number,
  name: string,
  playerId: string,
): Promise<{ success: boolean; error?: string }> {
  if (qx === 0 && qy === 0) return { success: false, error: '"Zentrum" is protected' };

  const validation = validateQuadrantName(name);
  if (!validation.valid) return { success: false, error: validation.error };

  const quadrant = await getQuadrant(qx, qy);
  if (!quadrant) return { success: false, error: 'Quadrant not found' };
  if (quadrant.discoveredBy !== playerId)
    return { success: false, error: 'Only the discoverer can name a quadrant' };

  // Enforce 60-second naming window from discovery time
  if (quadrant.discoveredAt) {
    const elapsed = Date.now() - new Date(quadrant.discoveredAt).getTime();
    if (elapsed > QUADRANT_NAMING_WINDOW_MS) {
      return { success: false, error: 'Naming window expired (60s)' };
    }
  }

  const nameExists = await quadrantNameExists(name);
  if (nameExists) return { success: false, error: 'Name already taken' };

  await updateQuadrantName(qx, qy, name);
  return { success: true };
}
