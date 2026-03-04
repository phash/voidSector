# UI/UX KONZEPT: VOID SECTOR INTERFACE (VSI)

## 1. Design-Philosophie: Die "Hardware-Metapher"
Die Benutzeroberfläche von *VOID SECTOR* wird nicht als klassisches Spielmenü behandelt, sondern als **virtuelle Hardware-Konsole**. Jedes UI-Element soll so wirken, als wäre es Teil eines analogen Hochleistungsrechners aus den 80er Jahren.

* **Look:** Amber-Monochrom (#FFB000 auf #050505).
* **Effekte:** Scanlines, leichte Bildschirmkrümmung (Vignette), Phosphor-Nachleuchten und subtiles Bildschirmflimmern.
* **Audio (Vorschlag):** Taktile Klick-Geräusche, mechanisches Summen der Monitore, Rauschen beim Umschalten der Frequenzen.

## 2. Das Multi-Monitor-System

### A. Mobile View (Single-Monitor-Focus)
Auf dem Smartphone entspricht der Screen exakt **einem** CRT-Monitor. 
* **Navigation:** Über eine feste "Hardware-Leiste" am unteren Rand (oder mechanische Tasten am Gehäuserand) schaltet der Spieler zwischen den Monitoren um.
* **Interaktion:** Touch-Gesten dienen zur Bedienung von Schaltern und Reglern innerhalb des simulierten Monitors.

### B. Web/Desktop View (Multi-Array)
Am Desktop nutzt das Spiel den Platz aus. Der Spieler kann sein Setup konfigurieren:
* **Side-by-Side:** Navigation links, Schiffs-Status in der Mitte, Marktplatz rechts.
* **Modularität:** Monitore können "an- und ausgeschaltet" oder in ihrer Anordnung getauscht werden.
* **Dashboard-Gefühl:** Das Gefühl, vor einer echten Raumschiff-Konsole zu sitzen.

## 3. Die Monitor-Module (Screens)

| Monitor-ID | Name | Hauptinhalt | Interaktive Elemente |
| :--- | :--- | :--- | :--- |
| **NAV-COM** | Navigation | Das 2D-Grid, Entdeckte Sektoren | Richtungs-Tasten, Scan-Button, Jump-Drive Hebel. |
| **SHIP-SYS** | Raumschiff | Ship-Status, Treibstoff, Fracht | Inventar-Management, Versicherungs-Status, Modul-Upgrades. |
| **BASE-LINK** | Home-Base | Gebäude-Übersicht, Produktion | Bau-Menü, Forschungs-Queue, Ressourcen-Transfer. |
| **MKT-NET** | Marktplatz | Handelsorders, Data-Slate Preise | Buy/Sell Order Eingabe, Handels-Log. |
| **COMM-DL** | Fraktion/Aliens | Chat, Quests, Reputation | Alien-Dialogfenster, Fraktions-Baum, Nachrichten. |

## 4. UI-Komponenten (Look & Feel)

* **Buttons:** Rechteckige Rahmen mit Pixelschrift. Beim Drücken invertieren die Farben (Amber Hintergrund, schwarzer Text).
* **Fortschrittsbalken:** Bestehen aus einzelnen Segmenten ( [||||||....] ).
* **Graphen:** Reine Vektor-Linien ohne Füllung.
* **Modale:** Wirken wie "Overlays" mit Warn-Symbolen (z.B. "WARNING: FUEL LOW").

## 5. Technisches UI-Stack (Vorschlag)
* **CSS-Filter:** `contrast()`, `brightness()` und ein `SVG-Filter` für die Scanlines.
* **Layout:** CSS-Grid für die Desktop-Monitor-Anordnung.
* **Animation:** `@keyframes` für das typische CRT-Einschalt-Flimmern.

## 6. User Flow (Beispiel)
1.  **Mobile:** Spieler sieht `NAV-COM`. Er tippt auf einen Sektor. Der Sprung kostet AP.
2.  **Umschalten:** Er wischt nach rechts oder drückt auf den physischen Button `SHIP`.
3.  **Ship-View:** Er sieht, dass sein Laderaum voll ist.
4.  **Umschalten:** Er geht auf `BASE-LINK`, um die Entladung in die Fabrik zu starten.