/**
 * Void Sector Station Artwork Exports
 * CRT terminal schematic artworks — amber (#FFB000) wireframe on dark (#050505) background.
 */

import tradingPostUrl from './trading_post.svg?url';
import researchStationUrl from './research_station.svg?url';
import militaryOutpostUrl from './military_outpost.svg?url';
import miningStationUrl from './mining_station.svg?url';
import pirateHideoutUrl from './pirate_hideout.svg?url';

export const stationArtwork: Record<string, string> = {
  trading_post: tradingPostUrl,
  research_station: researchStationUrl,
  military_outpost: militaryOutpostUrl,
  mining_station: miningStationUrl,
  pirate_hideout: pirateHideoutUrl,
  // Aliases for NPC faction stations
  traders: tradingPostUrl,
  scientists: researchStationUrl,
  pirates: pirateHideoutUrl,
  ancients: researchStationUrl,
  independent: tradingPostUrl,
};

export function getStationArtwork(key: string): string | undefined {
  return stationArtwork[key] ?? stationArtwork[key.toLowerCase()];
}

export {
  tradingPostUrl,
  researchStationUrl,
  militaryOutpostUrl,
  miningStationUrl,
  pirateHideoutUrl,
};
