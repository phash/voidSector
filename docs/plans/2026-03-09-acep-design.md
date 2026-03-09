# ACEP — Adaptive Craft Evolution Protocol: Design Dokument

**Datum:** 2026-03-09
**Status:** APPROVED
**Ersetzt:** #146 (Schiffswechsel) — wird geschlossen

---

## Kernprinzip

Ein Spieler. Ein Schiff. Kein Tausch, kein Kauf eines anderen Schiffs.

Das Schiff ist keine Ausrüstung — es ist ein Begleiter. Es wächst mit dem Spieler, entwickelt einen Charakter, und stirbt irgendwann. Sein Erbe lebt weiter.

> *"Das Schiff lernt. Der Spieler lebt."*

---

## Zwei-Schichten-Progression

### Schicht 1: Hardware (Module)
- Module können jederzeit getauscht werden (an Stationen/Bases)
- Modulslots wachsen mit dem AUSBAU-Pfad
- Module sind handelbar (kaufen/verkaufen)
- Geben sofortige, messbare Boni

### Schicht 2: Erfahrung (Schiff-XP)
- Schiff lernt Fähigkeiten durch Erfahrung — nicht tauschbar, nicht handelbar
- XP kommt emergent durch Aktionen (kein manuelles Verteilen)
- Fähigkeiten verbessern die *Effizienz* der eingebauten Module
- Höhere XP = Module arbeiten besser, nicht anders

**Zusammenspiel:** Ein Level-5-KAMPF-Schiff mit mittelmäßigen Waffen-Modulen kann ein Level-1-Schiff mit top Modulen übertreffen — Erfahrung macht den Unterschied.

---

## Die 4 Entwicklungspfade

Jeder Pfad hat eigene XP-Quellen und Fähigkeiten. Pfade sind **gegenseitig limitierend** — maximales Investment in einen Pfad reduziert verfügbare Punkte für andere.

### AUSBAU
*"Mehr Raum. Mehr Kapazität. Mehr Möglichkeiten."*

| XP-Quelle | XP pro Aktion |
|-----------|---------------|
| Große Frachten transportieren | +5 XP |
| Stationen bauen | +20 XP |
| Bases bauen | +15 XP |
| Ressourcen im Bulk verkaufen | +2 XP |

**Fähigkeiten:**
- Zusätzliche Modul-Slots (bis +4 extra)
- Cargo-Kapazität-Multiplikator
- Schiff nimmt äußerlich sichtbar größere Form an

---

### INTEL
*"Daten sind Macht. Das Schiff denkt mit."*

| XP-Quelle | XP pro Aktion |
|-----------|---------------|
| Sektoren scannen | +3 XP |
| Neue Quadranten entdecken | +20 XP |
| Daten an Archivare liefern | +10 XP |
| Anomalien analysieren | +8 XP |

**Fähigkeiten:**
- Autopilot-Qualität steigt (bessere Routen, schwarze Löcher automatisch umgehen)
- Scan-Ergebnisse detaillierter
- Schiff "erinnert sich" an Sektor-Details länger (Staleness-Timer verlängert)
- Axiom-Puzzles werden mit INTEL-XP leichter

---

### KAMPF
*"Das Schiff kennt seine Feinde. Es lernt aus jedem Treffer."*

| XP-Quelle | XP pro Aktion |
|-----------|---------------|
| Kampf gewonnen | +10 XP |
| Pirat besiegt | +5 XP |
| K'thari Ehrenkampf gewonnen | +50 XP |
| Konvoi beschützt | +15 XP |

**Fähigkeiten:**
- Waffen-Module feuern schneller
- Schild-Module regenerieren effizienter
- K'thari-Rang-Voraussetzungen reduziert
- Taktische KI: Schiff warnt vor Bedrohungen früher

---

### EXPLORER
*"Das Schiff spürt das Unbekannte. Es zieht es an."*

| XP-Quelle | XP pro Aktion |
|-----------|---------------|
| Ancient-Ruine scannen | +15 XP |
| Erstkontakt mit Alien-Rasse | +100 XP |
| Helion-Signal interpretieren | +20 XP |
| Rand-Fragment der Axiome erhalten | +50 XP |

**Fähigkeiten:**
- Ancient-Ruinen werden auf Radar erkennbar (kleine Markierung)
- Infiltrations-Module (Silent Swarm) funktionieren effizienter
- Helion-Decoder funktioniert ohne spezielles Modul (ab Level 5)
- Axion-Karten-Fragmente erscheinen häufiger

---

## Schiffs-Charakter

Das Schiff entwickelt **Persönlichkeit** durch Erfahrung. Zwei Ebenen:

### Ebene 1: Traits (im Hintergrund)
Traits entstehen automatisch aus dominantem Pfad + Ereignissen:

| Trait | Entsteht durch | Effekt |
|-------|----------------|--------|
| `veteran` | 500+ Kämpfe | Moral-System: Crew-Effizienz +10% |
| `curious` | 1000+ gescannte Sektoren | Scan-Anomalie-Chance +5% |
| `reckless` | 50+ K'thari-Ehrenkämpfe | Schadens-Output +15%, Schild -10% |
| `cautious` | 20+ Fluchten überlebt | Auto-Rückzug bei < 20% HP |
| `ancient-touched` | 100+ Ancient-Ruinen | Rätsel-Chance +20% |
| `scarred` | 3+ nahe-Tod-Erlebnisse | HP-Regeneration +5%, Anxiety-Log-Einträge |

### Ebene 2: Persönlichkeit (sichtbar)
Schiff kommentiert Situationen in Meldungen — Ton ändert sich mit Traits:

**Junges Schiff (neutral):**
> `[SCHIFF] Sektor gescannt. 2 Asteroiden, 1 Station erkannt.`

**Veteran-Kampf-Schiff:**
> `[SCHIFF] Piratensignal. Bekannte Taktik. Empfehle Flankenangriff.`

**Ancient-touched Explorer-Schiff:**
> `[SCHIFF] Anomalie. ...ich kenne dieses Muster. Wir sollten näherkommen.`

**Scarred Schiff nach vielen Verlusten:**
> `[SCHIFF] Kampfsignal. ...wir kommen durch. Wir kommen immer durch.`

---

## Permadeath + Legacy

### Schiff stirbt wenn:
- HP auf 0 sinkt und kein Rettungs-Mechanismus aktiviert wird
- Spieler kann Eject-Pod aktivieren wenn HP < 15% (kostet alle Cargo)

### Was passiert:
1. **Wrack** entsteht als POI im Universum — andere Spieler können es finden
2. Wrack enthält: letztes Radar-Icon, letzter Log-Eintrag, ggf. Module (25% Chance geborgen)
3. Spieler beginnt mit **Nachfolger-Schiff**

### Legacy-System:
Das Nachfolger-Schiff erbt:
- **30% der XP** des Vorgängers (verteilt über alle Pfade)
- **1 Trait** des Vorgängers (der dominanteste)
- **Radar-Icon Basis-Element** des Vorgängers (Heraldik-Sektion "Ahnen")
- **Startet bei der letzten Base** des Spielers

### Narben-System:
Wenn das Schiff fast stirbt (< 5% HP überlebt):
- Trait `scarred` steigt
- Radar-Icon bekommt visuellen "Kratzer"
- Schiff-Log zeigt den Moment: `[SCHIFF] System-Neustart nach kritischem Treffer. Notfall-Protokoll aktiv.`

---

## Radar-Icon System

### Evolutionäres Icon
Das Radar-Icon wächst und verändert sich mit der Schiffsentwicklung:

| Entwicklungsstufe | Icon-Größe | Visuelle Merkmale |
|-------------------|------------|-------------------|
| Neuling (0–50 XP) | 3×3 Pixel | Einfaches Dreieck |
| Erfahren (50–200 XP) | 5×5 Pixel | Pfad-spezifische Form |
| Veteran (200–500 XP) | 7×7 Pixel | Details, Errungenschaften |
| Legende (500+ XP) | 9×9 Pixel | Vollständiges Wappen |

**Pfad-spezifische Formen:**
- AUSBAU-dominiert: breites, massiges Muster
- INTEL-dominiert: elegantes, schlankes Muster
- KAMPF-dominiert: spitzes, aggressives Muster
- EXPLORER-dominiert: asymmetrisches, ausgreifendes Muster

### Heraldik-Editor *(deferred)*
- Spieler kann Icon in Sektoren aufteilen (wie Wappenschilde)
- Errungenschaften als Icons einsetzen:
  - "Erstkontakt: Archivare" → Archivar-Symbol
  - "1000 Kämpfe gewonnen" → Schwerter
  - "Ancient-Hüter" → Kristall-Symbol
- Ahnen-Sektion: Vorgänger-Icon als kleines Element

---

## Tech-Tree Visualisierung

```
         [SCHIFF-KERN]
              │
    ┌─────────┼─────────┐
    │         │         │         │
 [AUSBAU]  [INTEL]  [KAMPF]  [EXPLORER]
    │         │         │         │
  Slots+    Scan+    Waffen+   Ancient+
  Cargo+    Auto+    Schild+   Infilt.+
  Form↑     Mem+     Rep-K+    Detect+

Punkte-Budget: 100 Punkte total
Max pro Pfad: 50 Punkte
→ Spezialisierung möglich, aber niemals perfekt in allem
```

---

## DB-Schema

```sql
-- Schiff (ein pro Spieler — kein Array)
ALTER TABLE ships ADD COLUMN acep_ausbau_xp INTEGER DEFAULT 0;
ALTER TABLE ships ADD COLUMN acep_intel_xp INTEGER DEFAULT 0;
ALTER TABLE ships ADD COLUMN acep_kampf_xp INTEGER DEFAULT 0;
ALTER TABLE ships ADD COLUMN acep_explorer_xp INTEGER DEFAULT 0;
ALTER TABLE ships ADD COLUMN acep_traits JSONB DEFAULT '[]';
ALTER TABLE ships ADD COLUMN acep_personality_type VARCHAR(30) DEFAULT 'neutral';
ALTER TABLE ships ADD COLUMN acep_generation INTEGER DEFAULT 1; -- Legacy-Zähler
ALTER TABLE ships ADD COLUMN acep_legacy_from_ship_id UUID; -- Vorgänger

-- Wracks (Permadeath-POIs)
CREATE TABLE ship_wrecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_ship_id UUID,
  player_name VARCHAR(100),
  quadrant_x INTEGER, quadrant_y INTEGER,
  sector_x INTEGER, sector_y INTEGER,
  radar_icon_data JSONB,      -- Icon für Rendering
  last_log_entry TEXT,
  salvageable_modules JSONB,  -- 25% Chance
  died_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versprechen (Mirror Minds)
CREATE TABLE ship_promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id VARCHAR(100),
  promise_text TEXT,
  target_metric VARCHAR(50),  -- z.B. 'deliver_ore'
  target_value INTEGER,
  deadline_tick BIGINT,
  fulfilled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Auswirkungen auf bestehende Issues

| Issue | Status | Grund |
|-------|--------|-------|
| #146 Schiffswechsel | **SCHLIESSEN** | ACEP ersetzt Multi-Ship-System komplett |
| #149 Station Rework | Erhöhte Priorität | Schiff-Terminal zeigt ACEP-Daten |
| Alien-Rassen | Verknüpft | Pfade geben Boni für spezifische Rassen |

---

## Implementierungs-Reihenfolge

1. **DB-Migration** — ACEP-Felder zu ships, ship_wrecks Tabelle
2. **XP-Engine** — XP-Vergabe bei Aktionen (in bestehende Services integrieren)
3. **Trait-System** — Trait-Berechnung aus XP + Ereignissen
4. **Persönlichkeits-Meldungen** — Schiff-Log mit Persönlichkeits-Typ
5. **Radar-Icon-Evolution** — Icon wächst mit XP-Summe
6. **Permadeath-Flow** — HP 0 → Wrack spawnen → Nachfolger mit Legacy
7. **Heraldik-Editor** *(deferred)*
