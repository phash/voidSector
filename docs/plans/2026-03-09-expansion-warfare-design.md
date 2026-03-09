# Galactic Expansion & Warfare — Design Dokument

**Datum:** 2026-03-09
**Status:** APPROVED
**Abhängig von:** Phase LU (#177–184), UniverseTickEngine (#179)

---

## Kernprinzipien

1. **Expansion ist bilateral** — Menschen expandieren als Welle von 0:0, Aliens als Kugeln von ihren Heimat-Zentren.
2. **Grenz-Kontakt ist kein automatischer Krieg** — das Verhalten hängt vom `humanityRepTier` der beteiligten Fraktion ab.
3. **Kampf ist abstrakt, aber sichtbar** — Attack/Defense pro Quadrant als einfaches Zahlenmodell, NPC-Flotten auf dem QUAD-MAP visuell erlebbar.
4. **Spieler sind Enabler** — keine direkte Frontlinie, aber entscheidender Einfluss durch Quests (Krieg oder Diplomatie).
5. **Lebendige Grenzen** — Rep steigt → Frieden, Rep sinkt → Eskalation. Alles dynamisch.

---

## 1. Expansions-Modell

### Menschen (Welle von 0:0)

- Terra-Station (0:0) ist Tier IV, voll entwickelt — Ausgangspunkt
- **Tier III Station** → spawnt Bau-Schiff Richtung freien Nachbar-Quadrant (Nachbarschafts-Expansion)
- **Tier IV Station** → scannt nach Jumpgates, kann Sprungexpansion in weit entfernte Quadranten auslösen
- Bau-Schiffe sind langsam, unbewaffnet, auf dem QUAD-MAP sichtbar

### Station-Tiers

| Tier | Bezeichnung | Funktion | Expansions-Trigger |
|------|-------------|----------|--------------------|
| I | Outpost | Tanken, Speicherpunkt, Basis-Scans | — |
| II | Command Hub | Marktplatz, Quest-Board, Verteidigung | — |
| III | Industrial Node | Mining-Drohnen, Bau-Schiffe | **Spawnt Bau-Schiff → Nachbar-Quadrant** |
| IV | Gate Terminal | Aktiviert Jumpgates | **Ermöglicht Sprungexpansion** |

### Aliens (Kugeln von Heimat-Zentren)

- Jede Fraktion hat `home_qx`, `home_qy` — expandiert priorisiert innerhalb des eigenen Kugelradius
- Freie Quadranten werden bevorzugt
- Expansion-Rate und Aggressions-Faktor sind pro Fraktion konfigurierbar

### Fraktions-Persönlichkeiten

| Fraktion | Stil | Aggression |
|----------|------|------------|
| K'thari | Militärisch, aggressiv | Hoch |
| Silent Swarm | Schwarm-Invasion | Sehr hoch |
| Archivare | Statisch, konservativ | Sehr gering |
| Konsortium | Wirtschaftlich, friedlich | Gering |
| Touristengilde | Bunt, harmlos | Minimal |
| Mycelianer | Organisch, langsam | Gering |
| Mirror Minds | Reaktiv (spiegelt Spieler-Rep) | Variabel |

### Kollisionserkennung

Wenn ein Bau-Schiff/Frachter in einen Quadrant will, der bereits von einer anderen Fraktion **beansprucht** ist (= min. eine Station vorhanden) → **Border Contact Event** wird ausgelöst.

---

## 2. Grenz-Kontakt & Diplomatie

### Friction Score aus humanityRepTier

Friction Score wird direkt aus dem bestehenden `humanityRepTier`-System abgeleitet:

| humanityRepTier | Friction | Grenz-Verhalten |
|-----------------|----------|-----------------|
| ALLY / FRIENDLY | 0–20 | **Friedlicher Halt** — Expansion stoppt, keine Schiffe |
| NEUTRAL | 21–50 | **Scharmützel** — gelegentliche Scouts, kein Stationsangriff |
| HOSTILE | 51–80 | **Eskalation** — Flottenbewegungen, Mining gefährdet |
| ENEMY | 81–100 | **Totaler Krieg** — Invasionen, Stationen angreifbar |

### Fraktions-Aggression modifiziert Schwellwert

- Aggressive Fraktionen (K'thari, Silent Swarm): NEUTRAL startet mit Friction +20
- Friedliche Fraktionen (Konsortium, Touristengilde): NEUTRAL startet mit Friction -15

### Lebendige Grenzen

- Rep sinkt → Friction steigt → Halt wird Krieg
- Rep steigt → Friction sinkt → Krieg wird Halt, Halt wird Frieden
- Übergänge passieren graduell pro Strategic Tick

### Spieler-Einfluss auf Diplomatie

- **Diplomatie-Quests** (aktiv wählbar): Rep mit Zielfraktion erhöhen → Expansion stoppt
- **Sabotage-Quests**: Rep mit Zielfraktion senken → Expansion ermöglicht / Krieg eskaliert
- Spieler können gezielt steuern, welche Grenzen friedlich und welche Kriegszonen sind

---

## 3. Kampf-Modell

### Quadrant-Werte

```
attack  = Summe aller angreifenden Schiffe (fließen aus Nachbar-Quadranten ein)
defense = Summe aller Verteidigungs-Schiffe + Station-Wert
```

**Station-Wert (immobil, stark):**
- Tier I: 100 | Tier II: 300 | Tier III: 700 | Tier IV: 1500

**Schiff-Flow:**
- Angreifer: max. 50% der Flotte aus jedem kontrollierten Nachbar-Quadrant pro Strategic Tick
- Verteidiger: Verstärkung kommt ebenso aus Nachbar-Quadranten

### Kampf-Auflösung (Strategic Tick, z.B. alle 60s)

```
if attack > defense × 1.2:
  → Verteidiger verliert 10% defense
  → wenn defense ≤ 0: Quadrant wechselt Besitzer, Station beschädigt/zerstört

elif defense > attack × 1.2:
  → Angreifer verliert 10% attack
  → wenn attack ≤ 0: Invasion abgebrochen

else (Patt):
  → beide verlieren 5%
```

*Schwellwert (1.2) und Verlustwerte (10%/5%) werden live angepasst.*

### Spieler-Quest-Boni (direkte Modifikation)

| Quest-Typ | Auswirkung |
|-----------|------------|
| Logistik | +X auf eigene defense oder attack |
| Sabotage | −X auf feindliche defense |
| Scanning | Multiplikator auf eigene attack (Hinterhalt-Bonus) |
| Bergung | Tech-Bonus für nächste Tick-Auflösung |

---

## 4. Sichtbare NPC-Schicht (QUAD-MAP)

### Visuelle Elemente

- **Territorium-Farben** — Quadranten eingefärbt nach Fraktion (bestehende Alien-Farben aus Races-Design)
- **Gemischte Kontrolle** — anteilige Einfärbung (z.B. 70% K'thari-rot / 30% human-blau)
- **Bau-Schiffe** — Icon sichtbar während Transit zum Ziel-Quadrant
- **Frontline-Glow** — Quadranten mit Friction ≥ 50 haben pulsierenden Rand
- **Conflict Icons** — bei Friction ≥ 71 animierte Schwerter-Icons auf dem Quadrant
- **Flotten-Bewegung** — Invasions-Flotten als Pfeil-Icon zwischen Quadranten

### War Ticker (NAV-COM, unterer Rand)

```
▶ K'THARI INVASION — Quadrant [4/-2] — Logistik benötigt
▶ GRENZFRIEDEN — Archivare [7/3] — Expansion gestoppt
▶ MENSCHHEIT EXPANDIERT — Bau-Schiff → Quadrant [2/1]
▶ ESKALATION — Silent Swarm [−3/5] — Friction 78
```

### QUAD-MAP Detail-Panel (Klick auf Grenz-Quadrant)

- Fraktion + Rep-Tier
- Aktueller Friction Score
- Attack / Defense Werte
- Verfügbare Quests für diesen Quadrant

---

## 5. Datenmodell

### Neue DB-Tabellen

```sql
-- Quadrant-Kontrolle + Kampfwerte
quadrant_control (
  qx INTEGER,
  qy INTEGER,
  controlling_faction TEXT,
  faction_shares JSONB,           -- { "human": 70, "kthari": 30 }
  attack_value INTEGER,
  defense_value INTEGER,
  friction_score INTEGER,         -- 0-100
  station_tier INTEGER,
  last_strategic_tick TIMESTAMP
)

-- NPC-Schiffe (sichtbar auf QUAD-MAP)
npc_fleet (
  id UUID,
  faction TEXT,
  type TEXT,                      -- "build_ship" | "invasion" | "patrol"
  from_qx INTEGER,
  from_qy INTEGER,
  to_qx INTEGER,
  to_qy INTEGER,
  strength INTEGER,
  eta TIMESTAMP
)

-- Fraktions-Expansion-Konfiguration
faction_config (
  faction_id TEXT PRIMARY KEY,
  home_qx INTEGER,
  home_qy INTEGER,
  expansion_rate INTEGER,         -- Ticks zwischen Expansions-Versuchen
  aggression FLOAT,               -- Multiplikator auf Friction-Schwellwert
  expansion_style TEXT            -- "sphere" | "wave" | "jumpgate"
)
```

### Redis (flüchtige Live-Daten)

- `war_ticker` → Queue der letzten 10 Events für NAV-COM
- `npc_fleet:{id}` → Position + ETA (wird per Strategic Tick aktualisiert)

---

## 6. Einbindung in bestehende Architektur

- **UniverseTickEngine** (Phase LU #179) — Strategic Tick (60s) läuft hier neben dem Game-Tick (5s)
- **humanityRepTier** (bereits gebaut, AQ) — Friction Score wird daraus abgeleitet, kein neues System
- **QUAD-MAP** (bereits vorhanden) — visuelles Overlay für Territorien, Flotten, Conflict Icons
- **QuestService** — neue Quest-Typen: Diplomatie, Logistik-Krieg, Sabotage, Bergung
- **Nächste Migration:** 043 (`quadrant_control` + `npc_fleet` + `faction_config`)

---

## Abhängigkeits-Reihenfolge

```
Sprint 1 → Sprint 2 → Sprint 3 → Sprint 4
                                      ↓
                        Phase 2 (#162–168) — Sektor-Rebuild
                                      ↓
                        Phase LU (#177–184) — UniverseTickEngine
                                      ↓
                   Phase EW — Expansion & Warfare (dieses Dokument)
```
