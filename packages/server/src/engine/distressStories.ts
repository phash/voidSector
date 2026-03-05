const SHIP_NAMES = [
  'ISS Meridian',
  'ISS Kahlur',
  'ISS Volantis',
  'Freighter Kova-7',
  'Scout Vessel Argent',
  'ISS Prometheus',
  'Miner Hex-9',
  'ISS Dawnbreaker',
  'Cargo Runner Tethys',
  'ISS Valkyr',
  'Station Tender Orion-3',
  'ISS Centauri',
];

const CREW_NAMES = [
  'Captain Ryn',
  'Pilot Sasha',
  'Engineer Kael',
  'Commander Voss',
  'Lt. Mira',
  'Chief Tomas',
  'Dr. Elara',
  'Navigator Dex',
];

const STORIES: Array<(ship: string, crew: string, x: number, y: number) => string> = [
  (ship, crew, x, y) =>
    `[MAYDAY] ${ship} at ${x}:${y} — ${crew} reporting: Drive core overloaded, venting plasma. We have 3 survivors aboard. Request immediate rescue.`,
  (ship, crew, x, y) =>
    `[DISTRESS] This is ${crew} aboard ${ship}. We were ambushed near ${x}:${y}. Hull breach on deck 2, engines offline. Anyone who reads this — please respond.`,
  (ship, crew, x, y) =>
    `[SOS] ${ship} calling any vessel in range. Navigation systems destroyed after collision with debris at ${x}:${y}. ${crew} here — fuel tank ruptured, drifting. Survivors: 2.`,
  (ship, crew, x, y) =>
    `[EMERGENCY] ${crew} — ${ship} — we were hit by pirates at ${x}:${y}. Cargo jettisoned, reactor is critical. Life support holding for now. Please hurry.`,
  (ship, crew, x, y) =>
    `[MAYDAY] ISS comms relay picking up: ${ship} last known position ${x}:${y}. ${crew}: "...engine is gone... we have wounded... if anyone is out there..."`,
  (ship, crew, x, y) =>
    `[DISTRESS] ${ship} to any vessel — ${crew} speaking. We misjumped and ended up at ${x}:${y}. FTL coil is burnt out. We have supplies for 4 days. Please come.`,
  (ship, crew, x, y) =>
    `[SOS] ${crew} aboard ${ship}. Medical emergency at ${x}:${y} — crew member critical, no medic aboard. Structural integrity 34%. Requesting escort to nearest station.`,
  (ship, crew, x, y) =>
    `[EMERGENCY] ${ship} — ${crew} here. We hit an anomaly at ${x}:${y}, ship systems failing one by one. Sending this on emergency band. If you can hear us, we're waiting.`,
];

export function generateDistressMessage(sectorX: number, sectorY: number, seed: number): string {
  const shipIdx = (((seed >>> 0) % SHIP_NAMES.length) + SHIP_NAMES.length) % SHIP_NAMES.length;
  const crewIdx = (((seed >>> 8) % CREW_NAMES.length) + CREW_NAMES.length) % CREW_NAMES.length;
  const storyIdx = (((seed >>> 16) % STORIES.length) + STORIES.length) % STORIES.length;
  const ship = SHIP_NAMES[shipIdx];
  const crew = CREW_NAMES[crewIdx];
  return STORIES[storyIdx](ship, crew, sectorX, sectorY);
}
