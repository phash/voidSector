export type TrailKind = 'player' | 'trader' | 'combat' | 'unidentified';

export const TRAIL_MAX_POINTS = 5;          // max 5 sectors long
export const TRAIL_TICK_MS = 2000;          // one "tick" (tunable)
export const TRAIL_MAX_TICKS = 5;           // points vanish 5 ticks after creation
export const TRAIL_TTL_MS = TRAIL_TICK_MS * TRAIL_MAX_TICKS; // 10s

export const TRAIL_COLORS: Record<TrailKind, string> = {
  player: '#3399FF',        // blue
  trader: '#00FF66',        // green
  combat: '#FF4444',        // red
  unidentified: '#FFFFFF',  // white
};

/** Classify a ship for trail color. role: civ-ship role; isPlayer: self or other human player. */
export function classifyShip(opts: { isPlayer?: boolean; role?: string }): TrailKind {
  if (opts.isPlayer) return 'player';
  if (opts.role === 'trader') return 'trader';
  if (opts.role === 'military' || opts.role === 'outlaw') return 'combat';
  return 'unidentified';
}

export interface TrailEntry { key: string; x: number; y: number; kind: TrailKind; }

interface TrailPoint { x: number; y: number; createdAt: number; }

export interface RenderTrail {
  key: string;
  kind: TrailKind;
  points: Array<{ x: number; y: number; alpha: number }>;
}

class RadarTrailManager {
  private trails = new Map<string, { kind: TrailKind; points: TrailPoint[] }>();

  /**
   * Observe current ships: append a point when a ship's SECTOR changed; cap to
   * TRAIL_MAX_POINTS; prune points older than TRAIL_TTL_MS; drop empty trails.
   */
  observe(entries: TrailEntry[], now: number): void {
    // Update/create trails for observed entries
    for (const entry of entries) {
      let trail = this.trails.get(entry.key);
      if (!trail) {
        trail = { kind: entry.kind, points: [] };
        this.trails.set(entry.key, trail);
      }

      // Append point if position changed or no points yet
      const last = trail.points[trail.points.length - 1];
      if (!last || last.x !== entry.x || last.y !== entry.y) {
        trail.points.push({ x: entry.x, y: entry.y, createdAt: now });
        // Cap to TRAIL_MAX_POINTS (keep the newest ones)
        if (trail.points.length > TRAIL_MAX_POINTS) {
          trail.points = trail.points.slice(trail.points.length - TRAIL_MAX_POINTS);
        }
      }
    }

    // Prune ALL trails (including ones not in current entries)
    for (const [key, trail] of this.trails) {
      trail.points = trail.points.filter((p) => now - p.createdAt < TRAIL_TTL_MS);
      if (trail.points.length === 0) {
        this.trails.delete(key);
      }
    }
  }

  /** Trails for rendering, oldest-first (newest at end), with per-point alpha = 1 - age/TTL (clamped). */
  getTrails(now: number): RenderTrail[] {
    const result: RenderTrail[] = [];
    for (const [key, trail] of this.trails) {
      const points = trail.points
        .map((p) => ({
          x: p.x,
          y: p.y,
          alpha: Math.max(0, 1 - (now - p.createdAt) / TRAIL_TTL_MS),
        }))
        .filter((p) => p.alpha > 0);

      if (points.length > 0) {
        result.push({ key, kind: trail.kind, points });
      }
    }
    return result;
  }

  clear(): void {
    this.trails.clear();
  }
}

export const radarTrailManager = new RadarTrailManager();
