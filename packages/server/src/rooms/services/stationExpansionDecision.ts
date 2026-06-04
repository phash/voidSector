import { expansionCost, type ExpansionResourceCost, type StationExpansionType } from '@void-sector/shared';
import { validateExpansionBuild, type StationLevels } from '../../engine/stationExpansionService.js';

export interface PlayerResources {
  credits: number;
  cargo: { ore?: number; gas?: number; crystal?: number; artefact?: number };
}

export type ExpansionDecision =
  | { ok: true; targetLevel: number; cost: ExpansionResourceCost }
  | { ok: false; code: 'BUSY' | 'TIER_LOCKED' | 'MAX_LEVEL' | 'INSUFFICIENT'; message: string };

export function resolveExpansionBuild(
  station: StationLevels,
  type: StationExpansionType,
  res: PlayerResources,
): ExpansionDecision {
  const valid = validateExpansionBuild(station, type);
  if (!valid.ok) return valid;
  const cost = expansionCost(type, valid.targetLevel);
  const c = res.cargo;
  if (
    res.credits < cost.credits ||
    (c.ore ?? 0) < cost.ore ||
    (c.gas ?? 0) < cost.gas ||
    (c.crystal ?? 0) < cost.crystal ||
    (c.artefact ?? 0) < cost.artefact
  ) {
    return { ok: false, code: 'INSUFFICIENT', message: 'Nicht genug Ressourcen/Credits' };
  }
  return { ok: true, targetLevel: valid.targetLevel, cost };
}
