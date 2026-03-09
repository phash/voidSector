export type HumanityRepTier = 'FEINDSELIG' | 'NEUTRAL' | 'FREUNDLICH';

export function getHumanityRepTier(repValue: number): HumanityRepTier {
  if (repValue < -200) return 'FEINDSELIG';
  if (repValue > 200) return 'FREUNDLICH';
  return 'NEUTRAL';
}

export function getHumanityChanceModifier(tier: HumanityRepTier): number {
  if (tier === 'FREUNDLICH') return 1.5;
  if (tier === 'FEINDSELIG') return 0.5;
  return 1.0;
}
