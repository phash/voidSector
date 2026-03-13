# Friends System — Design Spec

**Datum:** 2026-03-14
**Status:** APPROVED
**Issue:** #362

---

## Übersicht

Spieler können anderen Spielern Freundschaftsanfragen senden, diese annehmen/ablehnen, und ihre Freunde in einem neuen FRIENDS-Programm verwalten. Ein PlayerCard-Modal zeigt Spieler-Infos und Aktionen (Freund hinzufügen, Nachricht, Blockieren) und ist von überall erreichbar (Radar, Chat, FRIENDS-Programm). Blockierte Spieler können keine DIRECT-Nachrichten mehr senden.

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

**Bidirektionale Freundschaft:** Wenn A+B Freunde werden → 2 Rows `(A,B)` + `(B,A)`. Einfachere Queries (`WHERE player_id = $1`).

**Keine Begrenzung** der Freundesanzahl.

---

## 2. FriendsService

Neuer Service: `packages/server/src/rooms/services/FriendsService.ts`

Folgt bestehendem ServiceContext-Pattern (wie ChatService).

### Methoden

```typescript
sendRequest(fromId: string, toId: string): Promise<void>
  // INSERT INTO friend_requests
  // Push 'friendRequest' an Empfänger (wenn online, via sendToPlayer)
  // Validierung: nicht sich selbst, nicht bereits Freund, nicht bereits angefragt, nicht blockiert

acceptRequest(playerId: string, requestId: string): Promise<void>
  // DELETE FROM friend_requests WHERE id = requestId AND to_player = playerId
  // INSERT INTO player_friends (2 Rows, bidirektional)
  // Push 'friendAccepted' an beide Spieler

declineRequest(playerId: string, requestId: string): Promise<void>
  // DELETE FROM friend_requests WHERE id = requestId AND to_player = playerId

removeFriend(playerId: string, friendId: string): Promise<void>
  // DELETE FROM player_friends WHERE (player_id, friend_id) IN ((A,B),(B,A))
  // Push 'friendRemoved' an beide Spieler

blockPlayer(blockerId: string, blockedId: string): Promise<void>
  // INSERT INTO player_blocks
  // Falls Freundschaft existiert → removeFriend
  // Falls offene Requests → löschen

unblockPlayer(blockerId: string, blockedId: string): Promise<void>
  // DELETE FROM player_blocks

getFriendsList(playerId: string): Promise<FriendEntry[]>
  // SELECT f.friend_id, p.username, p.level FROM player_friends f
  //   JOIN players p ON p.id = f.friend_id WHERE f.player_id = $1

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

getPlayerCardData(requesterId: string, targetId: string): Promise<PlayerCardData>
  // JOIN players für Name/Level, Position aus Room-State
  // + isFriend, isBlocked, hasPendingRequest Status
```

---

## 3. SectorRoom Messages

### Client → Server

| Message | Payload | Aktion |
|---------|---------|--------|
| `sendFriendRequest` | `{ targetPlayerId: string }` | FriendsService.sendRequest |
| `acceptFriendRequest` | `{ requestId: string }` | FriendsService.acceptRequest |
| `declineFriendRequest` | `{ requestId: string }` | FriendsService.declineRequest |
| `removeFriend` | `{ friendId: string }` | FriendsService.removeFriend |
| `blockPlayer` | `{ targetPlayerId: string }` | FriendsService.blockPlayer |
| `unblockPlayer` | `{ targetPlayerId: string }` | FriendsService.unblockPlayer |
| `getPlayerCard` | `{ playerId: string }` | FriendsService.getPlayerCardData |

### Server → Client

| Message | Payload | Wann |
|---------|---------|------|
| `friendRequest` | `{ id, fromId, fromName, createdAt }` | Neue Anfrage erhalten |
| `friendAccepted` | `{ friendId, friendName }` | Anfrage wurde akzeptiert |
| `friendRemoved` | `{ friendId }` | Freundschaft entfernt |
| `friendsList` | `FriendEntry[]` | Bei onJoin |
| `pendingRequests` | `FriendRequestEntry[]` | Bei onJoin |
| `blockedPlayers` | `BlockEntry[]` | Bei onJoin |
| `playerCard` | `PlayerCardData` | Antwort auf getPlayerCard |

### onJoin-Payload

Server schickt bei Room-Join (neben bestehendem inventoryState, questState etc.):

```typescript
friendsList: [{ id, name, level, online }]
pendingRequests: [{ id, fromId, fromName, createdAt }]
blockedPlayers: [{ id, name }]
```

Online-Status: Server prüft ob `friendId` als Client in einem aktiven Room connected ist.

---

## 4. Chat-Integration

### Block-Check in ChatService

In `ChatService.handleChat()`, vor dem Senden einer DIRECT-Nachricht:

```typescript
if (channel === 'direct') {
  const blocked = await friendsService.isBlocked(senderId, recipientId);
  if (blocked) {
    send(client, 'actionError', { code: 'CHAT_BLOCKED', message: 'Nachricht konnte nicht zugestellt werden.' });
    return;
  }
}
```

Absender erfährt nur "konnte nicht zugestellt werden" — nicht ob er blockiert wurde. Check ist bidirektional (A blockt B → weder A→B noch B→A möglich).

### Spieler-Suche im Chat

Im DIRECT-Kanal (CommsScreen): Eingabefeld für exakten Spielernamen. Bestehendes `getPlayerIdByUsername` in queries.ts wird verwendet.

- Spieler gefunden → DIRECT-Chat öffnet, Spieler zu `recentContacts` hinzugefügt
- Nicht gefunden → InlineError `Spieler nicht gefunden.`

### Klick auf Absender-Name im Chat

Klick auf Sender-Name in einer Chat-Nachricht → `getPlayerCard` Message → PlayerCard Modal öffnet.

---

## 5. Client State (Zustand)

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
  position: { x: number; y: number } | null;  // null wenn offline/unbekannt
  isFriend: boolean;
  isBlocked: boolean;
  hasPendingRequest: boolean;
}
```

---

## 6. PlayerCard Modal

Eigenständiges Overlay-Komponent: `packages/client/src/components/PlayerCardModal.tsx`

Folgt dem Pattern von `LocalScanResultOverlay` — zentrales Modal über dem Cockpit.

### Layout (Kompakt)

```
┌─ PLAYER CARD ──────────────── [X] ─┐
│ ┌──────┐  Captain_Kirk              │
│ │ ICON │  LEVEL 12 · EXPLORER       │
│ └──────┘  POSITION: (142, 87)       │
│                                      │
│ [FREUND +] [MESSAGE]  [BLOCK]       │
│ [POSITION → NAV-COM]               │
└──────────────────────────────────────┘
```

ICON-Platzhalter für spätere Implementierung (Issue-Vermerk).

### Button-Zustände

| Beziehung | Freund-Button | Block-Button |
|-----------|--------------|-------------|
| Kein Freund | `[FREUND +]` grün | `[BLOCK]` rot |
| Anfrage gesendet | `[ANFRAGE ✓]` grau/disabled | `[BLOCK]` rot |
| Bereits Freund | `[FREUND ✗]` rot | `[BLOCK]` rot |
| Blockiert | `[FREUND +]` hidden | `[ENTBLOCKEN]` gelb |

### Aktionen

- `[FREUND +]` → sendet `sendFriendRequest`, Button wechselt zu `[ANFRAGE ✓]`
- `[FREUND ✗]` → Confirm-Pattern (roter Rand), dann `removeFriend`
- `[MESSAGE]` → setzt `directChatRecipient`, wechselt zu DIRECT-Chat, schließt Modal
- `[BLOCK]` → Confirm-Pattern (roter Rand nach erstem Klick), dann `blockPlayer`
- `[ENTBLOCKEN]` → sendet `unblockPlayer`
- `[POSITION → NAV-COM]` → wählt Sektor im Detail-Panel, schließt Modal
- `[X]` → schließt Modal (`setPlayerCardTarget(null)`)

### Öffnen von überall

- **Radar/DetailPanel**: Klick auf Spielername → `getPlayerCard` → Modal
- **Chat**: Klick auf Absender-Name → `getPlayerCard` → Modal
- **FRIENDS-Programm**: Klick auf Listeneintrag → `getPlayerCard` → Modal

---

## 7. FRIENDS-Programm (Sec 2)

Neues Cockpit-Programm in `COCKPIT_PROGRAMS`: `'FRIENDS'`

Komponente: `packages/client/src/components/FriendsScreen.tsx`

### Layout

```
┌─ FRIENDS ─────────────────────────────┐
│                                        │
│  ⚠ 2 OFFENE ANFRAGEN                  │
│  ┌────────────────────────────────┐    │
│  │ SpacePilot42        [✓] [✗]   │    │
│  │ DarkNova99          [✓] [✗]   │    │
│  └────────────────────────────────┘    │
│                                        │
│  [FREUNDE]  [KONTAKTE]                 │
│  ─────────────────────────────────     │
│  Captain_Kirk    LVL 12  ● ONLINE     │
│  MoonWalker      LVL  8  ○ OFFLINE    │
│  StarDust77      LVL 15  ● ONLINE     │
│                                        │
└────────────────────────────────────────┘
```

### Anfragen-Bereich (oben)

- Nur sichtbar wenn `pendingRequests.length > 0`
- Pro Eintrag: Name + `[✓]` Accept + `[✗]` Decline
- `[✓]` → `acceptFriendRequest` → verschwindet, erscheint unter FREUNDE
- `[✗]` → `declineFriendRequest` → verschwindet

### Tab FREUNDE

- Alle bestätigten Freunde aus `friends` State
- Sortierung: Online zuerst, dann alphabetisch
- Pro Eintrag: Name, Level, Online-Status (● grün / ○ grau)
- Klick auf Eintrag → `getPlayerCard` → PlayerCard Modal

### Tab KONTAKTE

- Bestehende `recentContacts` aus gameSlice
- Gleiche Darstellung wie FREUNDE-Tab
- Klick → PlayerCard Modal

### ProgramSelector Alert

- `hasAlert['FRIENDS']` = `true` wenn `pendingRequests.length > 0`
- Button blinkt im ProgramSelector (bestehendes Pattern)

---

## 8. Dateien

| Datei | Typ | Beschreibung |
|-------|-----|-------------|
| `server/db/migrations/066_friends.sql` | Neu | 3 Tabellen |
| `server/db/friendQueries.ts` | Neu | DB Queries |
| `server/rooms/services/FriendsService.ts` | Neu | Service-Klasse |
| `server/rooms/SectorRoom.ts` | Modify | 7 Message-Handler + onJoin-Payload |
| `server/rooms/services/ChatService.ts` | Modify | isBlocked Check |
| `shared/types.ts` | Modify | FriendEntry, FriendRequestEntry, BlockEntry, PlayerCardData |
| `shared/constants.ts` | Modify | FRIENDS in COCKPIT_PROGRAMS |
| `client/components/PlayerCardModal.tsx` | Neu | Modal-Overlay |
| `client/components/FriendsScreen.tsx` | Neu | FRIENDS-Programm |
| `client/components/CommsScreen.tsx` | Modify | Klick auf Absender → PlayerCard |
| `client/components/DetailPanel.tsx` | Modify | Klick auf Spieler → PlayerCard |
| `client/components/CockpitLayout.tsx` | Modify | PlayerCardModal rendern |
| `client/state/gameSlice.ts` | Modify | Friends State + Actions |
| `client/network/client.ts` | Modify | Message-Handler für friends* Events |

---

## 9. Offene Punkte / Future Work

- **ICON**: PlayerCard Icon-Platzhalter — wird in separatem Issue implementiert
- **Online-Status Updates**: Aktuell nur bei onJoin geladen. Live-Updates (Freund kommt online/geht offline) als Erweiterung.
- **Freundschafts-Limit**: Aktuell unbegrenzt. Kann später per Konstante begrenzt werden.
