// packages/server/src/engine/frictionEngine.ts

export type RepTier = 'ally' | 'friendly' | 'neutral' | 'hostile' | 'enemy';
export type FrictionState = 'peaceful_halt' | 'skirmish' | 'escalation' | 'total_war';

export interface FrictionResult {
  score: number; // 0–100
  state: FrictionState;
}

const BASE_FRICTION: Record<RepTier, number> = {
  ally: 0,
  friendly: 10,
  neutral: 35,
  hostile: 65,
  enemy: 90,
};

/** Friction from a 0–100 base + an aggression multiplier. */
export function frictionFromBase(base: number, aggression: number): FrictionResult {
  const delta = (aggression - 1.0) * 20;
  const score = Math.max(0, Math.min(100, Math.round(base + delta)));

  let state: FrictionState;
  if (score <= 20) state = 'peaceful_halt';
  else if (score <= 50) state = 'skirmish';
  else if (score <= 80) state = 'escalation';
  else state = 'total_war';

  return { score, state };
}

export function calculateFriction(repTier: RepTier, aggression: number): FrictionResult {
  return frictionFromBase(BASE_FRICTION[repTier], aggression);
}

/**
 * BB3: deterministic baseline enmity (0–100) between two non-human factions, used
 * where there is no humanity reputation. 'voids' are hostile to everyone; other
 * alien pairs get a stable per-pair value so the galaxy has fixed rivalries and
 * mostly-peaceful neighbours rather than uniform war.
 */
export function pairEnmity(a: string, b: string): number {
  if (a === 'voids' || b === 'voids') return 75;
  const key = [a, b].sort().join('|');
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  return 10 + (h % 71); // 10..80
}

export function repValueToTier(rep: number): RepTier {
  if (rep >= 75) return 'ally';
  if (rep >= 25) return 'friendly';
  if (rep >= -25) return 'neutral';
  if (rep >= -75) return 'hostile';
  return 'enemy';
}
