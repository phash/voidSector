# NPC Bot-Agents Design

## Summary

Separate Node process (`packages/bots`) that connects to the game server as Colyseus clients. Bots are real player accounts (persistent in DB) that behave like human players: they explore, mine, trade, chat, and show up on other players' radar.

## Architecture

```
+---------------+     Colyseus WS      +----------------+
|  Bot-Runner   | -------------------- |  Game Server   |
|  (separate)   |  same path as real   |  SectorRoom    |
|               |  clients             |                |
|  BotManager   |                      |  PlayerSchema  |
|  +-- Bot 1    |                      |  +-- BOT-Kira  |
|  +-- Bot 2    |                      |  +-- BOT-Vex   |
|  +-- Bot N    |                      |  +-- ...       |
+---------------+                      +----------------+
```

- Separate process: if bots crash, game continues
- Same code path as real players: every bot-triggered bug is a real bug
- No special server-side code needed

## Behavior System

Each bot has a **Goal** determining its current actions. Goals switch on completion or timeout.

| Goal      | Behavior                                              |
|-----------|-------------------------------------------------------|
| `explore` | Move in random directions, scan sectors                |
| `mine`    | Fly to asteroid sector, start mining, wait, stop       |
| `trade`   | Fly to station, sell cargo, buy resources               |
| `patrol`  | Fly route between known sectors                        |
| `idle`    | Stay put, occasionally send chat messages               |

Goal selection: weighted random based on bot personality profile.

Each tick (3-8 seconds, varied per bot to avoid synchronization) the bot executes one action: move, scan, mine, trade, or chat.

## Bot Profiles

Bots are created from templates:

| Profile  | Goal weights                                         |
|----------|------------------------------------------------------|
| TRADER   | trade 40%, mine 30%, idle 20%, explore 10%           |
| SCOUT    | explore 40%, patrol 30%, idle 20%, mine 10%          |
| MINER    | mine 50%, trade 30%, idle 15%, explore 5%            |

Each bot has: name (from npcgen pool), hull type, start position, personality seed.

## Spawning

- Per quadrant with active real players: 2-3 bots
- BotManager polls active quadrants every 60s
- Spawns/despawns bots when players enter/leave quadrants
- Max ~20 bots globally (configurable)

## Chat

Context-aware messages on sector/quadrant channel:

- Mining: "Gutes Erzvorkommen hier"
- Trade: "Suche Crystal, biete Erz"
- Pirate encounter: "Warnung: Piraten bei (x,y)!"
- Idle: Flavor text ("Jemand Richtung Station unterwegs?")

Frequency: every 30-120 seconds per bot, with cooldown.

## Radar Visibility

Already supported by existing infrastructure:
- `PlayerSchema` syncs x, y, username, connected via Colyseus state
- `RadarRenderer` draws other players as yellow ship icons (zoom >= 2) with username (zoom >= 3)
- `PILOTS: N` counter includes bot players
- No client changes needed

## Persistence

- Bot accounts: real user rows with username prefix `BOT-`
- Credits, cargo, position persist across restarts
- Bots register via normal auth on first start

## Trade Integration

Bots use the same trade system as players:
- Buy/sell at NPC stations (affects station inventory/economy)
- Can post on player market (buy orders at Kontor)
- Economy stays dynamic even with few human players

## Not In Scope

- No PvP between bots and players
- No bot factions (use existing NPC factions)
- No admin UI for bot management (config file sufficient)
- No bot-specific quests
