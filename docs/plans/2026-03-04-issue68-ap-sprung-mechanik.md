# Issue #68 — Action Points & Sprung-Mechanik: Design-Dokument

**Stand:** 2026-03-04
**Branch:** `claude/design-documents-sections-XnGFr`
**Bezug:** Issue #68 „Änderungen an Spielinhalten" — Sektion 4
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick & Designziele

### Ist-Zustand

Das AP-System hat einen einzigen Sprung-Typ:

```typescript
export const AP_COSTS = {
  move: 1,          // normaler Sprung
  scan: 2,
  mine: 3,
  ...
};
```

Der Hyperjump ist ein bekannter-Routen-Mechanismus mit 50 % AP-Rabatt,
aber kein grundsätzlich anderer Bewegungstyp.
Fuel wird bei **jedem** Sprung verbraucht (auch kurze).

### Kernprobleme

1. Kein Unterschied zwischen „normaler Bewegung" und „Langstreckensprung"
2. Fuel-Verbrauch für kurze Sprünge ist spielerisch unbefriedigend
3. Hyperjump-Abhängigkeit von Engine-Speed ist nicht implementiert
4. Nebel-Blockade für Hyperjumps fehlt

### Ziele

1. **Zwei Sprung-Modi:** Normaler Sprung (kein Fuel) und Hyperjump (Engine-abhängig, Fuel)
2. **Engine-Speed beeinflusst Hyperjump-AP:** Schnellere Engine → weniger AP für Hyperjump
3. **Nebel blockiert Hyperjump** (Sektor-Typ-Regel, s. Sektor-Dokument)
4. **Normaler Sprung:** Günstig, kurzreichweitig, kein Fuel
5. **Balance:** Hyperjump bleibt attraktiv für Langstrecke, normaler Sprung für taktische Bewegung

---

## 2. Zwei Sprung-Modi im Detail

### 2.1 Normaler Sprung (Sektor-zu-Sektor-Navigation)

```
  ╔════════════════════════════════════════════════════╗
  ║  NORMALER SPRUNG                                  ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║  [A] ──────► [B]                                  ║
  ║  Sektor (0,0)   Sektor (1,0)                      ║
  ║                                                    ║
  ║  REICHWEITE:  1 Sektor (fix)                       ║
  ║  AP-KOSTEN:   1 AP (immer)                         ║
  ║  FUEL:        KEIN VERBRAUCH                       ║
  ║  NEBEL:       Erlaubt                              ║
  ║  UNBEKANNT:   Erlaubt (max 1 Sektor in             ║
  ║               unbekanntes Gebiet)                  ║
  ║                                                    ║
  ║  Verwendung: Taktische Navigation,                 ║
  ║  Erkunden von Nachbarsektoren,                     ║
  ║  Positionierung in Sektor-Gruppen                  ║
  ╚════════════════════════════════════════════════════╝
```

| Parameter        | Wert                    |
|------------------|-------------------------|
| Reichweite       | 1 Sektor                |
| AP-Kosten        | 1 AP (konstant)         |
| Fuel-Verbrauch   | 0 (kein Verbrauch)      |
| Nebel erlaubt    | Ja                      |
| Schwarzes Loch   | Nein (gesperrt)         |
| Unbekannt erlaubt| Ja (1 Sektor)           |

---

### 2.2 Hyperjump (Langstreckennavigation)

```
  ╔════════════════════════════════════════════════════╗
  ║  HYPERJUMP                                        ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║  [A] ═════════════════════════════════► [B]        ║
  ║  Sektor (0,0)     Warp-Tunnel          (15,8)     ║
  ║                                                    ║
  ║  REICHWEITE:  1 bis MAX (Engine-abhängig)          ║
  ║  AP-KOSTEN:   Engine-Speed-abhängig (s. Tabelle)   ║
  ║  FUEL:        JA — proportional zur Distanz        ║
  ║  NEBEL:       VERBOTEN (Ion-Interferenz)           ║
  ║  START IN NEBEL: VERBOTEN                          ║
  ║  UNBEKANNT:   Verboten (nur bekannte Routen)       ║
  ║                                                    ║
  ║  Verwendung: Langstrecke, Handelsstrecken,         ║
  ║  bekannte Routen, Autopilot                        ║
  ╚════════════════════════════════════════════════════╝
```

| Parameter             | Wert                                   |
|-----------------------|----------------------------------------|
| Reichweite            | 1 bis `jumpRange` (Engine-abhängig)    |
| AP-Kosten             | Engine-Speed-Formel (s. Abschnitt 3)   |
| Fuel-Verbrauch        | `fuelPerJump × Distanz-Faktor`         |
| Nebel-Ziel            | Verboten                               |
| Nebel-Start           | Verboten                               |
| Schwarzes Loch        | Verboten                               |
| Unbekannte Sektoren   | Verboten                               |
| Pirate-Sektor-Malus   | +50 % Fuel (`HYPERJUMP_PIRATE_FUEL_PENALTY`) |

---

## 3. Engine-Speed & Hyperjump-AP-Kosten

### 3.1 Engine-Speed-Konzept

Die Engine-Speed (Triebwerksgeschwindigkeit) ist ein abgeleiteter Wert aus
dem ausgerüsteten Drive-Modul und dem Schiffs-Hull.

```
  ENGINE-SPEED — CRT-Darstellung:

  ╔══ SCHIFF-STATUS ══════════════════════╗
  ║  Schiff:     VOID CRUISER MK.II       ║
  ║  Antrieb:    DRIVE MK.II              ║
  ║  ────────────────────────────────   ║
  ║  ENGINE-SPEED:  ████████░░   Stufe 3  ║
  ║  Sprungweite:   6 Sektoren            ║
  ║  Hyperjump-AP:  3 AP / Sprung         ║
  ║  Fuel/Sprung:   3 Einheiten           ║
  ╚═══════════════════════════════════════╝
```

### 3.2 Engine-Speed-Tabelle

Engine-Speed wird durch die Drive-Stufe bestimmt:

| Drive-Modul  | Engine-Speed | Jump-Range | Hyperjump-AP | Fuel/Sektor |
|--------------|-------------|------------|--------------|-------------|
| (kein)       | 1 (Basis)   | 4          | 5 AP         | 5           |
| drive_mk1    | 2           | 5          | 4 AP         | 4           |
| drive_mk2    | 3           | 6          | 3 AP         | 3           |
| drive_mk3    | 4           | 7          | 2 AP         | 2           |
| void_drive   | 5 (max)     | 10         | 1 AP         | 1           |

> `void_drive` = Ancient-Fraktion-Upgrade (Honored+), extrem selten

### 3.3 Hyperjump-AP-Formel

```
baseHyperjumpAP  = MAX_HYPERJUMP_AP - (engineSpeed - 1) × AP_PER_SPEED_LEVEL
                 = 5 - (engineSpeed - 1) × 1

Beispiele:
  Engine-Speed 1 (Basis):   5 - (1-1)×1 = 5 AP
  Engine-Speed 2 (MK.I):    5 - (2-1)×1 = 4 AP
  Engine-Speed 3 (MK.II):   5 - (3-1)×1 = 3 AP
  Engine-Speed 4 (MK.III):  5 - (4-1)×1 = 2 AP
  Engine-Speed 5 (Void):    5 - (5-1)×1 = 1 AP

Zusatz-Multiplikator (bekannte Route):
  Normale Strecke:           AP × 1.0
  Bekannte Handelsroute:     AP × 0.8 (−20 % für frequentierte Routen)
  Auto-Pilot-Route:          AP × 1.0 (kein Bonus)
```

---

## 4. Fuel-System — Nur Hyperjump

### 4.1 Neue Fuel-Regel

```
  ┌────────────────────────────────────────────────────┐
  │  FUEL-VERBRAUCH NACH SPRUNGTYP                     │
  │                                                    │
  │  Normaler Sprung:                                  │
  │  ► Fuel-Verbrauch: 0 Einheiten                     │
  │  ► Begründung: Kurzstrecke, Ionentriebwerk          │
  │                                                    │
  │  Hyperjump:                                        │
  │  ► Fuel-Verbrauch: fuelPerJump × Distanz-Faktor    │
  │  ► Distanz-Faktor: 1.0 für 1 Sektor;              │
  │    +0.1 pro weiteren Sektor                        │
  │    (cap bei 2.0 = 10+ Sektoren)                   │
  │                                                    │
  │  Pirate-Zone-Aufschlag:                            │
  │  ► Fuel × HYPERJUMP_PIRATE_FUEL_PENALTY (1.5)     │
  └────────────────────────────────────────────────────┘
```

### 4.2 Fuel-Verbrauch-Tabelle (Hyperjump)

| Drive   | Fuel/Sprung | 1 Sektor | 5 Sektoren | 10 Sektoren |
|---------|-------------|----------|------------|-------------|
| Basis   | 5           | 5        | 7.5        | 10 (cap)    |
| MK.I    | 4           | 4        | 6          | 8 (cap)     |
| MK.II   | 3           | 3        | 4.5        | 6 (cap)     |
| MK.III  | 2           | 2        | 3          | 4 (cap)     |
| Void    | 1           | 1        | 1.5        | 2 (cap)     |

```
fuelCost = fuelPerJump × min(1.0 + (distance - 1) × 0.1, 2.0)
```

### 4.3 Fuel-Leer-Szenarien

```
  ╔══ WARNUNG: TREIBSTOFF NIEDRIG ════════════════════╗
  ║                                                   ║
  ║  Treibstoff: ██░░░░░░░░░░░░░░  8 / 100            ║
  ║                                                   ║
  ║  HYPERJUMP GESPERRT — Nicht genug Fuel            ║
  ║  Nächste Reparaturstation: 12 Sektoren (normal)   ║
  ║                                                   ║
  ║  ► Normaler Sprung weiterhin möglich (kein Fuel)  ║
  ║  ► Ruf 15 freie Tankfüllungen → Station: 3 CR/u   ║
  ║                                                   ║
  ║  [RETTUNGSMISSION ANFORDERN] (5 AP)               ║
  ╚═══════════════════════════════════════════════════╝
```

---

## 5. Navigation-Modi im Vergleich

### 5.1 Übersichts-Tabelle

| Modus           | AP     | Fuel   | Reichweite   | Nebel | Unbekannt |
|-----------------|--------|--------|--------------|-------|-----------|
| Normaler Sprung | 1 AP   | 0      | 1 Sektor     | ✓     | ✓ (1)     |
| Hyperjump       | 1–5 AP | Ja     | 1–10 Sektoren| ✗     | ✗         |
| Jumpgate        | 0 AP   | 1 Fuel | Unbegrenzt   | ✓/✗  | ✓         |
| Autopilot       | Wie HJ | Ja     | Wie HJ       | ✗     | ✗         |
| Rettung         | 5 AP   | —      | Zur Base     | ✓     | —         |

### 5.2 Entscheidungsbaum Navigation

```
  Spieler will sich bewegen:
  │
  ├─► Ziel 1 Sektor entfernt?
  │     ├─ JA  → Normaler Sprung (1 AP, kein Fuel)
  │     └─ NEIN ↓
  │
  ├─► Ziel bekannt (discoverd)?
  │     ├─ NEIN → Normaler Sprung Schritt für Schritt
  │     └─ JA ↓
  │
  ├─► Ziel oder Route durch Nebel?
  │     ├─ JA  → Nur normaler Sprung möglich
  │     └─ NEIN ↓
  │
  ├─► Genug Fuel für Hyperjump?
  │     ├─ NEIN → Normaler Sprung oder Rettung
  │     └─ JA ↓
  │
  └─► Hyperjump möglich → Hyperjump oder Autopilot
```

---

## 6. UI-Darstellung

### 6.1 Navigations-Panel

```
  ╔══ NAVIGATION ═══════════════════════════════════════╗
  ║                                                     ║
  ║  Ziel-Sektor: [12, -4]                              ║
  ║  Distanz: 8 Sektoren                                ║
  ║                                                     ║
  ║  ── NORMALER SPRUNG ────────────────────────────   ║
  ║  Schritte: 8 (je 1 AP) = 8 AP total                 ║
  ║  Fuel:     0 Einheiten                              ║
  ║  [SCHRITT-MODUS STARTEN]                            ║
  ║                                                     ║
  ║  ── HYPERJUMP ──────────────────────────────────   ║
  ║  AP-Kosten: 3 AP (Engine MK.II)                     ║
  ║  Fuel:      6 Einheiten (8 Sektoren × 0.75)        ║
  ║  Dein Fuel: ████████░░░░  24 / 100 ✓               ║
  ║  [HYPERJUMP AUSFÜHREN]                              ║
  ║                                                     ║
  ║  ─────────────────────────────────────────────    ║
  ║  INFO: Route durch Sektor [5,-1] meidet Nebel.     ║
  ╚═════════════════════════════════════════════════════╝
```

### 6.2 Fuel-Warnung (bei wenig Fuel)

```
  ╔══ FUEL-STATUS ════════════════════════════════════╗
  ║                                                   ║
  ║  Treibstoff: ███░░░░░░░░░░  12 / 100              ║
  ║                              [WARNUNG]             ║
  ║                                                   ║
  ║  Hyperjump verfügbar:  bis 4 Sektoren (3 Fuel/S)  ║
  ║  Normaler Sprung:      unbegrenzt ✓               ║
  ║                                                   ║
  ║  Nächste Tankstelle:   Station [8, -2] (4 Sek.)   ║
  ║  Tankkosten:           3 Credits / Einheit         ║
  ╚═══════════════════════════════════════════════════╝
```

### 6.3 Hyperjump-Sperre (Nebel)

```
  ╔══ HYPERJUMP GESPERRT ══════════════════════════════╗
  ║                                                    ║
  ║  ROUTE: [0,0] → [3,-2]  (Nebel-Sektor)            ║
  ║                                                    ║
  ║  ION-INTERFERENZ: Nebel-Sektor [2,-1] blockiert   ║
  ║  Hyperjump-Navigation.                             ║
  ║                                                    ║
  ║  Alternativen:                                     ║
  ║  ► Normaler Sprung durch Nebel (3 AP, kein Fuel)  ║
  ║  ► Umweg-Route (außen um Nebel): +2 Sektoren      ║
  ║                                                    ║
  ║  [NORMALER SPRUNG]   [UMWEG BERECHNEN]             ║
  ╚════════════════════════════════════════════════════╝
```

---

## 7. Technische Implementierung

### 7.1 Neue Konstanten (`packages/shared/src/constants.ts`)

```typescript
// Sprung-Typen
export const JUMP_NORMAL_AP_COST    = 1;       // Normaler Sprung: immer 1 AP
export const JUMP_NORMAL_FUEL_COST  = 0;       // Normaler Sprung: kein Fuel
export const JUMP_NORMAL_MAX_RANGE  = 1;       // Normaler Sprung: 1 Sektor

// Hyperjump-AP: Basis und Reduktion pro Engine-Speed-Stufe
export const HYPERJUMP_BASE_AP          = 5;   // Basis (kein Drive)
export const HYPERJUMP_AP_PER_SPEED     = 1;   // −1 AP pro Speed-Stufe
export const HYPERJUMP_MIN_AP           = 1;   // Minimum (Void Drive)

// Hyperjump-Fuel-Skalierung
export const HYPERJUMP_FUEL_DIST_FACTOR = 0.1; // +10 % pro Sektor über 1
export const HYPERJUMP_FUEL_MAX_FACTOR  = 2.0; // Cap bei 200 % (10+ Sektoren)

// Engine-Speed-Mapping
export const ENGINE_SPEED: Record<string, number> = {
  none:       1,
  drive_mk1:  2,
  drive_mk2:  3,
  drive_mk3:  4,
  void_drive: 5,
};

// Bekannte-Route-Rabatt
export const KNOWN_ROUTE_AP_DISCOUNT = 0.8;    // −20 % AP für Handelsrouten
```

### 7.2 Neue Typen (`packages/shared/src/types.ts`)

```typescript
export type JumpType = 'normal' | 'hyperjump';

export interface JumpRequest {
  targetX: number;
  targetY: number;
  jumpType: JumpType;
}

export interface JumpResult {
  success: boolean;
  error?: 'BLACK_HOLE_BLOCKED' | 'NEBULA_BLOCKS_HYPERJUMP' | 'INSUFFICIENT_FUEL'
        | 'OUT_OF_RANGE' | 'UNKNOWN_SECTOR' | 'UNKNOWN_JUMP_TYPE';
  apCost?: number;
  fuelCost?: number;
  newPosition?: { x: number; y: number };
}

// Erweiterung HullDefinition
export interface HullDefinition {
  // ... bestehende Felder
  baseEngineSpeed: number;    // Basis-Engine-Speed ohne Modul
}
```

### 7.3 Hilfsfunktion (`packages/shared/src/utils/jumpCalc.ts`)

```typescript
export function calcHyperjumpAP(engineSpeed: number): number {
  return Math.max(
    HYPERJUMP_MIN_AP,
    HYPERJUMP_BASE_AP - (engineSpeed - 1) * HYPERJUMP_AP_PER_SPEED
  );
}

export function calcHyperjumpFuel(fuelPerJump: number, distance: number): number {
  const factor = Math.min(
    HYPERJUMP_FUEL_MAX_FACTOR,
    1.0 + (distance - 1) * HYPERJUMP_FUEL_DIST_FACTOR
  );
  return Math.ceil(fuelPerJump * factor);
}

export function getEngineSpeed(equippedModuleId: string | null): number {
  return ENGINE_SPEED[equippedModuleId ?? 'none'] ?? 1;
}
```

### 7.4 Server-Handler (`packages/server/src/rooms/SectorRoom.ts`)

```typescript
async handleJump(client: Client, data: JumpRequest) {
  const { targetX, targetY, jumpType } = data;
  const player = this.state.players.get(client.sessionId);
  const target = await getSectorData(targetX, targetY);

  // Schwarzes Loch gesperrt (beide Sprungtypen)
  if (target.environment === 'black_hole') {
    return send(client, 'jumpResult', { success: false, error: 'BLACK_HOLE_BLOCKED' });
  }

  if (jumpType === 'normal') {
    // Normaler Sprung: nur 1 Sektor, 1 AP, kein Fuel
    const distance = chebyshevDistance(player.x, player.y, targetX, targetY);
    if (distance > JUMP_NORMAL_MAX_RANGE) {
      return send(client, 'jumpResult', { success: false, error: 'OUT_OF_RANGE' });
    }
    await deductAP(player, JUMP_NORMAL_AP_COST);
    // Kein Fuel-Abzug
    await movePlayer(player, targetX, targetY);
    return send(client, 'jumpResult', { success: true, apCost: 1, fuelCost: 0, ... });
  }

  if (jumpType === 'hyperjump') {
    // Hyperjump: Route muss bekannt sein
    if (!isKnown(player, targetX, targetY)) {
      return send(client, 'jumpResult', { success: false, error: 'UNKNOWN_SECTOR' });
    }
    // Nebel prüfen
    if (target.environment === 'nebula') {
      return send(client, 'jumpResult', { success: false, error: 'NEBULA_BLOCKS_HYPERJUMP' });
    }
    const route = findRoute(player, targetX, targetY);
    if (route.some(s => s.environment === 'nebula')) {
      return send(client, 'jumpResult', { success: false, error: 'NEBULA_BLOCKS_HYPERJUMP' });
    }
    // Fuel-Check
    const engineSpeed = getEngineSpeed(player.driveModule);
    const distance = route.length;
    const fuelCost = calcHyperjumpFuel(player.fuelPerJump, distance);
    const piratePenalty = route.some(s => s.contents.includes('pirate_zone'))
      ? HYPERJUMP_PIRATE_FUEL_PENALTY : 1.0;
    const totalFuel = Math.ceil(fuelCost * piratePenalty);

    if (player.fuel < totalFuel) {
      return send(client, 'jumpResult', { success: false, error: 'INSUFFICIENT_FUEL' });
    }
    const apCost = calcHyperjumpAP(engineSpeed);
    await deductAP(player, apCost);
    await deductFuel(player, totalFuel);
    await movePlayer(player, targetX, targetY);
    return send(client, 'jumpResult', { success: true, apCost, fuelCost: totalFuel, ... });
  }
}
```

### 7.5 Hull-Definitionen — Engine-Speed Basis

```typescript
// Erweiterung in constants.ts
export const HULLS: Record<HullType, HullDefinition> = {
  scout:      { ..., baseEngineSpeed: 2, fuelMax: 100, fuelPerJump: 4 },
  freighter:  { ..., baseEngineSpeed: 1, fuelMax: 200, fuelPerJump: 6 },
  cruiser:    { ..., baseEngineSpeed: 2, fuelMax: 150, fuelPerJump: 5 },
  explorer:   { ..., baseEngineSpeed: 2, fuelMax: 180, fuelPerJump: 3 },
  battleship: { ..., baseEngineSpeed: 1, fuelMax: 120, fuelPerJump: 7 },
};
```

---

## 8. Balance-Überlegungen

### 8.1 AP-Effizienz Vergleich

| Strecke   | Normaler Sprung | Hyperjump MK.I | Hyperjump MK.III |
|-----------|-----------------|----------------|------------------|
| 1 Sektor  | 1 AP, 0 Fuel    | 4 AP, 4 Fuel   | 2 AP, 2 Fuel     |
| 5 Sektoren| 5 AP, 0 Fuel    | 4 AP, 6 Fuel   | 2 AP, 3 Fuel     |
| 10 Sektoren| 10 AP, 0 Fuel  | 4 AP, 8 Fuel   | 2 AP, 4 Fuel     |

> **Fazit:** Normaler Sprung ist für Kurzstrecke besser; Hyperjump ist effizienter ab ~4 Sektoren
> (wenn Fuel vorhanden) und erspart Echtzeit beim Spielen langer Routen.

### 8.2 Fuel-Knappheit als strategisches Element

```
  Strategische Frage:
  „Spare ich Fuel und reise langsamer mit normalen Sprüngen,
  oder nutze ich Hyperjumps und muss öfter tanken?"

  → Gibt Spielern mehr Entscheidungstiefe bei der Routenplanung.
  → Leerer Raum (kein Fuel) = normaler Sprung weiterhin möglich
    → kein harter Softlock-Zustand.
```

---

## 9. Phasen-Plan

### Phase 1 — Konstanten & Typen (0.5 Tage)

- [ ] `JumpType`, `JumpRequest`, `JumpResult` in `types.ts`
- [ ] Neue AP/Fuel-Konstanten in `constants.ts`
- [ ] `ENGINE_SPEED` Mapping
- [ ] `calcHyperjumpAP()` + `calcHyperjumpFuel()` Hilfsfunktionen
- [ ] Tests: Formel-Korrektheit

### Phase 2 — Server-Handler (1 Tag)

- [ ] `handleJump()` splitten in normal + hyperjump
- [ ] Nebel-Block-Prüfung für Hyperjump (Route-Scan)
- [ ] Fuel: nur bei Hyperjump abziehen
- [ ] Engine-Speed aus Modul-Slot berechnen
- [ ] Tests: alle Fehler-Cases, Fuel-Berechnung

### Phase 3 — UI (1 Tag)

- [ ] Navigations-Panel: normale vs. Hyperjump-Option anzeigen
- [ ] Fuel-Warnung: Hyperjump gesperrt bei Leer-Fuel
- [ ] Nebel-Warnung: NEBULA_BLOCKS_HYPERJUMP Meldung
- [ ] Engine-Speed-Anzeige im Schiffs-Status
- [ ] Tests: Client-Komponenten

### Phase 4 — Balance & Tests (0.5 Tage)

- [ ] Balance-Pass: AP/Fuel-Werte prüfen
- [ ] Integration mit Auto-Pilot: Hyperjump bevorzugen wenn möglich
- [ ] Alle Tests grün

---

*Dokument-Ende — voidSector Issue #68 / Sektion 4: Action Points & Sprung-Mechanik*
