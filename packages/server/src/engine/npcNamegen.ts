const PREFIXES: Record<string, string> = {
  trader: 'Händler',
  military: 'Patrouille',
  outlaw: 'Outlaw',
};

const SYLLABLES = ['Ax', 'Bor', 'Cel', 'Dax', 'Ek', 'Fen', 'Gol', 'Hex', 'Ion', 'Jet',
  'Kra', 'Lex', 'Mor', 'Nex', 'Orn', 'Pex', 'Qin', 'Rex', 'Sol', 'Tor',
  'Urk', 'Vex', 'Wor', 'Xan', 'Yel', 'Zor'];

function hashSeed(seed: number): number {
  let h = seed | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return h >>> 0;
}

export function generateNpcName(role: string, seed: number): string {
  const prefix = PREFIXES[role] ?? 'NPC';
  const h1 = hashSeed(seed);
  const h2 = hashSeed(seed + 7919);
  const syl = SYLLABLES[h1 % SYLLABLES.length] + SYLLABLES[h2 % SYLLABLES.length].toLowerCase();
  const num = (h1 % 9) + 1;
  return `${prefix} ${syl}-${num}`;
}
