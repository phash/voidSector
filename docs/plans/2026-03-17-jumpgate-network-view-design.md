# Jumpgate-Netzplan UI — Design Spec

**Datum:** 2026-03-17
**Issue:** #467 (Jumpgate und Station)

## Ziel

S-Bahn-artiger Netzplan der verbundenen Jumpgates im Hauptmonitor (Sec 2). Ersetzt temporär die Radar-Ansicht. Spieler klickt auf Knoten, sieht Kosten, entscheidet ob er fliegt.

## Trigger

- Spieler ist in einem Sektor mit Player-Jumpgate
- Detail-Panel (Sec 3) zeigt `[NETZPLAN]` Button neben der bestehenden Gate-Info
- Klick → Hauptmonitor wechselt zur Netzplan-Ansicht

## Layout: Sternförmiger Netzplan

- **SVG** im Hauptmonitor, füllt den verfügbaren Platz
- **Aktuelles Gate** in der Mitte, amber/gold, gefüllt, Label "YOU"
- **Direkte Verbindungen** (1 Hop) als solide Linien
- **Indirekte Verbindungen** (2+ Hops) als gestrichelte Linien
- **Farben** pro Gate-Kette (bestehende `JUMPGATE_CHAIN_COLORS`)
- **Knoten** zeigen Sektor-Koordinaten, Besitzer-Name optional
- **Anordnung**: Direkte Nachbarn näher am Zentrum, weiter entfernte Knoten am Rand
  - Position basiert auf relativen Sektor-Koordinaten (normalisiert auf den verfügbaren Platz)

## Interaktion

1. **Klick auf Knoten** → Knoten leuchtet auf (gefüllter Kreis)
2. **Info-Leiste** am unteren Rand der SVG zeigt:
   - Gate-Name/Besitzer + Koordinaten
   - Route: X Hops
   - Kosten: Y FUEL · Z CR Maut
   - `[SPRINGEN]` Button + `[ZURÜCK]` Button
3. **[SPRINGEN]** → ruft `network.sendUsePlayerGate(gateId, destinationGateId)` auf
4. **[ZURÜCK]** oder ESC → zurück zum normalen NAV-COM/Radar
5. **Kein Knoten selektiert** → Info-Leiste zeigt "Klicke ein Gate zum Reisen"

## Datenquelle

- `playerGateInfo.destinations: JumpGateDestination[]` — bereits vom Server via BFS berechnet
  - Enthält: `gateId`, `sectorX`, `sectorY`, `totalCost` (Credits), `hops`
- `playerGateInfo.gate: PlayerJumpGate` — aktuelles Gate mit `linkedGates[]`
- Fuel-Kosten: `hops × JUMPGATE_FUEL_PER_HOP` (10 Fuel pro Hop)
- Linien zwischen direkt verlinkten Gates: `gate.linkedGates` Array

## Neue Dateien

| Datei | Zweck |
|-------|-------|
| `packages/client/src/components/JumpGateNetworkView.tsx` | SVG-Netzplan-Komponente |

## Modifizierte Dateien

| Datei | Änderung |
|-------|----------|
| `packages/client/src/components/PlayerGatePanel.tsx` | `[NETZPLAN]` Button hinzufügen |
| `packages/client/src/components/CockpitLayout.tsx` | Netzplan-Modus im Hauptmonitor rendern |
| `packages/client/src/state/gameSlice.ts` | `gateNetworkOpen: boolean` State |

## Zustandssteuerung

- Neuer Zustand: `gateNetworkOpen: boolean` (default: false)
- `[NETZPLAN]` Button → `setGateNetworkOpen(true)`
- `[ZURÜCK]` / ESC / SPRINGEN → `setGateNetworkOpen(false)`
- `CockpitLayout`: wenn `gateNetworkOpen && playerGateInfo` → zeige `<JumpGateNetworkView />` statt Radar

## Knotenpositionierung (Algorithmus)

1. Aktuelles Gate = Zentrum (cx, cy) des SVG
2. Für jedes Ziel: Winkel basierend auf relativem Sektor-Vektor `atan2(dy, dx)`
3. Radius basierend auf Hop-Anzahl: 1 Hop = 30% des Radius, 2 Hops = 60%, 3+ = 85%
4. Kollisionsvermeidung: wenn zwei Knoten zu nah, leicht verschieben

## CRT-Ästhetik

- Dunkler Hintergrund (#0a0a0a)
- Amber/CRT-Schriftart für Labels (var(--font-mono))
- Subtiles Glow auf Linien (filter: drop-shadow)
- Konsistent mit dem restlichen Terminal-Look
