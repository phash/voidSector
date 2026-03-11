# Design: ACEP-Programm + AUSBAU-Level-Gating

**Datum:** 2026-03-11
**Issues:** #241
**Status:** Draft

---

## Scope

Zwei Änderungen:

1. **ACEP-Programm** — neuer Cockpit-Monitor der Modul-Slots + ACEP-Entwicklung auf einem Screen vereint
2. **AUSBAU-Level-Gating** — Forschungsslot 2 und Fabrik-Nutzung werden durch AUSBAU-Level statt Gebäude-Tier freigeschaltet

---

## Teil 1: ACEP-Programm

### Neuer Monitor

`MONITORS.ACEP = 'ACEP'` in `packages/shared/src/constants.ts`, am Ende von `COCKPIT_PROGRAMS` ergänzt.

### Zwei-Spalten-Layout

```
╔══════════════════════════════════════════════════════╗
║  ACEP — ADAPTIVE COGNITIVE EVOLUTION PROTOCOL        ║
╠═══════════════════════════╦══════════════════════════╣
║  MODUL-SLOTS              ║  ENTWICKLUNGSPFADE       ║
║  ─────────────────────    ║  ─────────────────────   ║
║  [GEN] fusion_mk2  ██░    ║  AUSBAU  ████████░ 32/50 ║
║  [DRV] ion_mk3     ███    ║  INTEL   █████░░░░ 18/50 ║
║  [WPN] laser_mk1   █░░    ║  KAMPF   ██░░░░░░░  8/50 ║
║  [ARM] —           ───    ║  EXPL    ███░░░░░░ 12/50 ║
║  [SHD] —           ───    ║  ─────────────────────   ║
║  [SCN] scanner_mk2 ██░    ║  AKTIVE EFFEKTE          ║
║  [MIN] mining_mk1  █░░    ║  +2 Modul-Slots (AUSBAU) ║
║  [CGO] cargo_mk2   ██░    ║  +1 Scan-Radius (INTEL)  ║
║  ─── EXTRA SLOTS ──────   ║  ─────────────────────   ║
║  [+1] defense_mk1  ██░    ║  TRAITS                  ║
║  [+2] —            ───    ║  ◆ VETERAN               ║
╚═══════════════════════════╩══════════════════════════╝
```

**Linke Spalte — Modul-Slots:**
- 8 Specialized Slots mit Kategorie-Label (GEN/DRV/WPN/ARM/SHD/SCN/MIN/CGO)
- Darunter Extra-Slots (freigeschaltet durch AUSBAU-Level), nummeriert +1, +2 etc.
- Pro Slot: `[KAT] moduleName  HP-Bar` — bei leer: `[KAT] —  ───`
- HP-Bar: 3 Zeichen aus `█░` (currentHp / maxHp)
- Klick auf belegten Slot: Uninstall-Button
- Klick auf leeren Slot: Filtert ModulePanel auf passende Kategorie (via `setActiveProgram('SHIP-SYS')`)
- Modul-Farbkodierung: standard=grün, found=amber, researched=blau (wie ModulePanel)

**Rechte Spalte — Entwicklungspfade:**
- 4 XP-Bars (AUSBAU / INTEL / KAMPF / EXPLORER), je `xp/50` mit Level-Anzeige
- Aktive Effekte (nur wenn vorhanden): `+N Modul-Slots`, `+N Scan-Radius`, `+X% Mining` etc.
- Traits (nur wenn vorhanden): `◆ TRAITNAME`
- Boost-Buttons (+5 XP) **nicht** hier — bleiben im HANGAR/SHIP-SYS

### Dateien

- **Create:** `packages/client/src/components/AcepProgram.tsx`
- **Modify:** `packages/shared/src/constants.ts` — `MONITORS.ACEP`, `COCKPIT_PROGRAMS`
- **Modify:** `packages/client/src/components/GameScreen.tsx` — case + detail-case für ACEP
- **Modify:** `packages/client/src/components/GameScreen.tsx` — `COMING SOON`-Placeholder entfernen

### Detail-Panel (Section 3)

Wenn ein Modul-Slot selektiert: zeigt Modul-Stats (wie ShipDetailPanel aktuell). Kein neues Panel nötig — bestehenden `ShipDetailPanel` wiederverwenden oder `null` zurückgeben.

---

## Teil 2: AUSBAU-Level-Gating

### Konzept

`labTier` (bisher: Tier des Gebäudes auf der Basis) wird ersetzt durch AUSBAU-Level des Schiffs. Die Funktion `canStartResearch()` in `research.ts` bleibt unverändert — nur der übergebene Wert ändert sich.

### Mapping

| AUSBAU-Level | Entspricht altem Lab-Tier | Forschungsslots | Fabrik |
|---|---|---|---|
| 1 (0–7 XP) | 1 | 1 | — |
| 2 (8–17 XP) | 2 | 1 | ✅ |
| 3 (18–31 XP) | 3 | 2 | ✅ |
| 4 (32–49 XP) | 4 | 2 | ✅ |
| 5 (50 XP) | 5 | 2 | ✅ |

**Forschungsslot 2:** Slot 2 in `canStartResearch()` erfordert `labTier >= 3`. Wenn wir AUSBAU-Level als labTier übergeben, gilt: Slot 2 erfordert AUSBAU-Level 3 (≥18 XP).

**Modulspezifische Anforderungen:** `module.requiredLab` bleibt erhalten — jetzt mapped auf AUSBAU-Level. Ein Modul mit `requiredLab: 2` braucht AUSBAU-Level 2.

### Server-Änderung

In `ShipService.handleStartResearch`:
```typescript
// ALT:
const labTier = await getResearchLabTier(auth.userId);

// NEU:
const ship = await getActiveShip(auth.userId);
const ausbauXp = ship?.acep_ausbau_xp ?? 0;
const labTier = getAcepLevel(ausbauXp);   // 1–5
```

`getResearchLabTier`-Aufruf entfällt. `getAcepLevel` kommt aus `@void-sector/shared`.

### Fabrik-Gating

In `SectorRoom`/`ShipService` wo Fabrik-Start geprüft wird (`handleStartProduction` o.ä.):
```typescript
const ausbauLevel = getAcepLevel(ship.acep_ausbau_xp ?? 0);
if (ausbauLevel < 2) {
  client.send('error', { code: 'FACTORY_LOCKED', message: 'Fabrik erfordert AUSBAU Level 2' });
  return;
}
```

Client: `TechTreePanel.tsx` oder `BASE-LINK` zeigt Hinweis wenn Level zu niedrig.

### Dateien

- **Modify:** `packages/server/src/rooms/services/ShipService.ts` — `getResearchLabTier` durch AUSBAU-Level ersetzen
- **Modify:** `packages/server/src/rooms/SectorRoom.ts` — `getResearchLabTier`-Aufruf für `labTier` im Research-State ersetzen
- **Modify:** `packages/client/src/components/TechTreePanel.tsx` — Hinweis wenn AUSBAU-Level zu niedrig

---

## Nicht im Scope

- Neue Modul-Kategorien `'lab'`/`'factory'` — kein Bedarf
- Modul-Boost-Buttons im ACEP-Programm — bleiben im SHIP-SYS
- Änderungen an `research.ts` Logik selbst

---

## Testplan

| Feature | Test |
|---------|------|
| ACEP-Programm rendert | Unit: AcepProgram — slots + XP-Bars sichtbar |
| Leerer Slot zeigt `—` | Unit: AcepProgram — slot ohne Modul |
| AUSBAU-Level als labTier | Unit: ShipService.handleStartResearch — AUSBAU Level 3 erlaubt Slot 2 |
| Fabrik gesperrt bei Level 1 | Unit: SectorRoom/ShipService — AUSBAU Level 1 → FACTORY_LOCKED |
