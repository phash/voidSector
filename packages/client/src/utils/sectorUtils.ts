import type { SectorData } from '@void-sector/shared';

export function findNearestStation(
  position: { x: number; y: number },
  discoveries: Record<string, SectorData>,
): SectorData | null {
  return (
    Object.values(discoveries)
      .filter((s) => s.type === 'station')
      .sort((a, b) => {
        const distA = Math.abs(a.x - position.x) + Math.abs(a.y - position.y);
        const distB = Math.abs(b.x - position.x) + Math.abs(b.y - position.y);
        return distA - distB;
      })[0] ?? null
  );
}
