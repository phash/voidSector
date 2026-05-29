# voidSector — Launch-Readiness-Review

**Stand:** 2026-05-26 · Branch `master` · ~98k LOC (Server 50k / Client 40k / Shared 8k) · 1.751 Tests · Migrationen 001–082
**Methode:** 7 parallele Funktionsreviews am Code (nicht an Docs), kritische Befunde direkt verifiziert.

---

## 1. Was voidSector ist

> **voidSector** ist ein asynchrones Multiplayer-Weltraum-Idle-MMO mit CRT-Terminal-Ästhetik. Spieler steuern ein einzelnes Schiff (AEGIS) durch ein deterministisch generiertes, praktisch unendliches Universum (Quadranten × Sektoren), das vom Ursprung (0,0) nach außen wächst. Kerngedanke: **kein Zeitdruck** — alle Aktionen kosten Action Points (AP), die über Zeit regenerieren (lazy berechnet, kein Tick-Loop).

**Gameplay-Schleife:** Erkunden (Hyperjump/Autopilot/Jumpgates) → Scannen → Minen (Ore/Gas/Crystal/Artefakte) → Handeln (NPC-Stationen, Spieler) → Schiff via **ACEP** (7 Charakter-Pfade, Level 1–10) und **Module** (73 Definitionen, 10 Kategorien) ausbauen → Kämpfen (Combat V3, Energie-/Taktik-System) → Stationen & Jumpgates bauen. Drumherum: Fraktionen, Quests, Story-Chain, Chat, Freunde, und ein simuliertes „lebendes Universum" (7 Alien-Fraktionen expandieren, Void-Cluster wachsen).

**Tech-Stack:** Colyseus (1 Room/Quadrant, 23 Domain-Services via DI) · PostgreSQL · Redis · React+Zustand+Canvas · Docker + Cloudflare-Tunnel.

---

## 2. Gesamtzustand — Ampel pro System

| System | Status | Kurzbefund |
|---|---|---|
| Explorations-Loop (Jump/Scan/Mine/Nav) | 🟢 | Voll verdrahtet, kein Blocker. Stärkstes Teilsystem. |
| Welt-Generierung / Spawn / AP / Fuel | 🟢 | Deterministisch, läuft. Ressourcen-Regen aktiv. |
| NPC-Handel / Refuel / Repair / Bau | 🟢 | Server-autoritativ, exploit-resistent. |
| **Neuspieler-Onboarding** | 🔴 | **Crasht** beim ersten Login (`addCredits` undefined). |
| **Combat V3** | 🔴 | **Unspielbar** — Spieler tritt mit 0 Modulen an, verliert Runde 1 immer. |
| **Schiff/Module/ACEP** | 🔴 | Waffen-Basisslot unbelegbar; ACEP-XP-Doppelschreibung; Tech-Tree gatet nichts. |
| Economy: Kontor/Markt + Spieler-FABRIK | 🟠 | UI da, **Server-Handler fehlen** → tote Features. |
| Social: Fraktionen/Quests/Story/Chat/Friends | 🟢 | Engine solide & verdrahtet. |
| Content-Erreichbarkeit | 🟠 | Story/Alien-Content distanz-gegated → für aktuelle Spieler unerreichbar. |
| Lebendiges Universum (StrategicTick/Void) | 🟢→⚪ | Läuft, aber **kosmetisch** (NPC-AI aus, fog-of-war versteckt alles). |
| Client/UI (Desktop, 14 Programme) | 🟢 | Feature-komplett, reif, keine Stubs. |
| Client/UI (Mobile) | 🟠 | FRIENDS & FABRIK auf Mobile nicht erreichbar. |
| Onboarding-HelpSlices | 🟠 | CLAUDE.md-Pflicht („[?]-Button überall") größtenteils unerfüllt. |
| **Build (Server tsc)** | 🔴 | 17 TS-Fehler (tsx-Runtime läuft trotzdem, aber echte Bugs drin). |
| **Build (Client vite)** | 🔴 | Bricht lokal (i18n-Deps nicht installiert; im Lockfile vorhanden). |
| Tests | 🟠 | Shared 306✓. Server **14 fail** / Client **30 Suites** brechen (i18n). „Alle grün" ist **falsch**. |
| **Security / Deployment** | 🔴 | Secrets im Repo committed; rotierender Quick-Tunnel. |

---

## 3. Funktionsreviews (verdichtet)

### 🟢 Explorations-Loop
Jump, Hyperjump V2 (Charge-gated, partielle Sprünge, Nebel/Black-Hole-Blocking), Autopilot (mit Black-Hole-Avoidance), Slow-Flight, Local/Area-Scan, Mining (Laser/no-Laser), Jumpgate-BFS-Routing: alle end-to-end verdrahtet.
**Nebenbefunde:** `emergencyWarp` existiert nicht (toter Verweis); 4 `engine/*Service.ts` + `universeSeedingService` sind ungenutzte Parallel-Welt (toter Code); Mining-XP vergibt mal `miner`, mal `ausbau` für dieselbe Aktion; Area-Scan kann bei Scanner-Lvl 5 ~1681 Sektoren in einem Burst generieren (OOM-Risiko); `moveSector` blockt keine Black-Holes (Jump schon).

### 🔴 Combat / Ships / Tech / ACEP
Engine (`combatV3Engine.ts`) und UIs sind gut gebaut und getestet, aber der **Server-Glue fehlt**:
- `CombatV3Service.ts:30` → `playerModules: []` mit `// TODO: load from DB`. `[].every()===true` ⇒ Spieler ist Runde 1 „defeated" → **jeder Kampf unverlierbar verloren**. Loot/Niederlage/NPC-Tod sind TODOs (Z. 118/123).
- Waffen-Basisslot (Slot 2 = `weapon`) akzeptiert **keine** Waffe, da alle Module `weapon_energy/kinetic/missile` sind → Neuspieler kann nie feuern (sogar als „erwartet" im Test codifiziert).
- ACEP: zwei Systeme schreiben dieselben DB-Spalten — `boostAcepPath` behandelt sie als **Level** (+1, cap 10), 11 Services schreiben **rohe XP** (z.B. Scan +50) in dieselben Spalten, cap 10 ⇒ ein Scan maxt einen Pfad sofort. `getAcepAutoXpThreshold` (Exponentialkurve) existiert, wird nie genutzt.
- Tech-Tree gatet **nichts**: `isModuleFreelyAvailable` gibt immer `true` → alle Tier-10-Module ab Minute 1 kauf-/craftbar. `TechTreeService` ist verwaist (Client sendet `researchNode`, nicht `researchTechNode`).
- `calculateShipStats(modules, acepXp)` liest `acepXp` nie → ACEP-Stat-Multiplikatoren wirkungslos; `getAcepLevel` nutzt veraltete 1–5-Schwellen → Lab-Tier-Gating kaputt.

### 🟠 Economy
NPC-Stationshandel, Refuel, Repair, NPC-Schiffshandel, Konstruktion, P2P-Direkthandel, NPC-Tier-FABRIK: voll verdrahtet, server-autoritativ, keine Preis-Exploits.
**Tote Features:** Kontor-Kauforders & Spieler-Marktorders (`placeOrder`/`kontorGetOrders`/`kontorSellTo`) — Client sendet, **kein Server-Handler** (verifiziert); Engine+Queries existieren+getestet, nur nicht angebunden. Spieler-Station-FABRIK (`cargo_contents`) unbenutzbar — kein Deposit/Withdraw-Handler.
**Kleinbugs:** NPC-Schiff-Kauf umgeht Cargo-Cap; AP/Ressourcen-Verlust bei Bau-Fehlschlag (kein Refund).

### 🟢/🟠 Social & Content
Fraktionen, prozedurale Quests (25 Templates), Story-Chain (9 handgeschriebene Kapitel), Chat (multi-channel), Friends, Ancient Ruins (24 Fragmente): verdrahtet & solide.
**Aber:** `AlienInteractionService` (1070 Z., 10 Fraktions-Mechaniken) hat **keine aufrufende UI** — toter Surface. CommunityQuest: 3 von 4 Typen nicht advancebar. Reputations-Belohnungen (Honored-Perks, Fraktions-Upgrade-Tiers) **wirkungslos** — nur angezeigt.
**Content-Erreichbarkeit:** Story-Kapitel 2+ und aller Alien-Content sind distanz-gegated (qDist 60–3000); Spieler nahe (0,0) erreichen davon nichts. Es ist **mehr Content geschrieben als erreichbar**.

### 🟢→⚪ Lebendiges Universum
`StrategicTickService` (60s-Loop: Friction/Warfare/Conquest/Expansion/Void/Wracks) läuft DB-gestützt korrekt.
**Aber kosmetisch:** `processCivTick` (NPC-AI) + Mining-Drohnen seit 2026-03-15 deaktiviert (OOM-Ursache: `spawnMissingDrones` → ~24k `civ_ships`-Rows, `getAllShips()` lädt alle alle 5s). NPCs daher **statisch**. `quadrant_territory` „leer", weil Dominant-Faction nur im **toten** `UniverseTickEngine` (in-memory, nie persistiert) berechnet wird; QUAD-MAP zeigt nur besuchte Quadranten (fog-of-war). `geminiNewsService` ruft eine nicht installierte `gemini`-CLI → **immer Fallback-Text**. `findAllBorderPairs` ist O(n²) über stetig wachsende Tabelle — latentes Skalierungsrisiko.
**Für Launch:** StrategicTick/Void/Conquest/Wracks ON lassen; civTick/Drohnen sicher OFF.

### 🟢/🟠 Client/UI
Alle 14 Programme rendern & sind verdrahtet; Netzwerk-Layer (~120 Handler) reif, Reconnect mit Backoff, keine Stubs.
**Gaps:** Mobile-`MEHR`-Menü listet FRIENDS & FABRIK nicht → unerreichbar. Fehler-Surfacing hängt vom Kanal ab (`error`-Handler nur Allowlist → stille Fehler möglich). `[?]`-Help-Buttons fehlen fast überall (nur QuestsScreen hat einen) trotz CLAUDE.md-Pflicht; `first_tech_tab`-Tip-Mapping kaputt; ~8 definierte Tips werden nie getriggert. Accessibility dünn (12/81 Komponenten mit aria).

### 🔴 Infra/Build/Security
Shared baut ✓. **Server tsc: 17 Fehler** (u.a. `ACEP_BOOST_COST_TIERS` entfernt aber importiert, `addCredits` undefined, Null-Safety); tsx-Runtime läuft, aber `addCredits` ist ein **echter Laufzeit-Crash**. **Client vite bricht** (i18n-Deps nicht in `node_modules` — `npm install` nötig; Docker-`npm ci` würde es ziehen). **Secrets committed** in `docker-compose.yml` (`JWT_SECRET`, `ADMIN_TOKEN=vs-admin-2026`, DB-PW). Quick-Tunnel rotiert URL bei jedem Restart. SQL durchweg parametrisiert (gut); ein `minedResource`-Pfad ohne Runtime-Whitelist.

---

## 4. Launch-Blocker (priorisiert)

### 🔴 P0 — Spiel ist ohne diese nicht spielbar/deploybar
1. **Neuspieler-Crash:** `addCredits` in `SectorRoom.ts:1499` importieren (aus `queries.ts:540`). *Ein-Zeilen-Fix, blockiert jeden neuen Account.*
2. **Combat unspielbar:** In `CombatV3Service.handleCombatV3Start` installierte Module aus DB → `CombatModule[]` laden (Z. 24–32) + Loot/Niederlage/NPC-Tod implementieren (Z. 117–129).
3. **Waffen-Basisslot:** Slot-2-Validierung so fixen, dass `weapon_*`-Kategorien passen (`shipCalculator.ts:171`).
4. **Client-Build:** `npm install` (i18n-Deps), `vite build` verifizieren.
5. **Secrets raus** aus `docker-compose.yml` → env/secrets. **Named Tunnel** statt Quick-Tunnel.

### 🟠 P1 — sichtbar kaputt / Vertrauen
6. **ACEP-XP-Kollision** auf ein Modell vereinheitlichen (rohe XP + Exponentialkurve ODER Auto-XP entfernen).
7. **Tote Economy-UI:** Kontor/Markt-Handler anbinden **oder** Tabs ausblenden. Spieler-FABRIK Deposit/Withdraw bauen **oder** verstecken.
8. **Tech-Tree** echt gaten (`isModuleUnlocked`) oder Erwartung anpassen.
9. **Reputations-Perks** wirksam machen oder entfernen.
10. **Server tsc grün** + 14 Server-Tests + 30 Client-Suites reparieren.
11. **Mobile:** FRIENDS+FABRIK in `MEHR_MONITORS` ergänzen.
12. **CommunityQuest:** Trigger anbinden oder Feature schneiden; Zieltexte korrigieren.

### ⚪ P2 — Politur / Design
- HelpSlice-`[?]`-Buttons nachrüsten, tote Tips aufräumen.
- Content-Erreichbarkeit: Story/Alien-Distanzgates senken oder Spawn näher an Content.
- `AlienInteractionService` (1000 Z.): UI bauen oder entfernen.
- Toter Code: `emergencyWarp`, `UniverseTickEngine`-Territorium, `droneService`, 4 ungenutzte engine-Services, doppelte Migrationsnummern (044/045/051/052/059), fehlende 077.
- Mining-XP-Pfad-Inkonsistenz, NPC-Cargo-Cap-Bypass, Bau-Fehlschlag-Refund, Area-Scan-Burst, O(n²)-Border-Scan, `minedResource`-Whitelist.

---

## 5. Bewertung & Empfehlung

**voidSector sieht reif aus (98k LOC, 23 Services, 14 Programme), ist aber NICHT launch-fähig.** Die *Peripherie* (Explorations-Loop, Handel, Welt-Sim, Client-Shell) ist stark; die *progressionskritische Mitte* (Onboarding → Module → Combat → ACEP → Tech) ist **an mehreren Stellen unfertig verdrahtet** und teils kürzlich regrediert (Onboarding-Crash kam mit Commit `412b89a`).

**Realistischer Weg zum Soft-Launch:**
- **P0 (1–5)** = Pflichtprogramm, geschätzt wenige Tage (meist kleine Glue-Fixes; Combat-Modul-Loading ist der größte Brocken).
- **P1** macht das Spiel fair und vertrauenswürdig (~1–2 Wochen).
- **P2/Content** danach.

Ohne P0 kann kein Spieler eine sinnvolle Runde spielen (kein Account-Anlegen, kein Kampf gewinnbar, keine Waffe einbaubar).
