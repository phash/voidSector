# Origin Hub Shell + Notice Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** A new cockpit program **ORIGIN-HUB**, usable only when the player is at sector (0,0), whose first service is a **Notice Board** — a persistent galaxy-wide message wall: post a message (only at 0:0), read the latest 50.

**Architecture:** Server: a `094` migration + `origin_notices` queries + a small `NoticeService` (validate message, gate to sector 0:0, rate-limit) wired into SectorRoom via two onMessage handlers. Client: a new `OriginHubScreen` (a tabbed shell with one PINNWAND tab for now) gated on `state.position`, plus gameSlice/network/helpSlice plumbing. The shell is built tab-ready so the next services (CQ turn-in, bounty, exchange) drop in as tabs.

**Tech Stack:** TS (ESM `.js` server imports), Vitest (server; client per project convention uses vitest/vite-build NOT tsc — ~111 pre-existing client tsc errors), `@void-sector/shared` (rebuild after edits), Postgres migration (auto-run, next = **094**). Access model (user decision): physical — services require being at sector 0:0.

**Branch:** `feat/origin-hub-notice` off master.

---

## File Structure

| File | Action |
|---|---|
| `packages/shared/src/constants.ts` | Modify — register ORIGIN-HUB (MONITORS, COCKPIT_PROGRAMS, COCKPIT_PROGRAM_LABELS) |
| `packages/server/src/db/migrations/094_origin_notices.sql` | Create — table |
| `packages/server/src/db/queries.ts` | Modify — `OriginNoticeRow`, `insertOriginNotice`, `getOriginNotices` |
| `packages/server/src/rooms/services/NoticeService.ts` | Create — validate + gate + post/get |
| `packages/server/src/rooms/services/__tests__/noticeService.test.ts` | Create — pure validation tests |
| `packages/server/src/rooms/SectorRoom.ts` | Modify — construct NoticeService + 2 onMessage handlers |
| `packages/client/src/state/gameSlice.ts` | Modify — `originNotices` + setter |
| `packages/client/src/network/client.ts` | Modify — request/post methods + onMessage handlers |
| `packages/client/src/state/helpSlice.ts` | Modify — `first_originhub` tip |
| `packages/client/src/components/OriginHubScreen.tsx` | Create — Sec2 UI (gated) |
| `packages/client/src/components/GameScreen.tsx` | Modify — renderScreen case |

---

## Task 1: Register the ORIGIN-HUB program (shared)

**Files:** `packages/shared/src/constants.ts`

- [ ] **Step 1:** In `MONITORS` (~line 744-762) add `ORIGIN_HUB: 'ORIGIN-HUB',`. In `COCKPIT_PROGRAMS` (~767-783) add `MONITORS.ORIGIN_HUB,` (place after NEWS or near the social programs). In `COCKPIT_PROGRAM_LABELS` (~786-803) add `'ORIGIN-HUB': 'HUB',`.
- [ ] **Step 2:** Rebuild: `cd packages/shared && npm run build` (clean).
- [ ] **Step 3:** Commit:
```bash
git add packages/shared/src/constants.ts packages/shared/dist
git commit -m "feat: register ORIGIN-HUB cockpit program"
```

---

## Task 2: Server — migration + queries + NoticeService + handlers

**Files:** migration, `queries.ts`, `NoticeService.ts`, its test, `SectorRoom.ts`

- [ ] **Step 1: Write the failing test.** Create `packages/server/src/rooms/services/__tests__/noticeService.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateNoticeMessage, NOTICE_MAX_LEN } from '../NoticeService.js';

describe('validateNoticeMessage', () => {
  it('accepts a normal message (trimmed)', () => {
    expect(validateNoticeMessage('  Hallo Galaxis  ')).toEqual({ ok: true, message: 'Hallo Galaxis' });
  });
  it('rejects empty / whitespace-only', () => {
    expect(validateNoticeMessage('   ').ok).toBe(false);
    expect(validateNoticeMessage('').ok).toBe(false);
  });
  it(`rejects over ${NOTICE_MAX_LEN} chars`, () => {
    expect(validateNoticeMessage('x'.repeat(NOTICE_MAX_LEN + 1)).ok).toBe(false);
  });
  it('accepts exactly the max length', () => {
    expect(validateNoticeMessage('x'.repeat(NOTICE_MAX_LEN)).ok).toBe(true);
  });
});
```
Run → FAIL: `cd packages/server && npx vitest run src/rooms/services/__tests__/noticeService.test.ts`

- [ ] **Step 2: Migration** `packages/server/src/db/migrations/094_origin_notices.sql`:
```sql
-- 094: Origin Hub notice board — a persistent galaxy-wide message wall posted at 0:0.
CREATE TABLE IF NOT EXISTS origin_notices (
  id          SERIAL PRIMARY KEY,
  player_id   VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_origin_notices_created ON origin_notices (created_at DESC);
```

- [ ] **Step 3: Queries** — add to `packages/server/src/db/queries.ts` (mirror `getRecentNews`/insert patterns; confirm the `query` import + add an exported `OriginNoticeRow` interface):
```typescript
export interface OriginNoticeRow {
  id: number;
  player_id: string;
  player_name: string;
  message: string;
  created_at: string;
}

export async function insertOriginNotice(
  playerId: string,
  playerName: string,
  message: string,
): Promise<OriginNoticeRow | null> {
  const res = await query<OriginNoticeRow>(
    `INSERT INTO origin_notices (player_id, player_name, message)
     VALUES ($1, $2, $3) RETURNING *`,
    [playerId, playerName, message],
  );
  return res.rows[0] ?? null;
}

export async function getOriginNotices(limit = 50): Promise<OriginNoticeRow[]> {
  const res = await query<OriginNoticeRow>(
    'SELECT * FROM origin_notices ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return res.rows;
}
```

- [ ] **Step 4: NoticeService** `packages/server/src/rooms/services/NoticeService.ts`. Mirror `ChatService` (constructor `(private ctx: ServiceContext)`, `client.auth as AuthPayload`, `ctx.checkRate`). Read `ChatService.ts` + `ServiceContext` to match the exact API (how `ctx.send`/`client.send` is used, how the player's sector is read — the room exposes `_px(sessionId)`/`_py(sessionId)`; NoticeService gets the sector via params passed from SectorRoom, like `handleDeliverQuest(client, id, px, py)`).
```typescript
import type { Client } from 'colyseus';
import type { ServiceContext } from './ServiceContext.js';
import type { AuthPayload } from '../../types/auth.js'; // match the real AuthPayload import used by ChatService
import { insertOriginNotice, getOriginNotices } from '../../db/queries.js';

export const NOTICE_MAX_LEN = 280;

/** Pure: validate + normalise a notice message. */
export function validateNoticeMessage(raw: string): { ok: true; message: string } | { ok: false; reason: string } {
  const message = (raw ?? '').trim();
  if (message.length === 0) return { ok: false, reason: 'EMPTY' };
  if (message.length > NOTICE_MAX_LEN) return { ok: false, reason: 'TOO_LONG' };
  return { ok: true, message };
}

export class NoticeService {
  constructor(private ctx: ServiceContext) {}

  /** Post a notice — only allowed at sector (0,0). px/py = caller's current sector. */
  async handlePost(client: Client, raw: string, px: number, py: number): Promise<void> {
    if (!this.ctx.checkRate(client.sessionId, 'originNotice', 30_000)) {
      client.send('error', { code: 'RATE_LIMIT', message: 'Bitte warte kurz, bevor du erneut postest.' });
      return;
    }
    if (px !== 0 || py !== 0) {
      client.send('error', { code: 'NOT_AT_ORIGIN', message: 'Nur am Zentrum (Sektor 0:0) kannst du posten.' });
      return;
    }
    const v = validateNoticeMessage(raw);
    if (!v.ok) {
      client.send('error', { code: 'INVALID_NOTICE', message: v.reason === 'TOO_LONG' ? `Max ${NOTICE_MAX_LEN} Zeichen.` : 'Leere Nachricht.' });
      return;
    }
    const auth = client.auth as AuthPayload;
    const notice = await insertOriginNotice(auth.userId, auth.username, v.message);
    if (notice) client.send('originNoticePosted', { notice });
  }

  /** Return the latest notices to the caller. */
  async handleGet(client: Client): Promise<void> {
    const notices = await getOriginNotices(50);
    client.send('originNoticesResult', { notices });
  }
}
```
> Adjust the `AuthPayload` import path + the `client.send` vs `ctx.send` call style to EXACTLY match ChatService. If `ctx.checkRate` signature differs, match it. If the room doesn't expose `_px/_py` to services, the handlers in Step 5 pass the sector in (they call `this._px(client.sessionId)`).
Run the test → PASS.

- [ ] **Step 5: Wire into SectorRoom.** In `SectorRoom.ts`: import + construct `this.notice = new NoticeService(this.serviceCtx);` alongside the other services (~line 408 area). Register two handlers (near the other `this.onMessage(...)` blocks, e.g. by getNews ~line 1015):
```typescript
this.onMessage('postOriginNotice', async (client, data: { message: string }) => {
  await this.notice.handlePost(client, data?.message ?? '', this._px(client.sessionId), this._py(client.sessionId));
});
this.onMessage('getOriginNotices', async (client) => {
  await this.notice.handleGet(client);
});
```
Add the `notice` field declaration where the other services are declared. Run `cd packages/server && npx tsc --noEmit 2>&1 | grep -iE "NoticeService|SectorRoom" || echo clean` and the existing SectorRoom-related tests.

- [ ] **Step 6: Commit.**
```bash
git add packages/server/src/db/migrations/094_origin_notices.sql packages/server/src/db/queries.ts packages/server/src/rooms/services/NoticeService.ts packages/server/src/rooms/services/__tests__/noticeService.test.ts packages/server/src/rooms/SectorRoom.ts
git commit -m "feat: NoticeService — origin notice board (post at 0:0, get latest 50)"
```

---

## Task 3: Client — OriginHubScreen + plumbing

**Files:** `gameSlice.ts`, `network/client.ts`, `helpSlice.ts`, `OriginHubScreen.tsx`, `GameScreen.tsx`

- [ ] **Step 1: gameSlice.** Add the field + setter (mirror `newsItems`/`setNewsItems`):
```typescript
// type (near other arrays)
originNotices: Array<{ id: number; player_id: string; player_name: string; message: string; created_at: string }>;
// setter
setOriginNotices: (originNotices) => set({ originNotices }),
```
Initialise `originNotices: []` in the initial state.

- [ ] **Step 2: network/client.ts.** Add request/post methods (mirror `requestNews`):
```typescript
requestOriginNotices() { this.sectorRoom?.send('getOriginNotices'); }
postOriginNotice(message: string) { this.sectorRoom?.send('postOriginNotice', { message }); }
```
In the room `onMessage` setup (where `newsResult`/`galaxyActivity` handlers are registered):
```typescript
room.onMessage('originNoticesResult', (data: { notices: any[] }) => {
  useStore.getState().setOriginNotices(data.notices ?? []);
});
room.onMessage('originNoticePosted', (data: { notice: any }) => {
  const s = useStore.getState();
  s.setOriginNotices([data.notice, ...s.originNotices].slice(0, 50));
});
```

- [ ] **Step 3: helpSlice.** Add to `HELP_TIPS`:
```typescript
{
  id: 'first_originhub',
  title: '◈ ORIGIN HUB — PINNWAND',
  body:
    'Das galaktische Schwarze Brett am Zentrum (Sektor 0:0).\n\n' +
    '→ Posten kannst du nur, wenn du im Sektor 0:0 bist\n' +
    '→ Alle Piloten lesen die letzten 50 Meldungen\n' +
    '→ Ort für Koordination, Handel und Geschichten',
},
```

- [ ] **Step 4: OriginHubScreen.tsx.** Create `packages/client/src/components/OriginHubScreen.tsx`, mirroring `NewsScreen.tsx`'s structure/styling (CRT terminal aesthetic — same container/scroll/colors). Behavior:
  - Read `position`, `originNotices`, `showTip`, `network` from the store/singleton (match how NewsScreen imports `network`).
  - `const atOrigin = position.x === 0 && position.y === 0;`
  - `useEffect(() => { showTip('first_originhub'); if (atOrigin) network.requestOriginNotices(); }, [atOrigin]);`
  - A header "◈ ORIGIN HUB" + a tab bar with one active tab `PINNWAND` (built so more tabs can be added later — a simple `tabs = ['PINNWAND']` map; the active tab state defaults to PINNWAND).
  - A `[?]` button → `showTip('first_originhub')`.
  - If `!atOrigin`: show a centered hint "⚠ REISE ZUM ZENTRUM (SEKTOR 0:0), UM DEN HUB ZU NUTZEN" and nothing else.
  - If `atOrigin`: render the notice board:
    - A post box: a `<textarea maxLength={280}>` + a "POSTEN" button → `network.postOriginNotice(text); setText('')`. Show remaining chars.
    - The list of `originNotices` (newest first): each row `◈ <player_name> · <relative or local time>` then the message. Use the existing terminal styling.
  - Keep it a single focused component; no new global state beyond gameSlice.

- [ ] **Step 5: GameScreen.tsx.** Add the import + renderScreen case:
```typescript
import { OriginHubScreen } from './OriginHubScreen';
// in renderScreen switch:
case MONITORS.ORIGIN_HUB:
  return <OriginHubScreen />;
```

- [ ] **Step 6: Verify (client convention — vite build + vitest, NOT tsc).**
`cd packages/client && npx vite build 2>&1 | tail -5` → must complete (no syntax/import errors).
`cd packages/client && npx vitest run 2>&1 | grep -E "Test Files|Tests "` → existing client tests still pass.

- [ ] **Step 7: Commit.**
```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts packages/client/src/state/helpSlice.ts packages/client/src/components/OriginHubScreen.tsx packages/client/src/components/GameScreen.tsx
git commit -m "feat: ORIGIN-HUB screen + notice board UI (gated to sector 0:0)"
```

---

## Task 4: Full sweep + deploy

- [ ] **Step 1:** `cd packages/shared && npx vitest run` and `cd packages/server && npx vitest run` → green (benign caught logs aside). `cd packages/client && npx vite build` → ok.
- [ ] **Step 2: Deploy (operational, human runs).** Migration 094 auto-runs on server boot; client has new screen.
```bash
cd /opt/voidsector && git pull
docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build server client
```
- [ ] **Step 3: Verify on prod.** At sector 0:0, open the HUB program → post a notice → it appears; reload → persists (`SELECT count(*) FROM origin_notices;`). Away from 0:0 → "Reise zum Zentrum" hint, posting rejected (NOT_AT_ORIGIN).

---

## Self-Review (plan author)
- **Spec coverage:** new ORIGIN-HUB program (T1+T3); notice board post-at-0:0 + read-latest-50 (T2 service/gate + T3 UI); physical-at-Origin gate (server `_px/_py` + client `position`); HelpSlice `first_originhub` + [?] (T3); tab-ready shell for future services (T3). ✓
- **Placeholders:** none; the "match ChatService exactly" notes (AuthPayload path, ctx.send vs client.send, checkRate signature, `_px/_py` exposure) are deliberate executor verifications against real signatures.
- **Consistency:** `originNotices` (gameSlice↔network), `postOriginNotice`/`getOriginNotices` (client↔SectorRoom handler names), `originNoticePosted`/`originNoticesResult` (server send↔client onMessage), `validateNoticeMessage`/`NOTICE_MAX_LEN` (service↔test), `MONITORS.ORIGIN_HUB` (constants↔GameScreen). All aligned.
- **Known verification points:** confirm `AuthPayload` import + `ctx.checkRate`/`ctx.send` API from ChatService; confirm `_px/_py` are accessible to pass from the SectorRoom handler; confirm `network` import style in client screens; confirm the renderScreen switch + MONITORS usage compiles after the shared rebuild.
