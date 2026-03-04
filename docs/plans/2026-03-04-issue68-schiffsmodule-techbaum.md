# Issue #68 — Schiffsmodule & Tech-Baum: Design-Dokument

**Stand:** 2026-03-04
**Branch:** `claude/design-documents-sections-XnGFr`
**Bezug:** Issue #68 „Änderungen an Spielinhalten" — Sektion 6
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick & Designziele

### Ist-Zustand

Das Modul-System hat 5 Kategorien, 3 Tiers, direkt kaufbar an Stationen:

```typescript
export type ModuleCategory = 'drive' | 'cargo' | 'scanner' | 'armor' | 'special';
export type ModuleTier = 1 | 2 | 3;
```

Jedes Modul hat `effects: Partial<ShipStats>` — **ein** primärer Effekt.
Tier 2 und 3 sind direkt käuflich ohne Voraussetzungen.

### Kernprobleme

1. Kein Unterschied zwischen Primär- und Sekundäreffekten in der Darstellung
2. Höhere Tiers sind ohne Progression freigeschaltet (keine Tech-Tree-Hürde)
3. Alle Module durch Credits kaufbar — Artefakte und seltene Ressourcen spielen keine Rolle
4. Kein Entdeckungs-Gefühl — Module sind immer verfügbar, nicht erforschbar

### Ziele

1. **Primär/Sekundär-Effekte:** Jedes Modul hat einen klaren Haupteffekt und optionale Nebeneffekte
2. **Tech-Baum:** Tier 2 und 3 müssen erforscht/freigeschaltet werden
3. **Ressourcen-Kosten:** Höhere Tiers kosten seltene Ressourcen inkl. Artefakte
4. **Entdeckungs-Mechanismus:** Blaupausen durch Gameplay (Quests, Anomalien, NPC-Handel)
5. **Rückwärtskompatibilität:** Tier 1 bleibt ohne Forschung verfügbar

---

## 2. Modul-Kategorien & Primäreffekte

### 2.1 Überblick — Kategorien

```
  ╔══════════════════════════════════════════════════════════╗
  ║  SCHIFFSMODUL-KATEGORIEN                                ║
  ╠══════════════════════════════════════════════════════════╣
  ║                                                          ║
  ║  ANTRIEB  [drive]   Bewegung, Reichweite, Effizienz     ║
  ║  FRACHT   [cargo]   Ladekapazität, Safe-Slots            ║
  ║  SCANNER  [scanner] Scan-Reichweite, Kommunikation       ║
  ║  PANZER   [armor]   HP, Schadensreduktion                ║
  ║  SCHILD   [shield]  Schild-HP, Regeneration      [NEU]   ║
  ║  WAFFE    [weapon]  Angriffsstärke, Waffentyp    [NEU]   ║
  ║  SPEZIAL  [special] Fraktions-Upgrades, Sonderfunktionen ║
  ║                                                          ║
  ╚══════════════════════════════════════════════════════════╝
```

### 2.2 Modul-Karten mit Primär/Sekundäreffekt

#### Antrieb (Drive) — Tier 1–3

```
  ╔════════════════════════════════════════════════════╗
  ║  MODUL: ION-ANTRIEB MK.I             [drive/T1]  ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║   ╔═══╗  ══════════════ ► Ionenstrahl             ║
  ║   ║ ≡ ║                                            ║
  ║   ╚═══╝  ══════════════ ► Ionenstrahl             ║
  ║                                                    ║
  ║  PRIMÄR:     Sprungweite +1                        ║
  ║  SEKUNDÄR:   Engine-Speed +1                       ║
  ║                                                    ║
  ║  Kaufpreis: 100 CR + 10 Erz                        ║
  ║  Forschung: Nicht erforderlich (Tier 1)            ║
  ╚════════════════════════════════════════════════════╝

  ╔════════════════════════════════════════════════════╗
  ║  MODUL: ION-ANTRIEB MK.II            [drive/T2]  ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║   ╔═══╗  ══════════════════════ ► Ionenstrahl     ║
  ║   ║≡≡≡║  ══════════════════════ ► Ionenstrahl     ║
  ║   ║≡≡≡║  ══════════════════════ ► Ionenstrahl     ║
  ║   ╚═══╝                                            ║
  ║  PRIMÄR:     Sprungweite +2                        ║
  ║  SEKUNDÄR:   Engine-Speed +1, Hyperjump-AP −1      ║
  ║                                                    ║
  ║  Kaufpreis: 300 CR + 20 Erz + 5 Kristall           ║
  ║  Forschung: ION-ANTRIEB MK.I erforscht             ║
  ║  Forschungskosten: 200 CR + 15 Erz                 ║
  ╚════════════════════════════════════════════════════╝

  ╔════════════════════════════════════════════════════╗
  ║  MODUL: ION-ANTRIEB MK.III           [drive/T3]  ║
  ║  ─────────────────────────────────────────────── ║
  ║                                                    ║
  ║   ╔═════╗  ═══════════════════════ ► ████          ║
  ║   ║≡≡≡≡≡║  ═══════════════════════ ► ████          ║
  ║   ║≡≡≡≡≡║  ═══════════════════════ ► ████          ║
  ║   ╚═════╝  PLASMA-BOOST AKTIV                      ║
  ║                                                    ║
  ║  PRIMÄR:     Sprungweite +3                        ║
  ║  SEKUNDÄR:   Engine-Speed +2, Hyperjump-AP −2,     ║
  ║              Fuel/Sprung −1                        ║
  ║                                                    ║
  ║  Kaufpreis: 800 CR + 40 Erz + 15 Kristall          ║
  ║  Forschung: ION-ANTRIEB MK.II erforscht            ║
  ║  Forschungskosten: 500 CR + 30 Erz + 2 Artefakte  ║
  ╚════════════════════════════════════════════════════╝
```

#### Fracht (Cargo) — Tier 1–3

| ID         | Tier | Primär         | Sekundär             | Kauf-Kosten                 | Forschungs-Kosten          |
|------------|------|----------------|----------------------|-----------------------------|----------------------------|
| cargo_mk1  | 1    | Frachtraum +5  | —                    | 80 CR                       | —                          |
| cargo_mk2  | 2    | Frachtraum +12 | Safe-Slot +1         | 250 CR + 15 Erz             | 150 CR + 10 Erz            |
| cargo_mk3  | 3    | Frachtraum +25 | Safe-Slot +2, +10 % Fuel-Tank | 600 CR + 30 Erz + 10 Gas | 400 CR + 25 Erz + 1 Artefakt |

#### Scanner (Scanner) — Tier 1–3

| ID           | Tier | Primär              | Sekundär                         | Kauf-Kosten                   | Forschungs-Kosten             |
|--------------|------|---------------------|----------------------------------|-------------------------------|-------------------------------|
| scanner_mk1  | 1    | Scan-Level +1       | —                                | 120 CR + 5 Kristall           | —                             |
| scanner_mk2  | 2    | Scan-Level +1       | Komm-Reichweite +50              | 350 CR + 15 Kristall          | 200 CR + 10 Kristall          |
| scanner_mk3  | 3    | Scan-Level +2       | Komm-Reichweite +100, Artefakt-Chance +3 % | 900 CR + 30 Krist + 10 Gas | 600 CR + 20 Krist + 3 Artefakte |

#### Panzer (Armor) — Tier 1–3

| ID          | Tier | Primär          | Sekundär                  | Kauf-Kosten                  | Forschungs-Kosten             |
|-------------|------|-----------------|---------------------------|------------------------------|-------------------------------|
| armor_mk1   | 1    | HP +25          | —                         | 100 CR + 15 Erz              | —                             |
| armor_mk2   | 2    | HP +50          | Schadensreduktion −10 %   | 300 CR + 30 Erz + 10 Krist  | 200 CR + 20 Erz               |
| armor_mk3   | 3    | HP +100         | Schadensreduktion −25 %   | 800 CR + 50 Erz + 25 Krist  | 500 CR + 40 Erz + 2 Artefakte |

---

## 3. Tech-Baum — Freischaltungssystem

### 3.1 Konzept

```
  ┌─────────────────────────────────────────────────────────────┐
  │                     TECH-BAUM STRUKTUR                      │
  │                                                             │
  │  TIER 1 ─────────────────────────────── Sofort verfügbar   │
  │  [drive_mk1] [cargo_mk1] [scanner_mk1] [armor_mk1]          │
  │       │            │           │           │                │
  │       ▼            ▼           ▼           ▼                │
  │  TIER 2 ─────────────────────────────── Nach Forschung     │
  │  [drive_mk2] [cargo_mk2] [scanner_mk2] [armor_mk2]          │
  │  [shield_mk1] [weapon_laser_mk1]                            │
  │       │            │           │           │                │
  │       ▼            ▼           ▼           ▼                │
  │  TIER 3 ──────────────────── Nach Forschung + Artefakte    │
  │  [drive_mk3] [cargo_mk3] [scanner_mk3] [armor_mk3]          │
  │  [shield_mk2] [weapon_laser_mk2] [weapon_railgun]           │
  │       │                                                     │
  │       ▼                                                     │
  │  TIER SPEZIAL ──────── Fraktions-spezifisch / Artefakte    │
  │  [void_drive] [quantum_scanner] [nano_armor]                │
  └─────────────────────────────────────────────────────────────┘
```

### 3.2 Forschungs-Mechanismus

Forschung findet an der **Home-Base** statt (Tech-Lab-Gebäude).
Nur ein Projekt gleichzeitig möglich (Queue optional in späteren Phasen).

```
  ╔══ TECH-LAB — UNIVERSITÄT ═══════════════════════════════╗
  ║  [FORSCHUNG: AKTIV]  ETA: 28 Minuten                    ║
  ║  ────────────────────────────────────────────────────  ║
  ║                                                         ║
  ║  Aktuelles Projekt:                                     ║
  ║  ION-ANTRIEB MK.II                                      ║
  ║  Fortschritt: ████████████░░░░░░░░  62 %               ║
  ║                                                         ║
  ║  ── VERFÜGBARE PROJEKTE ────────────────────────────  ║
  ║                                                         ║
  ║  ✓ FRACHT MK.II          [Voraussetzung: Cargo MK.I]   ║
  ║    Kosten: 150 CR + 10 Erz     Dauer: 20 Min           ║
  ║                                                         ║
  ║  ✗ SCANNER MK.III        [Voraussetzung: Scanner MK.II] ║
  ║    Kosten: 600 CR + 20 Krist + 3 Artefakte             ║
  ║    Dauer: 60 Min         GESPERRT: Artefakte 1/3        ║
  ║                                                         ║
  ║  ✗ VOID DRIVE            [Frak: Ancient / Honored+]    ║
  ║    Kosten: 2000 CR + 10 Artefakte  Dauer: 180 Min      ║
  ║    GESPERRT: Fraktion Honored erforderlich              ║
  ║                                                         ║
  ║  [PROJEKT WÄHLEN]                                       ║
  ╚═════════════════════════════════════════════════════════╝
```

### 3.3 Forschungs-Tabelle (vollständig)

| Projekt              | Voraussetzung         | Kosten (Credits + Res.)              | Artefakte | Dauer  |
|----------------------|-----------------------|--------------------------------------|-----------|--------|
| ion_drive_mk2        | drive_mk1 ausgerüstet | 200 CR + 15 Erz                      | 0         | 20 Min |
| ion_drive_mk3        | ion_drive_mk2         | 500 CR + 30 Erz + 10 Krist           | 2         | 45 Min |
| cargo_mk2            | cargo_mk1 ausgerüstet | 150 CR + 10 Erz                      | 0         | 15 Min |
| cargo_mk3            | cargo_mk2             | 400 CR + 25 Erz                      | 1         | 30 Min |
| scanner_mk2          | scanner_mk1           | 200 CR + 10 Krist                    | 0         | 20 Min |
| scanner_mk3          | scanner_mk2           | 600 CR + 20 Krist                    | 3         | 60 Min |
| armor_mk2            | armor_mk1             | 200 CR + 20 Erz                      | 0         | 20 Min |
| armor_mk3            | armor_mk2             | 500 CR + 40 Erz                      | 2         | 45 Min |
| shield_mk1           | armor_mk1 (Tier 1+)   | 300 CR + 15 Krist                    | 0         | 25 Min |
| shield_mk2           | shield_mk1            | 700 CR + 35 Krist + 10 Gas           | 2         | 50 Min |
| shield_mk3           | shield_mk2            | 1500 CR + 70 Krist + 25 Gas          | 0         | 75 Min |
| weapon_laser_mk1     | Kein Vorausset.       | 200 CR + 10 Krist                    | 0         | 20 Min |
| weapon_laser_mk2     | laser_mk1             | 600 CR + 25 Krist + 10 Gas           | 0         | 40 Min |
| weapon_laser_mk3     | laser_mk2             | 1500 CR + 50 Krist + 20 Gas          | 0         | 60 Min |
| weapon_railgun_mk1   | weapon_laser_mk1      | 400 CR + 30 Erz + 15 Krist           | 0         | 35 Min |
| weapon_railgun_mk2   | weapon_railgun_mk1    | 1000 CR + 60 Erz + 30 Krist          | 1         | 60 Min |
| weapon_missile_mk1   | Kein Vorausset.       | 300 CR + 20 Erz + 5 Krist            | 0         | 25 Min |
| weapon_missile_mk2   | weapon_missile_mk1    | 900 CR + 40 Erz + 15 Krist           | 0         | 50 Min |
| weapon_emp           | weapon_laser_mk2      | 600 CR + 20 Krist + 20 Gas           | 2         | 45 Min |
| void_drive           | ion_drive_mk3 + Ancient Honored | 2000 CR + 10 Artefakte    | 10        | 180 Min|
| quantum_scanner      | scanner_mk3           | 1500 CR + 50 Krist                   | 8         | 120 Min|
| nano_armor           | armor_mk3             | 1800 CR + 50 Erz + 50 Krist          | 15        | 150 Min|

---

## 4. Blaupausen-System (Entdeckungs-Mechanismus)

### 4.1 Konzept

Alternativ zur Forschung an der Home-Base können Spieler **Blaupausen**
(Blueprints) finden und freischalten. Blaupausen springen den Forschungs-
aufwand über und schalten das Modul direkt frei.

```
  ╔══ BLAUPAUSE GEFUNDEN ══════════════════════════════════╗
  ║                                                        ║
  ║  !! NEUE BLAUPAUSE !!                                  ║
  ║                                                        ║
  ║  ╔═══════════════════════╗                             ║
  ║  ║ [BP] SCANNER MK.III   ║   Aus Anomalie-Scan        ║
  ║  ║  ──────────────────  ║                             ║
  ║  ║  Schaltkreis-Schema   ║   Seltenheit: SELTEN       ║
  ║  ║  ░░░░░░░░░░░░░░░░░░░  ║                             ║
  ║  ║  ░░ QUANTUM-ARRAY ░░  ║   Sofort freigeschaltet:   ║
  ║  ╚═══════════════════════╝   SCANNER MK.III kaufbar   ║
  ║                                                        ║
  ║  Kaufpreis an Stationen: 900 CR + 30 Krist + 10 Gas   ║
  ║                                                        ║
  ║  [BLAUPAUSE AKTIVIEREN]   [ALS DATA SLATE VERKAUFEN]  ║
  ╚════════════════════════════════════════════════════════╝
```

### 4.2 Blaupausen-Quellen

| Quelle                    | Chance  | Mögliche Blaupausen       |
|---------------------------|---------|---------------------------|
| Anomalie-Scan (Tier 2+)   | 15 %    | T2/T3 Module              |
| Pirate-Beute (high-level) | 8 %     | T2 Waffen-Module          |
| Quest-Belohnung (Tier 3)  | Festgel.| Kategorie-spezifisch      |
| Ancient-Fraktion-Tausch   | 20 %    | Spezial-Module            |
| NPC-Händler (Spezial)     | Festgel.| T1–T2 (teuer, garantiert) |
| Spieler-zu-Spieler-Handel | —       | Alle (p2p)                |

### 4.3 Blaupausen-Inventar

```
  ╔══ BLAUPAUSEN-ARCHIV ════════════════════════════════════╗
  ║                                                         ║
  ║  Freigeschaltet durch Forschung:                        ║
  ║  ✓ ion_drive_mk2    ✓ cargo_mk2    ✓ scanner_mk2        ║
  ║                                                         ║
  ║  Freigeschaltet durch Blaupause:                        ║
  ║  ✓ scanner_mk3  [BP]                                    ║
  ║                                                         ║
  ║  Gesperrt (Forschung offen):                            ║
  ║  ○ ion_drive_mk3   — Erfordert: 500 CR + 2 Artefakte   ║
  ║  ○ armor_mk3       — Erfordert: 500 CR + 2 Artefakte   ║
  ║                                                         ║
  ║  Noch nicht erreichbar:                                 ║
  ║  ◻ quantum_scanner  ◻ void_drive  ◻ nano_armor          ║
  ║                                                         ║
  ╚═════════════════════════════════════════════════════════╝
```

---

## 5. Sekundäreffekte — Vollständige Referenz

Sekundäreffekte sind automatisch aktiv sobald das Modul ausgerüstet ist.
Sie erscheinen in der Modul-Karte als separate Zeile.

| Modul         | Primäreffekt         | Sekundäreffekt                         |
|---------------|----------------------|----------------------------------------|
| drive_mk1     | +1 Sprungweite       | Engine-Speed +1                        |
| drive_mk2     | +2 Sprungweite       | Engine-Speed +1, Hyperjump-AP −1       |
| drive_mk3     | +3 Sprungweite       | Engine-Speed +2, Hyperjump-AP −2, Fuel −1/Sprung |
| cargo_mk2     | +12 Frachtraum       | Safe-Slot +1                           |
| cargo_mk3     | +25 Frachtraum       | Safe-Slot +2, Fuel-Tank +10 %          |
| scanner_mk2   | Scan-Level +1        | Komm-Reichweite +50                    |
| scanner_mk3   | Scan-Level +2        | Komm-Reichweite +100, Artefakt-Chance +3 % |
| armor_mk2     | HP +50               | Schadensreduktion −10 %                |
| armor_mk3     | HP +100              | Schadensreduktion −25 %                |
| shield_mk1    | Schild +30           | Schild-Regen +3/Runde                  |
| shield_mk2    | Schild +60           | Schild-Regen +6/Runde, Schild-Regen nach Kampf |
| shield_mk3    | Schild +100          | Schild-Regen +12/Runde, EMP-Resistenz  |
| laser_mk2     | ATK +16              | Genauigkeit +10 %, krit. Treffer +5 %  |
| railgun_mk1   | ATK +12              | Panzerbrechend 30 %, Genauigkeit −5 %  |
| quantum_scann | Scan-Level +3        | Alle Sektoren in 3-Radius auto-gescannt|
| void_drive    | +6 Sprungweite       | Hyperjump kostet 1 AP, Fuel −3/Sprung  |
| nano_armor    | HP +150              | Schadensreduktion −35 %, Regen HP +2/Min|

---

## 6. CRT-Modul-Darstellung

### 6.1 Ausgerüstetes Modul mit Primär/Sekundär

```
  ╔══ MODUL: ION-ANTRIEB MK.II ═══════════════════════════╗
  ║  Kategorie: ANTRIEB  |  Tier: 2  |  Slot: 1           ║
  ║  ──────────────────────────────────────────────────  ║
  ║                                                        ║
  ║  ╔═══╗  ══════════════════════ ► Ionenstrahl           ║
  ║  ║≡≡≡║  ══════════════════════ ► Ionenstrahl           ║
  ║  ║≡≡≡║  ══════════════════════ ► Ionenstrahl           ║
  ║  ╚═══╝                                                 ║
  ║                                                        ║
  ║  PRIMÄR:   ► Sprungweite      +2  [7 → 9 Sektoren]    ║
  ║  SEKUNDÄR: ► Engine-Speed     +1  [2 → 3]             ║
  ║            ► Hyperjump-AP     −1  [5 → 4 AP]          ║
  ║                                                        ║
  ║  Status:   INSTALLIERT  |  Kaufpreis: 300 CR          ║
  ║  Freigeschaltet: 14.02.2026 (Forschung)                ║
  ║                                                        ║
  ║  [AUSRÜSTEN]    [ENTFERNEN]    [INFO]                  ║
  ╚════════════════════════════════════════════════════════╝
```

### 6.2 Gesperrtes Modul (Research benötigt)

```
  ╔══ MODUL: ION-ANTRIEB MK.III  [GESPERRT] ══════════════╗
  ║  Kategorie: ANTRIEB  |  Tier: 3                       ║
  ║  ──────────────────────────────────────────────────  ║
  ║                                                        ║
  ║  ████████████████████████████████ [GESPERRT]           ║
  ║  ██ Modul wird nach Erforschung verfügbar ██           ║
  ║  ████████████████████████████████                      ║
  ║                                                        ║
  ║  Voraussetzung: ION-ANTRIEB MK.II (erforscht ✓)        ║
  ║                                                        ║
  ║  Forschungskosten:                                     ║
  ║  ► 500 CR   [✓ 1240 vorhanden]                         ║
  ║  ► 30 Erz   [✓ 67 vorhanden]                           ║
  ║  ► 2 Artefakte [✗ nur 1 vorhanden]                    ║
  ║                                                        ║
  ║  Forschungsdauer: 45 Minuten                           ║
  ║                                                        ║
  ║  [FORSCHUNG STARTEN — GESPERRT (Artefakte fehlen)]    ║
  ╚════════════════════════════════════════════════════════╝
```

---

## 7. Technische Implementierung

### 7.1 Erweiterte Typen (`packages/shared/src/types.ts`)

```typescript
// Sekundäreffekte als eigenes Feld
export interface ModuleDefinition {
  id: string;
  category: ModuleCategory;
  tier: ModuleTier;
  name: string;
  displayName: string;
  primaryEffect: { stat: keyof ShipStats; delta: number; label: string };
  secondaryEffects: Array<{ stat: keyof ShipStats | string; delta: number; label: string }>;
  effects: Partial<ShipStats>;          // kombiniert, wie bisher
  cost: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number };
  researchCost?: { credits: number; ore?: number; gas?: number; crystal?: number; artefact?: number };
  researchDurationMin?: number;         // Forschungsdauer in Minuten
  prerequisite?: string;                // ID des Vorgänger-Moduls
  factionRequirement?: string;          // Fraktions-ID (optional)
}

// Tech-Baum-Zustand
export interface ResearchState {
  unlockedModules: string[];    // IDs freigeschalteter Module
  blueprints: string[];         // durch Blaupause freigeschaltet
  activeResearch: {
    moduleId: string;
    startedAt: number;
    completesAt: number;
  } | null;
}

// Erweiterte ShipStats
export interface ShipStats {
  fuelMax: number;
  cargoCap: number;
  jumpRange: number;
  apCostJump: number;
  fuelPerJump: number;
  hp: number;
  commRange: number;
  scannerLevel: number;
  damageMod: number;
  engineSpeed: number;           // NEU: für Hyperjump-AP-Berechnung
  artefactChanceBonus: number;   // NEU: % Bonus Artefakt-Fund
  safeSlotBonus: number;         // NEU: zusätzliche Safe-Slots
}
```

### 7.2 Konstanten-Erweiterung (`packages/shared/src/constants.ts`)

```typescript
// Erweiterte MODULES-Einträge (Beispiel drive_mk2)
export const MODULES: Record<string, ModuleDefinition> = {
  drive_mk2: {
    id: 'drive_mk2',
    category: 'drive',
    tier: 2,
    name: 'ION DRIVE MK.II',
    displayName: 'ION MK.II',
    primaryEffect:    { stat: 'jumpRange',  delta: 2,    label: 'Sprungweite +2' },
    secondaryEffects: [
      { stat: 'engineSpeed', delta: 1,    label: 'Engine-Speed +1' },
      { stat: 'apCostJump',  delta: -1,   label: 'Hyperjump-AP −1' },
    ],
    effects:        { jumpRange: 2, apCostJump: -0.2 },  // Legacy
    cost:           { credits: 300, ore: 20, crystal: 5 },
    researchCost:   { credits: 200, ore: 15 },
    researchDurationMin: 20,
    prerequisite:   'drive_mk1',
  },
  drive_mk3: {
    id: 'drive_mk3',
    // ...
    researchCost:   { credits: 500, ore: 30, crystal: 10, artefact: 2 },
    researchDurationMin: 45,
    prerequisite:   'drive_mk2',
  },
  // ... alle weiteren Module
};

// Forschungs-Grundwerte
export const RESEARCH_TICK_MS = 60_000;     // 1 Tick = 1 Minute
```

### 7.3 DB-Schema (`packages/server/src/db/migrations/012_research.sql`)

```sql
-- Tech-Baum-Zustand pro Spieler
CREATE TABLE IF NOT EXISTS player_research (
  user_id          INTEGER NOT NULL REFERENCES users(id) PRIMARY KEY,
  unlocked_modules TEXT[]  NOT NULL DEFAULT '{}',
  blueprints       TEXT[]  NOT NULL DEFAULT '{}'
);

-- Aktive Forschung
CREATE TABLE IF NOT EXISTS active_research (
  user_id       INTEGER NOT NULL REFERENCES users(id) PRIMARY KEY,
  module_id     TEXT    NOT NULL,
  started_at    BIGINT  NOT NULL,
  completes_at  BIGINT  NOT NULL
);
```

### 7.4 Server-Handler

Neue Message-Handler in `SectorRoom.ts`:

```typescript
'startResearch'     → handleStartResearch(client, { moduleId })
'cancelResearch'    → handleCancelResearch(client)
'claimResearch'     → handleClaimResearch(client)    // nach Timer-Ablauf
'activateBlueprint' → handleActivateBlueprint(client, { moduleId })
```

Neue DB-Queries:

```typescript
getPlayerResearch(userId): Promise<ResearchState>
startResearch(userId, moduleId, cost): Promise<void>
completeResearch(userId, moduleId): Promise<void>
unlockBlueprint(userId, moduleId): Promise<void>
```

---

## 8. Phasen-Plan

### Phase 1 — Datenmodell (1 Tag)

- [ ] `ModuleDefinition` um `primaryEffect`, `secondaryEffects`, `researchCost` erweitern
- [ ] `ShipStats` um `engineSpeed`, `artefactChanceBonus`, `safeSlotBonus` erweitern
- [ ] `ResearchState`-Typ anlegen
- [ ] Alle bestehenden `MODULES`-Einträge migrieren (Primär/Sekundär)
- [ ] Tests: `calculateShipStats()` mit neuen Feldern

### Phase 2 — Research-Engine (1.5 Tage)

- [ ] Migration 012 (DB-Schema)
- [ ] `startResearch`, `claimResearch`, `cancelResearch` Handler
- [ ] Artefakt-Abzug bei Forschungs-Kosten
- [ ] Voraussetzungs-Prüfung (prerequisite + factionRequirement)
- [ ] `unlockBlueprint` Handler
- [ ] Tests: Forschungs-Flow, Artefakt-Kosten, Voraussetzungen

### Phase 3 — UI (1 Tag)

- [ ] Tech-Baum-Panel (`TechTreePanel.tsx`)
- [ ] Modul-Karte mit Primär/Sekundär-Effekt-Darstellung
- [ ] Forschungs-Fortschritt-Anzeige
- [ ] Gesperrte Module mit Anforderungs-Anzeige
- [ ] Blaupausen-Archiv-Ansicht
- [ ] Tests: Komponenten

### Phase 4 — Balance (0.5 Tage)

- [ ] Forschungszeiten und Kosten-Balancing
- [ ] Artefakt-Verteilung prüfen (genug Quellen für T3-Forschung)
- [ ] Alle Tests grün (Ziel: 310+ Tests)

---

*Dokument-Ende — voidSector Issue #68 / Sektion 6: Schiffsmodule & Tech-Baum*
