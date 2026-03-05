import type { FactionUpgradeChoice } from '@void-sector/shared';

export interface FactionBonuses {
  miningRateMultiplier: number;
  cargoCapBonus: number;
  scanRadiusBonus: number;
  apRegenMultiplier: number;
  combatMultiplier: number;
  tradePriceMultiplier: number;
}

const DEFAULT_BONUSES: FactionBonuses = {
  miningRateMultiplier: 1.0,
  cargoCapBonus: 0,
  scanRadiusBonus: 0,
  apRegenMultiplier: 1.0,
  combatMultiplier: 1.0,
  tradePriceMultiplier: 1.0,
};

export function calculateBonuses(
  upgrades: Array<{ tier: number; choice: FactionUpgradeChoice }>,
): FactionBonuses {
  const bonuses = { ...DEFAULT_BONUSES };

  for (const u of upgrades) {
    switch (u.tier) {
      case 1:
        if (u.choice === 'A') bonuses.miningRateMultiplier = 1.15;
        if (u.choice === 'B') bonuses.cargoCapBonus = 3;
        break;
      case 2:
        if (u.choice === 'A') bonuses.scanRadiusBonus = 1;
        if (u.choice === 'B') bonuses.apRegenMultiplier = 1.2;
        break;
      case 3:
        if (u.choice === 'A') bonuses.combatMultiplier = 1.15;
        if (u.choice === 'B') bonuses.tradePriceMultiplier = 0.9;
        break;
    }
  }

  return bonuses;
}
