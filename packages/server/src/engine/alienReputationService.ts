/**
 * Alien Reputation Service
 * Manages player reputation with alien factions (-100 to +100),
 * unlocking different dialogue, quests, and abilities.
 */

export type AlienFactionId =
  | 'archivists'
  | 'consortium'
  | 'kthari'
  | 'mycelians'
  | 'mirror_minds'
  | 'tourist_guild'
  | 'silent_swarm'
  | 'helions'
  | 'axioms'
  | 'scrappers';

export type AlienRepTier =
  | 'enemy' // < -50
  | 'hostile' // -50 to -10
  | 'neutral' // -10 to +10
  | 'curious' // +10 to +40
  | 'friendly' // +40 to +70
  | 'honored'; // > +70

/**
 * Minimum Chebyshev quadrant distance to trigger first contact for each faction.
 * Players must travel this far from origin (0,0) quadrant to encounter the faction.
 */
export const ALIEN_FIRST_CONTACT_DISTANCE: Record<AlienFactionId, number> = {
  scrappers: 60, // Q ~60:60 — first alien contact
  archivists: 90, // Q ~90:90
  consortium: 150, // Q ~150:150
  kthari: 200, // Q ~200:200
  mycelians: 300, // Q ~300:300
  mirror_minds: 500, // Q ~500:500
  tourist_guild: 700, // Q ~700:700
  silent_swarm: 1000, // Q ~1000:1000
  helions: 1500, // Q ~1500:1500
  axioms: 2500, // Q ~2500:2500 — final encounter
};

/**
 * Flavor text for first contact with each alien faction.
 */
export const ALIEN_FIRST_CONTACT_FLAVOR: Record<AlienFactionId, string> = {
  archivists:
    'ARCHIVAR-SIGNAL EMPFANGEN — Übersetzung 94%\n"Ah. Ein Vertreter der äußeren Spezies. Bemerkenswert dass Sie bis hierher navigiert haben. Die meisten Ihrer Art tun das nicht. Ihr Koordinatenursprung 0:0 — Sie glauben, das sei das Zentrum? ... Faszinierend. Notiert."',
  consortium:
    'KONSORTIUM MARKT-TERMINAL [VERBINDUNG HERGESTELLT]\n"Spezies: Human (Randregion). Kreditwürdigkeit: Unbekannt. Wir handeln mit allem. Auch mit Spezies aus... der Ecke. Was haben Sie anzubieten?"',
  kthari:
    'K\'THARI KAMPFRUF ÜBERSETZT:\n"Unbekannte Einheit. Ihre Herkunftsregion 0:0 ist uns als unbedeutende Randzone bekannt. Beweist eure Stärke oder gebt Eure Route preis." [Kampf oder Kapitulation]',
  mycelians:
    'MYCELIANER-ÜBERTRAGUNG [Symbol-Sequenz #4471]:\n▣ ○ ▣ ▣ ○\nÜbersetzung: "Kleines... helles... Wesen... aus... dem... Rand... Ihr Planet... atmet nicht mehr... seit ihr kam."',
  mirror_minds:
    'MIRROR MIND ECHO [Resonanzfrequenz aktiviert]\n[Sie sehen sich selbst. Dann eine andere Version. Dann beide gleichzeitig.]\n"Du bist... interessant. Wie viele bist du?"',
  tourist_guild:
    'TOURIST GUILD BEACON [Willkommen!]\n"Oh! Ein Mensch! Wie reizend! Ihr seid eine der exotischsten Spezies, die wir je verzeichnet haben! Aus ECKE 0:0! Wir haben extra Fotos von euch im Katalog Seite 4892!"',
  silent_swarm:
    '[STILLE]\n[Dann: Ein einzelner Klick.]\n[Dann: Tausend Klicks gleichzeitig.]\n[Sie verstehen keines der Geräusche. Aber sie kennen jetzt Ihren Namen.]',
  helions:
    'HELION KOLLEKTIV — SONNENBOTSCHAFT:\n"Euer Stern ist jung. Euer Volk ist jung. Wir haben eure Sonne schon als Nebel gesehen. Wir werden sie auch als weißen Zwerg sehen. Seid nicht traurig."',
  axioms:
    '[ÜBERTRAGUNG AUF METAEBENE]\n"Du bist die 1.847.234ste Spezies, die bis hierher vorgedrungen ist."\n"Du bist nicht die letzte."\n"Du wirst nicht die letzte sein."\n[Ende der Übertragung]',
  scrappers:
    'SCRAPPER-FUNK [GEKRÄCHZE UND LÄRM]\n"HEY! ECHT? EIN MENSCH?! SCHON LANGE NICHT MEHR GESEHEN! KAUFT IHR SCHROTT? VERKAUFT IHR SCHROTT? ALLES SUPER, ECHT!"',
};

/**
 * Returns the reputation tier for a given rep value.
 */
export function getRepTier(reputation: number): AlienRepTier {
  if (reputation < -50) return 'enemy';
  if (reputation < -10) return 'hostile';
  if (reputation < 10) return 'neutral';
  if (reputation < 40) return 'curious';
  if (reputation < 70) return 'friendly';
  return 'honored';
}

/**
 * Returns a human-readable label for the reputation tier.
 */
export function getRepTierLabel(tier: AlienRepTier): string {
  const labels: Record<AlienRepTier, string> = {
    enemy: 'FEIND',
    hostile: 'FEINDLICH',
    neutral: 'NEUTRAL',
    curious: 'NEUGIERIG',
    friendly: 'FREUNDLICH',
    honored: 'GEEHRT',
  };
  return labels[tier];
}

/**
 * Clamps reputation change and returns the new value.
 */
export function applyRepChange(current: number, delta: number): number {
  return Math.max(-100, Math.min(100, current + delta));
}

/**
 * Returns whether a player can do quests for an alien faction based on rep.
 */
export function canAccessAlienQuests(reputation: number): boolean {
  return reputation > -50; // Must not be enemy tier
}

/**
 * Returns the reputation change for different interaction types.
 */
export function getRepChangeForAction(
  action:
    | 'quest_completed'
    | 'quest_failed'
    | 'combat_win'
    | 'combat_loss'
    | 'trade'
    | 'scan_share',
  factionId: AlienFactionId,
): number {
  // K'thari respect military strength more
  if (factionId === 'kthari' && action === 'combat_win') return 20;
  if (factionId === 'kthari' && action === 'combat_loss') return -5; // Slight respect for trying

  const baseChanges: Record<typeof action, number> = {
    quest_completed: 15,
    quest_failed: -10,
    combat_win: 5,
    combat_loss: -15,
    trade: 5,
    scan_share: 10, // Archivists love data
  };

  return baseChanges[action];
}

/**
 * Returns true if a player's quadrant position is in range for first contact.
 */
export function isInFirstContactRange(
  playerQx: number,
  playerQy: number,
  factionId: AlienFactionId,
): boolean {
  const chebyshev = Math.max(Math.abs(playerQx), Math.abs(playerQy));
  return chebyshev >= ALIEN_FIRST_CONTACT_DISTANCE[factionId];
}

/**
 * Returns all alien factions the player could encounter at their current quadrant distance.
 */
export function getEncounterableFactions(playerQx: number, playerQy: number): AlienFactionId[] {
  const chebyshev = Math.max(Math.abs(playerQx), Math.abs(playerQy));
  return (Object.entries(ALIEN_FIRST_CONTACT_DISTANCE) as [AlienFactionId, number][])
    .filter(([, minDist]) => chebyshev >= minDist)
    .map(([factionId]) => factionId);
}
