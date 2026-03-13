# Friends System — Design Spec

**Datum:** 2026-03-14
**Status:** APPROVED
**Issue:** #362

---

## Übersicht

Spieler können anderen Spielern Freundschaftsanfragen senden, diese annehmen/ablehnen, und ihre Freunde in einem neuen FRIENDS-Programm verwalten. Ein PlayerCard-Modal zeigt Spieler-Infos und Aktionen (Freund hinzufügen, Nachricht, Blockieren) und ist von überall erreichbar (Radar, Chat, FRIENDS-Programm). Blockierte Spieler können keine DIRECT-Nachrichten mehr senden.

**Einschränkung:** Gast-Spieler (`isGuest`) können keine Freundschafts-Features nutzen (kein Senden/Empfangen von Requests, kein Blocken). Die PlayerCard zeigt für Gäste nur `[MESSAGE]`.

---

## 1. Datenmodell

**Migration 066** — 3 neue Tabellen:

```sql
-- Bestätigte Freundschaften (bidirektional, 2 Rows pro Paar)
CREATE TABLE IF NOT EXISTS player_friends (
  player_id   UUID REFERENCES players(id) ON DELETE CASCADE,
  friend_id   UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, friend_id)
);
CREATE INDEX IF NOT EXISTS idx_player_friends_player ON player_friends(player_id);

-- Offene Anfragen
CREATE TABLE IF NOT EXISTS friend_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_player   UUID REFERENCES players(id) ON DELETE CASCADE,
  to_player     UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_player, to_player)
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_player);

-- Chat-Block
CREATE TABLE IF NOT EXISTS player_blocks (
  blocker_id  UUID REFERENCES players(id) ON DELETE CASCADE,
  blocked_id  UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
```

**Bidirektionale Freundschaft:** Wenn A+B Freunde werden, 2 Rows `(A,B)` + `(B,A)`. Einfachere Queries (`WHERE player_id = $1`).

**Keine Begrenzung** der Freundesanzahl.

---

## 2. Cross-Room Delivery und Online-Status

### Online-Status via Redis

Redis Set `online_players` trackt alle connected Player-IDs:

```typescript
// Bei Room onJoin:
await redis.sadd('online_players', playerId);

// Bei Room onLeave (wenn nicht reconnecting):
await redis.srem('online_players', playerId);

// Online-Check für Freundesliste:
const isOnline = await redis.sismember('online_players', friendId);

// Bulk-Check (alle Freunde auf einmal):
const pipeline = redis.pipeline();
friendIds.forEach(id => pipeline.sismember('online_players', id));
const results = await pipeline.exec();
```

### Cross-Room Friend Notifications via commsBus

Friend-Events (friendRequest, friendAccepted, friendRemoved) werden über den bestehenden `commsBus` an alle Rooms verteilt. Jeder Room prüft ob der Ziel-Spieler connected ist und leitet weiter:

```typescript
// In FriendsService — nach DB-Operation:
commsBus.emit('friendEvent', {
  type: 'friendRequest',  // oder 'friendAccepted', 'friendRemoved'
  targetPlayerId: toId,
  payload: { id, fromId, fromName, createdAt },
});

// In SectorRoom — commsBus Listener:
commsBus.on('friendEvent', (event) => {
  const client = this.clients.find(c => (c.auth as AuthPayload).userId === event.targetPlayerId);
  if (client) client.send(event.type, event.payload);
});
```

---

## 3. FriendsService

Neuer Service: `packages/server/src/rooms/services/FriendsService.ts`

Folgt bestehendem ServiceContext-Pattern (wie ChatService).

### Methoden

```typescript
sendRequest(fromId: string, toId: string): Promise<void>
  // Validierung: nicht sich selbst, nicht Gast, nicht bereits Freund,
  //   nicht bereits angefragt, nicht blockiert (bidirektional)
  // INSERT INTO friend_requests
  // Push 'friendRequest' an Empfänger via commsBus
  // Rate-Limit: 1 Request pro 2s

acceptRequest(playerId: string, requestId: string): Promise<void>
  // DELETE FROM friend_requests WHERE id = requestId AND to_player = playerId
  // INSERT INTO player_friends (2 Rows, bidirektional)
  // Push 'friendAccepted' an beide Spieler via commsBus

declineRequest(playerId: string, requestId: string): Promise<void>
  // DELETE FROM friend_requests WHERE id = requestId AND to_player = playerId

removeFriend(playerId: string, friendId: string): Promise<void>
  // DELETE FROM player_friends WHERE (player_id, friend_id) IN ((A,B),(B,A))
  // Push 'friendRemoved' an beide Spieler via commsBus

blockPlayer(blockerId: string, blockedId: string): Promise<void>
  // INSERT INTO player_blocks
  // Falls Freundschaft existiert: removeFriend (+ Notification)
  // Falls offene Requests in BEIDE Richtungen: löschen
  // Empfänger erhält 'friendRemoved' (ohne Info dass geblockt wurde — Privacy)

unblockPlayer(blockerId: string, blockedId: string): Promise<void>
  // DELETE FROM player_blocks

getFriendsList(playerId: string, redis: Redis): Promise<FriendEntry[]>
  // DB: SELECT f.friend_id, p.username, p.level FROM player_friends f
  //   JOIN players p ON p.id = f.friend_id WHERE f.player_id = $1
  // Redis: Bulk-Check online_players für Online-Status

getPendingRequests(playerId: string): Promise<FriendRequestEntry[]>
  // SELECT fr.id, fr.from_player, p.username, fr.created_at
  //   FROM friend_requests fr JOIN players p ON p.id = fr.from_player
  //   WHERE fr.to_player = $1

getBlockedPlayers(playerId: string): Promise<BlockEntry[]>
  // SELECT b.blocked_id, p.username FROM player_blocks b
  //   JOIN players p ON p.id = b.blocked_id WHERE b.blocker_id = $1

isBlocked(senderId: string, recipientId: string): Promise<boolean>
  // Bidirektional: check ob EINER den ANDEREN blockiert hat
  // SELECT 1 FROM player_blocks WHERE
  //   (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)

getPlayerCardData(requesterId: string, targetId: string, redis: Redis): Promise<PlayerCardData>
  // JOIN players für Name/Level
  // Redis: online_players für Online-Status
  // + isFriend, isBlocked, pendingDirection Status
  // Position: nur wenn target online und im selben Room, sonst null
  // Rate-Limit: 1 Request pro 500ms
```

---

## 4. SectorRoom Messages

### Client -> Server

| Message | Payload | Aktion |
|---------|---------|--------|
| `sendFriendRequest` | `{ targetPlayerId: string }` | FriendsService.sendRequest |
| `acceptFriendRequest` | `{ requestId: string }` | FriendsService.acceptRequest |
| `declineFriendRequest` | `{ requestId: string }` | FriendsService.declineRequest |
| `removeFriend` | `{ friendId: string }` | FriendsService.removeFriend |
| `blockPlayer` | `{ targetPlayerId: string }` | FriendsService.blockPlayer |
| `unblockPlayer` | `{ targetPlayerId: string }` | FriendsService.unblockPlayer |
| `getPlayerCard` | `{ playerId: string }` | FriendsService.getPlayerCardData |

### Server -> Client

| Message | Payload | Wann |
|---------|---------|------|
| `friendRequest` | `{ id, fromId, fromName, createdAt }` | Neue Anfrage erhalten |
| `friendAccepted` | `{ friendId, friendName }` | Anfrage wurde akzeptiert |
| `friendRemoved` | `{ friendId }` | Freundschaft entfernt (oder geblockt — gleiche Nachricht) |
| `friendsList` | `FriendEntry[]` | Bei onJoin |
| `pendingRequests` | `FriendRequestEntry[]` | Bei onJoin |
| `blockedPlayers` | `BlockEntry[]` | Bei onJoin |
| `playerCard` | `PlayerCardData` | Antwort auf getPlayerCard |

### onJoin-Payload

Server schickt bei Room-Join (neben bestehendem inventoryState, questState etc.):

```typescript
friendsList: [{ id, name, level, online }]   // online via Redis
pendingRequests: [{ id, fromId, fromName, createdAt }]
blockedPlayers: [{ id, name }]
```

---

## 5. Chat-Integration

### Block-Check in ChatService

In `ChatService.handleChat()`, vor dem Senden einer DIRECT-Nachricht:

```typescript
if (channel === 'direct') {
  const blocked = await friendsService.isBlocked(senderId, recipientId);
  if (blocked) {
    send(client, 'error', { code: 'CHAT_BLOCKED', message: 'Nachricht konnte nicht zugestellt werden.' });
    return;
  }
}
```

Absender erfährt nur "konnte nicht zugestellt werden" — nicht ob er blockiert wurde. Check ist bidirektional. Verwendet `'error'`-Message (konsistent mit ChatService-Pattern).

### Spieler-Suche im Chat

Im DIRECT-Kanal (CommsScreen): Eingabefeld für exakten Spielernamen. Bestehendes `getPlayerIdByUsername` in queries.ts wird verwendet.

- Spieler gefunden: DIRECT-Chat öffnet, Spieler zu `recentContacts` hinzugefügt
- Nicht gefunden: InlineError `Spieler nicht gefunden.`

### Klick auf Absender-Name im Chat

Klick auf Sender-Name in einer Chat-Nachricht sendet `getPlayerCard` Message und öffnet PlayerCard Modal.

---

## 6. Client State (Zustand)

Neue Felder im `gameSlice`:

```typescript
// State
friends: Array<{ id: string; name: string; level: number; online: boolean }>
friendRequests: Array<{ id: string; fromId: string; fromName: string; createdAt: number }>
blockedPlayers: Array<{ id: string; name: string }>
playerCardTarget: PlayerCardData | null   // null = Modal geschlossen

// Actions
setFriends: (friends) => void
setFriendRequests: (requests) => void
setBlockedPlayers: (blocked) => void
setPlayerCardTarget: (data | null) => void
addFriend: (friend) => void
removeFriendFromList: (friendId) => void
addFriendRequest: (request) => void
removeFriendRequest: (requestId) => void
```

### Shared Types

```typescript
interface FriendEntry {
  id: string;
  name: string;
  level: number;
  online: boolean;
}

interface FriendRequestEntry {
  id: string;
  fromId: string;
  fromName: string;
  createdAt: number;
}

interface BlockEntry {
  id: string;
  name: string;
}

interface PlayerCardData {
  id: string;
  name: string;
  level: number;
  online: boolean;
  position: { x: number; y: number } | null;  // null wenn offline oder anderer Room
  isFriend: boolean;
  isBlocked: boolean;
  pendingDirection: 'sent' | 'received' | null;  // null = kein offener Request
}
```

---

## 7. PlayerCard Modal

Eigenständiges Overlay-Komponent: `packages/client/src/components/PlayerCardModal.tsx`

Folgt dem Pattern von `LocalScanResultOverlay` — zentrales Modal über dem Cockpit.

### Layout (Kompakt)

```
+-- PLAYER CARD --------------------- [X] --+
| +------+  Captain_Kirk                     |
| | ICON |  LEVEL 12                         |
| +------+  POSITION: (142, 87)             |
|                                            |
| [FREUND +] [MESSAGE]  [BLOCK]             |
| [POSITION -> NAV-COM]                     |
+--------------------------------------------+
```

ICON-Platzhalter für spätere Implementierung.

### Button-Zustände

| Beziehung | Freund-Button | Block-Button |
|-----------|--------------|-------------|
| Kein Freund | `[FREUND +]` grün | `[BLOCK]` rot |
| Anfrage gesendet (`pendingDirection: 'sent'`) | `[ANFRAGE OK]` grau/disabled | `[BLOCK]` rot |
| Anfrage erhalten (`pendingDirection: 'received'`) | `[ANNEHMEN]` grün | `[BLOCK]` rot |
| Bereits Freund | `[FREUND X]` rot | `[BLOCK]` rot |
| Blockiert | Buttons hidden | `[ENTBLOCKEN]` gelb |

### Aktionen

- `[FREUND +]` sendet `sendFriendRequest`, Button wechselt zu `[ANFRAGE OK]`
- `[ANNEHMEN]` sendet `acceptFriendRequest`, Button wechselt zu `[FREUND X]`
- `[FREUND X]` Confirm-Pattern (roter Rand), dann `removeFriend`
- `[MESSAGE]` setzt `directChatRecipient`, wechselt zu DIRECT-Chat, schließt Modal
- `[BLOCK]` Confirm-Pattern (roter Rand nach erstem Klick), dann `blockPlayer`
- `[ENTBLOCKEN]` sendet `unblockPlayer`
- `[POSITION -> NAV-COM]` wählt Sektor im Detail-Panel, schließt Modal. Nur sichtbar wenn `position !== null`.
- `[X]` schließt Modal (`setPlayerCardTarget(null)`)

### Öffnen von überall

- **Radar/DetailPanel**: Klick auf Spielername sendet `getPlayerCard`, öffnet Modal
- **Chat**: Klick auf Absender-Name sendet `getPlayerCard`, öffnet Modal
- **FRIENDS-Programm**: Klick auf Listeneintrag sendet `getPlayerCard`, öffnet Modal

Freundschafts-Anfragen werden nur via PlayerCard gesendet (nicht per Name-Suche). Spieler müssen den Ziel-Spieler zuerst über Radar, Chat oder FRIENDS-Programm finden.

---

## 8. FRIENDS-Programm (Sec 2)

Neues Cockpit-Programm in `COCKPIT_PROGRAMS`: `'FRIENDS'`

Komponente: `packages/client/src/components/FriendsScreen.tsx`

Kein Sec 3 Detail-Panel — die PlayerCard Modal übernimmt diese Rolle.

### Layout

```
+-- FRIENDS ------------------------------------+
|                                               |
|  ! 2 OFFENE ANFRAGEN                         |
|  +---------------------------------------+    |
|  | SpacePilot42        [OK] [X]          |    |
|  | DarkNova99          [OK] [X]          |    |
|  +---------------------------------------+    |
|                                               |
|  [FREUNDE]  [KONTAKTE]                        |
|  ----------------------------------------     |
|  Captain_Kirk    LVL 12  * ONLINE            |
|  MoonWalker      LVL  8  o OFFLINE           |
|  StarDust77      LVL 15  * ONLINE            |
|                                               |
+-----------------------------------------------+
```

### Anfragen-Bereich (oben)

- Nur sichtbar wenn `pendingRequests.length > 0`
- Pro Eintrag: Name + `[OK]` Accept + `[X]` Decline
- `[OK]` sendet `acceptFriendRequest`, verschwindet, erscheint unter FREUNDE
- `[X]` sendet `declineFriendRequest`, verschwindet

### Tab FREUNDE

- Alle bestätigten Freunde aus `friends` State
- Sortierung: Online zuerst, dann alphabetisch
- Pro Eintrag: Name, Level, Online-Status (grün/grau)
- Klick auf Eintrag sendet `getPlayerCard`, öffnet PlayerCard Modal

### Tab KONTAKTE

- Bestehende `recentContacts` aus gameSlice (nur Name, kein Level/Online)
- Pro Eintrag: Name
- Klick sendet `getPlayerCard`, öffnet PlayerCard Modal (dort sind dann alle Infos sichtbar)

### ProgramSelector Alert

- `hasAlert['FRIENDS']` = `true` wenn `pendingRequests.length > 0`
- Button blinkt im ProgramSelector (bestehendes Pattern)

---

## 9. Dateien

| Datei | Typ | Beschreibung |
|-------|-----|-------------|
| `server/db/migrations/066_friends.sql` | Neu | 3 Tabellen |
| `server/db/friendQueries.ts` | Neu | DB Queries |
| `server/rooms/services/FriendsService.ts` | Neu | Service-Klasse |
| `server/rooms/SectorRoom.ts` | Modify | 7 Message-Handler, onJoin-Payload, commsBus-Listener, Redis online_players |
| `server/rooms/services/ChatService.ts` | Modify | isBlocked Check vor DIRECT-Delivery |
| `shared/types.ts` | Modify | FriendEntry, FriendRequestEntry, BlockEntry, PlayerCardData |
| `shared/constants.ts` | Modify | FRIENDS in COCKPIT_PROGRAMS + COCKPIT_PROGRAM_LABELS |
| `client/components/PlayerCardModal.tsx` | Neu | Modal-Overlay |
| `client/components/FriendsScreen.tsx` | Neu | FRIENDS-Programm |
| `client/components/CommsScreen.tsx` | Modify | Klick auf Absender, PlayerCard |
| `client/components/DetailPanel.tsx` | Modify | Klick auf Spieler, PlayerCard |
| `client/components/CockpitLayout.tsx` | Modify | PlayerCardModal rendern, FRIENDS in Programm-Switch |
| `client/state/gameSlice.ts` | Modify | Friends State + Actions |
| `client/network/client.ts` | Modify | Message-Handler für friends* Events |

---

## 10. Offene Punkte / Future Work

- **ICON**: PlayerCard Icon-Platzhalter — wird in separatem Issue implementiert
- **Live Online-Status Updates**: Aktuell nur bei onJoin geladen. Live-Push (Freund kommt online/geht offline) als Erweiterung via Redis Pub/Sub.
- **Freundschafts-Limit**: Aktuell unbegrenzt. Kann später per Konstante begrenzt werden.
