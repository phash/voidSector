# voidSector API Reference — Message Handlers

All communication between client and server uses Colyseus message passing.
The client sends a named message with an optional payload; the server processes
it and responds with one or more named messages.

**Total handlers:** 89 across 10 domain services.

---

## Table of Contents

1. [NavigationService](#navigationservice) (7 handlers)
2. [ScanService](#scanservice) (4 handlers)
3. [CombatService](#combatservice) (5 handlers)
4. [MiningService](#miningservice) (3 handlers)
5. [EconomyService](#economyservice) (14 handlers)
6. [FactionService](#factionservice) (5 handlers)
7. [QuestService](#questservice) (5 handlers)
8. [ChatService](#chatservice) (1 handler)
9. [ShipService](#shipservice) (14 handlers)
10. [WorldService](#worldservice) (31 handlers)

---

## NavigationService

Handles all movement: sector transitions, jumps, hyperjumps, autopilot, and emergency warp.

### moveSector
**Service:** NavigationService
**Payload:** `{ sectorX: number, sectorY: number }`
**Response:** `sectorData` message with full sector data object
**Auth:** Required
**Notes:** Intra-quadrant position change. Loads or generates sector, records discovery, tracks station visits. Auto-refuels at stations when FEATURE_HYPERDRIVE_V2 is enabled.

### jump
**Service:** NavigationService
**Payload:** `{ targetX: number, targetY: number }`
**Response:** `jumpResult` with `{ success: boolean, newSector?, apRemaining?, fuelRemaining?, gateInfo?, crossQuadrant?, error? }`
**Auth:** Required
**Notes:** Normal 1-tile jump. Costs 1 AP, no fuel. Blocks entry to black holes. Awards origin badges at (0,0). Detects jumpgates at target. Sets `crossQuadrant: true` if target is in different quadrant (client handles room switch).

### hyperJump
**Service:** NavigationService
**Payload:** `{ targetX: number, targetY: number }`
**Response:** `autopilotStart` then `autopilotUpdate` (per step) then `autopilotComplete`; also `apUpdate`, `fuelUpdate`, `hyperdriveUpdate`
**Auth:** Required
**Notes:** Long-range jump to discovered sectors. Two code paths: V1 (legacy fuel-based) and V2 (hyperdrive charge system). Blocks from/into nebula and black hole sectors. Starts autopilot timer with step-by-step movement.

### cancelAutopilot
**Service:** NavigationService
**Payload:** *(none)*
**Response:** `autopilotCancelled` with `{ success: true }`, then `autopilotComplete` with `{ x: -1, y: -1 }`
**Auth:** Required
**Notes:** Clears autopilot timer and cancels DB route.

### startAutopilot
**Service:** NavigationService
**Payload:** `{ targetX: number, targetY: number, useHyperjump?: boolean }`
**Response:** `autopilotStart` with `{ targetX, targetY, totalSteps, currentStep, costs, resumed }`; then periodic `autopilotUpdate` or `autopilotPaused`; finally `autopilotComplete`
**Auth:** Required (guests rejected)
**Notes:** Persistent autopilot with black hole avoidance pathfinding. Stores route in DB. Pauses on AP/fuel exhaustion. Can be resumed on reconnect.

### getAutopilotStatus
**Service:** NavigationService
**Payload:** *(none)*
**Response:** `autopilotStatus` with `{ active: boolean, targetX?, targetY?, currentStep?, totalSteps?, remaining?, eta?, useHyperjump? }`
**Auth:** Required

### emergencyWarp
**Service:** NavigationService
**Payload:** *(none)*
**Response:** `emergencyWarpResult` with `{ success: boolean, newSector?, fuelGranted?, creditCost?, credits?, error? }`
**Auth:** Required
**Notes:** Teleports player to home base when fuel is empty. Free within EMERGENCY_WARP_FREE_RADIUS, credits per sector beyond. Grants EMERGENCY_WARP_FUEL_GRANT fuel.

---

## ScanService

Handles local and area scanning, scan events, and scan event completion.

### localScan
**Service:** ScanService
**Payload:** *(none)*
**Response:** `localScanResult` with `{ resources: { ore, gas, crystal }, hiddenSignatures? }`; also `apUpdate`
**Auth:** Required
**Notes:** Scans current sector for resources. Costs AP_COSTS_LOCAL_SCAN AP. May trigger scan events (pirate ambush, distress signal, anomaly, artifact).

### areaScan
**Service:** ScanService
**Payload:** *(none)*
**Response:** `scanResult` with `{ sectors: SectorData[], apRemaining: number }`
**Auth:** Required
**Notes:** Area scan with radius based on scanner level + faction bonus. Blocked inside nebula sectors. Nebula sectors in range have contents hidden (fog). Batch-saves discoveries. Checks quest progress for scan objectives.

### scan
**Service:** ScanService (alias)
**Payload:** *(none)*
**Response:** Same as `areaScan`
**Auth:** Required
**Notes:** Legacy alias that delegates to `areaScan`.

### completeScanEvent
**Service:** ScanService
**Payload:** `{ eventId: string }`
**Response:** Various update messages: `creditsUpdate`, `cargoUpdate`, `blueprintFound`, `logEntry`
**Auth:** Required
**Notes:** Completes a discovered scan event. Awards credits, XP, reputation, artefacts, and/or blueprints based on event type. Handles distress_signal, anomaly_reading, artifact_find, and blueprint_find events.

---

## CombatService

Handles battle actions, combat v2 system, station defense, and repairs.

### battleAction
**Service:** CombatService
**Payload:** `{ action: 'fight' | 'flee' | 'negotiate', sectorX: number, sectorY: number }`
**Response:** `battleResult` with `{ success: boolean, encounter?, result?, error? }`; also `apUpdate`, `creditsUpdate`, `cargoUpdate`, `logEntry`
**Auth:** Required
**Notes:** Legacy combat (v1). Validates AP, applies outcomes (victory loot, defeat cargo loss, negotiation cost). Awards XP and pirate reputation changes. Logs battle to DB.

### combatV2Action
**Service:** CombatService
**Payload:** `{ tactic: 'assault' | 'balanced' | 'defensive', specialAction: 'aim' | 'evade' | 'none', sectorX: number, sectorY: number }`
**Response:** `combatV2Result` with `{ success: boolean, round?, state?, finalResult?, error? }`
**Auth:** Required
**Notes:** 5-round tactical combat. Resolves one round per action. On completion (victory/defeat), applies loot, reputation, and logs battle. Feature-flagged via FEATURE_COMBAT_V2.

### combatV2Flee
**Service:** CombatService
**Payload:** `{ sectorX: number, sectorY: number }`
**Response:** `combatV2Result` with `{ success: boolean, state?, finalResult?, error? }`; also `apUpdate`
**Auth:** Required
**Notes:** Attempt to flee from combat v2. Costs BATTLE_AP_COST_FLEE AP. Success depends on ship speed vs enemy.

### installDefense
**Service:** CombatService
**Payload:** `{ defenseType: string }`
**Response:** `installDefenseResult` with `{ success: boolean, defenseType?, id?, error? }`; also `cargoUpdate`, `creditsUpdate`
**Auth:** Required (guests rejected)
**Notes:** Installs station defense (turret, shield, ion cannon) at player's base. Validates base exists, checks credits and resource costs.

### repairStation
**Service:** CombatService
**Payload:** `{ sectorX: number, sectorY: number }`
**Response:** `repairResult` with `{ success: boolean, newHp?, maxHp?, error? }`; also `cargoUpdate`, `creditsUpdate`
**Auth:** Required (guests rejected)
**Notes:** Repairs damaged base structure to full HP. Costs credits (STATION_REPAIR_CR_PER_HP) and ore (STATION_REPAIR_ORE_PER_HP) per HP restored.

---

## MiningService

Handles resource extraction and cargo management.

### mine
**Service:** MiningService
**Payload:** `{ resource: 'ore' | 'gas' | 'crystal' }`
**Response:** `miningUpdate` with mining state (active, resource, rate, startedAt, etc.)
**Auth:** Required
**Notes:** Starts mining a resource in current sector. Validates sector has resources, cargo space available. Applies faction mining rate bonus. Rate-limited to 500ms.

### stopMine
**Service:** MiningService
**Payload:** *(none)*
**Response:** `miningUpdate` with stopped state; also `cargoUpdate`
**Auth:** Required
**Notes:** Stops active mining, calculates mined amount based on elapsed time, adds to cargo.

### jettison
**Service:** MiningService
**Payload:** `{ resource: string }`
**Response:** `cargoUpdate`; also `logEntry`
**Auth:** Required (guests rejected)
**Notes:** Jettisons all of a specific resource from cargo. Irreversible.

---

## EconomyService

Handles trading, storage, refueling, factory production, and kontor buy orders.

### npcTrade
**Service:** EconomyService
**Payload:** `{ resource: string, amount: number, action: 'buy' | 'sell' }`
**Response:** `npcTradeResult` with `{ success: boolean, credits?, storage?, error? }`; also `creditsUpdate`, `cargoUpdate` or `storageUpdate`, `npcStationUpdate`
**Auth:** Required
**Notes:** NPC trade at stations (dynamic pricing via station engine) or home base (storage-based). Applies faction trade price bonus on buys. Updates station inventory and rep.

### upgradeStructure
**Service:** EconomyService
**Payload:** `{ structureId: string }`
**Response:** `upgradeResult` with `{ success: boolean, newTier?, creditsRemaining?, error? }`; also `creditsUpdate`, `baseData`
**Auth:** Required
**Notes:** Upgrades storage or trading post to next tier. Deducts credits based on tier cost.

### placeOrder
**Service:** EconomyService
**Payload:** `{ resource: string, amount: number, pricePerUnit: number, type: 'buy' | 'sell' }`
**Response:** `orderPlaced` with `{ success: boolean, orderId? }`
**Auth:** Required (guests rejected)
**Notes:** Places a player market order. Requires Trading Post Tier 2+. Sell orders deduct from storage; buy orders deduct credits upfront.

### transfer
**Service:** EconomyService
**Payload:** `{ resource: string, amount: number, direction: 'toStorage' | 'fromStorage' }`
**Response:** `transferResult` with `{ success: boolean, cargo?, storage?, error? }`; also `cargoUpdate`, `storageUpdate`
**Auth:** Required
**Notes:** Transfers resources between ship cargo and home base storage. Must be at home base.

### refuel
**Service:** EconomyService
**Payload:** `{ amount: number }`
**Response:** `refuelResult` with `{ success: boolean, fuel?: { current, max }, credits?, error? }`
**Auth:** Required
**Notes:** Refuels at station or own base. Free at base with <= FREE_REFUEL_MAX_SHIPS ships. Applies reputation-based price modifier at stations (best of faction-rep vs station-rep).

### getNpcStation
**Service:** EconomyService
**Payload:** *(none)*
**Response:** `npcStationUpdate` with `{ level, name, xp, nextLevelXp, inventory: [{ itemType, stock, maxStock, buyPrice, sellPrice }] }`
**Auth:** Required
**Notes:** Returns current NPC station info with dynamic pricing based on stock levels.

### factoryStatus
**Service:** EconomyService
**Payload:** *(none)*
**Response:** `factoryUpdate` with factory state or `{ error }`
**Auth:** Required

### factorySetRecipe
**Service:** EconomyService
**Payload:** `{ recipeId: string }`
**Response:** `factoryUpdate` with updated factory state or `{ error }`
**Auth:** Required (guests rejected)
**Notes:** Sets active production recipe. Validates against player's blueprints.

### factoryCollect
**Service:** EconomyService
**Payload:** *(none)*
**Response:** `factoryUpdate`, `storageUpdate`
**Auth:** Required (guests rejected)
**Notes:** Collects factory output. Deducts consumed input resources from storage.

### factoryTransfer
**Service:** EconomyService
**Payload:** `{ itemType: string, amount: number }`
**Response:** `factoryUpdate`, `cargoUpdate`
**Auth:** Required (guests rejected)
**Notes:** Transfers factory output to ship cargo.

### kontorPlaceOrder
**Service:** EconomyService
**Payload:** `{ itemType: string, amount: number, pricePerUnit: number }`
**Response:** `kontorUpdate` with `{ orders, placed? }` or `{ error }`
**Auth:** Required (guests rejected)

### kontorCancelOrder
**Service:** EconomyService
**Payload:** `{ orderId: string }`
**Response:** `kontorUpdate` with `{ orders, refunded? }` or `{ error }`
**Auth:** Required (guests rejected)

### kontorSellTo
**Service:** EconomyService
**Payload:** `{ orderId: string, amount: number }`
**Response:** `kontorUpdate` with `{ orders, earned? }`; also `cargoUpdate`
**Auth:** Required (guests rejected)

### kontorGetOrders
**Service:** EconomyService
**Payload:** *(none)*
**Response:** `kontorUpdate` with `{ orders }`
**Auth:** Required

---

## FactionService

Handles player factions: creation, membership, management, and upgrades.

### createFaction
**Service:** FactionService
**Payload:** `{ name: string, tag: string, joinMode: 'open' | 'code' | 'invite' }`
**Response:** `createFactionResult` with `{ success: boolean, error? }`; also `factionData` on success
**Auth:** Required (guests rejected)
**Notes:** Name 3-64 chars, tag 3-5 chars (auto-uppercased). Fails if player already in a faction or name/tag taken.

### getFaction
**Service:** FactionService
**Payload:** *(none)*
**Response:** `factionData` with `{ faction: { id, name, tag, leaderId, leaderName, joinMode, inviteCode, memberCount, createdAt } | null, members: [{ playerId, playerName, rank, joinedAt }], invites }`
**Auth:** Required

### factionAction
**Service:** FactionService
**Payload:** `{ action: 'join' | 'joinCode' | 'leave' | 'kick' | 'promote' | 'demote' | 'disband' | 'setJoinMode' | 'invite', targetPlayerId?: string, targetPlayerName?: string, code?: string, joinMode?: string }`
**Response:** `factionActionResult` with `{ success: boolean, action: string, error? }`; also `factionData` on success
**Auth:** Required (guests rejected)
**Notes:** Multi-action handler. `join` requires open faction. `joinCode` requires valid invite code. Rank-based permission checks for kick/promote/demote/disband/setJoinMode/invite.

### respondInvite
**Service:** FactionService
**Payload:** `{ inviteId: string, accept: boolean }`
**Response:** `factionActionResult` with `{ success: boolean, action: 'respondInvite', error? }`; also `factionData`
**Auth:** Required

### factionUpgrade
**Service:** FactionService
**Payload:** `{ tier: number, choice: FactionUpgradeChoice }`
**Response:** `factionUpgradeResult` with `{ success: boolean, upgrades?, error? }`
**Auth:** Required
**Notes:** Faction leader only. 3 tiers with A/B choices. Each tier requires previous tier to be chosen. Costs credits from leader's account.

---

## QuestService

Handles NPC quests, reputation, and XP progression.

### getStationNpcs
**Service:** QuestService
**Payload:** `{ sectorX: number, sectorY: number }`
**Response:** `stationNpcsResult` with `{ npcs, quests }`
**Auth:** Required
**Notes:** Generates station NPCs and daily-rotating quests based on player's faction reputation tier.

### acceptQuest
**Service:** QuestService
**Payload:** `{ templateId: string, stationX: number, stationY: number }`
**Response:** `acceptQuestResult` with `{ success: boolean, quest?, error? }`; also `logEntry`
**Auth:** Required
**Notes:** Accepts a quest from available daily rotation. Max active quest limit enforced. Quest has expiry (QUEST_EXPIRY_DAYS).

### abandonQuest
**Service:** QuestService
**Payload:** `{ questId: string }`
**Response:** `abandonQuestResult` with `{ success: boolean, error? }`; also `activeQuests`
**Auth:** Required

### getActiveQuests
**Service:** QuestService
**Payload:** *(none)*
**Response:** `activeQuests` with `{ quests: Quest[] }`
**Auth:** Required

### getReputation
**Service:** QuestService
**Payload:** *(none)*
**Response:** `reputationUpdate` with `{ reputations: PlayerReputation[], upgrades: PlayerUpgrade[] }`
**Auth:** Required
**Notes:** Returns reputation for all 4 NPC factions (traders, scientists, pirates, ancients) with tier classification and active upgrades.

---

## ChatService

Handles all chat message routing across channels.

### chat
**Service:** ChatService
**Payload:** `{ channel: 'direct' | 'faction' | 'sector' | 'quadrant', content: string, recipientId?: string }`
**Response:** `chatMessage` broadcast to relevant recipients
**Auth:** Required (faction channel blocked for guests)
**Notes:** Content sanitized (HTML stripped, max 500 chars). Routing:
- `direct` — Sent to sender + recipient (cross-room via commsBus)
- `faction` — Broadcast to all faction members across rooms
- `sector` — Broadcast to all players in same sector (cross-room via commsBus)
- `quadrant` — Broadcast to all players in same quadrant room

---

## ShipService

Handles ship management, modules, research, and blueprints.

### getShips
**Service:** ShipService
**Payload:** *(none)*
**Response:** `shipList` with `{ ships: [{ id, hullType, name, modules, stats }] }`
**Auth:** Required

### switchShip
**Service:** ShipService
**Payload:** `{ shipId: string }`
**Response:** `shipData` with full ship info including stats
**Auth:** Required
**Notes:** Must be at home base. Updates server-side ship cache.

### installModule
**Service:** ShipService
**Payload:** `{ moduleId: string, slotIndex: number }`
**Response:** `moduleInstalled` with `{ modules, stats }`
**Auth:** Required
**Notes:** Removes module from inventory, installs on ship. Validates hull compatibility and slot availability.

### removeModule
**Service:** ShipService
**Payload:** `{ slotIndex: number }`
**Response:** `moduleRemoved` with `{ modules, stats, returnedModule }`
**Auth:** Required
**Notes:** Returns module to inventory.

### buyModule
**Service:** ShipService
**Payload:** `{ moduleId: string }`
**Response:** `buyModuleResult` with `{ success: boolean, moduleId }`; also `creditsUpdate`, `moduleInventory`
**Auth:** Required
**Notes:** Must be at station or home base. Module must be unlocked via research or blueprint. Deducts credits and cargo resources.

### buyHull
**Service:** ShipService
**Payload:** `{ hullType: string, name?: string, shipColor?: string }`
**Response:** `shipData` with new ship info; also `creditsUpdate`
**Auth:** Required (guests rejected)
**Notes:** Must be at station or home base. At NPC stations, requires station level >= STATION_SHIPYARD_LEVEL_THRESHOLD. Checks player level requirement. New ship becomes active.

### renameShip
**Service:** ShipService
**Payload:** `{ shipId: string, name: string }`
**Response:** `shipRenamed` with `{ shipId, name }`
**Auth:** Required
**Notes:** Name truncated to 20 characters.

### renameBase
**Service:** ShipService
**Payload:** `{ name: string }`
**Response:** `baseRenamed` with `{ name }`
**Auth:** Required
**Notes:** Name truncated to 20 characters.

### getModuleInventory
**Service:** ShipService
**Payload:** *(none)*
**Response:** `moduleInventory` with `{ modules }`
**Auth:** Required

### getResearchState
**Service:** ShipService
**Payload:** *(none)*
**Response:** `researchState` with `{ unlockedModules, blueprints, activeResearch }`
**Auth:** Required

### startResearch
**Service:** ShipService
**Payload:** `{ moduleId: string }`
**Response:** `researchResult` with `{ success: boolean, activeResearch?, error? }`
**Auth:** Required
**Notes:** Must be at home base. Checks prerequisites (other modules, faction tiers, blueprints). Deducts credits and cargo resources. Duration based on module definition.

### cancelResearch
**Service:** ShipService
**Payload:** *(none)*
**Response:** `researchResult` with `{ success: boolean, activeResearch: null, error? }`
**Auth:** Required
**Notes:** Cancels active research. Resources are NOT refunded.

### claimResearch
**Service:** ShipService
**Payload:** *(none)*
**Response:** `researchResult` with `{ success: boolean, claimed?, unlockedModules?, activeResearch: null, error? }`; also `logEntry`
**Auth:** Required
**Notes:** Claims completed research. Fails if research timer has not expired.

### activateBlueprint
**Service:** ShipService
**Payload:** `{ moduleId: string }`
**Response:** `researchResult` with `{ success: boolean, activated?, unlockedModules?, blueprints?, error? }`; also `logEntry`
**Auth:** Required
**Notes:** Moves a blueprint from blueprints array to unlocked modules. No cost.

---

## WorldService

Handles world data queries, building, data slates, jump gates, rescue, trade routes, bookmarks, and quadrant management.

### getAP
**Service:** WorldService
**Payload:** *(none)*
**Response:** `apUpdate` with AP state `{ current, max, regenRate, lastTick }`
**Auth:** Required

### getDiscoveries
**Service:** WorldService
**Payload:** *(none)*
**Response:** `discoveries` with array of `{ x, y }` coordinates
**Auth:** Required

### getCargo
**Service:** WorldService
**Payload:** *(none)*
**Response:** `cargoUpdate` with `{ ore, gas, crystal, slates, artefact }`
**Auth:** Required

### getMiningStatus
**Service:** WorldService
**Payload:** *(none)*
**Response:** `miningUpdate` with mining state
**Auth:** Required

### getBase
**Service:** WorldService
**Payload:** *(none)*
**Response:** `baseData` with `{ structures }`
**Auth:** Required

### getCredits
**Service:** WorldService
**Payload:** *(none)*
**Response:** `creditsUpdate` with `{ credits }`
**Auth:** Required

### getStorage
**Service:** WorldService
**Payload:** *(none)*
**Response:** `storageUpdate` with storage inventory
**Auth:** Required

### getTradeOrders
**Service:** WorldService
**Payload:** *(none)*
**Response:** `tradeOrders` with `{ orders }`
**Auth:** Required

### getMyOrders
**Service:** WorldService
**Payload:** *(none)*
**Response:** `myOrders` with `{ orders }`
**Auth:** Required

### cancelOrder
**Service:** WorldService
**Payload:** `{ orderId: string }`
**Response:** `cancelOrderResult` with `{ success: boolean }`
**Auth:** Required

### getMySlates
**Service:** WorldService
**Payload:** *(none)*
**Response:** `mySlates` with `{ slates: [{ id, creatorId, creatorName, ownerId, slateType, sectorData, status, createdAt }] }`
**Auth:** Required

### build
**Service:** WorldService
**Payload:** `{ type: string }` (one of: comm_relay, mining_station, base, storage, trading_post, defense_turret, station_shield, ion_cannon, factory, research_lab, kontor)
**Response:** `buildResult` with `{ success: boolean, structure?, error? }`; also `apUpdate`, `cargoUpdate`, broadcast `structureBuilt`
**Auth:** Required (guests rejected)
**Notes:** Validates AP and cargo resources. Creates structure in current sector. Prevents duplicates (unique constraint).

### createSlate
**Service:** WorldService
**Payload:** `{ slateType: 'sector' | 'area' }`
**Response:** `createSlateResult` with `{ success: boolean, slate?, cargo?, ap?, error? }`; also `apUpdate`
**Auth:** Required (guests rejected)
**Notes:** Creates a data slate recording current sector or area scan data. Costs AP. Added to cargo.

### activateSlate
**Service:** WorldService
**Payload:** `{ slateId: string }`
**Response:** `activateSlateResult` with `{ success: boolean, sectorsAdded?, error? }`; also `cargoUpdate`
**Auth:** Required
**Notes:** Activates a data slate, adding its sector data to player discoveries. Consumes the slate.

### npcBuybackSlate
**Service:** WorldService
**Payload:** `{ slateId: string }`
**Response:** `npcBuybackResult` with `{ success: boolean, credits?, creditsEarned?, error? }`; also `cargoUpdate`
**Auth:** Required
**Notes:** Sells a data slate back to NPC for credits. Payout based on sector count.

### listSlate
**Service:** WorldService
**Payload:** `{ slateId: string, price: number }`
**Response:** `orderPlaced` with `{ success: boolean }`; also `cargoUpdate`
**Auth:** Required
**Notes:** Lists a data slate on the player market. Requires Trading Post Tier 2+.

### acceptSlateOrder
**Service:** WorldService
**Payload:** `{ orderId: string }`
**Response:** `slateOrderAccepted` with `{ success: boolean }`; also `creditsUpdate`, `cargoUpdate`
**Auth:** Required
**Notes:** Buys a listed data slate from another player. Transfers credits and slate ownership.

### useJumpGate
**Service:** WorldService
**Payload:** `{ gateId: string, accessCode?: string }`
**Response:** `useJumpGateResult` with `{ success: boolean, targetX?, targetY?, fuel?, requiresMinigame?, error? }`
**Auth:** Required
**Notes:** Uses a jump gate for long-range travel. Costs JUMPGATE_FUEL_COST fuel. Code-locked gates require access code (stored permanently once entered). Minigame-required gates return `requiresMinigame: true` for client-side handling.

### frequencyMatch
**Service:** WorldService
**Payload:** `{ gateId: string, matched: boolean }`
**Response:** `useJumpGateResult` with `{ success: boolean, targetX?, targetY?, fuel?, error? }`
**Auth:** Required
**Notes:** Completes jump gate minigame. If `matched: true`, proceeds with gate usage. If false, gate use fails.

### rescue
**Service:** WorldService
**Payload:** `{ sectorX: number, sectorY: number }`
**Response:** `rescueResult` with `{ success: boolean, survivorsRescued?, safeSlotsFree?, error? }`; also `apUpdate`
**Auth:** Required
**Notes:** Rescues survivors at current sector. Costs RESCUE_AP_COST AP. Limited by ship safe slots.

### deliverSurvivors
**Service:** WorldService
**Payload:** *(none)* (data parameter exists but is unused)
**Response:** `deliverSurvivorsResult` with `{ success: boolean, credits?, rep?, xp?, error? }`
**Auth:** Required
**Notes:** Delivers rescued survivors to a station. Awards credits, reputation, and XP based on rescue source type.

### configureRoute
**Service:** WorldService
**Payload:** `{ targetX: number, targetY: number, sellResource: string, sellAmount: number, buyResource: string, buyAmount: number, cycleMinutes: number }`
**Response:** `configureRouteResult` with `{ success: boolean, route?, error? }`
**Auth:** Required
**Notes:** Creates an automated trade route. Requires trading post. Validates cycle time and route count limits.

### toggleRoute
**Service:** WorldService
**Payload:** `{ routeId: string, active: boolean }`
**Response:** `toggleRouteResult` with `{ success: boolean }`
**Auth:** Required

### deleteRoute
**Service:** WorldService
**Payload:** `{ routeId: string }`
**Response:** `deleteRouteResult` with `{ success: boolean, error? }`
**Auth:** Required

### getBookmarks
**Service:** WorldService
**Payload:** *(none)*
**Response:** `bookmarksUpdate` with `{ bookmarks }`
**Auth:** Required

### setBookmark
**Service:** WorldService
**Payload:** `{ slot: number (1-5), sectorX: number, sectorY: number, label: string }`
**Response:** `bookmarksUpdate` with `{ bookmarks }`
**Auth:** Required

### clearBookmark
**Service:** WorldService
**Payload:** `{ slot: number }`
**Response:** `bookmarksUpdate` with `{ bookmarks }`
**Auth:** Required

### nameQuadrant
**Service:** WorldService
**Payload:** `{ qx: number, qy: number, name: string }`
**Response:** `nameQuadrantResult` with `{ success: boolean, error? }`; broadcast `announcement` on success
**Auth:** Required (guests rejected)
**Notes:** Names a quadrant during first-contact window. Name is trimmed. Broadcasts announcement to all players.

### getKnownQuadrants
**Service:** WorldService
**Payload:** *(none)*
**Response:** `knownQuadrants` with `{ quadrants }`
**Auth:** Required (guests rejected)

### getKnownJumpGates
**Service:** WorldService
**Payload:** *(none)*
**Response:** `knownJumpGates` with `{ gates }`
**Auth:** Required (guests rejected)

### syncQuadrants
**Service:** WorldService
**Payload:** *(none)*
**Response:** `syncQuadrantsResult` with `{ success: boolean, quadrants?, synced?, error? }`
**Auth:** Required (guests rejected)
**Notes:** Must be at a station. Syncs all publicly discovered quadrant data to player's known list.

---

## Common Response Messages

These messages are sent by multiple services as side effects:

| Message | Payload | Sent By |
|---------|---------|---------|
| `error` | `{ code: string, message: string }` | All services (validation failures) |
| `apUpdate` | `{ current, max, regenRate, lastTick }` | Navigation, Scan, Combat, World |
| `creditsUpdate` | `{ credits: number }` | Navigation, Combat, Economy, Quest, Ship, World |
| `cargoUpdate` | `{ ore, gas, crystal, slates, artefact }` | Scan, Combat, Mining, Economy, Quest, Ship, World |
| `fuelUpdate` | `{ current: number, max: number }` | Navigation |
| `hyperdriveUpdate` | `{ charge, maxCharge, regenPerSecond, lastTick }` | Navigation |
| `storageUpdate` | Storage inventory object | Economy, World |
| `logEntry` | `string` | Multiple services (player-facing log messages) |
| `announcement` | `{ message: string, type: string }` | Navigation (badges), World (structures, quadrants) |

---

## Rate Limits

Most handlers enforce per-client rate limiting via `checkRate(sessionId, action, intervalMs)`:

| Action | Interval |
|--------|----------|
| moveSector | 200ms |
| jump | 300ms |
| hyperJump | 1000ms |
| localScan, areaScan | 1000ms |
| mine | 500ms |
| npcTrade | 250ms |
| transfer, kontorSellTo | 500ms |
| build, installDefense | 2000ms |
| chat | 500ms |
| startAutopilot, kontorPlaceOrder, kontorCancelOrder, factorySetRecipe, factoryCollect, nameQuadrant | 1000ms |
| factoryStatus, factoryTransfer, getKnownQuadrants, getKnownJumpGates, kontorGetOrders | 500ms |
| syncQuadrants | 2000ms |
