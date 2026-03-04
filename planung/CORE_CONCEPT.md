# Projekt: VOID SECTOR
**Stil:** Low-Fi Sci-Fi / Monochrome CRT / Mobile-First
**Genre:** 2D Space-Exploration Idle MMO

## 1. Vision
Ein unendliches 2D-Koordinatensystem (Grid), in dem Spieler erkunden, abbauen und handeln. Der Fokus liegt auf strategischem Ressourcenmanagement und Fraktionsdynamiken.

## 2. Kern-Mechaniken
### Action Points (AP)
* Jede Aktion (Sprung, Scan, Abbau) kostet AP.
* AP regenerieren sich über Zeit.
* Maximale AP und Regenerationsrate steigen durch Spieler-Level (XP).

### Exploration & Bewegung
* **Bekanntes Gebiet:** Sprungweite = Triebwerks-Level.
* **Unbekanntes Gebiet:** Max. 1 Sektor pro Sprung (Sicherheits-Protokoll).
* **Navigation:** Koordinaten-basiert (0,0 ist das Zentrum).

### Schiff & Rettung
* **Zerstörung:** Schiff geht verloren, Spieler spawnt an Home-Base.
* **Safe Slots:** Ein Basis-Slot im Inventar ist "rettungskapselsicher". Alle anderen Ressourcen gehen bei Zerstörung verloren. Safe Slots sind upgradebar.
* **Rettungsmission:** Bei Treibstoffmangel kann man sich abschleppen lassen (Kosten/Zeit skalieren mit Distanz).

### Fraktionen & Aliens
* **Fraktions-Baum:** Fraktionen leveln gemeinsam und wählen Boni mit Trade-offs (z.B. +Schildstärke vs. -Ladekapazität).
* **Alien-Reputation:** Prozedurale Quests für Alien-Rassen. Ruf-Gewinn bei Rasse A kann Ruf-Verlust bei Rasse B bedeuten. Hoher negativer Ruf führt zu Angriffen "on sight".

## 3. UI/UX Design
* **Farben:** Schwarz/Amber oder Schwarz/Grün.
* **Ansicht:** Mobile-First. Die Karte nimmt den oberen Teil ein, Steuerung und Status-Displays den unteren Teil.
* **Einfachheit:** Keine verschachtelten Menüs. Tabs für Karte, Basis, Inventar und Markt.