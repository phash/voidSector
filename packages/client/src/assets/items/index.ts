/**
 * Void Sector Item Artwork Exports
 * CRT terminal schematic artworks — amber (#FFB000) wireframe on dark (#050505) background.
 * SVG format: scalable, crisp at any size, no external dependencies.
 */

import oreUrl from './ore.svg?url';
import gasUrl from './gas.svg?url';
import crystalUrl from './crystal.svg?url';
import artefactUrl from './artefact.svg?url';
import dataSlateUrl from './data_slate.svg?url';
import fuelCellUrl from './fuel_cell.svg?url';
import circuitBoardUrl from './circuit_board.svg?url';
import blueprintUrl from './blueprint.svg?url';

export const itemArtwork: Record<string, string> = {
  // Resource items
  ore: oreUrl,
  ERZ: oreUrl,
  gas: gasUrl,
  GAS: gasUrl,
  crystal: crystalUrl,
  KRISTALL: crystalUrl,
  artefact: artefactUrl,
  ARTEFAKT: artefactUrl,
  // Crafted / advanced items
  data_slate: dataSlateUrl,
  DATENTRAEGER: dataSlateUrl,
  fuel_cell: fuelCellUrl,
  BRENNSTOFFZELLE: fuelCellUrl,
  circuit_board: circuitBoardUrl,
  PLATINE: circuitBoardUrl,
  blueprint: blueprintUrl,
  BLAUPAUSE: blueprintUrl,
};

/** Returns the artwork URL for a given item key, or undefined if not found. */
export function getItemArtwork(key: string): string | undefined {
  return itemArtwork[key] ?? itemArtwork[key.toUpperCase()] ?? itemArtwork[key.toLowerCase()];
}

export {
  oreUrl,
  gasUrl,
  crystalUrl,
  artefactUrl,
  dataSlateUrl,
  fuelCellUrl,
  circuitBoardUrl,
  blueprintUrl,
};
