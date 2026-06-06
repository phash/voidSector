# SP0 — Korrekturen + Dead-Code/Wiring-Cleanup

**Datum:** 2026-06-06 · **Branch:** `feat/sp0-cleanup` · Teil des Audit-Fix-Programms (Phase A).

## Ziel
Eindeutige Korrekturen + Entfernen klar toten/überholten Codes. **Kein** Feature-Bau, **keine**
„gebaut-aber-unverdrahteten" Systeme löschen (die werden in SP1–SP10 verdrahtet). Nur verifiziert
Sicheres.

## Scope (verifiziert)

1. **Fix `FriendsService.getPlayerCard` Position** (`rooms/services/FriendsService.ts:162`):
   `position: null` ist hartkodiert. → `getPlayerPosition` aus `./RedisAPStore.js` importieren und
   `position: await getPlayerPosition(targetId)` setzen (liefert `{x,y}` für aktive Spieler, sonst `null`).

2. **Fix `first_tech_tab`** (`state/helpSlice.ts`): `AcepProgram.tsx:14` triggert `first_tech_tab`,
   aber der Tip fehlt in `HELP_TIPS` → stiller No-Op. Tip ergänzen (DE, kurz):
   `{ id: 'first_tech_tab', title: 'TECH-BAUM', body: 'Im TECH-Tab schaltest du Forschungsknoten mit Wissen frei. Höhere Stufen brauchen Voraussetzungen → erst Basis-Knoten, dann Spezialisierung.', articleId: 'tech-tree' }`.

3. **Toten Client-Listener entfernen** (`network/client.ts:688`): `room.onMessage('researchResult_legacy', …)`
   — Server sendet das nie (0 Sends). Block entfernen.

4. **Tote Engine löschen**: `engine/productionEngine.ts` (0 Nicht-Test-Importer; abgelöst durch
   `stationProductionEngine`) + `engine/__tests__/productionEngine.test.ts`.

5. **Tote spawn.ts löschen**: `engine/spawn.ts` (nur `generateSpawnPosition` + `assignToCluster`,
   0 Nicht-Test-Caller; echtes Spawnen läuft über Login `lastPosition ?? {0,0}`) + `engine/__tests__/spawn.test.ts`.

## Ausdrücklich NICHT in SP0 (verschoben)
- Legacy-Konstanten `MODULES`/`ACEP_EXTRA_SLOT_THRESHOLDS`/`HYPERJUMP_AP_DISCOUNT` — haben echte
  Nicht-Test-Nutzung (4/4/3) → Migration nötig, kein „safe cleanup".
- Untriggerte Tips (`first_login`, `first_nav_com`, …) + fehlende `[?]`-Buttons → **SP4**.
- `expansion_style` ungenutzt → **SP10**. P2P-/Kontor-/Transfer-Sends bleiben (→ SP1/SP3/SP6).

## Tests
- `FriendsService`/`getPlayerCard`: bestehende Friends-Tests müssen grün bleiben; Position-Pfad ggf.
  über vorhandene Mocks abgedeckt.
- Nach dem Löschen: keine offenen Importe auf `productionEngine`/`spawn` (grep) → Server-Suite grün.
- `helpSlice`: `first_tech_tab` ist in `HELP_TIPS` auffindbar.

## Verifikation
`cd packages/shared && npm run build` (falls nötig) · `cd packages/server && npx vitest run` ·
`cd packages/client && npx vitest run` — alle grün; `grep` bestätigt keine Verweise auf gelöschte Module.
