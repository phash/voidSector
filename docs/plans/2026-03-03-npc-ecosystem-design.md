# NPC-Ökosystem — Design

**Date:** 2026-03-03
**Status:** Approved
**Phase:** 4 (NPC-Ökosystem)

## Überblick

Phase 4 implementiert drei zusammenhängende Systeme: Prozedurale Alien-Quests, ein Reputations-System mit 4 NPC-Fraktionen, und Auto-Battle gegen Piraten mit Flee/Fight/Negotiate-Optionen.

## 1. NPC-Generation (Seed-basiert, Hybrid)

NPCs werden deterministisch pro Station generiert (`hashCoords(x, y, worldSeed)`), nicht in der DB gespeichert. Nur Spieler-Fortschritt (Quests, Reputation, Battles) wird persistiert.

Jede Station hat 1-3 NPCs. Name, Fraktion und Persönlichkeit ergeben sich aus dem Seed.

### Station-Fraktionsverteilung

| Typ | ID | Anteil | Quest-Fokus |
|---|---|---|---|
| Unabhängig | `independent` | ~30% | Gemischte generische Quests |
| Trader-Gilde | `traders` | ~28% | Fetch/Delivery |
| Forscher-Allianz | `scientists` | ~25% | Scan/Explore |
| Piraten-Syndikat | `pirates` | ~16% | Bounty/Kampf |
| Die Vergessenen | `ancients` | ~1% | Seltene Spezial-Quests |

Unabhängige Stationen bieten gemischte Quests ohne Fraktions-Bonus und dienen als neutrale Handelsposten.

## 2. Reputations-System

### Skala (pro Fraktion, pro Spieler)

Bereich: -100 bis +100 (Start: 0 bei allen).

| Stufe | Rep-Bereich | Freischaltung |
|---|---|---|
| Hostile | -100 .. -51 | NPCs verweigern Quests, Preise +50% |
| Unfriendly | -50 .. -1 | Nur einfache Quests verfügbar |
| Neutral | 0 | Standard-Quests, Standard-Preise |
| Friendly | 1 .. 50 | Bessere Quests, Negotiate-Option, Preise -10% |
| Honored | 51 .. 100 | Elite-Quests, exklusive Upgrades, Preise -25% |

### Fraktions-Upgrades (bei "Honored")

| Fraktion | Upgrade | Effekt |
|---|---|---|
| Traders | Cargo Expansion | +3 Cargo-Kapazität |
| Scientists | Advanced Scanner | areaScan-Radius +1 |
| Pirates | Combat Plating | +20% Kampf-Bonus |
| Ancients | Void Drive | -1 AP Kosten für Movement |

Upgrades sind passive Boni. Verliert man Rep unter Schwelle → Upgrade wird deaktiviert (nicht gelöscht).

## 3. Quest-System

### Quest-Typen

| Typ | Beispiel | Ziel | Abschluss |
|---|---|---|---|
| `fetch` | "Bringe 3 Ore" | Ressourcen abliefern | Bei Station abgeben |
| `delivery` | "Liefere Cargo zu Station (x,y)" | Zu Ziel-Station reisen | Bei Ziel-Station abgeben |
| `scan` | "Scanne Sektor (x,y)" | Bestimmten Sektor scannen | Automatisch bei Scan |
| `bounty` | "Eliminiere Piraten bei (x,y)" | Pirate-Sektor aufsuchen + kämpfen | Nach gewonnenem Kampf |

### Prozedurale Generation

- `generateStationQuests(stationX, stationY, worldSeed, dayOfYear)` → 2-4 Quests
- Seed sorgt dafür, dass alle Spieler dieselben Quests an einer Station sehen
- Tagesrotation: neuer dayOfYear = neue Quests
- Parameter (Ziel-Koordinaten, Mengen) werden aus umliegenden Sektoren abgeleitet

### Quest-Tracking

- Max 3 aktive Quests gleichzeitig
- Ablauf nach 7 Tagen wenn nicht abgeschlossen
- Ziele werden gegen Spieler-Aktionen geprüft (Scan, Kampf, Cargo-Abgabe)

### Rewards (skalieren mit Schwierigkeit)

- Credits: 10-500 CR
- XP: 5-100 (nutzt vorhandene xp/level Felder)
- Rep: +5 bis +25 bei Quest-Fraktion
- Optional: -5 Rep bei rivalisierender Fraktion

### Level-System

XP-Schwellen pro Level. Höhere Level → bessere Quests verfügbar, höhere Belohnungen.

## 4. Scan-Events

Beim Scannen: ~15% Chance auf Event (deterministisch via Seed).

| Event | Trigger | Verhalten | Belohnung |
|---|---|---|---|
| Piraten-Hinterhalt | Sofort beim Scan | Battle-Dialog (Flee/Fight/Negotiate) | Loot bei Sieg |
| Notsignal | Marker im Sektor | Spieler reist hin, Mini-Quest (Rettung) | Credits + Rep |
| Anomalie | Marker im Sektor | Spieler reist hin, Scan-Quest | XP + Scientist-Rep |
| Artefakt-Fund | Marker im Sektor | Spieler reist hin, Einmaliges Pickup | Ancient-Rep + CR |

## 5. Auto-Battle (Pirate-Encounters)

Auslöser: Pirate-Sektor betreten ODER Scan-Hinterhalt.

### 3 Optionen

**FLEE** — 2 AP Kosten, Fluchtchance basierend auf Ship-Speed vs Pirate-Level.
- Erfolg: Entkommen, kein Verlust
- Fehlschlag: Kampf wird erzwungen

**FIGHT** — Auto-Resolve basierend auf Stats.
- Ship-Attack + Weapons vs Pirate-HP/Defense
- Sieg: Loot (Credits + Ressourcen) + Pirate-Rep-Malus
- Niederlage: 25-50% Cargo-Verlust, kein Schiffs-Verlust

**NEGOTIATE** — Nur ab Pirate-Rep "Friendly" (+1).
- Kosten: Pirate-Level × 10 CR
- Ergebnis: Friedlich passieren, Pirate-Rep +1

### Pirate-Level

Basiert auf Entfernung vom Origin: `floor(distance / 50) + 1`, max 10.

## 6. DB-Schema

```sql
-- Reputation pro Spieler pro Fraktion
player_reputation: player_id, faction_id, reputation (int), updated_at

-- Aktive/abgeschlossene Quests
player_quests: id, player_id, quest_template_id, station_x, station_y,
               objectives JSONB, status, accepted_at, expires_at

-- Freigeschaltete Upgrades
player_upgrades: player_id, upgrade_id, active (bool), unlocked_at

-- Entdeckte Scan-Events
scan_events: id, player_id, sector_x, sector_y, event_type,
             status ('discovered'|'completed'), data JSONB, created_at

-- Kampf-Historie
battle_log: id, player_id, pirate_level, action, outcome,
            loot JSONB, created_at
```

## 7. UI

- **QUESTS Monitor** (neuer Sidebar-Monitor): Aktive Quests mit Fortschritt, verfügbare Quests bei Station
- **Battle-Dialog**: Modal bei Pirate-Encounter mit Flee/Fight/Negotiate + Pirate-Info
- **Station-Interaktion**: NPC-Liste mit Fraktion-Badge, Quest-Angebote
- **Rep-Anzeige**: Im QUESTS-Monitor, alle 4 Fraktionen mit Balken
- **Scan-Event-Marker**: Im Radar als spezielle Icons (Notsignal=blinkend, Anomalie=pulsierend)
