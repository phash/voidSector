# Spec: Onboarding-Starter-Experience — Tutorial-Kette, Starthilfe-Bounties, Starter-Setup

**Datum:** 2026-06-11 · **Status:** approved (direkte Umsetzungsanweisung Manuel: „setz 1+5 um, danach 2 und 3")
**Branch:** `feat/onboarding-tutorial` · **Migrationen:** 097, 098

## Problem

Neue Spieler stehen nach dem Spawn bei 0:0 ohne Ziel da: keine Anfänger-Questkette (StoryQuestChain
startet erst ab Quadrant-Distanz 6+), Starter-Module liegen uninstalliert im Inventar, der Origin Hub
bietet Anfängern nichts (Bounties verlangen Kampf, Exchange verlangt Kapital).

## Lösung — 3 Bausteine

### A) Starthilfe-Bounties (Origin Hub, BOUNTY-Tab)

Statische, systemgestellte Lieferaufträge, **einmal pro Spieler** einlösbar, nur physisch bei 0:0.

**Shared** (`constants.ts` + `types.ts`):

```ts
interface StarterBountyDef { key, title, resource: 'ore'|'gas'|'crystal', amount, rewardCredits, rewardWissen }
STARTER_BOUNTIES = [
  { key: 'starter_ore',     resource: 'ore',     amount: 5, rewardCredits:  60, rewardWissen: 3 },
  { key: 'starter_gas',     resource: 'gas',     amount: 3, rewardCredits:  80, rewardWissen: 4 },
  { key: 'starter_crystal', resource: 'crystal', amount: 2, rewardCredits: 100, rewardWissen: 5 },
]
```

**Migration 097** `starter_bounty_claims (player_id, bounty_key, claimed_at, PK (player_id, bounty_key))`.

**Server** (BountyService-Erweiterung, kein neuer Service):
- `getStarterBounties` → `starterBountiesResult { claims: string[] }` (Defs kennt der Client aus shared)
- `claimStarterBounty { key }`:
  1. 0:0-Gate (`NOT_AT_ORIGIN`, wie handlePost)
  2. Def-Lookup (`INVALID_BOUNTY`)
  3. Cargo-Check via `getCargoState` (`INSUFFICIENT_RESOURCES`)
  4. Claim-Insert mit `ON CONFLICT DO NOTHING` (`ALREADY_CLAIMED` wenn 0 rows) — atomar vor Abbuchung
  5. `removeFromInventory` (wirft bei Race → Claim-Row löschen, Fehler senden)
  6. `addCredits` + `awardWissenAndNotify`; Pushes: `cargoUpdate`, `creditsUpdate`, `starterBountyClaimed { key, rewardCredits, rewardWissen }`
  7. Tutorial-Hook `onStarterBounty` (Baustein B)
- Pure Validierung in `engine/starterBountyEngine.ts`: `validateStarterClaim(def, cargo, atOrigin)` — TDD.

**Client** (OriginHubScreen, BOUNTY-Tab, Sektion „STARTHILFE" oberhalb der Spieler-Bounties):
- Liste aus `STARTER_BOUNTIES`, Status erledigt/offen aus `starterBountyClaims` (gameSlice)
- `[ABGEBEN]` pro Auftrag: enabled nur bei 0:0 + genug Cargo + nicht geclaimt; `data-testid="starter-bounty-claim-<key>"`
- HelpSlice `first_starter_bounty` + [?]-Button neben Sektionstitel

### B) Tutorial-Questkette (serverseitig getrackt, automatisch fortschreitend)

4 Schritte, kein Annehmen nötig, Fortschritt wird aus bestehenden Aktionen erkannt:

| # | Schritt | Trigger (Server-Hook) |
|---|---------|----------------------|
| 0 | BEWEGEN | `NavigationService.handleMoveSector` erfolgreich |
| 1 | SCANNEN | `ScanService.handleLocalScan` / `handleAreaScan` erfolgreich |
| 2 | MINEN (5 Erz) | `MiningService` schreibt Erz gut (stopMine/autoStop), kumulativ |
| 3 | LIEFERN | Starthilfe-Bounty geclaimt (Baustein A) |

Abschluss-Reward: **200 CR + 15 Wissen** (15 = exakt erste Tier-2-Forschung) + `tutorialComplete`.

**Shared**: `TUTORIAL_STEPS` (id, title, hint — deutsch, mit →-Anweisungen), `TUTORIAL_REWARD_CREDITS = 200`,
`TUTORIAL_REWARD_WISSEN = 15`, `TUTORIAL_MINE_ORE_TARGET = 5`.

**Migration 098** `tutorial_progress (player_id PK, step int default 0, ore_mined int default 0, completed_at timestamp null, created_at)`.
Nur **Neuspieler** bekommen eine Row (onJoin bei `isNewPlayer`) — Bestandsspieler sehen kein Tutorial.

**Server**:
- `engine/tutorialEngine.ts` (pure, TDD): `applyTutorialEvent(state, event) → { state, advanced, completed }`
  — Events: `move`, `scan`, `mine {oreAmount}`, `starter_bounty`. Falsche Reihenfolge = kein Fortschritt
  (Erz vor Schritt 2 zählt nicht).
- `TutorialService` (rooms/services): lädt/cached Status pro Spieler (Map playerId → 'active'|'inactive',
  damit Bestandsspieler keinen DB-Hit pro Move erzeugen), persistiert via queries, sendet `tutorialUpdate
  { step, total, oreMined, oreTarget, done }`, zahlt Abschluss-Reward aus.
- `ServiceContext`: optionales `tutorial?: { onMove, onScan, onMined, onStarterBounty }`.

**Client**:
- `TutorialPanel.tsx` im BookmarkBar-Bereich (persistent sichtbar, inline, kein Modal): `TUTORIAL [n/4]`,
  Titel + Hint des aktuellen Schritts, Erz-Fortschritt bei Schritt 2, [?]-Button (`first_tutorial`).
  Verschwindet nach Abschluss (Toast + Log-Eintrag).
- gameSlice: `tutorial`-State, Handler `tutorialUpdate`/`tutorialComplete`.

### C) Starter-Module vorinstalliert

`createShip` installiert zusätzlich `ion_drive_mk1` (Slot 1) und `mining_laser_mk1` (Slot 6)
(powerLevel `high`, currentHp 20) — Generator `fusion_cell_mk1` (Slot 0) und `factory_mk1` (Slot 8)
sind bereits vorinstalliert (Befund „kein Generator im Startsetup" war falsch). Die beiden
`addToInventory`-Aufrufe in `SectorRoom.onJoin` entfallen; Willkommens-Log verweist auf das Tutorial.

## Nicht-Ziele

- Keine Änderung an Spieler-Bounties (Escrow-System bleibt unberührt)
- Kein Force-Onboarding/Spotlight-Umbau (HelpOverlay-5-Schritte bleiben wie sie sind)
- Keine Wiederholbarkeit der Starthilfe-Bounties (bewusst einmalig; Daily-Contracts wären ein eigenes Feature)

## Teststrategie

- TDD: `tutorialEngine` und `starterBountyEngine` als pure Funktionen mit Vitest (server)
- Client: RTL-Tests für TutorialPanel + STARTHILFE-Sektion
- Bestehende Tests: Starter-Inventar-Annahmen (ion_drive/mining_laser im Inventar) anpassen
- E2E (Playwright): nachgelagert, sofern Stack lokal lauffähig
