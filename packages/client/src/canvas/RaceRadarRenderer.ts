/**
 * Race Radar Renderer — #187
 * Draws alien faction NPC ship icons on the radar canvas using race-specific
 * pixel patterns and accent colors from RACE_VISUAL_CONFIGS.
 */

import { RACE_VISUAL_CONFIGS } from '@void-sector/shared';
import type { AlienFactionId } from '@void-sector/shared';

/**
 * Draw an alien race ship icon centered at (cx, cy) on the radar.
 * Uses the 5×5 pattern from RACE_VISUAL_CONFIGS[raceId].radarPattern.
 *
 * @param ctx  Canvas 2D context
 * @param raceId  Alien faction identifier
 * @param cx  Center X pixel coordinate
 * @param cy  Center Y pixel coordinate
 * @param pixelSize  Size of each pattern pixel in canvas pixels (default 2)
 */
export function drawRaceIcon(
  ctx: CanvasRenderingContext2D,
  raceId: AlienFactionId,
  cx: number,
  cy: number,
  pixelSize = 2,
): void {
  const config = RACE_VISUAL_CONFIGS[raceId];
  if (!config) return;

  const pattern = config.radarPattern;
  const rows = pattern.length;
  const cols = pattern[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return;

  const offsetX = cx - Math.floor((cols * pixelSize) / 2);
  const offsetY = cy - Math.floor((rows * pixelSize) / 2);

  ctx.fillStyle = config.accentColor;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (pattern[r][c]) {
        ctx.fillRect(offsetX + c * pixelSize, offsetY + r * pixelSize, pixelSize, pixelSize);
      }
    }
  }
}

/**
 * Returns the CSS accent color string for a given alien faction.
 * Useful for station terminal theming.
 */
export function getRaceAccentColor(raceId: AlienFactionId): string {
  return RACE_VISUAL_CONFIGS[raceId]?.accentColor ?? '#c8a96e';
}

/**
 * Returns the dim/background color for a given alien faction.
 */
export function getRaceDimColor(raceId: AlienFactionId): string {
  return RACE_VISUAL_CONFIGS[raceId]?.dimColor ?? '#6b5a38';
}
