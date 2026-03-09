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

export function calculateFriction(repTier: RepTier, aggression: number): FrictionResult {
  const base = BASE_FRICTION[repTier];
  const delta = (aggression - 1.0) * 20;
  const score = Math.max(0, Math.min(100, Math.round(base + delta)));

  let state: FrictionState;
  if (score <= 20) state = 'peaceful_halt';
  else if (score <= 50) state = 'skirmish';
  else if (score <= 80) state = 'escalation';
  else state = 'total_war';

  return { score, state };
}

export function repValueToTier(rep: number): RepTier {
  if (rep >= 75) return 'ally';
  if (rep >= 25) return 'friendly';
  if (rep >= -25) return 'neutral';
  if (rep >= -75) return 'hostile';
  return 'enemy';
}
