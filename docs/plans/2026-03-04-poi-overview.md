# Points of Interest (POI) — Systemübersicht

**Stand:** 2026-03-04
**Branch:** `claude/poi-design-documents-DHxCE`
**Bezug:** POI-System — Gesamtüberblick und Verteilungslogik
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick & Designziele

Points of Interest (POI) sind besondere Sektoren oder Sektor-Inhalte, die über das normale
Ressourcen-Abbauen hinausgehen. Sie bieten Erkundungstiefe, Minigames, Quests und seltene
Belohnungen.

### Kernziele

1. **Erkundungsanreiz:** Spieler sollen das Universum aktiv erkunden wollen
2. **Risiko/Belohnungs-Balance:** Schwierigere POIs = bessere Rewards
3. **Vielfalt:** Verschiedene Spielstile (Kämpfer, Händler, Forscher) werden bedient
4. **Seltenheit:** POIs bleiben besonders durch kontrollierte Häufigkeit
5. **Integration:** Neues System baut auf bestehendem Faction/Quest/Building-System auf

---

## 2. POI-Kategorien

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                    POI-KATEGORIEN                               │
  │                                                                 │
  │  Kategorie            Symbol  Typ          Häufigkeit           │
  │  ─────────────────────────────────────────────────────────────  │
  │  Alien Außenposten    ⊛       permanent    ★☆☆☆☆ sehr selten   │
  │  Alien Raumschiff     ≋       temporär     ★★☆☆☆ selten        │
  │  JumpGate (Alien)     ⊕       permanent    ★☆☆☆☆ sehr selten   │
  │  JumpGate (Spieler)   ⊗       permanent    ★★★☆☆ (baubar)      │
  │  Wormhole             ∞       variabel     ★★☆☆☆ selten        │
  │  NPC Außenposten      ◈       perm./temp.  ★★★☆☆ mittel        │
  │  NPC Raumschiff       ◁       temporär     ★★★★☆ häufig        │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 3. Verteilungslogik

### 3.1 Zonen-Konzept

Das Universum ist in Zonen mit unterschiedlicher POI-Dichte aufgeteilt:

```
  ╔══════════════════════════════════════════════════════════════╗
  ║  UNIVERSUM — ZONEN-KARTE (schematisch)                      ║
  ║                                                              ║
  ║   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·       ║
  ║  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·      ║
  ║   ·  ·  ·  ·  LEERER RAUM (Zone 0)  ·  ·  ·  ·  ·  ·       ║
  ║  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·      ║
  ║   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·       ║
  ║                                                              ║
  ║   · · ·  ╔══════════════╗  · · ·  ╔══════════════╗  · · ·   ║
  ║   · · ·  ║   CLUSTER A  ║  · · ·  ║   CLUSTER B  ║  · · ·   ║
  ║   · · ·  ║ (Spieler-    ║  · · ·  ║ (Spieler-    ║  · · ·   ║
  ║   · · ·  ║  Spawn-Zone) ║  · · ·  ║  Spawn-Zone) ║  · · ·   ║
  ║   · · ·  ╚══════════════╝  · · ·  ╚══════════════╝  · · ·   ║
  ║                                                              ║
  ║  Zone 0 (Leerer Raum): sehr wenige POIs                     ║
  ║  Zone 1 (Cluster-Umgebung ~500 Sektoren): mittlere POI-     ║
  ║          Dichte, NPC-Schiffe & Außenposten häufiger         ║
  ║  Zone 2 (Cluster-Kern ~100 Sektoren): höchste NPC-Dichte,  ║
  ║          Alien-POIs ausgeschlossen (Anfänger-Schutz)        ║
  ╚══════════════════════════════════════════════════════════════╝
```

### 3.2 Spawn-Wahrscheinlichkeiten (pro Sektor, deterministisch)

| POI-Typ                | Leerer Raum | Cluster-Umgebung | Cluster-Kern |
|------------------------|-------------|------------------|--------------|
| Alien Außenposten      | 0.05 %      | 0.10 %           | 0.00 %       |
| Alien Raumschiff       | 0.10 %      | 0.25 %           | 0.00 %       |
| JumpGate (Alien)       | 0.08 %      | 0.15 %           | 0.00 %       |
| JumpGate (Spieler)     | —           | —                | —            |
| Wormhole               | 0.15 %      | 0.30 %           | 0.05 %       |
| NPC Außenposten (perm.)| 0.20 %      | 0.50 %           | 1.00 %       |
| NPC Außenposten (temp.)| 0.30 %      | 0.80 %           | 2.00 %       |
| NPC Raumschiff         | 0.50 %      | 2.00 %           | 5.00 %       |

> **Hinweis:** Temporäre POIs werden täglich/stündlich neu gewürfelt (Zeit-basierter Seed).
> Permanente POIs sind rein koordinaten-basiert deterministisch (unveränderlich).

### 3.3 Cluster-Erkennung

Spieler-Cluster werden bei Spawn in einem Radius von 10.000.000 Koordinaten-Einheiten
platziert (bestehend). Die Cluster-Zone für POI-Häufigkeit:

```typescript
// Pseudo-Code
function getPoiZone(sectorX: number, sectorY: number): 'deep_space' | 'cluster_vicinity' | 'cluster_core' {
  // Prüfe Nähe zu bekannten Cluster-Mittelpunkten
  const dist = nearestClusterDistance(sectorX, sectorY);
  if (dist > 500) return 'deep_space';
  if (dist > 100) return 'cluster_vicinity';
  return 'cluster_core';
}
```

---

## 4. POI-Encounter-Mechanik

### 4.1 Entdeckung

POIs sind unsichtbar bis gescannt. Bei Standard-Scan (Radius 1) erscheinen sie als
besondere Marker. Ein Tiefen-Scan (2 AP extra) zeigt Details:

```
  ╔══ SCAN-ERGEBNIS ════════════════════════════════════╗
  ║                                                     ║
  ║  SEKTOR [1234:5678]  Typ: LEER                      ║
  ║  ─────────────────────────────────────────────────  ║
  ║                                                     ║
  ║  ► POI ERKANNT: ANOMALES OBJEKT                     ║
  ║    Kategorie:   NPC RAUMSCHIFF                      ║
  ║    Fraktion:    HÄNDLER (INDEPENDENT)               ║
  ║    Status:      WARTEND / HANDELSWILLIG             ║
  ║    Bedrohung:   KEINE                               ║
  ║                                                     ║
  ║  [ANFLUG] [SCAN VERTIEFEN] [IGNORIEREN]             ║
  ╚═════════════════════════════════════════════════════╝
```

### 4.2 Interaktion

Beim Betreten eines POI-Sektors wird automatisch ein Encounter ausgelöst:

```
  ╔══ POI-ENCOUNTER ════════════════════════════════════╗
  ║                                                     ║
  ║  ≋  ALIEN-RAUMSCHIFF ERKANNT                        ║
  ║  ─────────────────────────────────────────────────  ║
  ║                                                     ║
  ║  Ein unbekanntes Raumschiff nähert sich.            ║
  ║  Alien-Technologie: NICHT IDENTIFIZIERBAR           ║
  ║  Größe: MITTEL  |  Zustand: GUT                     ║
  ║                                                     ║
  ║  Alien-Repräsentant sendet Signal...                ║
  ║                                                     ║
  ║  [KOMMUNIZIEREN] [SCANNEN] [KAMPF] [FLIEHEN]        ║
  ╚═════════════════════════════════════════════════════╝
```

### 4.3 Belohnungs-Typen

| Typ         | Beschreibung                                   | Quellen                              |
|-------------|------------------------------------------------|--------------------------------------|
| Credits     | Standard-Währung                               | Alle POI-Typen                       |
| Ressourcen  | Ore / Gas / Crystal (direkt ins Cargo)         | Alien-Schiffe, NPC-Außenposten       |
| Artefakte   | Seltene Items (Daten-Slate-Erweiterungen)      | Alien-POIs, Anomalien, Wormholes     |
| Reputation  | +/- bei NPC-Fraktionen (-100..+100)            | Quests, Kämpfe, Kommunikation        |
| Baupläne    | Freischalten neuer Bauoptionen                 | Alien Außenposten (Forschung)        |
| JumpGate-   | Upgrades für eigene JumpGates                  | Alien JumpGates (Erforschung)        |
| Codes       | Zugangs-Codes für gesperrte JumpGates          | Pirate-Außenposten, Quest-Belohnungen|

---

## 5. POI-Typen — Kurzübersicht

| Dokument                               | Inhalt                                     |
|----------------------------------------|--------------------------------------------|
| `2026-03-04-poi-alien-zones.md`        | Alien Außenposten & Alien Raumschiffe       |
| `2026-03-04-poi-jumpgates-extended.md` | JumpGates (AlienTech + Spieler-gebaut)     |
| `2026-03-04-poi-wormholes.md`          | Wormhole-System (perm./temp./Einbahn)      |
| `2026-03-04-poi-npc-encounters.md`     | NPC-Schiffe & NPC-Außenposten              |
| `2026-03-04-poi-minigames-rewards.md`  | Minigame-Designs & Belohnungstabellen      |

---

## 6. Neue Typen & Konstanten (Überblick)

### 6.1 `packages/shared/src/types.ts` — Neue Typen

```typescript
// POI-Kategorien
export type PoiType =
  | 'alien_outpost'         // Alien-Außenposten (permanent)
  | 'alien_ship'            // Alien-Raumschiff (temporär)
  | 'jumpgate_alien'        // JumpGate (AlienTech, permanent)
  | 'jumpgate_player'       // JumpGate (Spieler-gebaut, permanent)
  | 'wormhole'              // Wurmloch (variabel)
  | 'npc_outpost_permanent' // NPC-Außenposten (permanent)
  | 'npc_outpost_temp'      // NPC-Außenposten (temporär)
  | 'npc_ship';             // NPC-Raumschiff (temporär)

// Artefakt-Item
export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  effect?: ArtifactEffect;
  sourcePoiType: PoiType;
}

export type ArtifactType =
  | 'alien_data_core'        // Aliens: Bauplan-Fragmente
  | 'navigation_crystal'     // JumpGate: Reichweiten-Upgrade
  | 'wormhole_stabilizer'    // Wormhole: Permanenz-Verlängerung
  | 'ancient_weapon'         // Kampf-Bonus
  | 'resonance_fragment'     // Minigame-Hilfe (erhöht Toleranz)
  | 'faction_emblem';        // Reputations-Boost (Fraktion)

// POI-Interact-Ergebnis
export interface PoiInteractResult {
  success: boolean;
  rewards?: {
    credits?: number;
    resources?: { ore?: number; gas?: number; crystal?: number };
    artifacts?: Artifact[];
    reputation?: { factionId: NpcFactionId; delta: number }[];
    blueprint?: string;
  };
  questUnlocked?: string;
  error?: string;
}
```

### 6.2 `packages/shared/src/constants.ts` — Neue Konstanten

```typescript
// POI Spawn-Chancen (leerer Raum)
export const POI_CHANCE_ALIEN_OUTPOST    = 0.0005;  // 0.05 %
export const POI_CHANCE_ALIEN_SHIP       = 0.0010;  // 0.10 %
export const POI_CHANCE_JUMPGATE_ALIEN   = 0.0008;  // 0.08 %
export const POI_CHANCE_WORMHOLE         = 0.0015;  // 0.15 %
export const POI_CHANCE_NPC_OUTPOST_PERM = 0.0020;  // 0.20 %
export const POI_CHANCE_NPC_OUTPOST_TEMP = 0.0030;  // 0.30 %
export const POI_CHANCE_NPC_SHIP         = 0.0050;  // 0.50 %

// Multiplikatoren für Cluster-Nähe
export const POI_CLUSTER_VICINITY_MULT   = 3.0;     // ×3 in Cluster-Umgebung
export const POI_CLUSTER_CORE_MULT       = 0.0;     // ×0 (keine Aliens im Kern)
export const POI_CLUSTER_NPC_CORE_MULT   = 10.0;    // ×10 für NPC-Ships im Kern

// Artefakt-Raritäts-Chancen
export const ARTIFACT_RARITY_COMMON    = 0.50;
export const ARTIFACT_RARITY_UNCOMMON  = 0.30;
export const ARTIFACT_RARITY_RARE      = 0.15;
export const ARTIFACT_RARITY_LEGENDARY = 0.05;

// Radar-Symbole für POIs
export const POI_SYMBOLS: Record<PoiType, string> = {
  alien_outpost:         '⊛',
  alien_ship:            '≋',
  jumpgate_alien:        '⊕',
  jumpgate_player:       '⊗',
  wormhole:              '∞',
  npc_outpost_permanent: '◈',
  npc_outpost_temp:      '◉',
  npc_ship:              '◁',
};

// Radar-Farben für POIs
export const POI_COLORS: Record<PoiType, string> = {
  alien_outpost:         '#AA00FF',  // Violett
  alien_ship:            '#CC44FF',  // Helles Violett
  jumpgate_alien:        '#FF6600',  // Orange
  jumpgate_player:       '#FFAA00',  // Amber-Orange
  wormhole:              '#00FFCC',  // Cyan-Grün
  npc_outpost_permanent: '#00FF88',  // Grün
  npc_outpost_temp:      '#88FF88',  // Helles Grün
  npc_ship:              '#AAFFAA',  // Sehr helles Grün
};
```

---

## 7. Phasen-Plan (Gesamtsystem)

### Phase 1 — Typen & Grundstruktur (1 Tag)

- [ ] `PoiType`, `Artifact`, `ArtifactType`, `PoiInteractResult` in `types.ts`
- [ ] POI-Konstanten in `constants.ts`
- [ ] `poi_events`-DB-Tabelle (temporäre POIs)
- [ ] `artifacts`-DB-Tabelle
- [ ] POI-Radar-Symbole & Farben

### Phase 2 — Deterministische POI-Generierung (2 Tage)

- [ ] `packages/server/src/engine/poigen.ts` — POI-Generator
- [ ] Permanente POIs: seed-basiert (wie JumpGates)
- [ ] Temporäre POIs: zeit-basierter Seed (`Math.floor(Date.now() / POI_REFRESH_INTERVAL)`)
- [ ] Cluster-Distanz-Berechnung für Spawn-Modifikatoren
- [ ] Integration in `worldgen.ts`

### Phase 3 — Alien-System (3 Tage)

- [ ] Alien Außenposten: Interaktions-Handler, Forschungs-Minigame
- [ ] Alien Raumschiffe: Begegnung, Kommunikations-Minigame
- [ ] Artefakt-Generierung & Loot-Tabellen
- [ ] Tests: Alien-Encounter-Logik

### Phase 4 — JumpGate-Erweiterung (2 Tage)

- [ ] Spieler-JumpGates: Bau, Verbinden, Upgrades
- [ ] Alien JumpGates: Erforschung, Frequenz-Minigame-Erweiterung
- [ ] JumpGate-Research-System

### Phase 5 — Wormhole-Überarbeitung (1 Tag)

- [ ] Wormhole-Typen: permanent/temporär/Einbahn
- [ ] Instabilität und Ablauf-Mechanik
- [ ] Wormhole-Daten im Detail-Panel

### Phase 6 — NPC-POIs (2 Tage)

- [ ] NPC-Außenposten: Permanente & temporäre Varianten
- [ ] NPC-Raumschiffe: Begegnung & Handel
- [ ] Integration mit bestehenden NPC-Fraktionen

### Phase 7 — Minigames & Rewards (2 Tage)

- [ ] Neue Minigame-Typen (Dekodierung, Andocken, Signal-Amplifikation)
- [ ] Belohnungstabellen & Balancing
- [ ] Artefakt-Nutzungs-System

---

*Dokument-Ende — voidSector POI-System Übersicht*
