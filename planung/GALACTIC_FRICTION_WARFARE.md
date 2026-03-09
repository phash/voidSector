# KONZEPT: GALACTIC FRICTION (NPC-Kriegsführung)

## 1. Das Grenz-System (Conflict Zones)
Kämpfe finden dynamisch an den Grenzen der Einflusssphären statt (z. B. dort, wo ein besiedelter menschlicher Quadrant an Alien-Territorium grenzt).

* **Friction Score (0-100):** Jeder Grenz-Quadrant besitzt einen Reibungswert.
    * **0–20 (Scharmützel):** Gelegentliche Piraten oder Alien-Scouts. Geringes Risiko für Stationen.
    * **21–70 (Eskalation):** Regelmäßige NPC-Flottenbewegungen. Mining-Drohnen benötigen Eskorten.
    * **71–100 (Totaler Krieg):** Massive Belagerungen. Stationen können zerstört oder übernommen werden.

## 2. Die Rolle der NPCs (The Combatants)
Raumstationen ab Tier III generieren automatisch militärische Einheiten, um den 999x999-Raum zu sichern.

* **Patrouillen:** Sichern automatisierte Mining-Routen innerhalb des Quadranten.
* **Invasions-Flotten:** Werden von Tier IV Stationen ausgesandt, um feindliche Quadranten zu destabilisieren.
* **Auto-Battle-Logik:** Treffen zwei Flotten aufeinander, wird das Ergebnis serverseitig berechnet. Die Gewinnchance basiert auf der Flottenstärke und den Spieler-Beiträgen.

## 3. Die Rolle der Spieler (The Enablers)
Spieler kämpfen nicht direkt in der "Frontlinie", sondern fungieren als strategische Unterstützer. Ihre Aktionen modifizieren die Kampfwerte der NPC-Fraktion.

| Quest-Typ | Auswirkung auf NPC-Kampf | Mechanik |
| :--- | :--- | :--- |
| **Logistik** | Erhöht Schadensoutput | Lieferung von "Munition & Treibstoff" an die Frontstation. |
| **Scanning** | Erhöht Trefferchance | "Deep Space Scans" decken feindliche Flottenpositionen auf. |
| **Sabotage** | Senkt feindliche Schilde | Hacken von feindlichen Kommunikations-Relais im Zielsektor. |
| **Bergung** | Beschleunigt Forschung | Sammeln von Trümmern (Debris) nach Schlachten für Tech-Boni. |

## 4. Kampf-Algorithmus (Für die Coding-KI)
Die Gewinnchance $P_{win}$ einer menschlichen NPC-Flotte gegen eine Alien-Flotte wird wie folgt berechnet:

$$P_{win} = \frac{BasePower_{Human} + \sum QuestBonus_{Player}}{TotalPower_{Combined}}$$

* **Logistik-Bonus:** Additiver Wert auf die Grundstärke der Flotte.
* **Sabotage-Bonus:** Subtraktiver Wert, der die gegnerische Verteidigung schwächt.
* **Scan-Bonus:** Multiplikator, der die Effizienz der Flotte steigert (Vermeidung von Hinterhalten).

## 5. Auswirkungen & Konsequenzen
* **Sieg der Menschheit:** Die feindliche Präsenz wird verdrängt. Ein Bau-Schiff wird entsandt, um eine neue Station zu gründen.
* **Niederlage:** Die menschliche Station wird beschädigt oder zerstört. Spieler müssen evakuieren. Der Quadrant wird als "Lost Sector" markiert.
* **Belohnung:** Spieler erhalten **War Bonds** (Kriegsanleihen), die gegen exklusive Schiffsmodule oder seltene Baupläne getauscht werden können.

## 6. UI-Integration (NAV-COM Monitor)
Das Karten-Interface benötigt ein strategisches Overlay:
* **Frontline-Indikator:** Eine visuelle Grenze (Glow-Effekt), die den aktuellen Machtbereich markiert.
* **Conflict Icons:** Animierte Symbole (z. B. gekreuzte Schwerter) in Quadranten mit hohem Friction Score.
* **War Ticker:** Ein Text-Laufband am unteren Rand des Monitors mit Echtzeit-Meldungen (z. B. *"ATTENTION: Siege in Quadrant [12/-4] - Logistics required!"*).