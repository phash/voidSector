import type { CargoState, StarterBountyDef } from '@void-sector/shared';

export type StarterClaimValidation =
  | { ok: true }
  | { ok: false; code: 'NOT_AT_ORIGIN' | 'INSUFFICIENT_RESOURCES' };

/** Pure Validierung eines Starthilfe-Claims — Einmaligkeit prüft die DB (PK-Insert). */
export function validateStarterClaim(
  def: StarterBountyDef,
  cargo: CargoState,
  px: number,
  py: number,
): StarterClaimValidation {
  if (px !== 0 || py !== 0) return { ok: false, code: 'NOT_AT_ORIGIN' };
  if ((cargo[def.resource] ?? 0) < def.amount) return { ok: false, code: 'INSUFFICIENT_RESOURCES' };
  return { ok: true };
}
