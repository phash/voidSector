# Origin Hub Bounty Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** 3rd Origin Hub service — a **Bounty Board**. Players post (at sector 0:0) a credit-escrowed bounty with one of two objective types, and the first OTHER player to fulfill it out in the world is paid automatically.

- `pirate_defeat` — "defeat pirates/outlaws anywhere in quadrant Q" → fulfilled on a **combat victory** in that quadrant.
- `reach_sector` — "reach sector (x,y)" → fulfilled on a **scan** at that sector.

**Architecture:** Migration `095` + `origin_bounties` table + queries (insert, list-open, atomic find-and-complete, refund-expired). A `BountyService`: post (0:0 gate, validate, `deductCredits` escrow, insert), and `tryFulfill(playerId, x, y, kind)` (atomic claim+payout). Fulfillment is wired via `ServiceContext.tryFulfillBounty` and called from CombatV3Service (victory, kind='combat') + ScanService (scan, kind='reach'). Expired bounties refund the poster via a periodic call in the strategic tick. Client: a BOUNTY tab in the existing tab-ready OriginHubScreen.

**Tech:** TS (ESM `.js`), Vitest (server; client = vite build + vitest, NOT tsc), shared rebuild not needed (no shared change). Migration next = **095**. Access: post at 0:0 (server `_px/_py`).

**Branch:** `feat/origin-hub-bounty` off master.

---

## Key design
- **Escrow:** on post, `deductCredits(posterId, reward)` (atomic, returns false if insufficient → reject). Reward range 1..1,000,000.
- **Fulfillment (atomic, race-safe):** a single SQL `UPDATE ... WHERE id = (SELECT ... open ... matching ... poster<>claimer ... ORDER BY reward DESC, created ASC LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING poster_id, reward_credits`. If a row returns, `addCredits(claimerId, reward)`. Picks the highest open matching bounty, never the claimer's own, exactly once.
- **Match:** pirate_defeat matches on `{qx,qy}` (quadrant of the combat sector via `sectorToQuadrant`); reach_sector matches on `{sectorX,sectorY}`. JSONB containment `objective_data @> $`.
- **Expiry:** `expires_at = created + 7 days`. A periodic `refundExpiredBounties()` sets status='expired' + refunds `addCredits(poster, reward)` for open expired bounties (atomic per-row so no double-refund).
- **No claim step:** open → first fulfiller completes + paid.

---

## File Structure
| File | Action |
|---|---|
| `packages/server/src/db/migrations/095_origin_bounties.sql` | Create |
| `packages/server/src/db/queries.ts` | Modify — bounty queries + `OriginBountyRow` |
| `packages/server/src/rooms/services/BountyService.ts` | Create |
| `packages/server/src/rooms/services/__tests__/bountyService.test.ts` | Create |
| `packages/server/src/rooms/services/ServiceContext.ts` | Modify — add `tryFulfillBounty` |
| `packages/server/src/rooms/SectorRoom.ts` | Modify — construct BountyService, wire ctx, post/get handlers |
| `packages/server/src/rooms/services/CombatV3Service.ts` | Modify — call tryFulfillBounty on victory |
| `packages/server/src/rooms/services/ScanService.ts` | Modify — call tryFulfillBounty on scan |
| `packages/server/src/engine/strategicTickService.ts` | Modify — periodic refundExpiredBounties |
| `packages/client/src/state/gameSlice.ts` | Modify — `bounties` + setter |
| `packages/client/src/network/client.ts` | Modify — request/post + handlers |
| `packages/client/src/state/helpSlice.ts` | Modify — `first_originhub` (extend) |
| `packages/client/src/components/OriginHubScreen.tsx` | Modify — BOUNTY tab |

---

## Task 1: Server core — migration + queries + BountyService

- [ ] **Step 1: failing test** `packages/server/src/rooms/services/__tests__/bountyService.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateBounty, BOUNTY_MAX_REWARD } from '../BountyService.js';

describe('validateBounty', () => {
  it('accepts a pirate_defeat with a quadrant target + valid reward', () => {
    expect(validateBounty('pirate_defeat', { qx: 0, qy: 0 }, 500)).toMatchObject({ ok: true });
  });
  it('accepts a reach_sector with a sector target', () => {
    expect(validateBounty('reach_sector', { sectorX: 5, sectorY: 3 }, 500)).toMatchObject({ ok: true });
  });
  it('rejects an unknown objective type', () => {
    expect(validateBounty('deliver', { qx: 0, qy: 0 }, 500).ok).toBe(false);
  });
  it('rejects a pirate_defeat missing qx/qy', () => {
    expect(validateBounty('pirate_defeat', { sectorX: 1, sectorY: 2 }, 500).ok).toBe(false);
  });
  it('rejects reward < 1, non-integer, or over the cap', () => {
    expect(validateBounty('reach_sector', { sectorX: 1, sectorY: 1 }, 0).ok).toBe(false);
    expect(validateBounty('reach_sector', { sectorX: 1, sectorY: 1 }, 1.5).ok).toBe(false);
    expect(validateBounty('reach_sector', { sectorX: 1, sectorY: 1 }, BOUNTY_MAX_REWARD + 1).ok).toBe(false);
  });
});
```
Run → FAIL.

- [ ] **Step 2: migration** `095_origin_bounties.sql`:
```sql
-- 095: Origin Hub bounty board — player-posted, credit-escrowed bounties.
CREATE TABLE IF NOT EXISTS origin_bounties (
  id             SERIAL PRIMARY KEY,
  poster_id      VARCHAR(255) NOT NULL,
  poster_name    VARCHAR(255) NOT NULL,
  reward_credits INTEGER NOT NULL CHECK (reward_credits > 0),
  objective_type VARCHAR(30) NOT NULL,
  objective_data JSONB NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'open',
  claimer_id     VARCHAR(255),
  claimer_name   VARCHAR(255),
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMP WITH TIME ZONE,
  expires_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);
CREATE INDEX IF NOT EXISTS idx_origin_bounties_open ON origin_bounties (status, objective_type);
CREATE INDEX IF NOT EXISTS idx_origin_bounties_created ON origin_bounties (created_at DESC);
```

- [ ] **Step 3: queries** in `db/queries.ts` (match the `query`/`withTransaction` style; export `OriginBountyRow`):
```typescript
export interface OriginBountyRow {
  id: number; poster_id: string; poster_name: string; reward_credits: number;
  objective_type: string; objective_data: any; status: string;
  claimer_id: string | null; claimer_name: string | null;
  created_at: string; completed_at: string | null; expires_at: string;
}

export async function insertOriginBounty(
  posterId: string, posterName: string, reward: number, objectiveType: string, objectiveData: object,
): Promise<OriginBountyRow | null> {
  const res = await query<OriginBountyRow>(
    `INSERT INTO origin_bounties (poster_id, poster_name, reward_credits, objective_type, objective_data)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [posterId, posterName, reward, objectiveType, JSON.stringify(objectiveData)],
  );
  return res.rows[0] ?? null;
}

export async function getOpenBounties(limit = 50): Promise<OriginBountyRow[]> {
  const res = await query<OriginBountyRow>(
    `SELECT * FROM origin_bounties WHERE status = 'open' AND expires_at > NOW()
     ORDER BY reward_credits DESC, created_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
}

/** Atomically claim+complete the best open bounty matching (type, dataMatch) for a non-poster claimer.
 *  Returns the completed row (with poster_id + reward_credits) or null. */
export async function fulfillBounty(
  claimerId: string, claimerName: string, objectiveType: string, dataMatch: object,
): Promise<OriginBountyRow | null> {
  const res = await query<OriginBountyRow>(
    `UPDATE origin_bounties SET status='completed', claimer_id=$1, claimer_name=$2, completed_at=NOW()
     WHERE id = (
       SELECT id FROM origin_bounties
       WHERE status='open' AND expires_at > NOW() AND objective_type=$3
         AND objective_data @> $4::jsonb AND poster_id <> $1
       ORDER BY reward_credits DESC, created_at ASC LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [claimerId, claimerName, objectiveType, JSON.stringify(dataMatch)],
  );
  return res.rows[0] ?? null;
}

/** Expire + refund open bounties past their expiry. Returns the rows refunded (poster_id, reward). */
export async function expireBountiesForRefund(): Promise<Array<{ poster_id: string; reward_credits: number }>> {
  const res = await query<{ poster_id: string; reward_credits: number }>(
    `UPDATE origin_bounties SET status='expired'
     WHERE status='open' AND expires_at <= NOW()
     RETURNING poster_id, reward_credits`,
  );
  return res.rows;
}
```

- [ ] **Step 4: BountyService** `rooms/services/BountyService.ts` (mirror NoticeService: `constructor(private ctx: ServiceContext)`, `this.ctx.send`, `client.auth as AuthPayload`):
```typescript
import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../auth.js';
import { sectorToQuadrant } from '../../engine/quadrantEngine.js';
import { QUADRANT_SIZE } from '@void-sector/shared';
import {
  insertOriginBounty, getOpenBounties, fulfillBounty, expireBountiesForRefund,
  deductCredits, addCredits,
} from '../../db/queries.js';

export const BOUNTY_MAX_REWARD = 1_000_000;
export type BountyKind = 'combat' | 'reach';

export function validateBounty(objectiveType: string, data: any, reward: number):
  { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(reward) || reward < 1 || reward > BOUNTY_MAX_REWARD) return { ok: false, reason: 'BAD_REWARD' };
  if (objectiveType === 'pirate_defeat') {
    if (!Number.isInteger(data?.qx) || !Number.isInteger(data?.qy)) return { ok: false, reason: 'BAD_TARGET' };
    return { ok: true };
  }
  if (objectiveType === 'reach_sector') {
    if (!Number.isInteger(data?.sectorX) || !Number.isInteger(data?.sectorY)) return { ok: false, reason: 'BAD_TARGET' };
    return { ok: true };
  }
  return { ok: false, reason: 'BAD_TYPE' };
}

export class BountyService {
  constructor(private ctx: ServiceContext) {}

  async handlePost(client: Client, data: { objectiveType: string; objectiveData: any; reward: number }, px: number, py: number): Promise<void> {
    if (px !== 0 || py !== 0) { this.ctx.send(client, 'error', { code: 'NOT_AT_ORIGIN', message: 'Nur am Zentrum (0:0) kannst du Bounties aussetzen.' }); return; }
    const auth = client.auth as AuthPayload | null;
    if (!auth?.userId) return;
    const v = validateBounty(data?.objectiveType, data?.objectiveData, data?.reward);
    if (!v.ok) { this.ctx.send(client, 'error', { code: 'INVALID_BOUNTY', message: 'Ungültige Bounty.' }); return; }
    // normalise objectiveData to ONLY the matched keys (prevent junk)
    const od = data.objectiveType === 'pirate_defeat'
      ? { qx: data.objectiveData.qx, qy: data.objectiveData.qy }
      : { sectorX: data.objectiveData.sectorX, sectorY: data.objectiveData.sectorY };
    const ok = await deductCredits(auth.userId, data.reward);
    if (!ok) { this.ctx.send(client, 'error', { code: 'INSUFFICIENT_CREDITS', message: 'Nicht genug Credits.' }); return; }
    const bounty = await insertOriginBounty(auth.userId, auth.username, data.reward, data.objectiveType, od);
    if (!bounty) { await addCredits(auth.userId, data.reward); this.ctx.send(client, 'error', { code: 'BOUNTY_FAILED', message: 'Fehlgeschlagen.' }); return; }
    await this.sendOpen(client);
  }

  async sendOpen(client: Client): Promise<void> {
    this.ctx.send(client, 'bountiesResult', { bounties: await getOpenBounties(50) });
  }

  /** Called from combat-victory / scan hooks. Returns the completed bounty (for notification) or null. */
  async tryFulfill(playerId: string, playerName: string, x: number, y: number, kind: BountyKind): Promise<{ reward: number } | null> {
    if (kind === 'combat') {
      const { qx, qy } = sectorToQuadrant(x, y);
      const b = await fulfillBounty(playerId, playerName, 'pirate_defeat', { qx, qy });
      if (b) { await addCredits(playerId, b.reward_credits); return { reward: b.reward_credits }; }
      return null;
    }
    // reach
    const b = await fulfillBounty(playerId, playerName, 'reach_sector', { sectorX: x, sectorY: y });
    if (b) { await addCredits(playerId, b.reward_credits); return { reward: b.reward_credits }; }
    return null;
  }

  async refundExpired(): Promise<void> {
    const refunds = await expireBountiesForRefund();
    for (const r of refunds) await addCredits(r.poster_id, r.reward_credits).catch(() => undefined);
  }
}
```
> Confirm `deductCredits`/`addCredits` exist in queries.ts (they do, ~611-632). Confirm `sectorToQuadrant` import path (`engine/quadrantEngine.js`). Match `this.ctx.send` + `AuthPayload` import to NoticeService EXACTLY.
Run the test → PASS.

- [ ] **Step 5: commit.**
```bash
git add packages/server/src/db/migrations/095_origin_bounties.sql packages/server/src/db/queries.ts packages/server/src/rooms/services/BountyService.ts packages/server/src/rooms/services/__tests__/bountyService.test.ts
git commit -m "feat: BountyService — escrowed player bounties (pirate_defeat quadrant / reach_sector), atomic fulfill+refund"
```

---

## Task 2: Wire fulfillment hooks + handlers + refund tick

- [ ] **Step 1: ServiceContext** — add an optional `tryFulfillBounty` so combat/scan can call it without a hard dep. In `ServiceContext.ts` add to the interface/type: `tryFulfillBounty?: (playerId: string, playerName: string, x: number, y: number, kind: 'combat' | 'reach') => Promise<{ reward: number } | null>;` (match how `contributeToCommunityQuest`/`checkQuestProgress` are typed on the ctx).

- [ ] **Step 2: SectorRoom** — construct + wire + handlers. Near the other services: `this.bounty = new BountyService(this.serviceCtx);` and `this.serviceCtx.tryFulfillBounty = this.bounty.tryFulfill.bind(this.bounty);`. Add a `bounty` field. Handlers (near the notice handlers):
```typescript
this.onMessage('postBounty', async (client, data: { objectiveType: string; objectiveData: any; reward: number }) => {
  await this.bounty.handlePost(client, data ?? ({} as any), this._px(client.sessionId), this._py(client.sessionId));
});
this.onMessage('getBounties', async (client) => { await this.bounty.sendOpen(client); });
```

- [ ] **Step 3: CombatV3Service victory hook** — in the victory path (after the loot/recordTrace, ~line 166-177), add (guard the optional ctx fn + notify on payout):
```typescript
const bx = this.ctx._px(client.sessionId), by = this.ctx._py(client.sessionId);
const claimed = await this.ctx.tryFulfillBounty?.(auth.userId, auth.username, bx, by, 'combat').catch(() => null);
if (claimed) this.ctx.send(client, 'bountyClaimed', { reward: claimed.reward, kind: 'combat' });
```

- [ ] **Step 4: ScanService scan hook** — where it already calls `checkQuestProgress(... 'scan' ...)` (~line 177), add after it:
```typescript
const sx = this.ctx._px(client.sessionId), sy = this.ctx._py(client.sessionId);
const claimedB = await this.ctx.tryFulfillBounty?.(auth.userId, auth.username, sx, sy, 'reach').catch(() => null);
if (claimedB) this.ctx.send(client, 'bountyClaimed', { reward: claimedB.reward, kind: 'reach' });
```

- [ ] **Step 5: refund tick** — in `strategicTickService.ts` `tick()`, add a periodic refund (it runs every 60s; refund-expired is cheap). Best: expose via SectorRoom's bounty service OR call a standalone. Simplest: in SectorRoom, when constructing the strategic tick is not available — instead call `this.bounty.refundExpired()` from an existing room-level interval OR add to the universe tick. ACTUALLY simplest + decoupled: call `expireBountiesForRefund()` + refund inside the existing `strategicTickService` by importing the queries directly:
```typescript
// in strategicTickService.tick(), near other periodic cleanups:
import { expireBountiesForRefund, addCredits } from '../db/queries.js';
const refunds = await expireBountiesForRefund().catch(() => []);
for (const r of refunds) await addCredits(r.poster_id, r.reward_credits).catch(() => undefined);
```
(Place it next to `cleanupExpiredQuestItems` or similar existing periodic cleanup. Keep it guarded so a failure doesn't break the tick.)

- [ ] **Step 6: verify + commit.**
`cd packages/server && npx tsc --noEmit 2>&1 | grep -iE "Bounty|Combat|Scan|SectorRoom|strategicTick" || echo clean`
`npx vitest run src/rooms/services/__tests__/bountyService.test.ts`
Run combat/scan/strategic tests if present (e.g. `src/__tests__/strategicTickService.test.ts`); if a test mocks the ctx and now needs `tryFulfillBounty`, add a no-op mock — do not weaken assertions.
```bash
git add packages/server/src/rooms/services/ServiceContext.ts packages/server/src/rooms/SectorRoom.ts packages/server/src/rooms/services/CombatV3Service.ts packages/server/src/rooms/services/ScanService.ts packages/server/src/engine/strategicTickService.ts
git commit -m "feat: wire bounty fulfillment (combat victory + scan) + post/get handlers + expiry refund tick"
```

---

## Task 3: Client — BOUNTY tab

- [ ] **Step 1: gameSlice** — `bounties: OriginBounty[]` + `setBounties`, mirror `originNotices`. Type:
```typescript
bounties: Array<{ id: number; poster_name: string; reward_credits: number; objective_type: string; objective_data: any; status: string; created_at: string; expires_at: string }>;
```

- [ ] **Step 2: network** — `requestBounties() { this.sectorRoom?.send('getBounties'); }`, `postBounty(objectiveType: string, objectiveData: any, reward: number) { this.sectorRoom?.send('postBounty', { objectiveType, objectiveData, reward }); }`. onMessage: `bountiesResult` → setBounties; `bountyClaimed` → a transient toast/log via the store's existing notification/log mechanism (find how NewsScreen/combat shows a transient message; if none, just `console.info` is NOT acceptable — instead push to an existing toast/error channel if present, else skip the toast and rely on credits updating).

- [ ] **Step 3: OriginHubScreen** — add `'BOUNTY'` to the tabs. The BOUNTY tab:
  - `useEffect` on tab → `network.requestBounties()`.
  - List open `bounties` (newest/highest first): each shows reward (credits), the objective ("Piraten in Quadrant qx:qy besiegen" for pirate_defeat using `objective_data.qx/qy`; "Sektor sectorX:sectorY erreichen" for reach_sector), poster_name, and a relative expiry.
  - Post form (only enabled at 0:0; hint + disabled otherwise): a type selector (PIRATEN-KOPFGELD / SEKTOR-ZIEL), target inputs (qx,qy for pirate; sectorX,sectorY for reach), a reward number input (1..1,000,000, capped at the player's credits — read credits from the store), and "AUSSETZEN" → `network.postBounty(type, data, reward)`. Disable if reward<1 or reward>credits.
  - Empty state: "Keine offenen Kopfgelder."
- [ ] **Step 4: helpSlice** — extend the `first_originhub` body OR add the bounty info (keep ≤6 lines).
- [ ] **Step 5: verify** — `cd packages/client && npx vite build 2>&1 | tail -4` (clean) + `npx vitest run 2>&1 | grep -E "Test Files|Tests "`.
- [ ] **Step 6: commit.**
```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts packages/client/src/components/OriginHubScreen.tsx packages/client/src/state/helpSlice.ts
git commit -m "feat: Origin Hub BOUNTY tab — post + list player bounties"
```

---

## Task 4: Sweep + deploy
- [ ] Full shared+server vitest + client vite build green.
- [ ] Deploy (migration 095 auto-runs): `cd /opt/voidsector && git pull && docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build server client`.
- [ ] Prod verify: at 0:0 post a bounty → credits deducted, appears in list; defeat pirates in the target quadrant (or reach the target sector) as another player → paid; `SELECT status, count(*) FROM origin_bounties GROUP BY status;`.

---

## Self-Review (plan author)
- **Coverage:** post (0:0 gate + escrow) T1/T2; two objective types + quadrant/sector matching T1; atomic race-safe fulfill + payout T1; combat + scan hooks T2; expiry refund T2; client tab T3. ✓
- **Atomicity:** escrow = atomic `deductCredits`; fulfill = single `UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING` then `addCredits` (one winner, can't claim own); refund = atomic `UPDATE ... RETURNING` then `addCredits`. Post-insert failure refunds the escrow.
- **Placeholders:** none; "match NoticeService/ChatService exactly" + "confirm ctx fn typing" are deliberate executor checks.
- **Consistency:** `postBounty`/`getBounties` (client↔server), `bountiesResult`/`bountyClaimed` (server→client), `tryFulfillBounty` (ctx↔BountyService↔combat/scan), `validateBounty`/`BOUNTY_MAX_REWARD` (service↔test), objective types `pirate_defeat`/`reach_sector` + data keys `qx,qy`/`sectorX,sectorY` everywhere. Aligned.
- **Verification points:** `deductCredits`/`addCredits` signatures; `sectorToQuadrant` path + units (quadrant matching must use the SAME convention as the combat sector→quadrant); how the ctx exposes service fns (`contributeToCommunityQuest` pattern); a transient-toast channel on the client for `bountyClaimed` (else skip).
