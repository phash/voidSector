# Friends System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players can send/accept friend requests, manage friends in a FRIENDS program, view PlayerCard modals from anywhere, and block players from DIRECT chat.

**Architecture:** New `FriendsService` (ServiceContext pattern) with DB tables (`player_friends`, `friend_requests`, `player_blocks`). Cross-room notifications via `friendsBus` (new EventEmitter, same pattern as `commsBus`). Online status tracked in Redis Set `online_players`. PlayerCard as standalone modal overlay. FRIENDS as new cockpit program.

**Tech Stack:** TypeScript, PostgreSQL, Redis (ioredis), Colyseus, React + Zustand, Vitest

**Spec:** `docs/superpowers/specs/2026-03-14-friends-system-design.md`

---

## Notes for implementer

- **ESM server imports**: use `.js` extension on all server imports
- **Client imports**: no extension (bundler)
- **Redis instance**: import pattern from `./services/RedisAPStore.js` or create local singleton
- **commsBus pattern**: see `packages/server/src/commsBus.ts` — new `friendsBus` follows identical pattern
- **MONITORS constant**: add `FRIENDS: 'FRIENDS'` to `MONITORS` object in `shared/constants.ts` (~line 1994), then add to `COCKPIT_PROGRAMS` array and `COCKPIT_PROGRAM_LABELS`
- **onJoin pattern**: see `SectorRoom.ts` ~line 1280 — `client.send('friendsList', data)` after other state sends
- **Overlay pattern**: see `LocalScanResultOverlay` for modal overlay positioning
- **Alert pattern**: `alerts` record in gameSlice, `setAlert(monitorId, active)` action
- **Player ID**: `(client.auth as AuthPayload).userId` — never `client.sessionId`
- **Shared build**: after changing shared types/constants, run `cd packages/shared && npm run build`

---

## Task 1: Shared types and constants

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/constants.ts`

- [ ] **Step 1: Add friend types to `types.ts`**

At the end of the file:

```typescript
export interface FriendEntry {
  id: string;
  name: string;
  level: number;
  online: boolean;
}

export interface FriendRequestEntry {
  id: string;
  fromId: string;
  fromName: string;
  createdAt: number;
}

export interface BlockEntry {
  id: string;
  name: string;
}

export interface PlayerCardData {
  id: string;
  name: string;
  level: number;
  online: boolean;
  position: { x: number; y: number } | null;
  isFriend: boolean;
  isBlocked: boolean;
  pendingDirection: 'sent' | 'received' | null;
}
```

- [ ] **Step 2: Add FRIENDS to MONITORS and programs in `constants.ts`**

In `MONITORS` (~line 1994) add `FRIENDS: 'FRIENDS'` before `} as const`.
In `COCKPIT_PROGRAMS` add `MONITORS.FRIENDS` after `MONITORS.ACEP`.
In `COCKPIT_PROGRAM_LABELS` add `FRIENDS: 'FRIENDS'`.

- [ ] **Step 3: Build shared**

```bash
cd packages/shared && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/constants.ts
git commit -m "feat: friends system shared types + FRIENDS program constant"
```

---

## Task 2: Migration 066

**Files:**
- Create: `packages/server/src/db/migrations/066_friends.sql`

- [ ] **Step 1: Create migration**

```sql
-- Migration 066: Friends system
CREATE TABLE IF NOT EXISTS player_friends (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, friend_id)
);
CREATE INDEX IF NOT EXISTS idx_player_friends_player ON player_friends(player_id);

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_player UUID REFERENCES players(id) ON DELETE CASCADE,
  to_player UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_player, to_player)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_player);

CREATE TABLE IF NOT EXISTS player_blocks (
  blocker_id UUID REFERENCES players(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
```

- [ ] **Step 2: Commit**

```bash
git add packages/server/src/db/migrations/066_friends.sql
git commit -m "feat: migration 066 — player_friends, friend_requests, player_blocks"
```

---

## Task 3: friendsBus + DB queries

**Files:**
- Create: `packages/server/src/friendsBus.ts`
- Create: `packages/server/src/db/friendQueries.ts`

- [ ] **Step 1: Create friendsBus** (follow `commsBus.ts` pattern)

```typescript
import { EventEmitter } from 'events';

export interface FriendBusEvent {
  type: 'friendRequest' | 'friendAccepted' | 'friendRemoved';
  targetPlayerId: string;
  payload: Record<string, unknown>;
}

class FriendsBus extends EventEmitter {
  notify(event: FriendBusEvent): void {
    this.emit('friendEvent', event);
  }
}

export const friendsBus = new FriendsBus();
```

- [ ] **Step 2: Create friendQueries**

Full CRUD for `player_friends`, `friend_requests`, `player_blocks`. Functions:

`getFriends(playerId)`, `getPendingRequests(playerId)`, `getBlocked(playerId)`,
`isBlocked(idA, idB)` (bidirectional), `isFriend(idA, idB)`,
`hasPendingRequest(fromId, toId)`, `insertRequest(fromId, toId)`,
`deleteRequest(requestId, toPlayerId)`, `getRequestById(requestId)`,
`deleteRequestsBetween(idA, idB)`, `insertFriendship(idA, idB)` (2 rows),
`deleteFriendship(idA, idB)` (both rows), `insertBlock(blockerId, blockedId)`,
`deleteBlock(blockerId, blockedId)`, `getPlayerCardRow(targetId)`.

All queries use `import { query } from './client.js'` pattern.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/friendsBus.ts packages/server/src/db/friendQueries.ts
git commit -m "feat: friendsBus + friend DB queries"
```

---

## Task 4: FriendsService

**Files:**
- Create: `packages/server/src/rooms/services/FriendsService.ts`
- Create: `packages/server/src/engine/__tests__/friendsService.test.ts`

- [ ] **Step 1: Write validation tests**

Test `validateSendRequest(fromId, toId, isFriend, hasPending, isBlocked)`:
- Self-add returns 'FRIEND_SELF'
- Already friends returns 'ALREADY_FRIENDS'
- Already requested returns 'ALREADY_REQUESTED'
- Blocked returns 'BLOCKED'
- Valid returns null

- [ ] **Step 2: Implement FriendsService**

Class with methods: `sendRequest`, `acceptRequest`, `declineRequest`, `removeFriend`,
`blockPlayer`, `unblockPlayer`, `getFriendsListWithOnline`, `getPendingRequestsList`,
`getBlockedList`, `getPlayerCard`.

Uses `ServiceContext` for rate limiting. Uses `friendsBus.notify()` for cross-room delivery.
Uses Redis `online_players` set for online status via pipeline bulk check.

Export `validateSendRequest` as pure function for testing.

- [ ] **Step 3: Run tests**

```bash
cd packages/server && npx vitest run src/engine/__tests__/friendsService.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/rooms/services/FriendsService.ts packages/server/src/engine/__tests__/friendsService.test.ts
git commit -m "feat: FriendsService — request, accept, decline, remove, block, playerCard"
```

---

## Task 5: Wire into SectorRoom + ChatService

**Files:**
- Modify: `packages/server/src/rooms/SectorRoom.ts`
- Modify: `packages/server/src/rooms/services/ChatService.ts`

- [ ] **Step 1: Import FriendsService + friendsBus, add field, instantiate**

- [ ] **Step 2: Add Redis online_players tracking** in onJoin (`sadd`) and onLeave (`srem`)

- [ ] **Step 3: Add friendsBus listener** in onCreate (same pattern as commsBus listener ~line 1154)

- [ ] **Step 4: Add onJoin payload** — send `friendsList`, `pendingRequests`, `blockedPlayers` after existing state sends

- [ ] **Step 5: Add 7 message handlers** — sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, blockPlayer, unblockPlayer, getPlayerCard

- [ ] **Step 6: Add isBlocked check in ChatService** — before direct message delivery, check `friendQueries.isBlocked(senderId, recipientId)`, return `'error'` if blocked

- [ ] **Step 7: Run server tests**

```bash
cd packages/server && npx vitest run
```

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/rooms/SectorRoom.ts packages/server/src/rooms/services/ChatService.ts
git commit -m "feat: wire FriendsService into SectorRoom + ChatService block check"
```

---

## Task 6: Client state + network handlers

**Files:**
- Modify: `packages/client/src/state/gameSlice.ts`
- Modify: `packages/client/src/network/client.ts`

- [ ] **Step 1: Add friends state** — `friends`, `friendRequests`, `blockedPlayers`, `playerCardTarget` + actions

- [ ] **Step 2: Add network message handlers** — `friendsList`, `pendingRequests`, `blockedPlayers`, `friendRequest`, `friendAccepted`, `friendRemoved`, `playerCard`

- [ ] **Step 3: Add send methods** in GameNetwork class — `sendFriendRequest`, `acceptFriendRequest`, etc.

- [ ] **Step 4: Typecheck**

```bash
cd packages/client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/state/gameSlice.ts packages/client/src/network/client.ts
git commit -m "feat: friends client state + network handlers"
```

---

## Task 7: PlayerCardModal

**Files:**
- Create: `packages/client/src/components/PlayerCardModal.tsx`
- Modify: `packages/client/src/components/CockpitLayout.tsx`

- [ ] **Step 1: Create PlayerCardModal** — compact layout, button states per `pendingDirection`/`isFriend`/`isBlocked`, confirm pattern for destructive actions

- [ ] **Step 2: Add to CockpitLayout** alongside `<LocalScanResultOverlay />`

- [ ] **Step 3: Run client tests**

```bash
cd packages/client && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/PlayerCardModal.tsx packages/client/src/components/CockpitLayout.tsx
git commit -m "feat: PlayerCardModal overlay + wire into CockpitLayout"
```

---

## Task 8: FriendsScreen program

**Files:**
- Create: `packages/client/src/components/FriendsScreen.tsx`
- Modify: `packages/client/src/components/CockpitLayout.tsx`

- [ ] **Step 1: Create FriendsScreen** — pending requests section, FREUNDE/KONTAKTE tabs, click-to-PlayerCard

- [ ] **Step 2: Wire into CockpitLayout** program switch: `case 'FRIENDS': return <FriendsScreen />`

- [ ] **Step 3: Run client tests**

```bash
cd packages/client && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/FriendsScreen.tsx packages/client/src/components/CockpitLayout.tsx
git commit -m "feat: FriendsScreen program + wire into CockpitLayout"
```

---

## Task 9: Click-to-PlayerCard from DetailPanel + CommsScreen

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx`
- Modify: `packages/client/src/components/CommsScreen.tsx`

- [ ] **Step 1: Make player names clickable in DetailPanel** — `onClick={() => network.getPlayerCard(player.id)}`

- [ ] **Step 2: Make chat sender names clickable in CommsScreen** — `onClick={() => network.getPlayerCard(msg.senderId)}`

- [ ] **Step 3: Run client tests**

```bash
cd packages/client && npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/components/DetailPanel.tsx packages/client/src/components/CommsScreen.tsx
git commit -m "feat: click-to-PlayerCard from DetailPanel + CommsScreen"
```

---

## Task 10: All tests + push + PR

- [ ] **Step 1: Build shared + run all tests**

```bash
cd packages/shared && npm run build && npx vitest run
cd packages/server && npx vitest run
cd packages/client && npx vitest run
```

- [ ] **Step 2: Push + create PR**

```bash
git push origin feat/friends-system
gh pr create --title "feat: friends system — requests, PlayerCard, FRIENDS program, chat blocks" --body-file <body>
```
