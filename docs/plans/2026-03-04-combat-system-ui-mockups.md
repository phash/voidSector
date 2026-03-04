# Kampfsystem v2 — UI-Mockups & Grafikdokumentation

**Stand:** 2026-03-04
**Referenz:** `2026-03-04-combat-system-design.md`

Alle Darstellungen im CRT Amber-Monochrome-Stil (Schriftfarbe `#FFB000`, Hintergrund `#050505`).
Akzentfarben: Rot `#FF3333` (Feind/Gefahr), Grün `#00FF88` (OK/Sieg), Blau `#00BFFF` (Aliens).

---

## 1. Waffensystem-Grafiken

### 1.1 Modul-Karten (Schiff-Designer-Ansicht)

```
╔══════════════════════════════════════╗
║  ┌──────────────────────────────┐   ║
║  │  ───═══════════════►         │   ║
║  │     ····················►    │   ║
║  │  ───═══════════════►         │   ║
║  └──────────────────────────────┘   ║
║  PULS-LASER MK.I            [WAF]   ║
║  ────────────────────────────────   ║
║  ATK    +8   │ GEN   +5%            ║
║  Typ: Energie│ Piercing: 0%         ║
║  ────────────────────────────────   ║
║  KOSTEN: 150 CR + 10 Crystal        ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════╗
║  ┌──────────────────────────────┐   ║
║  │  ════════════════════►       │   ║
║  │  ◆══════════════════►        │   ║  ← Panzerbrechendes Projektil
║  │  ════════════════════►       │   ║
║  └──────────────────────────────┘   ║
║  RAIL-KANONE MK.I           [WAF]   ║
║  ────────────────────────────────   ║
║  ATK   +12   │ GEN   -5%            ║
║  Typ: Kinetik │ Piercing: 30%       ║
║  ────────────────────────────────   ║
║  KOSTEN: 300 CR + 30 Ore + 15 Xtal  ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════╗
║  ┌──────────────────────────────┐   ║
║  │  ┌─┐ ┌─┐                    │   ║
║  │  │▓│ │▓│  ~~~▶  ~~~▶        │   ║
║  │  │▓│ │▓│  ~~~▶  ~~~▶        │   ║
║  │  └─┘ └─┘                    │   ║
║  └──────────────────────────────┘   ║
║  RAKETEN-POD MK.I           [WAF]   ║
║  ────────────────────────────────   ║
║  ATK   +18   │ Abfangbar: JA        ║
║  Typ: Ballist.│ PD: -50% dmg        ║
║  ────────────────────────────────   ║
║  KOSTEN: 250 CR + 20 Ore + 5 Xtal   ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════╗
║  ┌──────────────────────────────┐   ║
║  │    ╔═══╗                     │   ║
║  │ ≈≈≈╣EMP╠≈≈≈≈≈≈≈≈≈≈≈≈        │   ║
║  │    ╚═══╝  [SHIELD OFF]       │   ║
║  └──────────────────────────────┘   ║
║  EMP-EMITTER                [WAF]   ║
║  ────────────────────────────────   ║
║  ATK    0    │ Schilde: AUS 2R      ║
║  Typ: Elektro │ Hit: 75%            ║
║  ────────────────────────────────   ║
║  KOSTEN: 500 CR + 20 Xtal + 20 Gas  ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════╗
║  ┌──────────────────────────────┐   ║
║  │       ╔═══════╗              │   ║
║  │  ···  ║ SCHLD ║  ···         │   ║
║  │  ···  ╠═══════╣  ···         │   ║
║  │       ╚═══════╝              │   ║
║  └──────────────────────────────┘   ║
║  SCHILD-GEN MK.II          [SCH]   ║
║  ────────────────────────────────   ║
║  Shield +60  │ Regen +6/Runde       ║
║  Typ: Energie│ Slot: Shield         ║
║  ────────────────────────────────   ║
║  KOSTEN: 600 CR + 35 Xtal + 10 Gas  ║
╚══════════════════════════════════════╝

╔══════════════════════════════════════╗
║  ┌──────────────────────────────┐   ║
║  │  ~~~▶×  ~~~▶×  ~~~▶×        │   ║
║  │     ≈[PD]≈                  │   ║
║  │  ~~~▶×  ~~~▶×               │   ║
║  └──────────────────────────────┘   ║
║  PUNKT-VERTEIDIGUNG         [DEF]   ║
║  ────────────────────────────────   ║
║  Abfang: 60% Raketen-DMG            ║
║  Nur gegen Raketen-Typ              ║
║  ────────────────────────────────   ║
║  KOSTEN: 350 CR + 20 Ore + 10 Xtal  ║
╚══════════════════════════════════════╝
```

---

## 2. Haupt-Kampf-Dialog

### 2.1 Rundenstart — Taktik wählen

```
╔══════════════════════════════════════════════════════════════════════╗
║ ● KAMPF ● SEKTOR (047,-023) ● RUNDE 1/5 ● AP: 8/10 ●              ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ╔══ VOID CRUISER ═══════════════╗   ╔══ PIRATEN-JÄGER LV.3 ═════╗  ║
║  ║                               ║   ║                             ║  ║
║  ║         ╱╲  ╱╲                ║   ║     ╱╲  ╱╲                 ║  ║
║  ║        ╱██╲╱██╲               ║   ║    ╱██╲╱██╲                ║  ║
║  ║       ╱████████╲              ║   ║   │╔══╗╔══╗│               ║  ║
║  ║       ╲████████╱              ║   ║  ══╡║▓╟╢▓║╞══              ║  ║
║  ║        ╲██╱╲██╱               ║   ║   │╚══╝╚══╝│               ║  ║
║  ║                               ║   ║    ╲  ╱╲  ╱                ║  ║
║  ║                               ║   ║                             ║  ║
║  ║ SCH [░░░░░░░░░░░░░░░]   0/0   ║   ║ SCH [░░░░░░░░░░░░░░]  0/0  ║  ║
║  ║ RMP [████████████░░░]  85/100 ║   ║ RMP [████████████░░] 50/60  ║  ║
║  ║                               ║   ║                             ║  ║
║  ║ WAFFE: RAIL-KANONE MK.I       ║   ║ WAFFE: PIRATEN-BLASTER     ║  ║
║  ╚═══════════════════════════════╝   ╚═════════════════════════════╝  ║
║                                                                      ║
║  ─── KAMPF-LOG ───────────────────────────────────────────────────  ║
║  > Piratenkontakt! PIRATEN-JÄGER LV.3 — Sektor (47,-23)             ║
║  > BEREIT — Taktik wählen um Runde 1 zu starten                     ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ─── TAKTIK ──────────────────────────────────────────────────────  ║
║                                                                      ║
║   [F1] ANGRIFF      +30% DMG / -20% DEF                             ║
║   [F2] AUSGEWOGEN   Balanced (Standard)                              ║
║   [F3] DEFENSIV     -25% DMG / +35% DEF                             ║
║                                                                      ║
║  ─── SONDER-AKTION (1× pro Kampf) ───────────────────────────────  ║
║                                                                      ║
║   [F4] ZIELEN       +50% Hit, 35% Systemdeaktivierung    [VERFÜGBAR]║
║   [F5] AUSWEICHEN   50% Dodge nächster Angriff            [VERFÜGBAR]║
║                                                                      ║
║   [ESC] FLUCHT — 2 AP, ~60% Chance                                  ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 2.2 Mitten im Kampf — Runde 3, Schilde aktiv, EMP-Effekt

```
╔══════════════════════════════════════════════════════════════════════╗
║ ● KAMPF ● SEKTOR (047,-023) ● RUNDE 3/5 ● AP: 6/10 ●              ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ╔══ VOID EXPLORER ══════════════╗   ╔══ ALIEN-KREUZER LV.7 ══════╗  ║
║  ║    ─────                      ║   ║  ≋≋≋≋≋≋≋≋≋≋≋≋              ║  ║
║  ║   ╱─────╲                     ║   ║ ≋ ◈ ════════ ◈ ≋           ║  ║
║  ║  ╱───────╲                    ║   ║ ≋ ║ ◆◇◆◇◆◇◆ ║ ≋           ║  ║
║  ║ │─────────│  ·····EMP·····►   ║   ║ ≋ ╠═[ALIEN]=╣ ≋  [SCH:OFF]║  ║
║  ║  ╲───┬───╱                    ║   ║ ≋ ║ ◇◆◇◆◇◆◇ ║ ≋           ║  ║
║  ║      │                        ║   ║ ≋ ◈ ════════ ◈ ≋           ║  ║
║  ║     ═╧═                       ║   ║  ≋≋≋≋≋≋≋≋≋≋≋≋              ║  ║
║  ║                               ║   ║                             ║  ║
║  ║ SCH [■■■■■■■░░░░░░░░] 42/100  ║   ║ SCH [░░░░░░░░░░░░░░]  0/0  ║  ║
║  ║ RMP [■■■■■■■■■■░░░░░] 72/100  ║   ║ RMP [■■■■░░░░░░░░░░] 32/90  ║  ║
║  ║                               ║   ║ !!! SCHILD DEAKTIVIERT !!!  ║  ║
║  ║ WAFFE: EMP-EMITTER            ║   ║ (noch 1 Runde)              ║  ║
║  ╚═══════════════════════════════╝   ╚═════════════════════════════╝  ║
║                                                                      ║
║  ─── KAMPF-LOG ───────────────────────────────────────────────────  ║
║  > R1: Rail-Kanone → 24 DMG (Piercing 30%, Alien-Schild -18, Rmpf-6)║
║  > R1: Alien-Energiepuls → 30 DMG (Schild absorbiert 30)            ║
║  > R2: Schild-Regen +12 (Schild: 42/100)                            ║
║  > R2: EMP-Emitter → TREFFER! Alien-Schild DEAKTIVIERT (2 Runden)   ║
║  > R2: Alien-Energiepuls → 30 DMG (Schild -30, Schild: 42)         ║
║  > R3: Schild-Regen +12 → 54/100 ... Schilde voll bei 100           ║
║  > R3: Alien-Schild noch 1 Runde deaktiviert — Dein Zug...          ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║   [F1] ANGRIFF   [F2] AUSGEWOGEN   [F3] DEFENSIV                    ║
║   [F4] ZIELEN [BENUTZT]   [F5] AUSWEICHEN [VERFÜGBAR]               ║
║   [ESC] FLUCHT — 2 AP                                               ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 2.3 Niederlage-Screen

```
╔══════════════════════════════════════════════════════════════════════╗
║ ● KAMPF ● SEKTOR (047,-023) ● RUNDE 4/5 ● BEENDET ●               ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║                                                                      ║
║   ███╗   ██╗██╗███████╗██████╗ ███████╗██████╗ ██╗      █████╗ ██╗  ║
║   ████╗  ██║██║██╔════╝██╔══██╗██╔════╝██╔══██╗██║     ██╔══██╗██║  ║
║   ██╔██╗ ██║██║█████╗  ██║  ██║█████╗  ██████╔╝██║     ███████║██║  ║
║   ██║╚██╗██║██║██╔══╝  ██║  ██║██╔══╝  ██╔══██╗██║     ██╔══██║██║  ║
║   ██║ ╚████║██║███████╗██████╔╝███████╗██║  ██║███████╗██║  ██║██║  ║
║   ╚═╝  ╚═══╝╚═╝╚══════╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  RUNDEN GESPIELT: 4 / 5                                              ║
║  DEIN SCHIFF: 0 HP — ZERSTÖRT                                        ║
║  FEIND:  Alien-Kreuzer LV.7 — 28 HP verbleibend                     ║
║                                                                      ║
║  ─── VERLUSTE ───────────────────────────────────────────────────   ║
║                                                                      ║
║  Fracht-Verlust:                                                     ║
║  ► Erz:      -8  (38% verloren)                                      ║
║  ► Kristall: -2  (38% verloren)                                      ║
║  ► Gas:      -3  (38% verloren)                                      ║
║                                                                      ║
║  ─── ERFAHRUNG ──────────────────────────────────────────────────   ║
║  ► XP: +14  (Level 7 Feind × 2)                                     ║
║                                                                      ║
║  ─── HINWEIS ────────────────────────────────────────────────────   ║
║  Tip: Schild-Generator MK.II hätte 60 HP Schaden absorbiert.        ║
║                                                                      ║
║  [WEITER]                                                            ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 2.4 Sieg-Screen

```
╔══════════════════════════════════════════════════════════════════════╗
║ ● KAMPF ● SEKTOR (047,-023) ● RUNDE 2/5 ● BEENDET ●               ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║    ██████╗ ██╗███████╗ ██████╗                                       ║
║   ██╔════╝██║██╔════╝██╔════╝                                        ║
║   ╚█████╗ ██║█████╗  ██║  ███╗                                       ║
║    ╚═══██╗██║██╔══╝  ██║   ██║                                       ║
║   ██████╔╝██║███████╗╚██████╔╝                                       ║
║   ╚═════╝ ╚═╝╚══════╝ ╚═════╝                                        ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  RUNDEN GESPIELT: 2 / 5                                              ║
║  DEIN SCHIFF: 82 HP  │  SCHILD: 38/60                               ║
║  FEIND: Piraten-Jäger LV.3 — VERNICHTET                             ║
║                                                                      ║
║  ─── BEUTE ──────────────────────────────────────────────────────   ║
║  ► Credits:  +45 CR                                                  ║
║  ► Erz:      +2                                                      ║
║  ► Kristall: +1                                                      ║
║                                                                      ║
║  ─── ERFAHRUNG & REPUTATION ────────────────────────────────────    ║
║  ► XP:       +20  (LV.3 × 5 + Runden-Bonus)                        ║
║  ► Piraten-Rep: -3                                                   ║
║                                                                      ║
║  [WEITER]                                                            ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 2.5 Flucht erfolgreich / gescheitert

```
  ─── FLUCHT ERFOLGREICH ────────────────────────────────────────────

  ╔══════════════════════════════════════════════╗
  ║  GEFLOHEN                                    ║
  ║  ────────────────────────────────────────── ║
  ║  Notfall-Sprung eingeleitet!                 ║
  ║  Kosten: -2 AP                               ║
  ║  Fluchtchance war: 63% — Erfolg!             ║
  ╚══════════════════════════════════════════════╝

  ─── FLUCHT GESCHEITERT ────────────────────────────────────────────

  ╔══════════════════════════════════════════════╗
  ║  !!! FLUCHT FEHLGESCHLAGEN !!!               ║
  ║  ────────────────────────────────────────── ║
  ║  Triebwerke überhitzt — Sprung abgebrochen   ║
  ║  Feind greift an!                            ║
  ║  Kosten: -2 AP                               ║
  ║  Kampf geht weiter...                        ║
  ╚══════════════════════════════════════════════╝
```

---

## 3. Stationskampf-UI

### 3.1 Station-Alarm (Push-Benachrichtigung)

```
  ┌─────────────────────────────────────────────────────────────────┐
  │ !!! ALARM !!! STATION NEXUS-7 UNTER BESCHUSS !!!               │
  │                                                                 │
  │  Sektor (47, -23)  │  Angreifer: Piraten-Kreuzer LV.4          │
  │  Station-Schild: [████████████░░░░] 80%                        │
  │                                                                 │
  │  [BEITRETEN]  Sektor anspringen + Verteidigung beitreten       │
  │  [IGNORIEREN] Station kämpft automatisch weiter                │
  └─────────────────────────────────────────────────────────────────┘
```

### 3.2 Stations-Kampf-Dialog (Spieler beigetreten)

```
╔══════════════════════════════════════════════════════════════════════╗
║ ● STATIONS-VERTEIDIGUNG ● SEKTOR (047,-023) ● RUNDE 3/10 ●        ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ╔══ NEXUS-7 [STATION] ══════════════════╗   ╔══ ANGREIFER ════════╗  ║
║  ║   ┌───┐   ┌───┐                       ║   ║                     ║  ║
║  ║   │ ▲ │   │ ▲ │  TÜRME AKTIV          ║   ║    ╱╲  ╱╲           ║  ║
║  ║   ╔═══════════════════╗               ║   ║   ╱██╲╱██╲          ║  ║
║  ║   ║    [NEXUS-7]      ║               ║   ║  │╔══╗╔══╗│         ║  ║
║  ║   ║  ░░░ STATION ░░░  ║               ║   ║ ══╡║▓╟╢▓║╞══        ║  ║
║  ║   ╚═══════════════════╝               ║   ║  │╚══╝╚══╝│         ║  ║
║  ║                                       ║   ║   ╲  ╱╲  ╱          ║  ║
║  ║  SCH [████████░░░░░░]  80/150         ║   ║                     ║  ║
║  ║  RMP [████████████████] 500/500       ║   ║ SCH [░░░░░░░░]  0/0 ║  ║
║  ║  TURM×2: AUTO  30 DMG/RND            ║   ║ RMP [███░░░░░] 30/60 ║  ║
║  ╚═══════════════════════════════════════╝   ╚═════════════════════╝  ║
║                                                                      ║
║  ╔══ DEIN SCHIFF (VOID SCOUT) ════════════════════════════════════╗   ║
║  ║  SCH [░░░░░░░░░░░░░░░]   0/0   RMP [██████████░░░░]  60/80    ║   ║
║  ║  WAFFE: PULS-LASER MK.I   │  Kombinierter Schaden auf Feind   ║   ║
║  ╚════════════════════════════════════════════════════════════════╝   ║
║                                                                      ║
║  ─── LOG ────────────────────────────────────────────────────────   ║
║  > R1-2: Station-Türme feuern  → 30 DMG/Runde auf Piraten         ║
║  > R2:   Pirat greift Station an → 28 DMG (Schild -28: 80/150)    ║
║  > R3:   Du feuerst Laser MK.I → 14 DMG  (komb. mit Türmen: 44)  ║
║  > R3:   Pirat HP: 30/60 — Feind geschwächt                       ║
║                                                                     ║
╠══════════════════════════════════════════════════════════════════════╣
║   [F1] ANGRIFF   [F2] AUSGEWOGEN   [F3] DEFENSIV                    ║
║   [F4] ZIELEN [VERFÜGBAR]   [F5] AUSWEICHEN [VERFÜGBAR]             ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 3.3 Stations-Verteidigung verwalten (neues Panel im STRUCTURE-Monitor)

```
╔══════════════════════════════════════════════════════════════════════╗
║  STATION: NEXUS-7 ● Sektor (47,-23) ● STRUKTUR-MANAGEMENT          ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ─── INSTALLIERTE VERTEIDIGUNG ─────────────────────────────────   ║
║                                                                      ║
║  [1] VERTEIDIGUNGS-TURM MK.I  ×2                                    ║
║      Auto-DMG: 15×2 = 30/Runde                                      ║
║      Status: AKTIV [●●●]                                            ║
║                                                                      ║
║  [2] STATIONS-SCHILD MK.I                                           ║
║      Shield-HP: 150  │  Regen: 10/Runde                             ║
║      Status: AKTIV [●●●]  │  Aktuell: 80/150                       ║
║                                                                      ║
║  ─── VERFÜGBARE UPGRADES ───────────────────────────────────────    ║
║                                                                      ║
║  [+] VERTEIDIGUNGS-TURM MK.II                                       ║
║      Auto-DMG: +30/Runde  │  Zusätzlich zu MK.I                    ║
║      Kosten: 1500 CR + 100 Ore + 20 Crystal                         ║
║      [BAUEN]                                                         ║
║                                                                      ║
║  [+] IONEN-KANONE                                                    ║
║      80 DMG, ignoriert Schilde, 1× pro Kampf                        ║
║      Kosten: 8000 CR + 300 Ore + 100 Crystal + 50 Gas               ║
║      [BAUEN]  [NICHT GENUG RESSOURCEN]                               ║
║                                                                      ║
║  ─── STATIONSREPARATUR ─────────────────────────────────────────    ║
║                                                                      ║
║  RUMPF-HP: 500/500 — KEIN SCHADEN                                   ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 4. Waffensystem-Übersicht (Radar-Ansicht Symbole)

Neue Symbole für zukünftige Radar-Erweiterungen:

```
  Schuss-Effekte auf dem Radar-Canvas:

  Laser:   ·····►   (gepunktete Linie, Amber)
  Rail:    ═════►   (doppelte Linie, hell-amber)
  Rakete:  ~~~▶     (Wellenform, rot)
  EMP:     ≈≈≈≈     (radial, blau-amber)

  Treffer-Effekte:
  Schild-Hit:   ◉  (Kreis-Blitz, blue)
  Hull-Hit:     ✕  (Kreuz, rot)
  Ausweichen:   ◌  (leerer Kreis, grau)
  Kritisch:     ★  (Stern, gelb-weiß)
```

---

## 5. HP-Balken Designs

### 5.1 Schiff-Balken (im Kampf-Dialog)

```
  Voll:      SCHILD [■■■■■■■■■■■■■■■] 100/100  ← Amber #FFB000
  75%:       SCHILD [■■■■■■■■■■■░░░░]  75/100
  50%:       SCHILD [■■■■■■■░░░░░░░░]  50/100
  25%:       SCHILD [■■■░░░░░░░░░░░░]  25/100  ← Orange
  Kritisch:  SCHILD [■░░░░░░░░░░░░░░]  10/100  ← Rot #FF3333 + Blink

  Voll:      RUMPF  [████████████████] 100/100  ← Grün #00FF88
  Schaden:   RUMPF  [████████░░░░░░░░]  50/100  ← Amber
  Kritisch:  RUMPF  [██░░░░░░░░░░░░░░]  15/100  ← Rot, Blink-Effekt
```

### 5.2 Stations-Balken (größer, Stations-Panel)

```
  SCHILD  [■■■■■■■■■■■■■■■■░░░░]  160/200
  RUMPF   [████████████████████]  500/500

  Nach Schaden:
  SCHILD  [■■■■■■░░░░░░░░░░░░░░]   60/200   ← Warnfarbe
  RUMPF   [████████████████░░░░]  400/500
```

---

## 6. Schiff-ASCII-Kunst im Kampf (alle Hull-Typen)

### 6.1 Scout (3×Kampf-Breite)

```
      Neutral:              Feuert:              Getroffen:
         ╱╲                   ╱╲    ···►             ╱╲
        ╱██╲                 ╱██╲                   ╱╲╱╲    ✕
       ╱████╲               ╱████╲══►              ╱████╲
       ╲████╱               ╲████╱                 ╲╱ ╲╱
        ╲██╱                 ╲██╱                   ╲╱
```

### 6.2 Cruiser

```
      Neutral:              Feuert:
      ╱╲    ╱╲              ╱╲    ╱╲
     ╱██╲  ╱██╲            ╱██╲  ╱██╲
    ╱████████████╲         ╱██████████╲══════►
    ╲████████████╱         ╲████████████╱
     ╲██╱  ╲██╱             ╲██╱  ╲██╱
```

### 6.3 Freighter

```
      Neutral:
    ┌────────────────┐
    │ ░░░░░░░░░░░░░░ │
  ══╡ ░░ FRACHT ░░░░ ╞══
    │ ░░░░░░░░░░░░░░ │
    └────────┬───────┘
             │
            ═╧═
```

### 6.4 Battleship

```
      Neutral:              Feuert (Rail-Kanone):
    ████████████            ████████████
   ╔════════════╗          ╔════════════╗
   ║ ▓▓ [] ▓▓  ║          ║ ▓▓ [] ▓▓  ║
  ═╣ ▓▓████▓▓  ╠═        ═╣ ▓▓████▓▓  ╠═══════════════►
   ║ ▓▓ [] ▓▓  ║          ║ ▓▓ [] ▓▓  ║  ◆═════════════►
   ╚════════════╝          ╚════════════╝
    ████████████            ████████████
```

### 6.5 Explorer

```
      Neutral:
        ─────
       ╱─────╲
      ╱───────╲
     │─────────│
      ╲───┬───╱
          │
         ═╧═
         ═══
```

### 6.6 Pirat / Feind-Typen

```
  Standard-Pirat (LV 1-5):      Ancient/Alien (LV 6-10):

       ╱╲  ╱╲                    ≋≋≋≋≋≋≋≋≋≋≋≋
      ╱██╲╱██╲                  ≋ ◈ ════════ ◈ ≋
     │╔══╗╔══╗│                 ≋ ║ ◆◇◆◇◆◇◆ ║ ≋
    ══╡║▓╟╢▓║╞══               ≋ ╠═[ANCIENT]=╣ ≋
     │╚══╝╚══╝│                 ≋ ║ ◇◆◇◆◇◆◇ ║ ≋
      ╲  ╱╲  ╱                  ≋ ◈ ════════ ◈ ≋
                                  ≋≋≋≋≋≋≋≋≋≋≋≋

  Pirat-Fregattte (LV 3-7):     Station-Angreifer (LV 5-10):

    ╱╲      ╱╲                   ┌──────────┐
   ╱██╲    ╱██╲                  │▓▓▓▓▓▓▓▓▓▓│
  ╱██████████████╲              ═╡ [RAID]   ╞═
  ╲██████████████╱               │▓▓▓▓▓▓▓▓▓▓│
   ╲██╱    ╲██╱                  └──────────┘
```

---

## 7. Taktik-Visualisierung (Auswahl-Highlight)

```
  Taktik-Buttons — normal:

  ┌────────────────────────────────────────────────────────────┐
  │  [F1] ANGRIFF      +30% DMG  -20% DEF                     │
  │  [F2] AUSGEWOGEN   Balanced (Standard)                     │
  │  [F3] DEFENSIV     -25% DMG  +35% DEF                     │
  └────────────────────────────────────────────────────────────┘

  ANGRIFF ausgewählt (Hover/Focus):

  ┌────────────────────────────────────────────────────────────┐
  │ ►[F1]◄ANGRIFF ████ +30% DMG  -20% DEF  ████  [AKTIV]◄    │  ← Rot #FF3333
  │  [F2] AUSGEWOGEN   Balanced (Standard)                     │
  │  [F3] DEFENSIV     -25% DMG  +35% DEF                     │
  └────────────────────────────────────────────────────────────┘

  DEFENSIV ausgewählt:

  ┌────────────────────────────────────────────────────────────┐
  │  [F1] ANGRIFF      +30% DMG  -20% DEF                     │
  │  [F2] AUSGEWOGEN   Balanced (Standard)                     │
  │ ►[F3]◄DEFENSIV ███ -25% DMG  +35% DEF  ███  [AKTIV]◄    │  ← Grün #00FF88
  └────────────────────────────────────────────────────────────┘
```

---

## 8. EMP-Effekt-Visualisierung

```
  EMP feuert (Animationsframes):

  Frame 1:        Frame 2:        Frame 3:        Frame 4 (Treffer):
  ╔═══╗           ╔═══╗           ╔═══╗           ╔═══╗
  ║EMP║ ≈         ║EMP║ ≈≈≈       ║EMP║ ≈≈≈≈≈≈    ║EMP║ ≈≈≈≈≈≈≈►  ✦ [TREFFER]
  ╚═══╝           ╚═══╝           ╚═══╝           ╚═══╝
                                                  SCHILD: DEAKTIVIERT

  Feind mit deaktiviertem Schild (2 Runden):

  ╔══ PIRATEN-JÄGER LV.5 ════════════╗
  ║   ... Schiff-Art ...              ║
  ║  SCH [░░░░░░░░░░░░░░]  0/0        ║
  ║  !!  [SCHILD OFFLINE] !!          ║  ← blinkt rot
  ║  (noch 1 Runde deaktiviert)       ║
  ║  RMP [████████░░░░░░] 60/90       ║
  ╚═══════════════════════════════════╝
```

---

## 9. Stations-Turm-Symbole (Radar)

```
  Auf dem Radar-Canvas neben Stations-Symbol:

  Ohne Verteidigung:    ▲        (Standard Station-Dreieck)
  1 Turm:              ▲•        (Punkt rechts)
  2 Türme:             ▲••       (zwei Punkte)
  3 Türme:             ▲•••      (drei Punkte)
  + Schild:            ▲[•]      (Klammern = Schild)
  + Schild + Türme:    ▲[••]
  Ionen-Kanone:        ▲[═]      (Gleichheitszeichen = Kanone)
  Eigene Station:      ⌂[••]     (Haus-Symbol)
```

---

## 10. Kompletter Kampf-Flow-Diagramm

```
  PIRATE AMBUSH EVENT
         │
         ▼
  ┌─────────────────────────────────────────────────────┐
  │ CombatV2Dialog öffnet sich                          │
  │                                                     │
  │ - Encounter-Daten laden (encounter, playerStats)    │
  │ - CombatV2State initialisieren                      │
  │   - playerHp = shipStats.hp (aktuell)               │
  │   - playerShield = shipStats.shieldHp               │
  │   - enemyHp = pirateBaseHp + level * perLevel       │
  │   - enemyShield = level >= 5 ? level * 5 : 0        │
  └─────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────┐
  │ RUNDENSTART (max 5 Runden)                          │
  │                                                     │
  │ 1. Schild-Regen anwenden                            │
  │    playerShield = min(maxShield, shield+regenRate)  │
  │                                                     │
  │ 2. Spieler wählt:                                   │
  │    [F1] ANGRIFF / [F2] AUSGEWOGEN / [F3] DEFENSIV  │
  │    Optional: [F4] ZIELEN / [F5] AUSWEICHEN          │
  │    Oder: [ESC] FLUCHT (→ 2 AP, 60% Chance)          │
  └─────────────────────────────────────────────────────┘
         │
         ▼ (Taktik gesendet via 'combatV2Action' Message)
  ┌─────────────────────────────────────────────────────┐
  │ SERVER: combatV2.ts — Runde auflösen               │
  │                                                     │
  │ A. Spieler-Angriff berechnen                        │
  │    - baseAttack + weaponBonus                       │
  │    - × tacticMultiplier                             │
  │    - × factionCombatBonus                          │
  │    - × rng(0.85, 1.15)                              │
  │    - EMP: 0 Schaden, Shield-Disable-Roll            │
  │    - Rakete: -pointDefenseRate wenn PD installiert  │
  │    - Rail: Piercing-Berechnung                      │
  │                                                     │
  │ B. Feind-Angriff berechnen                         │
  │    - enemyBase + level * perLevel                   │
  │    - × ecmPenalty (wenn ECM-Suite aktiv)           │
  │    - × rng(0.85, 1.15)                              │
  │    - Ausweichen: 50% Chance → 0 Schaden            │
  │                                                     │
  │ C. Schäden anwenden                                 │
  │    Spieler emp. Schaden:                            │
  │      shieldDmg = min(damage, currentShield)         │
  │      hullDmg = (damage-shieldDmg) * damageMod      │
  │    Feind emp. Schaden:                              │
  │      Schaden - enemyShield → enemyHp                │
  │                                                     │
  │ D. Sondereffekte                                    │
  │    ZIELEN: accuracyBonus + disableRoll              │
  │    EMP-Treffer: enemyShieldDisabled = 2 Runden      │
  │                                                     │
  │ E. CombatRound-Objekt erstellen                     │
  └─────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────┐
  │ SIEG/NIEDERLAGE-CHECK                               │
  │                                                     │
  │ enemyHp <= 0 ?                                      │
  │   → SIEG: Beute generieren, XP, Rep                │
  │   → BattleResult senden, CombatV2State beenden      │
  │                                                     │
  │ playerHp <= 0 ?                                     │
  │   → NIEDERLAGE: Cargo-Verlust berechnen            │
  │   → BattleResult senden, CombatV2State beenden      │
  │                                                     │
  │ round >= maxRounds ?                                │
  │   → AUTO-FLUCHT: Outcome 'escaped'                  │
  │   → BattleResult senden                             │
  └─────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────┐
  │ CLIENT: 'combatV2RoundResult' empfangen            │
  │                                                     │
  │ - CombatRound in Log hinzufügen                     │
  │ - HP-Balken animieren                              │
  │ - Sondereffekte darstellen (EMP-Blink, Treffer-X)  │
  │ - Bei finalResult: VictoryScreen/DefeatScreen       │
  └─────────────────────────────────────────────────────┘
```

---

*Dokument-Ende — voidSector Combat UI-Mockups v2*
