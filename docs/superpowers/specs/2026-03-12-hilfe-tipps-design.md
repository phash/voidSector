# Spec: Hilfe-Tipps — First-Action Popups (#258)

**Date:** 2026-03-12
**Issue:** #258
**Status:** Approved

---

## Overview

Expand the existing help tip system with 24 new first-action tips triggered by in-game events. Tips fire once per pilot (localStorage), cover all 12 programs on first open, and go deeper for 6 core systems. Tone: Douglas Adams (cosmic/existential) for passive discovery moments, Terry Pratchett (dry/practical) for active doing moments.

---

## Architecture

### Existing Infrastructure (no changes)

- `HelpTip` interface, `HELP_TIPS` array, `showTip(id)`, `dismissTip()`, `seenTips` (localStorage `vs_seen_tips`)
- `HelpOverlay` component — renders active tip as amber panel, dismiss on click/ESC, optional Kompendium link
- `onboardingStep` — separate 4-step spotlight onboarding, unaffected

### New: `trigger` field + `triggerTip(event)`

**`HelpTip` gets an optional `trigger` field:**

```ts
export interface HelpTip {
  id: string;
  title: string;
  body: string;
  articleId?: string;
  trigger?: string;  // NEW: event name for triggerTip()
}
```

**`HelpSlice` gets `triggerTip(event: string)`:**

```ts
triggerTip: (event: string) => {
  if (get().onboardingStep !== null) return; // don't interrupt onboarding
  const tip = HELP_TIPS.find(t => t.trigger === event && !get().seenTips.has(t.id));
  if (tip) get().showTip(tip.id);
}
```

Added to `HelpSlice` interface. Called from components and network handlers at the appropriate moment. The onboarding guard is in `triggerTip`, not in `showTip`, so direct `showTip()` calls remain unaffected.

---

## Tip Inventory

### Program Tips (12) — first open, brief orientation

Trigger pattern: `program_open_<id>` — fired in `ProgramSelector` when a program button is clicked for the first time.

| Tip ID | Trigger | Title | Body | Tone |
|--------|---------|-------|------|------|
| `prog_navcom` | `program_open_navcom` | NAVIGATIONSKONSOLE | *You are here. The universe is very large. These two facts are not as reassuring as they should be. Use the D-Pad to move. The arrow shows which way is interesting.* | Adams |
| `prog_radar` | `program_open_radar` | RADARSYSTEM | *A dot on a grid. Your dot. Every other dot wants something from your dot. Or is simply in the way. Click a cell to select it. Double-click to center.* | Adams |
| `prog_scan` | `program_open_scan` | SCANNER | *Point at something. Press SCAN. Discover that it is either valuable, dangerous, or both. Scanning costs AP. Not scanning costs more.* | Pratchett |
| `prog_mining` | `program_open_mining` | MINING-SYSTEM | *Rocks. In space. You will hit them with a machine until they become money. Navigate to an asteroid sector, then press MINE. This is civilization.* | Pratchett |
| `prog_cargo` | `program_open_cargo` | FRACHTLAGER | *Everything you own fits in this hold. The hold has a capacity. When the capacity is reached, the mining stops. Sell things to make room for more things.* | Pratchett |
| `prog_tech` | `program_open_tech` | TECHNOLOGIEBAUM | *The research tree contains many nodes. Some are genuinely useful. Wissen (W) is the research currency — produced by labs. Hover nodes to read what they do before spending.* | Adams |
| `prog_trade` | `program_open_trade` | HANDELSMODUL | *Buy low, sell high, avoid pirates between the two steps. The spread between buy and sell price reflects a station's opinion of your desperation. The rest is commentary.* | Pratchett |
| `prog_quests` | `program_open_quests` | AUFTRAGS-SYSTEM | *Someone wants something done. They're offering credits. Read the objectives carefully. Note the expiry date. Assume there's a catch. There is always a catch.* | Pratchett |
| `prog_faction` | `program_open_faction` | FRAKTIONEN | *Large organizations with strong opinions about you. You didn't ask for their opinions. They'll express them through prices, patrol behavior, and occasional hostility anyway.* | Adams |
| `prog_hangar` | `program_open_hangar` | HANGAR | *Your ship. It can be improved. Improving it costs credits. Making credits requires the ship. The loop is not a bug — it is the entire point. Check the MODULE tab for upgrades.* | Pratchett |
| `prog_quadmap` | `program_open_quadmap` | QUADRANTEN-KARTE | *You are in a quadrant. The quadrant is in a galaxy. Somewhere out there, factions are expanding. Some of them are not human. The map shows who controls what.* | Adams |
| `prog_tv` | `program_open_tv` | GALAKTISCHER NACHRICHTENDIENST | *This is the galactic news feed. Much of it is propaganda. Some of it is useful. Faction conflicts, conquest events, and war ticker items appear here. Good luck telling which is which.* | Adams |

---

### Deep System Tips (12) — specific action moments

| Tip ID | Trigger | Fired When | Title | Body | Tone |
|--------|---------|-----------|-------|------|------|
| `mining_started_first` | `mining_started` | First MINE button pressed | BOHRKOPF AKTIV | *The drill is running. It stops when the rock runs out, your hold fills, or you tell it to. The rock does not care which. Mine-All chains resources automatically.* | Pratchett |
| `mining_depleted_first` | `mining_depleted` | First sector depleted | SEKTOR ERSCHÖPFT | *The sector is empty. Resources regenerate over time — the rate depends on how long you leave it alone. Space has more rocks than you can mine in a lifetime. Move on.* | Adams |
| `cargo_full_first` | `cargo_full` | Cargo hits 100% | FRACHT VOLL | *Hold is full. You can sell at any station, or jettison cargo if you're in a hurry. Jettisoned cargo returns to the void, which accepts donations without comment.* | Pratchett |
| `combat_started_first` | `combat_started` | First combat encounter | KAMPFKONTAKT | *Someone has chosen violence. You may respond in kind, attempt to flee, or — if you're feeling optimistic — negotiate. The optimistic option is statistically underrated but occasionally correct.* | Adams |
| `combat_won_first` | `combat_won` | First combat victory | GEFECHT GEWONNEN | *You won. Your opponent is no longer a problem. Their wreckage might be worth scanning. Combat experience accrues to your ACEP pilot profile.* | Pratchett |
| `quest_accepted_first` | `quest_accepted` | First quest accepted | AUFTRAG ANGENOMMEN | *You have accepted a contract. Read the objectives. Note the expiry date. Some quests place items in your cargo. The universe does not offer deadline extensions.* | Pratchett |
| `quest_completed_first` | `quest_completed` | First quest completed | AUFTRAG ERFÜLLT | *Delivered. Paid. The galaxy nods in its usual indifferent way and immediately generates another contract. Your reputation with the issuing faction has improved. Marginally.* | Adams |
| `acep_first_xp` | `acep_xp_gained` | First ACEP XP earned | ERFAHRUNG GESAMMELT | *Experience points. You have earned some. They accumulate in four paths: Kampf, Ausbau, Handel, Erkundung. Open the ACEP program to see your pilot profile and available traits.* | Adams |
| `scan_complete_first` | `scan_complete` | First full sector scan | SCAN ABGESCHLOSSEN | *Scan complete. The sector has been documented, categorized, and added to a database nobody will read. Resources, POIs, and anomalies are now visible. You may proceed.* | Adams |
| `trade_first_sale` | `trade_sold` | First item sold at a station | TRANSAKTION | *Credits received. Note the spread between buy and sell prices. That spread is the station's fee for existing. Higher-tier stations generally offer better margins. Shop around.* | Pratchett |
| `ap_low_first` | `ap_low` | AP drops below 20% for first time | ACTION POINTS | *AP powers all movement and actions. It regenerates automatically over time. The regen rate can be improved via ACEP traits and ship modules. Consider parking until it recovers.* | Pratchett |
| `faction_rep_first` | `faction_rep_change` | First faction reputation change | REPUTATIONSÄNDERUNG | *Your reputation with a faction has shifted. Reputation determines what they'll sell you, whether they'll shoot at you, and what prices they quote. It can be improved. Slowly.* | Pratchett |

---

## Trigger Placements

### `ProgramSelector.tsx`
- On program button click: `triggerTip('program_open_<programId>')`
- Guard: only call when `!hasSeenTip('prog_<id>')` (or let `triggerTip` handle it — it checks internally)

### `MiningScreen.tsx` / `MiningService` network handler
- On `miningUpdate` with `active: true` for first time: `triggerTip('mining_started')`
- On `logEntry` message containing `'SEKTOR ERSCHÖPFT'`: `triggerTip('mining_depleted')` — this couples to an internal server string that we control; acceptable given the no-server-changes constraint

### `client.ts` cargo update handler
- In the `cargoUpdate` message handler in `GameNetwork`, after updating store state: compute `totalCargo >= ship.cargoCap` and call `triggerTip('cargo_full')`. The `apUpdate` handler pattern in the same file is the model.

### `CombatService` network handler (client)
- On `combatStart` message: `triggerTip('combat_started')`
- On `combatEnd` message with `result: 'won'`: `triggerTip('combat_won')`

### `QuestsScreen.tsx` / quest network handler
- On `questAccepted` or `activeQuests` array grows: `triggerTip('quest_accepted')`
- On `questCompleted` message: `triggerTip('quest_completed')`

### ACEP XP handler (client network)
- On `acepXpGained` message: `triggerTip('acep_xp_gained')`

### `ScanScreen.tsx` / scan handler
- On `scanComplete` message with full scan: `triggerTip('scan_complete')`

### `TradeScreen.tsx` / trade handler
- On successful sell response: `triggerTip('trade_sold')`

### `client.ts` AP update handler
- In the `apUpdate` message handler: when `ap.current / ap.max < 0.2`, call `triggerTip('ap_low')`
- The existing tip `ap-depleted-first` has no active caller in the codebase; add `trigger: 'ap_low'` to it and rename id to `ap_low_first` to align with the new naming convention (the new deep tip row in the inventory table). No separate new tip is added — the existing entry is migrated.

### `FactionScreen.tsx` / faction rep handler
- On `reputationUpdate` message where any rep changes: `triggerTip('faction_rep_change')`

---

## Existing Tips: Migration

The 9 existing tips are retained. One migration:
- `ap-depleted-first` → rename to `ap_low_first`, add `trigger: 'ap_low'`; add `triggerTip('ap_low')` call in the `apUpdate` handler in `client.ts`. This tip currently has no active caller.
- All other existing tips (`first_nebula`, `first_station`, `first_asteroid`, `first_pirate`, `first_distress`, `first_anomaly`, `low_fuel`) keep their existing direct `showTip()` call pattern — no changes.

---

## File Changes Summary

| File | Change |
|------|--------|
| `packages/client/src/state/helpSlice.ts` | Add `trigger?` to `HelpTip`; add `triggerTip()` to slice + interface; expand `HELP_TIPS` with 24 new entries |
| `packages/client/src/components/ProgramSelector.tsx` | Add `triggerTip('program_open_<id>')` on first button press |
| `packages/client/src/components/MiningScreen.tsx` | `triggerTip('mining_started')` on first active state |
| `packages/client/src/network/client.ts` (or handlers) | `triggerTip` calls for combat, quest, ACEP, scan, trade, cargo, AP, faction events |

---

## Out of Scope

- No server changes
- No new Kompendium articles (existing `articleId` links are optional and can be wired later)
- No changes to HelpOverlay rendering
- No localization system — texts are inline German/English hybrid matching existing tip style

---

## Success Criteria

- Every program shows a tip on first open, never again after
- Core system tips fire at the correct moment, once per pilot
- Tips are dismissable with click or ESC
- `vs_seen_tips` persists across sessions (existing localStorage mechanism)
- No tip fires during onboarding (onboardingStep !== null guard in `triggerTip()`)
