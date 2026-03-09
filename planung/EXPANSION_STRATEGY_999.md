# KONZEPT: THE GREAT EXPANSION (999-GRID-EDITION)

## 1. Das Makro-Gitter (Macro-Grid)
Das Universum ist in gigantische Quadranten unterteilt, um die unendliche Karte zu strukturieren.
* **Quadrant-Größe:** 999 x 999 Sektoren (ca. 1 Million Sektoren pro Quadrant).
* **Zentrum (0/0):** Hier befindet sich die "Terra-Station" (Max Tier), der Ausgangspunkt der gesamten menschlichen Expansion.
* **Besiedlungs-Logik:** Ein Quadrant gilt als 'besiedelt', sobald eine Station (Menschlich oder Spieler) darin aktiv ist.

## 2. Raumstation-Evolutionsstufen (Tiers)
Die Entwicklung einer Station wird durch Spieler-Quests (Ressourcen-Lieferungen, Scans) und automatische Drohnen-Arbeit vorangetrieben.

| Tier | Bezeichnung | Funktion | Expansions-Trigger |
| :--- | :--- | :--- | :--- |
| **I** | **Outpost** | Auftanken, Speicherpunkt, Basis-Scans. | Benötigt: 10k Eisen, 5k Energie. |
| **II** | **Command Hub** | Marktplatz, Quest-Board, Verteidigung. | Benötigt: 50k Eisen, 50 Artefakte. |
| **III** | **Industrial Node** | Baut Mining-Drohnen & **Bau-Schiffe**. | **Löst Expansion in Nachbar-Quadrant aus.** |
| **IV** | **Gate Terminal** | Aktiviert lokale Jumpgates. | **Ermöglicht "Leapfrog"-Expansion (Sprung).** |

## 3. Expansions-Logik für die KI
### A. Nachbarschafts-Expansion (The Wave)
Sobald eine Station **Tier III** erreicht:
1. **Zielwahl:** Prüft die 8 angrenzenden 999x999-Quadranten. Priorität hat der Quadrant, der am nächsten zum Rand liegt, aber noch keine Station hat.
2. **Bau-Schiff:** Ein langsames NPC-Bau-Schiff wird gespawnt. Es muss die physische Distanz im 999-Raster zum Zielpunkt (meist Quadranten-Mitte) überbrücken.
3. **Gründung:** Nach Ankunft wird eine neue Tier I Station errichtet.

### B. Jumpgate-Expansion (The Leap)
Tier IV Stationen scannen ihren Quadranten nach Jumpgates:
1. Identifizierte Tore führen oft in Quadranten, die weit außerhalb der aktuellen "Welle" liegen.
2. Die Station entsendet ein Expeditionsteam, um auf der Gegenseite einen neuen Expansions-Kern zu bilden.

## 4. Spieler-Rolle & Player-Seeds
* **Katalysator:** Spieler können durch Groß-Lieferungen ("Expansion-Pushes") die Zeit bis zum Bau eines neuen Bau-Schiffs massiv verkürzen.
* **Expansion Kits:** Spieler können in ihrer Komponentenfabrik eigene "Expansion-Samen" bauen, um selbst Stationen in völlig unbesiedelten 999x999 Quadranten zu gründen.

## 5. Automatisierung: Mining-Drohnen
* Ab **Tier III** agiert die Station autark.
* Drohnen fliegen im Radius von 50 Sektoren Asteroiden an.
* Gesammelte Ressourcen fließen direkt in den globalen "Upgrade- & Bau-Pool" der Station.

## 6. Datenstruktur (JSON Entwurf für die KI)
```json
{
  "quadrant_coord": {"qx": 1, "qy": 0},
  "sector_range": {"x": [1, 999], "y": [-499, 499]},
  "station": {
    "id": "ST-A1",
    "owner": "Human_Federation",
    "tier": 3,
    "resources": {"iron": 12000, "energy": 8000},
    "construction_ship_deployed": false,
    "expansion_target": {"qx": 2, "qy": 0}
  }
}