# UX, Scan, Comms & Infrastructure Overhaul — Design

**Datum:** 2026-03-02
**Status:** Genehmigt

## 1. Scope

Acht Arbeitsbereiche in einer Iteration:

1. **Jump-Animation** — CRT-Glitch + Radar-Slide beim Sektorwechsel
2. **Radar Zoom/Pan** — Scrollbar, zoombar, Drehräder am Bezel
3. **Kontrast & Farben** — Dickere Linien, Farbakzente, Brightness-Knob, Profil-Farben, Legende
4. **Zweistufiger Scan** — Lokal-Scan (Ressourcen) + Umgebungs-Scan (Nachbarsektoren)
5. **AP-Anzeige** — Kosten-Preview, Verbrauchs-Flash, Regen-Timer
6. **Spawn-System** — Cluster-Spawn 10M+ von Origin, Race-to-Origin Badge
7. **Kommunikation & Infrastruktur** — Komm-System, Relays, Stationen, Basen, COMMS-Monitor
8. **Tests** — Server Unit-Tests erweitern, Client UI-Tests neu einrichten

## 2. Jump-Animation

### Ablauf (800ms gesamt)

1. **Phase 1 (0-200ms):** CRT-Glitch — Scanlines verzerren, horizontale Shift-Artefakte, Static-Noise-Flash
2. **Phase 2 (200-600ms):** Grid slided in Sprungrichtung (↑ = Grid scrollt nach unten). Alte Zellen gleiten raus, Void/Static dazwischen. Glitch reduziert weiter
3. **Phase 3 (600-800ms):** Neue Sektor-Daten geladen, Grid settlet an Endposition, Glitch faded aus

### Implementierung

- `AnimationState` im RadarRenderer: `{ phase, progress, direction, startTime }`
- CRT-Glitch als Canvas-Layer: Noise-Texture + Scanline-Displacement
- Server-Response wird während Animation gepuffert
- Falls Animation fertig aber Response nicht da: `"ESTABLISHING LINK..."` Zustand
- Rein client-seitig, kein Server-Impact

## 3. Radar Zoom, Pan & Bezel-Steuerung

### Zoom

- Mausrad/Pinch verändert Zellgröße (3 Stufen: 48px, 64px, 80px)
- Rauszoomen zeigt mehr Sektoren, reinzoomen mehr Detail
- Drehrad rechts am Bezel als Alternative

### Pan

- Drag auf Radar verschiebt sichtbaren Ausschnitt (max 3 Sektoren vom Spieler)
- Doppelklick zentriert zurück
- Drehrad links am Bezel für Pan

### Bezel-Redesign

```
┌──────────────────────────────────────────┐
│ [PAN]  ┌────────────────────────┐ [ZOOM] │
│  (o)   │                        │  (o)   │
│        │      RADAR CANVAS      │        │
│        │                        │        │
│        └────────────────────────┘        │
│        [BRIGHTNESS (o)]  [? HELP]        │
└──────────────────────────────────────────┘
```

- Links: Pan-Drehrad (Drag up/down = Y-Pan, Shift+Drag = X-Pan)
- Rechts: Zoom-Drehrad
- Unten: Brightness-Drehrad + Help-Button
- Drehräder visuell als geriffelte Metallknöpfe, interaktiv per Drag

## 4. Kontrast, Farben & Legende

### Grid-Verbesserungen

| Element | Alt | Neu |
|---|---|---|
| Grid-Linien Opacity | 0.08 | 0.25 |
| Grid-Linien Breite | 1px | 2px |
| Koordinaten-Format | `[1/-4]` | `(1,-4)` |
| Dim-Color Opacity | 0.4 | 0.6 |

### Farbakzente pro Sektortyp

| Sektortyp | Farbe | Hex |
|---|---|---|
| Empty | Amber (default) | #FFB000 |
| Asteroid | Orange | #FF8C00 |
| Nebula | Cyan | #00BFFF |
| Station | Grün | #00FF88 |
| Anomaly | Magenta | #FF00FF |
| Pirate | Rot | #FF3333 |
| Home Base | Weiß | #FFFFFF |

Symbol UND Label in Sektorfarbe. Grid-Linien bleiben Amber/Primärfarbe.

### Brightness-Drehrad

- Steuert globale Opacity-Multiplikator (0.5x bis 1.5x)
- Beeinflusst Grid, Labels, Symbole gleichmäßig
- Wert wird im LocalStorage persistiert

### Profil-Farbeinstellungen

- Im SHIP-SYS Monitor oder Settings-Bereich
- Vorsets: "Amber Classic", "Green Phosphor", "Ice Blue", "High Contrast"
- Custom: Primärfarbe per Farbpicker
- Persistiert in LocalStorage, überschreibt CSS-Variablen

### Legende/Hilfe

- `[?]` Button am Bezel unten öffnet Overlay
- Zeigt: Symbol → Name → Beschreibung für jeden Sektortyp
- Zeigt: Ressourcen-Icons, Spieler-Icon, Scanner-Hinweise
- Schließt per Klick oder ESC

## 5. Zweistufiger Scan

### 5a — Lokal-Scan

- Neuer Button `[LOCAL SCAN]` im NAV-COM Monitor
- Kostet 1 AP
- Enthüllt Inhalte im aktuellen Sektor, abhängig von Scanner-Level:
  - **Level 1:** Erze (ore, gas, crystal) + Grundtyp
  - **Level 2:** + Rare Resources (dark matter, alien alloy)
  - **Level 3:** + Hidden Objects (Wracks, Caches, Anomaly-Artefakte)
- Falls Scanner nicht ausreicht: `"UNKNOWN SIGNATURES DETECTED — SCANNER UPGRADE REQUIRED"`
- Ergebnis aktualisiert MINING-Monitor Ressourcen-Bars

### 5b — Umgebungs-Scan (Area Scan)

- Bestehender `[SCAN]` wird zu `[AREA SCAN]`
- Radius und AP-Kosten nach Scanner-Level:

| Scanner-Level | Radius | AP-Kosten |
|---|---|---|
| 1 | 2 | 3 |
| 2 | 3 | 5 |
| 3 | 5 | 8 |

- Aufgedeckte Sektoren zeigen Typ + Koordinaten (keine Ressourcen — dafür Lokal-Scan nötig)
- Radar-Animation: Sektoren decken sich kreisförmig vom Zentrum nach außen auf (Sweep-Effekt, ~500ms)

### Neue Messages

| Message | Richtung | Payload |
|---|---|---|
| `localScan` | Client → Server | `{}` |
| `localScanResult` | Server → Client | `{ resources: SectorResources, hiddenSignatures: boolean }` |
| `areaScan` | Client → Server | `{}` (ersetzt `scan`) |
| `areaScanResult` | Server → Client | `{ sectors: SectorData[], apRemaining: number }` (ersetzt `scanResult`) |

## 6. AP-Anzeige & Feedback

### Verbrauchs-Feedback

- AP-Bar flasht kurz rot/weiß bei Ausgabe
- Verbrauchter Anteil "fällt ab" (Slide-Animation)
- Zahl blinkt 2x (z.B. `92/100` → flash → `89/100`)
- Wenn AP nicht reicht: Button pulst rot, Tooltip `"NOT ENOUGH AP (need 3, have 2)"`

### Kosten-Preview

- Hover über Buttons zeigt AP-Kosten als Tooltip
- Vorschau-Marker auf AP-Bar: Zu verbrauchender Anteil gestreift/heller dargestellt

### Regen-Anzeige

Kompaktes Format in einer Zeile:

```
AP: 89/100 ████████████████░░░░ [0.5/s | FULL 22s]
```

- Live-Countdown bis voll
- Wenn voll: `"FULL"` in Grün gedimmt
- Bar füllt sich smooth (CSS-Transition) statt sprunghaft

## 7. Spawn-System & Race to Origin

### Cluster-Spawn

- Bei Registrierung: Server generiert Position ≥ 10.000.000 Sektoren von (0,0)
- Algorithmus: Zufälliger Winkel (0-360°), Distanz 10M + random(0, 2M) → X/Y berechnen
- Cluster-Zuordnung: Neuer Spieler wird bestehendem Cluster zugeordnet (falls < 5 Spieler in Radius 100), sonst neuer Cluster
- `home_base` in DB auf Cluster-Position gesetzt

### Distanz-Anzeige

- Im NAV-COM: `"ORIGIN: 10,234,567 SECTORS"` — Live-Distanz zu (0,0)
- Euklidische Distanz: `Math.ceil(Math.sqrt(x² + y²))`

### Race to Origin Badges

- Neue DB-Tabelle `badges`: `player_id, badge_type, awarded_at`
- Erster Spieler der (0,0) betritt: Badge `ORIGIN_FIRST` (exklusiv)
- Alle weiteren: Badge `ORIGIN_REACHED`
- Globale Announcement bei `ORIGIN_FIRST`
- Badge-Anzeige im SHIP-SYS Monitor

## 8. Kommunikation & Infrastruktur

### Komm-System

- Neues Schiff-Attribut `commRange`: AEGIS = 50 Sektoren, HELIOS = 200 Sektoren
- Direktchat möglich wenn: `Distanz ≤ commRange_A + commRange_B`
- Oder: Relay-Kette verbindet beide Spieler

### Relay-Kette

- Relay hat eigene Reichweite (500 bzw. 1000 Sektoren)
- Routing: Server baut Graph aus allen Relays/Basen + Spielerpositionen
- Nachricht zustellbar wenn Pfad im Graph existiert

### Verzögerte Zustellung

- Nachrichten an Spieler außerhalb Reichweite: gespeichert in `pending_messages` Tabelle
- Bei Room-Join: Server prüft ob unzugestellte Nachrichten jetzt zustellbar sind
- Zustellung mit Original-Timestamp: `"[2h ago] PhashX: Hey, found a station at (10234, -5001)"`

### Bauwerke

| Bauwerk | Kosten | Funktion | Relay-Range |
|---|---|---|---|
| Komm-Relay | 5 Ore, 2 Crystal | Komm-Netz erweitern | 500 Sektoren |
| Mining-Station | 30 Ore, 15 Gas, 10 Crystal | Rohstoff-Abbau + Relay | 500 Sektoren |
| Basis | 50 Ore, 30 Gas, 25 Crystal | Heimatbasis + Relay + Spawn | 1000 Sektoren |

- Bauen: Button `[BUILD]` im NAV-COM, kostet AP + Ressourcen aus Cargo
- Persistenz: `structures` Tabelle (`id, owner_id, type, sector_x, sector_y, created_at`)
- Sichtbar auf Radar als eigene Symbole

### COMMS Monitor (5. Tab)

```
┌─── COMMS ──────────────────────────────────┐
│ [DIRECT] [FACTION] [LOCAL]                 │
│                                            │
│ > [14:20] PhashX: Found station at (10234) │
│ > [14:22] VoidWalker: On my way            │
│ > [2h ago] Scout7: Anyone near cluster 4?  │
│                                            │
│ ── IN RANGE ────────────────               │
│ ◆ PhashX      — 12 sectors                │
│ ~ VoidWalker  — ~NE (comms only)           │
│                                            │
│ [____________________________] [SEND]      │
└────────────────────────────────────────────┘
```

- Kanal-Tabs oben: DIRECT (1:1), FACTION (Gruppe), LOCAL (alle in Komm-Range)
- Chat-Verlauf mit Timestamps, verzögerte Nachrichten mit `[Xh ago]`
- Spielerliste: In Scanner-Range = exakt, nur Komm-Range = vage Richtung
- Ungelesen-Indikator auf Tab: `[COMMS •]`

### Radar-Integration

- Spieler in Scanner-Range: ◆ Symbol + Name im Sektor
- Spieler in Komm-Range aber außerhalb Scanner: Richtungspfeil am Radar-Rand + `"~Name"`

## 9. Tests

### Server Unit-Tests (Vitest, erweitern)

| Testdatei | Tests |
|---|---|
| `commands.test.ts` | + `validateLocalScan`, `validateAreaScan` (Scanner-Level), `validateBuild` |
| `worldgen.test.ts` | + Hidden Signatures Generierung |
| `spawn.test.ts` (neu) | Cluster-Distanz ≥ 10M, Cluster-Zuordnung, Badge-Vergabe |
| `comms.test.ts` (neu) | Reichweite, Relay-Routing, verzögerte Zustellung |
| `structures.test.ts` (neu) | Bauwerk erstellen, Kosten-Validierung, Relay-Netz |

### Client UI-Tests (Vitest + React Testing Library, neu)

| Testdatei | Tests |
|---|---|
| `NavControls.test.tsx` | Jump-Klick, disabled bei jumpPending, AP-Kosten-Preview |
| `RadarCanvas.test.tsx` | Zoom-State, Pan-Offset begrenzt, Doppelklick zentriert |
| `MiningScreen.test.tsx` | Mine-Button, Stop-Button bei aktivem Mining |
| `CargoScreen.test.tsx` | Jettison nur aktiv wenn Ressource > 0 |
| `CommsScreen.test.tsx` | Nachricht senden, Kanal wechseln, Ungelesen-Indikator |
| `MonitorBezel.test.tsx` | Drehräder verändern State, Tab-Wechsel |

### Test-Setup

- `@testing-library/react` + `jsdom` als Vitest-Environment
- Mock für `useStore` (Zustand) und `network` (WebSocket)
- Canvas-Tests via `jest-canvas-mock`
- E2E-Tests (Playwright) als späteres Follow-up, Infrastruktur vorbereiten

## 10. Neue Shared Types

```typescript
// Scan
interface LocalScanResult {
  resources: SectorResources;
  rareResources?: Record<string, number>;
  hiddenObjects?: string[];
  hiddenSignatures: boolean;
}

// Structures
type StructureType = 'comm_relay' | 'mining_station' | 'base';

interface Structure {
  id: string;
  ownerId: string;
  type: StructureType;
  sectorX: number;
  sectorY: number;
  createdAt: string;
}

interface BuildMessage {
  type: StructureType;
}

// Communication
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  channel: 'direct' | 'faction' | 'local';
  recipientId?: string;  // for direct messages
  content: string;
  sentAt: number;
  delayed: boolean;
}

// Badges
type BadgeType = 'ORIGIN_FIRST' | 'ORIGIN_REACHED';

interface Badge {
  playerId: string;
  badgeType: BadgeType;
  awardedAt: string;
}
```

## 11. Neue DB-Migrationen

```sql
-- 003_structures.sql
CREATE TABLE IF NOT EXISTS structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES players(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  sector_x INTEGER NOT NULL,
  sector_y INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (sector_x, sector_y, type)
);

-- 004_comms.sql
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES players(id),
  recipient_id UUID REFERENCES players(id),
  channel VARCHAR(16) NOT NULL DEFAULT 'direct',
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS badges (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  badge_type VARCHAR(32) NOT NULL,
  awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (player_id, badge_type)
);

-- 005_spawn_clusters.sql
CREATE TABLE IF NOT EXISTS spawn_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  center_x INTEGER NOT NULL,
  center_y INTEGER NOT NULL,
  player_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 12. Zukünftige Features (notiert)

- **Skilltree** — AP-Upgrades, Scanner-Upgrades, Komm-Range-Upgrades durch XP
- **Fuel-System** — Issue #14
- **Markt & Handel** — Issue #13
- **Auto-Scanner** — Höhere Scanner-Level scannen Umgebung automatisch
- **Fraktionen** — Gruppen, Fraktions-Chat-Kanal, geteilte Relays
