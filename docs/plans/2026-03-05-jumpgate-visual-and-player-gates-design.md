# JumpGate Visual Indicators & Player-Built JumpGates Design

## Overview

Two features in one design:

1. **#138 — Radar/grid visual indicators** for sectors containing jumpgates
2. **#139 — Player-built jumpgates** with leveling, linking via data slates, credit tolls, and chain routing

## #138: Radar Visual Indicators

Gate sectors get a `◎` overlay icon drawn on top of the sector symbol in both NAV-COM radar and QUAD-MAP. Uses the chain color from `jumpGateOverlay.ts` so gates in the same network share color. Drawn at all zoom levels where sector symbols are visible.

No new state needed — uses existing `knownJumpGates` array.

## #139: Player-Built JumpGates

### Data Model

Extend existing `jumpgates` table (world gates get `owner_id = NULL`):

```sql
ALTER TABLE jumpgates ADD COLUMN owner_id UUID REFERENCES players(id) DEFAULT NULL;
ALTER TABLE jumpgates ADD COLUMN level_connection INT DEFAULT 1;
ALTER TABLE jumpgates ADD COLUMN level_distance INT DEFAULT 1;
ALTER TABLE jumpgates ADD COLUMN toll_credits INT DEFAULT 0;
ALTER TABLE jumpgates ADD COLUMN built_at TIMESTAMPTZ DEFAULT NULL;
```

New link table (replaces single target_x/target_y for player gates):

```sql
CREATE TABLE jumpgate_links (
  gate_id TEXT REFERENCES jumpgates(id),
  linked_gate_id TEXT REFERENCES jumpgates(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (gate_id, linked_gate_id)
);
```

### Leveling

**Distance limits per level (single side):**

| Level | Range |
|-------|-------|
| 1 | 250 sectors |
| 2 | 500 sectors |
| 3 | 2,500 sectors |

Total link distance = sum of both gates' max range (e.g., L2+L1 = 750).

**Connection limits per level:** L1 = 1 link, L2 = 2 links, L3 = 3 links.

### Costs

**Build:** 500 Credits + 20 Crystal + 5 Artefacts

**Level-up:**

| Upgrade | Cost |
|---------|------|
| Connection L2 | 300 CR + 15 Ore + 3 Artefacts |
| Connection L3 | 800 CR + 30 Ore + 8 Artefacts |
| Distance L2 | 300 CR + 15 Crystal + 3 Artefacts |
| Distance L3 | 800 CR + 30 Crystal + 8 Artefacts |

**Dismantle:** Owner only. Returns 50% of total invested resources (rounded down). Removes all links.

### Data Slates & Linking

- Only the gate owner can create gate data slates (`type: 'jumpgate'`, metadata: `{ gateId, sectorX, sectorY, ownerName }`)
- Gate slates are tradeable via existing trade mechanics
- To link: player visits their own gate with a foreign gate slate in cargo, clicks "[VERKNUPFEN]"
- Server validates distance (combined range), connection slots, no duplicate links
- Inserts bidirectional rows into `jumpgate_links`, consumes the slate
- Unlinking: owner removes a link, the consumed slate is returned to the unlinking player

### Travel & Chain Routing

- BFS through `jumpgate_links` to find all reachable destinations (max 10 hops)
- Each hop costs the toll set by that hop's origin gate owner
- Total cost = sum of all hop tolls
- Credits deducted from traveler, added to each gate owner per hop
- No fuel or AP cost beyond entering the sector
- Cross-quadrant jumps handled same as existing gate travel
- World gates and player gates are separate networks (no cross-routing)

### UI

**Owner view at gate sector:**

```
◎ JUMPGATE [L1/L1]
BESITZER: PlayerName
VERBINDUNGEN: 1/1
DISTANZ-REICHWEITE: 250

VERKNUPFTE GATES:
  -> (200, 80) [Toll: 10 CR] [TRENNEN]

MAUT: 10 CR  [ANDERN]

[GATE-SLATE ERSTELLEN]
[VERBINDUNG UPGRADEN]  300 CR + 15 Ore + 3 Art
[DISTANZ UPGRADEN]      300 CR + 15 Crys + 3 Art
[ABBAUEN]
```

**Other player view:**

```
◎ JUMPGATE [L1/L1]
BESITZER: PlayerName
MAUT: 10 CR

ZIELE:
  (200, 80) -- 10 CR  [SPRINGEN]
  (350, 120) -- 25 CR [SPRINGEN]  (via 2 hops)

GATE-SLATE IM CARGO:
  Gate bei (100, 50) von Player A
  [VERKNUPFEN] -- Distanz: 112 ✓
```

### Edge Cases

- Building blocked on sectors with existing gates (world or player)
- Dismantled gate invalidates foreign slates (error on link attempt)
- Gate owner offline: gate still works, tolls accumulate
- Chain depth capped at 10 hops

### Not In Scope

- Gate names/labels
- Gate permissions/faction restrictions
- Visual customization
- Maintenance/decay
