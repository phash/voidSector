# Design-Spec: Sprint Issues #239, #242, #243, #244, #245, #246, #247, #248 + ACEP-Panel

**Datum:** 2026-03-10
**Status:** APPROVED
**Nächste Migration:** 049

---

## Übersicht

Fünf thematische Blöcke, umgesetzt als eigenständige PRs:

| Block | Issues | Beschreibung |
|-------|--------|--------------|
| A | #239, #246 + ACEP-UI | ACEP-Panel ersetzt Hangar, Bereinigung |
| B | #247, #245 | Modul-Shop → Station, Create → Section 5 |
| C | #248 | Wissen-Integration (Scan + Quest + Display) |
| D | #242 | Quest-Erfüllung UX |
| E | #243, #244 | Animation-Fix + QuadMap Fog-of-War |

---

## Block A — ACEP-Panel + Bereinigung (#239, #246 + Roadmap)

### Ziel
- `HangarPanel` durch vollständiges **ACEP-Panel** ersetzen
- Alle UI-Referenzen auf `hullType`, "VOID SCOUT", "AEGIS" entfernen
- Schiff bezeichnet sich als **"ACEP GEN-{acep_generation}"** (z.B. "ACEP GEN-1")

### ACEP-Panel Layout

```
── DEIN SCHIFF ──────────────────────────────
  [Schiffsname]          ACEP GEN-1  [UMBENENNEN]

── ENTWICKLUNGSPFADE ────────────────────────
  AUSBAU    ████████░░  23/50  [BOOST +5 XP]  100 Cr · 3 W
  INTEL     █████░░░░░  12/50  [BOOST +5 XP]  100 Cr · 3 W
  KAMPF     ███░░░░░░░   8/50  [BOOST +5 XP]  100 Cr · 3 W
  EXPLORER  ██░░░░░░░░   5/50  [BOOST +5 XP]  100 Cr · 3 W
  GESAMT    ████████░░  48/100

── AKTIVE EFFEKTE ───────────────────────────
  +2 Modul-Slots (AUSBAU)  ·  +1 Scan-Radius (INTEL)

── MODUL-SLOTS ──────────────────────────────
  5/8 SLOTS BELEGT (3 Basis + 2 AUSBAU)

── TRAITS ───────────────────────────────────
  ◈ CURIOUS  ◈ CAUTIOUS
```

### ACEP-Beschleunigung (Boost)

Neuer Server-Handler: `acepBoost { path: AcepPath }`

Kosten (pro +5 XP, skaliert nach aktuellem XP dieses Pfades):

| Bracket | Credits | Wissen |
|---------|---------|--------|
| 0–19 XP | 100 | 3 |
| 20–39 XP | 300 | 8 |
| 40–49 XP | 600 | 15 |

- Per-Pfad-Cap (50) und Total-Cap (100) werden geprüft — Boost verweigert wenn nicht möglich
- Fehler via `actionError` zurück an Client

### Bereinigung

- `HullType`-Feld bleibt im Backend (DB, Spawn) — nur UI-Anzeige wird bereinigt
- `HULLS[hullType].name` / `displayName` wird aus allen Client-Komponenten entfernt
- `HangarPanel.tsx` → wird geleert und durch `AcepPanel.tsx` ersetzt (gleiches `HangarPanel`-Export-Interface)
- `ShipStatusPanel`: [HANGAR]-Link bleibt, zeigt jetzt ACEP-Panel
- `StationTerminalOverlay`: hangar-Tab zeigt jetzt ACEP-Panel
- `GameScreen`: SHIP-SYS-Sektion zeigt ACEP-Panel

### Neue Komponente

`AcepPanel.tsx` — exportiert als `HangarPanel` (Drop-in-Ersatz, kein Refactor der Imports nötig)

---

## Block B — Modul-System-Umbau (#247, #245)

### #247 — Modul-Shop auf Station

**Vorher:** CargoScreen enthält "HERSTELLEN"-Tab mit Craft-Buttons
**Nachher:**
- CargoScreen MODULE-Tab: zeigt nur Cargo-Module (fertig produziert) + **[INSTALLIEREN]**-Button
- `StationTerminalOverlay`: neuer Tab **"FABRIK"** (zwischen bestehendem Shop und Hangar)
  - Zeigt Blaupausen aus Inventory
  - Craft-Button → `sendCraftModule(itemId)` → Modul landet in Cargo-Inventory
  - Installierbare Module aus Cargo werden ebenfalls angezeigt mit [INSTALLIEREN]-Button

### #245 — Create-Slates → Section 5

- Sektion `── KARTEN ──` mit drei Buttons (Sektor-Slate, Area-Slate, Custom-Slate) aus CargoScreen entfernen
- Neuer Block am Ende von Section 5 (unterhalb NavControls), gerendert in `NavControls.tsx` oder eigene kleine Komponente `SlateControls.tsx`

---

## Block C — Wissen-Integration (#248)

### Wissen-Quellen

| Quelle | Betrag | Bedingung |
|--------|--------|-----------|
| Area-Scan | +1 pro Sektor | Nur *neu entdeckte* Sektoren (nicht in `sector_discoveries`) |
| Local-Scan | +10 pro Sektor | Unbekannter Sektor; Standard |
| Local-Scan Spezial | +25 pro Sektor | Anomalie, Asteroid, Nebel, Nachbar von Sonne/BH |
| Quest: Delivery | +2 | Bei Abschluss |
| Quest: Exploration | +3 | Bei Abschluss |
| Quest: Community | +5 | Bei Abschluss |

### Daily-Cap (Local-Scan-Wissen)

- Redis-Key: `wissen_daily:{playerId}:{YYYY-MM-DD}` → Counter (TTL 26h)
- Tages-Limit: **200 Punkte** base
- Frontier-Faktor: Q-Distanz > 3 vom Ursprung → ×1.5 effektives Limit (d.h. bis 300)
- Area-Scan-Wissen ist **nicht** gedeckelt (gering pro Aktion)

### Backend

- `ScanService.areaScan`: nach Viewport-Scan → `addWissen(shipId, newSectorCount * 1)`
- `ScanService.localScan`: pro Sektor → klassifiziere Typ → Wissen addieren, Daily-Cap prüfen
- `addWissen(shipId, amount)` → `UPDATE ships SET wissen = wissen + $2 WHERE id = $1`
- Quest-Abschluss: `wissen?: number` zu `QuestReward`-Interface, wird in `awardQuestReward()` verarbeitet
- ResearchState-Push enthält `wissen` (bereits in Typen vorhanden)

### Client

- Section 5 (SectorInfo / HUD): `◈ WISSEN: {n}` neben Credits — immer sichtbar
- TECH-Screen Header: Wissen-Anzeige + wissenRate (falls aktiv)
- Wissen-Wert kommt über bestehenden `ResearchState`-Push

---

## Block D — Quest-Erfüllung (#242)

### Delivery-Quests: Abliefern-Button

**Server:** Neuer Handler `deliverQuestResources { questId }`
- Prüft: Spieler ist an Station (`currentSector.type === 'station'`)
- Prüft: Quest ist aktiv, `type === 'delivery'`, nicht abgebrochen
- Entfernt so viele Ressourcen wie vorhanden (partielle Lieferung OK)
- Aktualisiert `player_quests.progress` (vorhandenes JSONB-Feld)
- Bei Vollständigkeit: Quest als `completed` markieren, Belohnung auszahlen, Completion-Event senden

**Client:** `QuestsScreen`
- Bei aktiver Delivery-Quest + Spieler an Station → Button **[ROHSTOFFE ABLIEFERN]**
- Fortschrittsanzeige: `17/50 ERZ`

### Abschluss-Popup

Neue Komponente `QuestCompleteOverlay.tsx`:
- Zeigt Quest-Titel, Typ-Icon, Belohnung (Credits, Wissen, Items)
- Auto-dismiss nach 5s oder Klick
- Stacking wie `AlienEncounterToast` (Queue)

---

## Block E — Animation + QuadMap (#243, #244)

### #243 — Smooth Sector Move

**Root-Cause:** In `joinSector()` (client.ts) wird `resetPan()` sofort nach `startShipMoveAnimation()` aufgerufen. Das rastet den Viewport snap-artig auf den neuen Sektor ein, während das Schiff-Icon noch animiert.

**Fix:** `resetPan()` um die Animations-Dauer (600ms) verzögern:

```typescript
// vorher:
store.startShipMoveAnimation(oldPos.x, oldPos.y, x, y);
store.setPosition({ x, y });
store.resetPan();  // ← sofort → ruckt

// nachher:
store.startShipMoveAnimation(oldPos.x, oldPos.y, x, y);
store.setPosition({ x, y });
setTimeout(() => useStore.getState().resetPan(), 600);
```

### #244 — QuadMap Fog of War

**Migration 049:** `player_quadrant_visits (player_id, qx, qy, first_visited_at)`

**Server:**
- `SectorRoom.onCreate/onJoin`: `INSERT INTO player_quadrant_visits ... ON CONFLICT DO NOTHING`
- QuadMap-Handler: filtert `quadrant_control`-Daten auf Zeilen in `player_quadrant_visits` des Spielers
- Alien-Fraktionen: erscheinen nur wenn `EXISTS (SELECT 1 FROM alien_encounters WHERE player_id = ... AND faction_id = ...)`

**Client:**
- Nicht besuchte Quadranten: leeres Tile (kein Render / "░░░ UNBEKANNT")
- Bekannte Quadranten ohne Alien-Kontakt: zeigen Menschen-Farbe / neutrale Farbe, kein Alien-Label

---

## Implementierungs-Reihenfolge

```
Block E (#243) — 1 Zeile, sofort
Block A (#239, #246, ACEP-UI) — Frontend-schwer
Block B (#247, #245) — Frontend-Umbau
Block C (#248) — Backend + Frontend
Block D (#242) — Backend + Frontend
Block E (#244) — Migration + Backend + Frontend
```

---

## Migrations-Übersicht

| Nr. | Tabelle | Inhalt |
|-----|---------|--------|
| 049 | `player_quadrant_visits` | Fog-of-War für QuadMap |

Keine weiteren Migrationen nötig (Wissen nutzt bestehende `ships.wissen`-Spalte; Daily-Cap via Redis).
