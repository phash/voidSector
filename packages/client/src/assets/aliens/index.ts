/**
 * Void Sector Alien Artwork Exports
 * CRT terminal schematic artworks — amber (#FFB000) wireframe on dark (#050505) background.
 */

import alienScoutUrl from './alien_scout.svg?url';
import alienCruiserUrl from './alien_cruiser.svg?url';
import alienStationUrl from './alien_station.svg?url';
import alienArtifactUrl from './alien_artifact.svg?url';

export const alienArtwork: Record<string, string> = {
  alien_scout: alienScoutUrl,
  alien_cruiser: alienCruiserUrl,
  alien_station: alienStationUrl,
  alien_artifact: alienArtifactUrl,
};

export function getAlienArtwork(key: string): string | undefined {
  return alienArtwork[key] ?? alienArtwork[key.toLowerCase()];
}

export {
  alienScoutUrl,
  alienCruiserUrl,
  alienStationUrl,
  alienArtifactUrl,
};
