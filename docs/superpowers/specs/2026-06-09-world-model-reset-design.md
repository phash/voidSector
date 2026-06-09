# World-Model-Reset — Design

**Datum:** 2026-06-09
**Branch (geplant):** `feat/world-model-reset`
**Status:** Design (Spec) — vor Implementierung
**Sprache der Distanzen:** Sektoren. `QUADRANT_SIZE = 500` ⇒ 1 Quadrant = 500 Sektoren.

---

## 1. Motivation

Prod zeigt **5 873 NPC-Stationen** (`civ_stations`), obwohl nur **0:0** eine Station sein soll und
der Rest von Spielern gebaut werden soll. Ursache ist **kein** Datenmüll allein, sondern zwei aktive
Generatoren plus eine außer Kontrolle geratene Expansion:

- **Worldgen** vergibt `type='station'` an ~1,6 % aller besuchten Sektoren
  (`CONTENT_WEIGHTS.station = 0.016`, `shared/constants.ts:643`).
- **`ensureCivStations()`** legt bei **jedem Boot** je eine `civ_stations`-Zeile pro nicht-menschlich
  kontrolliertem Quadranten an (`universeBootstrap.ts`, `civStationService.ts:28`).
- **Alien-Expansion** ist ungedeckelt: `quadrant_control` wuchs nach dem Reset vom 2026-06-04 von
  **8 → 6 627 Zeilen** in 5 Tagen (`strategicTickService.ts` `processAlienExpansion`, **kein Cap**).

Zusätzlicher Befund: die Alien-Heimaten liegen aktuell **47 000 – 1 400 000 Sektoren** von 0:0 entfernt
(`ALIEN_STARTING_REGIONS`, `shared/constants.ts:1010` mit `qx`-Werten 65–2800 × 500). Das ist praktisch
unerreichbar und genau das „Galaxis fühlt sich tot an"-Problem aus dem Living-Universe-Review: Spieler
begegnen Aliens nie.

**Ziel:** eine saubere, erreichbare Welt — nur 0:0 als (gut ausgebaute) Handelsstation, Aliens in
Reichweite und schlafend bis Spieler sie erreichen, dann echte Expansion; dazu eine kleine, gedeckelte
Flotte herumfliegender NPCs, damit erkundeter Raum lebendig wirkt — ohne den OOM, der NPC-Ticks früher
lahmgelegt hatte.

## 2. Geltungsbereich

**In-Scope (dieses Spec = Sub-Projekt 1):**
1. **Clean Slate** — Generatoren abschalten, Bestandsdaten bereinigen, 0:0 zur Handelsstation ausbauen.
2. **Alien-Heimaten in den 1000–5000-Sektor-Ring + getriggerte Expansion.**
3. **100 Frontier-NPCs** (gebunden an die Spieler-Frontier).

**Out-of-Scope (Sub-Projekt 2, später, eigenes Spec):** die sozialen/Service-Funktionen des „Origin Hub"
(Notice-Board, Community-Quest-Turn-in, Bounty-Board, Goods/Blueprint-Exchange). Der hier ausgebaute
0:0-Trade-Post ist deren Fundament, aber die Hub-Programme/UI sind nicht Teil dieses Specs.

## 3. Entschiedene Parameter

| Parameter | Wert | Quelle/Begründung |
|---|---|---|
| Quadrantengröße | 500 Sektoren/Quadrant | `QUADRANT_SIZE`, `constants.ts:971` |
| Alien-Heimat-Ring | **1000–5000 Sektoren** (= 2–10 Q) von 0:0 | Nutzerentscheidung; macht Aliens erreichbar |
| Expansions-Trigger | erster Mensch entdeckt Quadrant **≥ 2 Q (≈1000 Sektoren)** | = Spieler erreicht den Alien-Ring |
| Post-Wake-Expansion | **an die Spieler-Frontier gebunden** | verhindert 6 627-Runaway, bleibt „echt" |
| Frontier-NPCs | **100** Stück | Nutzerentscheidung |
| NPC-Frontier-Band | ≤ **5 Q (2500 Sektoren)** hinter dem äußersten Online-Spieler | bleibt im Anchor-Bubble (OOM-safe) |
| NPC-Aktivität v1 | leichtgewichtig: scan/mine/trade + BB5-Traces | tiefe Wirtschaft später |
| 0:0-Station-Level | **5** (Megastation, maxStock 8000) | `NPC_STATION_LEVELS`, `constants.ts:230` |
| 0:0-Sink | nimmt ore/gas/crystal **immer** an | Nutzerentscheidung |

---

## Phase 1 — Clean Slate

### 1.1 Generatoren abschalten (Code, TDD)

- **Worldgen-Stationen aus:** `CONTENT_WEIGHTS.station 0.016 → 0`, das Gewicht zu `none` (0.91 → 0.926),
  sodass die Tabelle weiter auf 1.0 summiert (`shared/constants.ts:639-645`; danach `shared` rebuilden).
  - *Begründung „echt abschalten":* Worldgen-`station`-Sektoren sind bis zum ersten Besuch kosmetisch,
    werden dann aber lazy zur Handelsstation initialisiert (`npcStationEngine.getOrInitStation`).
- **`ensureCivStations()` deaktivieren:** Aufruf in `universeBootstrap.ts` hinter ein game_config-Flag
  `civ_stations_enabled` (Default `false`). Funktion bleibt erhalten (re-aktivierbar), läuft aber nicht.
  - *Safety:* einzige Leser von `civ_stations` sind Drohnen-Spawn (`spawnMissingDrones`) und
    `ConquestEngine` (`getConquestStations`). Bei leerer Tabelle laufen beide **leer** (kein Fehler);
    Drohnen sind ohnehin OOM-disabled, und Conquest hat mit 0 player_stations nichts zu tun.

### 1.2 0:0 zur Handelsstation ausbauen (Code, gilt auch für frische Welten)

`ensureKernweltStation()` (`queries.ts`) erweitern:
- `npc_station_data` für (0,0): **Level 5** (bzw. `xp ≥ 15000`, `NPC_STATION_LEVELS[4]`).
- `npc_station_inventory` für `ore`/`gas`/`crystal` seeden (hoher Stock, z. B. ~80 % von maxStock = 6400),
  damit faire Ankaufspreise gelten.
- **Echter Sink:** 0:0 nimmt ore/gas/crystal **immer** an, auch bei vollem Lager. Umsetzung als
  Sonderregel in der NPC-Station-Kauf-Logik (`npcStationEngine` / `EconomyService`): für Station (0,0)
  und Basis-Ressourcen kein „Lager voll"-Reject; Preis folgt weiter der Stock-Kurve mit einem
  **Preisboden**, damit der Sink nicht auf 0 fällt. (Sonderregel auf 0:0 + {ore,gas,crystal} begrenzt.)

### 1.3 Einmaliges Prod-Cleanup (Script)

Neues, zielgerichtetes Script `packages/server/src/scripts/cleanSlateReset.ts` (`npm run clean-slate`).
**Behält Accounts, Spieler-Progress und erkundete Sektoren** (anders als `reset:world`). Schritte,
idempotent und in Transaktion:

1. `DELETE FROM civ_stations;`
2. `DELETE FROM civ_ships;`  *(verwaiste NPC-Schiffe — Phase 3 baut die Flotte neu auf)*
3. `quadrant_control` auf Homes reduzieren: alle Nicht-Home-Zeilen löschen, dann
   `ensureZentrumQuadrant()` + `ensureAlienHomeQuadrants()` re-seeden (nutzt die **neuen** Heimaten aus
   Phase 2).
4. Nicht-Origin `sectors` mit `type='station'` löschen (regenerieren ohne Station, da Worldgen-Gewicht 0)
   + verirrte `npc_station_data` (station_x/y ≠ 0).
5. 0:0 ausbauen (= `ensureKernweltStation()` mit den Phase-1.2-Änderungen).

> **Reihenfolge-Invariante:** Erst Code (Generatoren aus) deployen, **dann** Script laufen lassen —
> sonst füllt der nächste Boot die Stationen/Territorien wieder auf.

### 1.4 Tests (Phase 1)

- `CONTENT_WEIGHTS` summiert auf 1.0 und `station === 0`.
- `ensureCivStations` no-op bei Flag `false` (kein Insert).
- `ensureKernweltStation` setzt Level 5 + seedet ore/gas/crystal-Inventar.
- 0:0-Sink: Kauf von ore/gas/crystal bei vollem Lager wird angenommen, Preis ≥ Boden.
- `cleanSlateReset` (Integration gegen Test-DB): nach Lauf `civ_stations=0`, `quadrant_control` = nur
  Homes, nur (0,0) ist Station.

---

## Phase 2 — Alien-Heimaten in den Ring + getriggerte Expansion

### 2.1 Heimaten neu setzen (1000–5000 Sektoren)

Die 10 Alien-Faktionen (`archivists, consortium, kthari, mycelians, mirror_minds, tourist_guild,
silent_swarm, helions, axioms, scrappers`) bekommen neue Heimat-Quadranten im positiven Quadrantenraum
(Welt erstreckt sich nach +x/+y), verteilt nach Richtung, Euklid-Distanz **2–10 Q (1000–5000 Sektoren)**.

Vorgeschlagenes Layout (final im Plan, muss am `alienHomeGuard` vorbei):

| Faktion | Quadrant (qx,qy) | ≈ Sektoren von 0:0 |
|---|---|---|
| archivists | (2, 1) | 1118 |
| scrappers | (1, 3) | 1581 |
| consortium | (4, 2) | 2236 |
| mycelians | (2, 4) | 2236 |
| kthari | (5, 3) | 2915 |
| mirror_minds | (3, 6) | 3354 |
| tourist_guild | (7, 2) | 3640 |
| silent_swarm | (4, 7) | 4031 |
| helions | (8, 4) | 4472 |
| axioms | (6, 8) | 5000 |

Betroffen:
- `ALIEN_STARTING_REGIONS` (`shared/constants.ts:1010`) — neue Primär-Heimaten (Sekundär-Regionen
  entfallen oder rücken in den Ring).
- `faction_config.home_qx/home_qy` (Migration/Seed) — Quelle für `ensureAlienHomeQuadrants()`
  (`queries.ts:3411`).
- `alienHomeGuard` (`engine/alienHomeGuard.ts`) — Guard von „≥1000 Sektoren" auf **„1000–5000 Sektoren"**
  erweitern (Min **und** Max), damit künftige Resets im Ring bleiben.
- Nebula-Safe-Check beachten (Heimaten nicht in Nebula-Cluster legen).

### 2.2 Schlaf/Wach-Trigger

- Flag **`aliens_awakened`** in `game_config` (Default `false`), gelesen via `getConfig` / gesetzt via
  `gameConfigService.set` (persistiert + Redis-Pub/Sub).
- Im **Strategic-Tick** (vor `processAlienExpansion`): wenn `!aliens_awakened`, prüfe billig, ob ein
  Mensch je einen Quadranten **≥ 2 Q (Chebyshev, ≈1000 Sektoren)** entdeckt hat
  (`player_quadrant_visits`, `MAX(GREATEST(ABS(qx),ABS(qy)))`). Wenn ja → `set('aliens_awakened', true)`
  (einmalig, bleibt). Ein `log()`/News-Event („Die Fremden erwachen…") macht den Moment sichtbar.
- `processAlienExpansion` läuft **nur** wenn `aliens_awakened`. Vorher: Aliens komplett passiv.

### 2.3 Post-Wake-Expansion an die Frontier binden

Statt eines harten Caps wird Expansion **relativ zur Spieler-Frontier** begrenzt: eine Faktion darf einen
Ziel-Quadranten nur beanspruchen, wenn er **innerhalb von `EXPANSION_FRONTIER_MARGIN` (Default 5 Q)** der
**äußersten menschlichen Discovery-Distanz** liegt (gleiche Frontier-Berechnung wie 2.2). So expandieren
Aliens „richtig" in umkämpften/erreichten Raum, fluten aber nicht die 50 000-Sektoren-Leere → kein
6 627-Runaway. `getExpansionTarget` (`expansionEngine.ts`) bekommt die Frontier-Grenze als Filter.

### 2.4 Tests (Phase 2)

- Alle neuen Heimaten liegen im 1000–5000-Sektor-Ring (Guard akzeptiert Min+Max).
- Trigger: kein Wecken solange max Discovery < 2 Q; Wecken (Flag true) sobald ≥ 2 Q; Flag bleibt true.
- `processAlienExpansion` ist no-op bei `aliens_awakened=false`.
- Frontier-Bound: Ziel jenseits `Frontier + 5 Q` wird **nicht** beansprucht; innerhalb schon.

---

## Phase 3 — 100 Frontier-NPCs

### 3.1 Modell

- Neue `civ_ships`-Rolle **`explorer`** (baut auf vorhandener NPC-KI `npcShipAI.ts` + `patrol_state` auf;
  Muster wie `outlaw`-Roaming, aber mit beweglichem Anker = Spieler-Frontier).
- **100** Explorer werden geseedet (lazy beim Start, wenn `COUNT(explorer) < 100`).
- **Bound:** ein Explorer darf nie weiter als **5 Q (2500 Sektoren)** außerhalb des **äußersten
  Online-Spieler-Radius** sein. Liegt er zu weit draußen (Spieler offline/zurückgezogen), zieht sein
  Ziel nach innen. → bleibt im Anchor-Tick-Radius (`CIV_TICK_RADIUS=200` greift in Spielernähe);
  100 ≪ `CIV_MAX_SHIPS_PER_TICK=600`.

### 3.2 Aktivitäten (v1, leichtgewichtig + sichtbar)

Pro AI-Schritt wählt der Explorer eine Aktivität passend zum Sektor:
- **scan/forschen:** in leerem Raum — hinterlässt eine **BB5-Trace** (`recordTrace`, neue/passende
  Action) „◈ <NPC-Name> hat hier gescannt".
- **mine:** in asteroid/gas/crystal-Sektoren — senkt Sektor-Ressourcen **leicht**, NPC trägt Fracht
  (`resources_carried`/`inventory`), Trace „… hat hier gemint".
- **trade:** mit Fracht Richtung 0:0 — verkauft Basis-Ressourcen an den 0:0-Sink (schließt den
  Wirtschaftskreis), Trace beim Andocken.

Effekte bewusst klein gehalten (kein neuer Wirtschafts-Subsystem); der Wert ist **Sichtbarkeit** —
erkundeter Raum zeigt fremde Pilotenspuren. Tiefere Wirkung (Bestände, Preise, Sicht-Aufdeckung) ist
spätere Iteration.

### 3.3 Wo es tickt (OOM-Constraint)

Explorer ticken im **Anchor-Tick** (`processCivTick`, alle 5 s, Radius 200 um Online-Spieler), weil sie
per Definition nahe der Spieler-Frontier sind. Kein Eingriff in den Background-Sweep nötig. Speicher
beobachten (Baseline ~82–102 MiB; harte Grenze).

### 3.4 Tests (Phase 3)

- Seeding stoppt bei 100 (`COUNT(explorer)=100`, kein Überschuss).
- Bound: Explorer jenseits Frontier+5 Q bekommt Ziel nach innen; nie weiter platziert.
- Aktivitätswahl deterministisch pro Sektortyp; mine reduziert Ressourcen, trade verkauft an 0:0.
- Explorer hinterlässt Trace beim Handeln/Scannen/Minen.

---

## 4. Rollout & Verifikation

1. Branch `feat/world-model-reset`, Phasen 1→3 per TDD, je grün.
2. `shared` rebuilden (Worldgen-Gewicht). Server-Tests grün (`cd packages/server && npx vitest run`).
3. Mergen + auf Prod deployen (Code zuerst — Generatoren aus, neue Heimaten, Trigger, Explorer-Seeding,
   0:0-Ausbau für frische Welten).
4. **Einmal** `npm run clean-slate` auf Prod (analog zum bekannten `reset:world`-Deploy-Schritt).
5. **Verifizieren** (read-only SQL auf Prod):
   - `civ_stations = 0`, `sectors type='station' nur (0,0)`, `npc_station_data` 0:0 Level 5.
   - `quadrant_control` = Homes (1 Mensch + 10 Aliens = 11 Zeilen) und alle Alien-Homes im Ring.
   - `aliens_awakened=false` (frische Welt), `civ_ships explorer ≤ 100`.
   - Speicher/Restarts stabil; keine Tick-Fehler in Logs.

## 5. Risiken & Gegenmaßnahmen

- **OOM** (historisch durch NPC-Ticks): Explorer im Anchor-Tick, 100 ≪ 600-Cap, an Frontier gebunden →
  bleiben in Spielernähe. Nach Deploy Speicher beobachten.
- **Expansion-Runaway erneut:** Frontier-Bound (2.3) statt freiem Lauf; Trigger gated den Start. Notfalls
  `aliens_awakened` per game_config wieder auf `false`.
- **`civ_stations`-Leser brechen:** geprüft — Drohnen-Spawn/Conquest laufen leer ohne Fehler.
- **Living-Universe-Spannung:** Galaxis ist bis zur Spieler-Expansion ruhig (bewusst — Spieler füllen
  sie). Explorer + erweckende Aliens liefern die „Lebendigkeit" dosiert und in Reichweite.
- **Quadranten-Konvention** (centered vs floor, bekannt zweideutig): Frontier-/Home-Distanzen konsequent
  mit `sectorToQuadrant` (centered, `quadrantEngine.ts:21`) und Chebyshev rechnen; in Tests fixieren.

## 6. Offene Punkte (im Plan/Review zu klären)

- Finale Heimat-Koordinaten (am `alienHomeGuard` + Nebula-Check vorbei).
- Preisboden-Höhe für den 0:0-Sink.
- Exakte `EXPANSION_FRONTIER_MARGIN`- und Explorer-Seed-Defaults als game_config (tunbar).

## 7. Entscheidungen / Scope-Notizen

- **Void-Lifecycle bleibt aktiv (Entscheidung 2026-06-09).** Das `VoidLifecycleService`-System
  (Void-Cluster + `voids`-Territorium, ungated im Strategic-Tick) ist **gewolltes Gameplay** und wird
  vom Clean-Slate **nicht** eingefroren oder bereinigt. Nur NPC-Handelsstationen (`civ_stations`) und
  Alien-Expansion sind in Phase 1 aus; Voids dürfen weiter Cluster spawnen und Quadranten beanspruchen.
  → Phase 2 muss das **nicht** neu aufrollen. (Surfaced im Phase-1-Final-Review als Residual-Generator;
  bewusst akzeptiert.)
