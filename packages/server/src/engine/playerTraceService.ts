// playerTraceService.ts — BB5: ephemeral "a pilot was here" traces.
//
// Major player actions (explore / defeat pirates / build) leave a short-lived
// Redis trace, so even a near-empty galaxy shows signs of other pilots. Two
// views: per-sector (shown when scanning/entering) and a global recent-activity
// feed (shown in NEWS). Bounded by ltrim + TTL — no unbounded growth.

import { redis } from '../rooms/services/RedisAPStore.js';
import { logger } from '../utils/logger.js';

export type TraceAction = 'explored' | 'defeated_pirates' | 'built' | 'scanned' | 'traded' | 'mined';

export interface PlayerTrace {
  playerId: string;
  playerName: string;
  action: TraceAction;
  x: number;
  y: number;
  ts: number;
}

const TRACE_TTL_S = 24 * 3600;
const SECTOR_TRACE_MAX = 5;
const RECENT_MAX = 30;

/** Human-readable relative age (pure). */
export function formatTraceAge(ts: number, now: number): string {
  const min = Math.floor((now - ts) / 60000);
  if (min < 1) return 'soeben';
  if (min < 60) return `vor ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h}h`;
  return `vor ${Math.floor(h / 24)}t`;
}

const ACTION_VERB: Record<TraceAction, string> = {
  explored: 'erkundete diesen Sektor',
  defeated_pirates: 'besiegte hier Piraten',
  built: 'errichtete hier eine Station',
  scanned: 'vermaß diesen Sektor',
  traded: 'handelte hier mit Waren',
  mined: 'förderte hier Rohstoffe',
};

/** One-line trace message (pure). */
export function traceMessage(t: PlayerTrace, now: number): string {
  return `◈ ${t.playerName} ${ACTION_VERB[t.action] ?? 'war hier'} (${formatTraceAge(t.ts, now)})`;
}

/** Parse a Redis trace list, skipping any individually-corrupt entry. */
export function parseTraces(raw: string[]): PlayerTrace[] {
  return raw
    .map((r) => {
      try {
        return JSON.parse(r) as PlayerTrace;
      } catch {
        return null; // one bad entry must not nuke the whole list
      }
    })
    .filter((t): t is PlayerTrace => t !== null);
}

/** Record a trace at a sector (per-sector list + global recent feed). */
export async function recordTrace(t: PlayerTrace): Promise<void> {
  try {
    const entry = JSON.stringify(t);
    const secKey = `trace:sec:${t.x}:${t.y}`;
    await redis.lpush(secKey, entry);
    await redis.ltrim(secKey, 0, SECTOR_TRACE_MAX - 1);
    await redis.expire(secKey, TRACE_TTL_S);
    await redis.lpush('trace:recent', entry);
    await redis.ltrim('trace:recent', 0, RECENT_MAX - 1);
    await redis.expire('trace:recent', TRACE_TTL_S); // bound the global feed too
  } catch (err) {
    // traces are best-effort; never let them break a gameplay action
    logger.warn({ err }, 'recordTrace failed (Redis)');
  }
}

/** Traces left at a sector (most recent first). Best-effort — never throws. */
export async function getSectorTraces(x: number, y: number): Promise<PlayerTrace[]> {
  try {
    return parseTraces(await redis.lrange(`trace:sec:${x}:${y}`, 0, -1));
  } catch (err) {
    logger.warn({ err }, 'getSectorTraces failed (Redis)');
    return [];
  }
}

/** Recent galaxy-wide pilot activity (most recent first). Best-effort — never throws. */
export async function getRecentActivity(limit = 20): Promise<PlayerTrace[]> {
  try {
    return parseTraces(await redis.lrange('trace:recent', 0, limit - 1));
  } catch (err) {
    logger.warn({ err }, 'getRecentActivity failed (Redis)');
    return [];
  }
}

/** Record a trace at a sector ONLY (no global recent-activity feed). For NPCs
 *  whose volume would otherwise drown real players' activity in NEWS. */
export async function recordSectorTrace(t: PlayerTrace): Promise<void> {
  try {
    const entry = JSON.stringify(t);
    const secKey = `trace:sec:${t.x}:${t.y}`;
    await redis.lpush(secKey, entry);
    await redis.ltrim(secKey, 0, SECTOR_TRACE_MAX - 1);
    await redis.expire(secKey, TRACE_TTL_S);
  } catch (err) {
    logger.warn({ err }, 'recordSectorTrace failed (Redis)');
  }
}
