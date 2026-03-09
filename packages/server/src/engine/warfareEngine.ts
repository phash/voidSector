// packages/server/src/engine/warfareEngine.ts

const ADVANTAGE_THRESHOLD = 1.2;
const CRUSHING_THRESHOLD = 10.0;
const LOSS_ON_WIN = 0.1;
const LOSS_ON_STALEMATE = 0.05;

export interface WarfareTickInput {
  attack: number;
  defense: number;
  playerAttackBonus?: number;
  playerDefenseBonus?: number;
  attackMultiplier?: number;
}

export interface WarfareResult {
  outcome: 'attacker_wins' | 'defender_wins' | 'stalemate';
  newAttack: number;
  newDefense: number;
  conquest: boolean;
  invasionRepelled: boolean;
}

export function resolveStrategicTick(input: WarfareTickInput): WarfareResult {
  const effectiveAttack = Math.round(
    (input.attack + (input.playerAttackBonus ?? 0)) * (input.attackMultiplier ?? 1.0),
  );
  const effectiveDefense = input.defense + (input.playerDefenseBonus ?? 0);

  let newAttack = input.attack;
  let newDefense = input.defense;
  let outcome: WarfareResult['outcome'];

  if (effectiveAttack > effectiveDefense * ADVANTAGE_THRESHOLD) {
    // Attacker needs 1.2x advantage over effective defense to win
    outcome = 'attacker_wins';
    if (effectiveAttack >= effectiveDefense * CRUSHING_THRESHOLD) {
      newDefense = 0;
    } else {
      newDefense = Math.max(0, Math.round(input.defense * (1 - LOSS_ON_WIN)));
    }
  } else if (effectiveDefense > effectiveAttack * ADVANTAGE_THRESHOLD) {
    // Defender needs 1.2x advantage over effective attack to win (symmetric threshold)
    outcome = 'defender_wins';
    if (effectiveDefense >= effectiveAttack * CRUSHING_THRESHOLD) {
      newAttack = 0;
    } else {
      newAttack = Math.max(0, Math.round(input.attack * (1 - LOSS_ON_WIN)));
    }
  } else {
    // Stalemate: attacker has some edge but not 1.2x, or forces are equal
    outcome = 'stalemate';
    newAttack = Math.max(0, Math.round(input.attack * (1 - LOSS_ON_STALEMATE)));
    newDefense = Math.max(0, Math.round(input.defense * (1 - LOSS_ON_STALEMATE)));
  }

  return {
    outcome,
    newAttack,
    newDefense,
    conquest: outcome === 'attacker_wins' && newDefense === 0,
    invasionRepelled: outcome === 'defender_wins' && newAttack === 0,
  };
}

export const STATION_DEFENSE: Record<number, number> = {
  0: 0,
  1: 100,
  2: 300,
  3: 700,
  4: 1500,
};

export function calculateBaseDefense(stationTier: number, fleetStrength: number): number {
  return (STATION_DEFENSE[stationTier] ?? 0) + fleetStrength;
}
