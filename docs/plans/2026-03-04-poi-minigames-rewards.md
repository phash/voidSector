# Points of Interest — Minigames & Belohnungen

**Stand:** 2026-03-04
**Branch:** `claude/poi-design-documents-DHxCE`
**Bezug:** POI-System — Minigame-Designs & Reward-Tabellen
**Basis:** `feat/nav-grid-overhaul` (288 Tests, alle grün)

---

## 1. Überblick

POI-Minigames sind kurze, canvas-basierte Interaktions-Herausforderungen.
Sie bauen auf dem bestehenden **Frequenz-Minigame** (JumpGate) auf und ergänzen es
um 4 neue Varianten:

```
  ╔══════════════════════════════════════════════════════════════════╗
  ║                   MINIGAME-ÜBERSICHT                            ║
  ║                                                                  ║
  ║  ID  Name                    POI-Typ           Dauer  Schwier.  ║
  ║  ──  ──────────────────────  ────────────────  ─────  ──────── ║
  ║  MG1 FREQUENZ-KALIBRIERUNG   JumpGate (norm.)  30s    ★★★☆☆   ║
  ║  MG2 KERN-ANALYSE            Alien Außenposten 30s    ★★★☆☆   ║
  ║  MG3 SIGNAL-HARMONISIERUNG   Alien Raumschiff  20s    ★★★★☆   ║
  ║  MG4 ALIEN FREQUENZ-DUAL     JumpGate (Alien)  45s    ★★★★★   ║
  ║  MG5 DATEN-RELAY             NPC Forscher      15s    ★★☆☆☆   ║
  ║  MG6 ANDOCK-MANÖVER          NPC Außenposten   20s    ★★★☆☆   ║
  ║  MG7 SIGNAL-AMPLIFIKATION    Wormhole (stab.)  10s    ★☆☆☆☆   ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 2. Minigame-Designs

### MG1: FREQUENZ-KALIBRIERUNG (bestehend)

Bereits in Phase 5 implementiert für normale JumpGates.

**Kurzbeschreibung:** Einzelner Frequenz-Regler. Spieler justiert bis Kurve passt (≥90%).
**Canvas:** Frequenz-Wellenform, ein Schieberegler.
**Dauer:** 30 Sekunden.
**Erfolg:** ≥90% Übereinstimmung für 3 Sekunden halten.

---

### MG2: KERN-ANALYSE (neu)

**Kontext:** Alien Außenposten — Daten-Kern entschlüsseln.

```
  ╔══ MINIGAME: KERN-ANALYSE ═══════════════════════════════════════╗
  ║                                                                  ║
  ║  ALIEN DATA CORE — MUSTER-ENTSCHLÜSSELUNG                       ║
  ║  Zeit: 30s  |  Schwelle: 85%                                    ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  ALIEN-SEQUENZ (scrollt nach links →):                          ║
  ║  ▓ ░ █ ▒ ░ ░ ▓ █ ▓ ░ ▒ █ ░ ▓ ░ ▒ █ ░ ░ ▓ █ ▒ ░ ░ ▓           ║
  ║                 ╔═══════════════════╗                           ║
  ║  DEIN FENSTER:  ║ █ ▓ ░ ▒ █ ░ ░ ▓ ║  ◄── kann verschoben     ║
  ║  (6 Zeichen)    ╚═══════════════════╝      werden (←/→)        ║
  ║                                                                  ║
  ║  Übereinstimmung: ████████████░  83%                            ║
  ║  Haltezeit:       ██░░░░  1.2s / 5s                             ║
  ║                                                                  ║
  ║  [← LINKS] [RECHTS →]  [ABBRECHEN]                              ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Mechanik:**
1. Alien-Sequenz aus 8 Symbolen (`░`, `▒`, `▓`, `█`) scrollt stetig
2. Spieler sieht ein 6-Zeichen-Fenster (Ausschnitt)
3. Tasten ←/→ verschieben das Fenster horizontal (synct mit scrollender Sequenz)
4. Ziel: Fenster-Inhalt ≥85% mit aktuellem Scroll-Ausschnitt übereinstimmen
5. Übereinstimmung ≥85% für 5 Sekunden halten → Erfolg

**Artefakt-Effekt:** `resonance_fragment` senkt Schwelle auf 75%, Haltezeit auf 3s.

---

### MG3: SIGNAL-HARMONISIERUNG (neu)

**Kontext:** Alien Raumschiff — Kommunikation aufbauen.

```
  ╔══ MINIGAME: SIGNAL-HARMONISIERUNG ══════════════════════════════╗
  ║                                                                  ║
  ║  ALIEN-KOMMUNIKATION — FREQUENZ-ANGLEICHUNG                     ║
  ║  Zeit: 20s  |  Schwelle: 90%  |  2 Regler                      ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  ALIEN-SIGNAL:                                                   ║
  ║  ─╱╲──╱╲╱──╱╱╲──╱╲╱╱──╲─╱╲──╱╲╱──╱╱╲──╱╲╱╱──╲─               ║
  ║                                                                  ║
  ║  DEIN SIGNAL:                                                    ║
  ║  ──────────────────────────────────────────────────             ║
  ║  Phase:     [  ←───────────────────────────→  ]   +8 Hz        ║
  ║  Amplitude: [  ←───────────────────────────→  ]   75%          ║
  ║                                                                  ║
  ║  Synchronie: █████████████░░  88%  (Ziel: 90% für 3s)          ║
  ║                                                                  ║
  ║  [← Phase] [Phase →] [↓ Ampl.] [↑ Ampl.] [ABBRECHEN]           ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Mechanik:**
1. Alien-Signal fluktuiert zufällig (Phase und Amplitude ändern sich langsam)
2. Spieler steuert 2 Regler: Phasen-Offset (−30..+30 Hz) + Amplitude (50..150%)
3. Synchronie% = wie gut beide Regler zum aktuellen Alien-Signal passen
4. 90% Synchronie für 3 Sekunden → Erfolg
5. Alien-Signal bewegt sich bewusst weg → Spieler muss nachregeln

---

### MG4: ALIEN FREQUENZ-DUAL (neu)

**Kontext:** Alien JumpGate — Zwei-Kanal-Kalibrierung.

```
  ╔══ MINIGAME: ALIEN FREQUENZ-DUAL ════════════════════════════════╗
  ║                                                                  ║
  ║  ALIEN JUMPGATE — ZWEI-KANAL-KALIBRIERUNG                       ║
  ║  Zeit: 45s  |  Schwelle: 85% (Gesamt)                           ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  KANAL A (Primär-Resonanz):                                      ║
  ║  ─╱╲──╱╲╱──╱╱╲──╱╲╱╱──╲─  ALIEN                               ║
  ║  ──────────────────────    DEIN SIGNAL  Regler A: [+5Hz / 85%] ║
  ║  Match A: ████████████  92%                                      ║
  ║                                                                  ║
  ║  KANAL B (Harmonik):                                             ║
  ║  ─────────╱╲────────╱╲──  ALIEN                                ║
  ║  ──────────────────────    DEIN SIGNAL  Regler B: [+2Hz / 70%] ║
  ║  Match B: ████████░░░░  67%                                      ║
  ║                                                                  ║
  ║  GESAMT:  ██████████░░  80%  (Ziel: 85% für 5s)                ║
  ║  FORTSCHRITT:  ██░░░░░  1.2s / 5s                               ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Mechanik:** Wie MG1, aber zwei Kanäle gleichzeitig. Gesamt-Match = Durchschnitt beider Kanäle.
Beide Kanäle haben eigene Regler (4 Tasten gesamt + 2 Amplituden).
Mit Stufe-2-Alien-Gate-Erforschung: nur ein Kanal aktiv, Schwelle 75%.

---

### MG5: DATEN-RELAY (neu)

**Kontext:** NPC Forscher-Außenposten — Sequenz-Dekodierung.

```
  ╔══ MINIGAME: DATEN-RELAY ════════════════════════════════════════╗
  ║                                                                  ║
  ║  FORSCHUNGS-DATEN — PAKET-SORTIERUNG                            ║
  ║  Zeit: 15s  |  Versuche: 2                                      ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  Eingehende Pakete:  [B] [D] [A] [C]                            ║
  ║  (kommen zufällig an)                                            ║
  ║                                                                  ║
  ║  Richtige Reihenfolge:  A → B → C → D                           ║
  ║  (Muster ist am Anfang kurz sichtbar: 3 Sekunden)               ║
  ║                                                                  ║
  ║  Deine Eingabe: [A] [ ] [ ] [ ]                                  ║
  ║                  ▲                                               ║
  ║              bereits platziert                                   ║
  ║                                                                  ║
  ║  [A] [B] [C] [D]  ←── Klick zum Platzieren                     ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Mechanik:**
1. Für 3 Sekunden wird die Reihenfolge A→B→C→D angezeigt
2. Dann Pakete in zufälliger Reihenfolge dargestellt
3. Spieler klickt Pakete in richtiger Reihenfolge
4. 4 Pakete (Basis), 6 Pakete (advanced)
5. Vollständig richtig in der Zeit → Erfolg
6. Einfachstes Minigame — für Casual-Spieler

---

### MG6: ANDOCK-MANÖVER (neu)

**Kontext:** NPC Außenposten — Andocken an provisorische Schleuse.

```
  ╔══ MINIGAME: ANDOCK-MANÖVER ══════════════════════════════════════╗
  ║                                                                  ║
  ║  ANDOCK-SEQUENZ — SCHLEUSE SYNCHRONISIEREN                      ║
  ║  Zeit: 20s  |  Toleranz: ±15 Pixel                              ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║      ┌──────────────────────────────────────┐                   ║
  ║      │                        ╔══╗           │                  ║
  ║      │     ╔═══╗   ZIEL──►   ║  ║           │                  ║
  ║      │  ►  ║ ▶ ║             ║  ║           │                  ║
  ║      │     ╚═══╝     SCHIFF  ╚══╝           │                  ║
  ║      │    (dein Schiff)  (bewegt sich)       │                  ║
  ║      └──────────────────────────────────────┘                   ║
  ║                                                                  ║
  ║  X-Offset: +12px  |  Y-Offset: -3px                             ║
  ║  Ausrichtung: ████████████░░  86%                               ║
  ║                                                                  ║
  ║  [← LINKS] [RECHTS →] [↑ OBEN] [↓ UNTEN]                       ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Mechanik:**
1. Dein Schiff (festes Symbol) muss zur beweglichen Andock-Schleuse
2. Schleuse bewegt sich auf einer Linie (Y-Achse) auf/ab mit variabler Geschwindigkeit
3. Spieler steuert Schiff mit Richtungs-Tasten
4. ±15px Toleranz für erfolgreiche Andockung
5. Bei 85% Ausrichtung für 2 Sekunden → Andock-Erfolg
6. Stärker als MG5, schwächer als MG1

---

### MG7: SIGNAL-AMPLIFIKATION (neu)

**Kontext:** Wormhole-Stabilisierung (optionales Mini-Bonus-Minigame beim Durchflug).

```
  ╔══ MINIGAME: SIGNAL-AMPLIFIKATION ═══════════════════════════════╗
  ║                                                                  ║
  ║  WORMHOLE-DURCHFLUG — TRIEBWERK-STABILISIERUNG                  ║
  ║  Zeit: 10s  |  Einfach — Bonus-Belohnung bei Erfolg             ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  TRIEBWERKS-PULS (tippe im Rhythmus):                           ║
  ║                                                                  ║
  ║  ● · · · ● · · · ● · · · ● · · ·  ←── Alien-Rhythmus          ║
  ║  ▲                                                               ║
  ║  Nächster Puls in: 0.8s                                         ║
  ║                                                                  ║
  ║  Treffer: 3/4   |   Präzision: 75%                               ║
  ║                                                                  ║
  ║  [PULS SENDEN] (Leertaste)                                       ║
  ╚══════════════════════════════════════════════════════════════════╝
```

**Mechanik:**
1. Puls-Symbol leuchtet im Rhythmus auf (alle 1–2 Sekunden)
2. Spieler drückt Leertaste im Rhythmus (±200ms Toleranz)
3. 4 korrekte Pulse in 10 Sekunden → Erfolg (Bonus-Reward)
4. Kein Misserfolgs-Penalty — nur optionaler Bonus
5. Einfachstes aller Minigames

---

## 3. Artefakt-System

### 3.1 Artefakt-Typen und Effekte

```
  ╔══════════════════════════════════════════════════════════════════╗
  ║                   ARTEFAKT-KOMPENDIUM                           ║
  ║                                                                  ║
  ║  NAVIGATION_CRYSTAL  ★★★★☆  SELTEN                             ║
  ║  Quelle: Alien JumpGate (Erforschung Stufe 3), Alien Handel     ║
  ║  Effekt: Spieler-JumpGate +5.000 Sektoren Reichweite (einmalig) ║
  ║  Oder:   Alien JumpGate wird dauerhaft kalibriert (+10.000)     ║
  ║  Verbrauch: JA (einmalig einsetzbar)                            ║
  ║                                                                  ║
  ║  ALIEN_DATA_CORE  ★★★☆☆  UNGEWÖHNLICH–SELTEN                   ║
  ║  Quelle: Alien Außenposten, Ancient NPC-Schiff                  ║
  ║  Effekt: Freigeschalteter Bauplan (Alien-Tech)                   ║
  ║  Varianten: alien_sensor / alien_hull / alien_drive (zufällig)  ║
  ║  Verbrauch: JA (beim Einsetzen zu Bauplan wird)                 ║
  ║                                                                  ║
  ║  WORMHOLE_STABILIZER  ★★★☆☆  UNGEWÖHNLICH                      ║
  ║  Quelle: Temporäre Wormholes (Durchflug-Bonus), Alien Handel    ║
  ║  Effekt: Einbahn-Wormhole → Ziel-Bookmark; ODER temp. +48h     ║
  ║  Verbrauch: JA (einmalig)                                       ║
  ║                                                                  ║
  ║  ANCIENT_WEAPON  ★★★★☆  SELTEN                                 ║
  ║  Quelle: Aktive Alien Außenposten (Stufe 2+), Kampf-Beute       ║
  ║  Effekt: Dauerhaft +20% Kampfbonus (passiv, kein Verbrauch)     ║
  ║  Limit: 1 pro Spieler (zweites überschreibt nicht)              ║
  ║                                                                  ║
  ║  RESONANCE_FRAGMENT  ★★☆☆☆  GEWÖHNLICH–UNGEWÖHNLICH            ║
  ║  Quelle: Alien Raumschiffe (Handel), Forscher-Quests            ║
  ║  Effekt: Minigame-Hilfsmittel — senkt alle MG-Schwellen um 10%  ║
  ║  Verbrauch: JA (nach einer Minigame-Nutzung verbraucht)         ║
  ║                                                                  ║
  ║  FACTION_EMBLEM  ★★☆☆☆  GEWÖHNLICH                             ║
  ║  Quelle: NPC-Quests (seltene Belohnung), Piraten-Schwarzmarkt   ║
  ║  Effekt: +20 Reputation bei gewählter Fraktion (einmalig)       ║
  ║  Varianten: je eine pro Fraktion (5 Typen)                      ║
  ║  Verbrauch: JA (beim Einsetzen)                                 ║
  ╚══════════════════════════════════════════════════════════════════╝
```

### 3.2 Artefakt-Raritäts-Verteilung nach POI-Typ

| POI-Typ                  | Common | Uncommon | Rare | Legendary |
|--------------------------|--------|----------|------|-----------|
| Alien Außenposten Stufe 1| 60%    | 35%      | 5%   | 0%        |
| Alien Außenposten Stufe 2| 30%    | 45%      | 20%  | 5%        |
| Alien Außenposten Stufe 3| 10%    | 30%      | 40%  | 20%       |
| Alien Raumschiff Scout   | 70%    | 25%      | 5%   | 0%        |
| Alien Raumschiff Raider  | 40%    | 40%      | 18%  | 2%        |
| Alien Raumschiff Destroyer| 20%   | 40%      | 30%  | 10%       |
| Alien Raumschiff Mothership| 5%   | 25%      | 45%  | 25%       |
| JumpGate Alien Stufe 3   | 0%     | 30%      | 50%  | 20%       |
| Wormhole Einbahn (erst.) | 40%    | 40%      | 18%  | 2%        |
| NPC-Quest (Belohnung)    | 80%    | 15%      | 5%   | 0%        |

### 3.3 Artefakt-UI (Inventory-Erweiterung)

Artefakte werden im Cargo-Panel als separater Tab angezeigt:

```
  ╔══ CARGO — ARTEFAKTE ════════════════════════════════════════════╗
  ║  [RESSOURCEN] [ARTEFAKTE ★2]                                    ║
  ║  ─────────────────────────────────────────────────────────────  ║
  ║                                                                  ║
  ║  ★ RESONANCE_FRAGMENT  (UNCOMMON)                               ║
  ║    Minigame-Schwelle −10% (1× verwendbar)                       ║
  ║    [VERWENDEN] [VERKAUFEN: 250 Cr]                               ║
  ║                                                                  ║
  ║  ★ FACTION_EMBLEM — TRADERS  (COMMON)                           ║
  ║    +20 Händler-Reputation (1× verwendbar)                       ║
  ║    [VERWENDEN] [VERKAUFEN: 100 Cr]                               ║
  ║                                                                  ║
  ║  Artefakt-Slots: 2 / 10                                          ║
  ║  (Artefakt-Kapazität: 10 — separates Fach, kein Cargo-Limit)   ║
  ╚══════════════════════════════════════════════════════════════════╝
```

---

## 4. Belohnungstabellen

### 4.1 Credits-Belohnungen nach POI-Typ

| POI-Typ                      | Credits-Range    | Bemerkung                     |
|------------------------------|------------------|-------------------------------|
| Alien Außenposten Stufe 1    | 100–500          | + Artefakt                    |
| Alien Außenposten Stufe 2    | 300–1.000        | + Artefakt + Bauplan-Fragment |
| Alien Außenposten Stufe 3    | 500–2.000        | + Artefakt + vollst. Bauplan  |
| Alien Schiff Scout (Kampf)   | 200–500          | + Ressourcen                  |
| Alien Schiff Raider (Kampf)  | 400–1.000        | + Ressourcen + Artefakt       |
| Alien Schiff Destroyer       | 800–2.500        | + Artefakt                    |
| Alien Schiff Mothership      | 2.000–5.000      | + 1–3 Artefakte               |
| Alien Schiff Kommunikation   | 0 (Handel)       | Handel-Artefakt               |
| JumpGate Alien Erforschung 1 | 200              | + XP                          |
| JumpGate Alien Erforschung 2 | 500              | + Artefakt + XP               |
| JumpGate Alien Erforschung 3 | 1.000            | + Bauplan + Artefakt + XP     |
| Wormhole perm. (erstmalig)   | 50               | + XP                          |
| Wormhole temp. (erstmalig)   | 75               | + XP                          |
| Wormhole einbahn (erstmalig) | 200              | + XP + Artefakt               |
| NPC-Schiff Quest             | 200–1.500        | + Rep                         |
| NPC-Schiff Handel            | Variabel         | Marktpreise                   |
| NPC Außenposten Quest        | 500–2.000        | + Rep + Artefakt (selten)     |
| NPC Außenposten Sonderangebot| Rabatt           | −15–25% auf Ressourcen        |

### 4.2 Reputations-Belohnungen

| Aktion                           | Rep-Geber     | Delta    | Rival-Verlust |
|----------------------------------|---------------|----------|---------------|
| Alien Außenposten erforscht      | ancients      | +5       | —             |
| Alien Schiff Kommunikation Erf.  | ancients      | +10      | —             |
| Alien Schiff getötet             | ancients      | -20      | —             |
| JumpGate Alien erforscht         | ancients      | +3       | —             |
| NPC-Quest abgeschlossen          | Quest-Geber   | +5..+15  | -2..-5 Rival  |
| NPC-Schiff angreifen (neutral)   | NPC-Fraktion  | -15      | +3 Rival      |
| Händler-Sonderangebot benutzt    | traders       | +3       | —             |
| Piraten-Quest erfüllt            | pirates       | +10      | -5 Target     |
| Forschungsdaten geliefert        | scientists    | +8       | —             |

### 4.3 XP-Belohnungen

| Aktion                             | XP   |
|------------------------------------|------|
| Alien Außenposten Stufe 1          | 100  |
| Alien Außenposten Stufe 2          | 250  |
| Alien Außenposten Stufe 3          | 500  |
| Alien Schiff Kommunikation Erf.   | 200  |
| Alien Schiff getötet (Scout)      | 150  |
| Alien Schiff getötet (Raider)     | 300  |
| Alien Schiff getötet (Destroyer)  | 600  |
| Alien Schiff getötet (Mothership) | 1500 |
| JumpGate Alien Erforschung 1–3    | 200/500/1000 |
| Wormhole erstmalig (perm/temp/EB) | 100/150/300  |
| NPC-Quest abgeschlossen           | 50–200 (je Typ) |

---

## 5. Balancing-Notizen

### 5.1 POI-Encounter-Rate im Spielalltag

Ziel: Spieler begegnen ca. 1–2 interessanten POIs pro 30-minütiger Session.

| Session-Typ        | Erwartete POIs (30 min)         |
|--------------------|---------------------------------|
| Cluster-Kern       | 3–5 NPC-Schiffe, 1 Außenposten  |
| Cluster-Umgebung   | 1–2 NPC-Schiffe, 0–1 Alien-POI  |
| Tiefer Raum        | 0–1 NPC-Schiff, 0–1 Alien-POI  |
| JumpGate-Routen    | Gelegentlich Wormholes          |

### 5.2 Minigame-Häufigkeit

- Nicht jede POI-Interaktion erfordert ein Minigame
- Minigames sind optional (oft gibt es auch "Scannen" als Alternative)
- Alternative ohne Minigame: Niedrigerer Reward (kein Artefakt, weniger Credits)
- Minigame-Cooldown: 10 Minuten (kann nicht gespamt werden)

### 5.3 Artefakt-Wirtschaft

- Max 10 Artefakt-Slots (separates Inventar, kein Cargo-Konflikt)
- Artefakte für NPC-Händler verkaufbar (Credits-Sink-Verhältnis 1:5)
- Seltene Artefakte im TRADE-Monitor handelbar (zwischen Spielern)
- Legendary Artefakte: Nicht NPC-verkaufbar, nur Spieler-zu-Spieler

---

## 6. Technische Implementierung

### 6.1 Minigame-Framework (Client)

Alle Canvas-Minigames nutzen eine gemeinsame Basis-Klasse:

```typescript
// packages/client/src/minigames/MinigameBase.ts
export abstract class MinigameBase {
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected timeRemaining: number;
  protected score: number;
  protected onComplete: (score: number, success: boolean) => void;

  abstract update(deltaMs: number): void;
  abstract render(): void;
  abstract handleInput(event: KeyboardEvent | MouseEvent): void;

  start(): void { ... }
  stop(): void { ... }
  getScore(): number { return this.score; }
}

// Konkrete Implementierungen
export class KernAnalyseMinigame extends MinigameBase { ... }
export class SignalHarmonisierungMinigame extends MinigameBase { ... }
export class AlienFrequenzDualMinigame extends MinigameBase { ... }
export class DatenRelayMinigame extends MinigameBase { ... }
export class AndockManoevrMinigame extends MinigameBase { ... }
export class SignalAmplifikationMinigame extends MinigameBase { ... }
```

### 6.2 Artefakt-Verwendungs-Handler (Server)

```typescript
// packages/server/src/engine/artifacts.ts

export async function useArtifact(
  playerId: string,
  artifactId: string,
  target?: { gateId?: string; factionId?: NpcFactionId }
): Promise<ArtifactUseResult> { ... }

export function generateArtifact(
  poiType: PoiType,
  rarity: ArtifactRarity
): Artifact { ... }

export function getArtifactSellPrice(artifact: Artifact): number {
  const BASE = { common: 50, uncommon: 250, rare: 1000, legendary: 0 };
  return BASE[artifact.rarity];  // legendary: nicht verkaufbar
}
```

### 6.3 Neue Message-Typen

```typescript
// Minigame abgeschlossen
export interface MinigameCompleteMessage {
  minigameType: MinigameType;
  score: number;
  success: boolean;
  contextId: string;  // gateId / poiId / sectorKey
}

// Artefakt verwenden
export interface UseArtifactMessage {
  artifactId: string;
  targetGateId?: string;
  targetFactionId?: NpcFactionId;
}

export interface UseArtifactResultMessage {
  success: boolean;
  artifactId: string;
  effect: ArtifactEffect;
  error?: string;
}
```

### 6.4 Neue Konstanten

```typescript
export type MinigameType =
  | 'frequenz_kalibrierung'
  | 'kern_analyse'
  | 'signal_harmonisierung'
  | 'alien_frequenz_dual'
  | 'daten_relay'
  | 'andock_manoevr'
  | 'signal_amplifikation';

// Minigame-Parameter
export const MINIGAME_CONFIG: Record<MinigameType, {
  duration: number;
  threshold: number;
  holdTime: number;
}> = {
  frequenz_kalibrierung:   { duration: 30, threshold: 0.90, holdTime: 3 },
  kern_analyse:            { duration: 30, threshold: 0.85, holdTime: 5 },
  signal_harmonisierung:   { duration: 20, threshold: 0.90, holdTime: 3 },
  alien_frequenz_dual:     { duration: 45, threshold: 0.85, holdTime: 5 },
  daten_relay:             { duration: 15, threshold: 1.00, holdTime: 0 },
  andock_manoevr:          { duration: 20, threshold: 0.85, holdTime: 2 },
  signal_amplifikation:    { duration: 10, threshold: 0.75, holdTime: 0 },
};

// Cooldowns
export const MINIGAME_COOLDOWN_MS = 10 * 60 * 1000;  // 10 Minuten

// Artefakt-Slots
export const ARTIFACT_MAX_SLOTS = 10;
```

---

*Dokument-Ende — voidSector POI: Minigames & Belohnungen*
