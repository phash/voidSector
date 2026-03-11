// ---------------------------------------------------------------------------
// Compendium — In-game wiki: alle verfügbaren Spielsysteme (kein Alien-Content)
// ---------------------------------------------------------------------------

export type CompendiumCategory =
  | 'grundlagen'
  | 'navigation'
  | 'ressourcen'
  | 'kampf'
  | 'handel'
  | 'technik'
  | 'sozial'
  | 'fortgeschritten'
  | 'acep';

export interface CompendiumArticle {
  id: string;
  title: string;
  category: CompendiumCategory;
  icon: string;
  summary: string;
  body: string;
  seeAlso?: string[];
  tags?: string[];
}

export const COMPENDIUM_CATEGORIES: {
  id: CompendiumCategory;
  label: string;
  icon: string;
}[] = [
  { id: 'grundlagen', label: 'GRUNDLAGEN', icon: '◈' },
  { id: 'navigation', label: 'NAVIGATION', icon: '◎' },
  { id: 'ressourcen', label: 'RESSOURCEN', icon: '⬡' },
  { id: 'kampf', label: 'KAMPF', icon: '✦' },
  { id: 'handel', label: 'HANDEL', icon: '◆' },
  { id: 'technik', label: 'TECHNIK', icon: '⚙' },
  { id: 'sozial', label: 'SOZIAL', icon: '◉' },
  { id: 'fortgeschritten', label: 'FORTGESCHRITTEN', icon: '◇' },
  { id: 'acep', label: 'ACEP', icon: '⬟' },
];

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export const COMPENDIUM_ARTICLES: CompendiumArticle[] = [
  // ==========================================================================
  // GRUNDLAGEN
  // ==========================================================================

  {
    id: 'grundlagen-start',
    title: 'ERSTE SCHRITTE',
    category: 'grundlagen',
    icon: '◈',
    summary: 'Einführung in voidSector — Cockpit, Programme, erste Aktionen.',
    body: `Du befindest dich im Cockpit deines Schiffes. Das Interface besteht aus 6 Sektionen:

- **Sektion 1** (links): Programm-Selektor — 12 Buttons für alle Hauptprogramme
- **Sektion 2** (Mitte oben): Hauptmonitor — aktives Programm
- **Sektion 3** (Mitte rechts): Detail-Monitor — kontextabhängige Zusatzinfos
- **Sektion 4** (rechts oben): SHIP-SYS — Status, Module, Hangar (ACEP ist eigenes Programm in Sektion 1)
- **Sektion 5** (rechts Mitte): Navigation — Sektor-Info, AP, Steuerung
- **Sektion 6** (rechts unten): COMMS — Chat und Kommunikation

**Erste Aktionen:**
- Wähle NAV-COM → navigiere mit dem D-Pad oder klicke auf benachbarte Sektoren
- Führe einen LOKALSCAN durch (SCAN-Programm) um den aktuellen Sektor zu analysieren
- Suche einen Asteroiden-Sektor und starte MINING
- Fliege zu einer Station und nutze TRADE für Credits

**Aktionspunkte (AP):**
Du startest mit 100 AP. Sprünge und Scans kosten AP. AP regeneriert automatisch (0,5 AP/Sek).

**Ziel:**
Das Universum ist eine 10.000 × 10.000 Quadranten-Matrix. Du startest in der Nähe von [0:0]. Der Rand liegt irgendwo jenseits von [1000:1000].`,
    seeAlso: ['ap-system', 'monitore', 'navigation', 'acep-intro'],
    tags: ['start', 'einführung', 'cockpit', 'interface', 'basics'],
  },

  {
    id: 'universum',
    title: 'UNIVERSUM & WELTGENERIERUNG',
    category: 'grundlagen',
    icon: '◎',
    summary: 'Aufbau des Universums: Quadranten, Sektoren, absolute Koordinaten.',
    body: `Das voidSector-Universum ist hierarchisch strukturiert:

**Universum-Ebene:**
- 10.000 × 10.000 Quadranten (qx/qy: 0–9999)
- Quadrant [0:0] = Spawn-Region (Ecke, nicht Zentrum)
- Quadranten mit negativen Koordinaten existieren (z.B. [-1:0] links von [0:0])

**Quadrant-Ebene:**
- Jeder Quadrant enthält 10.000 × 10.000 Sektoren
- Absolute Sektor-Koordinate = qx × 10.000 + lokaler Sektor-X

**Sektor-Ebene:**
- Kleinste navigierbare Einheit
- Hat Typ, Umgebung, Ressourcen, Inhalte
- Deterministisch aus World-Seed generiert

**Dichteverteilung:**
- Nahe [0:0] (< 5000 Sektoren): Stationen 2,5× häufiger, Piraten 0,3× seltener
- Weit von [0:0] (> 5000 Sektoren): Stationen 0,3× seltener, Piraten 3× häufiger
- Nebel-Zonen: ab 200 Sektoren Distanz möglich
- Schwarze Löcher: cluster-basiert, max. 4-Sektor-Radius

**Erkundung:**
Der erste Spieler in einem neuen Quadranten erhält Namensrechte. Entdeckungen werden im QUAD-MAP visualisiert.`,
    seeAlso: ['quadranten', 'sektoren', 'quad-map'],
    tags: ['universum', 'koordinaten', 'quadrant', 'sektor', 'weltgenerierung'],
  },

  {
    id: 'quadranten',
    title: 'QUADRANTEN-SYSTEM',
    category: 'grundlagen',
    icon: '⬡',
    summary:
      'Quadranten sind die größten navigierbaren Einheiten — mit eigenem Namen, Entdeckungslog und Territory-System.',
    body: `Quadranten gruppieren je 10.000 × 10.000 Sektoren zu einer benennbaren Region.

**Quadranten-Wechsel:**
Ein normaler Sprung (D-Pad) kann die Quadrantengrenze überschreiten. Das System erkennt dies automatisch ("Cross-Quadrant-Sprung"). Du wechselst nahtlos in den benachbarten Quadranten.

**Erster Kontakt:**
- Der erste Spieler, der einen Quadranten betritt, gibt ihm seinen Namen
- Dieses Ereignis wird im NEWS-Programm gemeldet
- Der Quadrant wird in der QUAD-MAP markiert

**QUAD-MAP:**
Das QUAD-MAP-Programm zeigt alle bekannten Quadranten als Canvas-Raster. Eigene Position = hell, entdeckte Quadranten = gedimmt, unbekannte = schwarz.

**Territory (Gebietsansprüche):**
Im SHIP-SYS-Programm kannst du den aktuellen Quadranten beanspruchen (CLAIM). Kostet 20 Erz + 10 Kristall. Andere Spieler können deinen Anspruch anfechten (DEFEND-Mechanik).

| Defense-Rating | Angreifer-Gewinnchance |
|---|---|
| LOW | 50% |
| HIGH (K'thari-Grenzgebiet) | 25% |`,
    seeAlso: ['universum', 'quad-map', 'territorium', 'news-monitor'],
    tags: ['quadrant', 'entdeckung', 'territory', 'grenzen'],
  },

  {
    id: 'sektoren',
    title: 'SEKTORTYPEN',
    category: 'grundlagen',
    icon: '◇',
    summary:
      'Jeder Sektor hat einen Umgebungstyp und mögliche Inhalte, die Ressourcen und Ereignisse bestimmen.',
    body: `Sektoren werden deterministisch aus dem World-Seed generiert. Typ und Umgebung bestimmen Ressourcenvorkommen und Ereignis-Häufigkeit.

**Umgebungstypen:**

| Typ | Häufigkeit | Besonderheiten |
|---|---|---|
| Leer | 55% | Standard |
| Nebel | 15% | Nur Lokalscan möglich, hohe Ereignisdichte |
| Asteroid | 12% | Hohe Erz-Vorkommen |
| Planet | 10% | Gemischte Ressourcen |
| Stern | 8% | Nicht befahrbar |
| Schwarzes Loch | 3% | Nicht befahrbar, blockiert Hyperjump |

**Sektor-Inhalte (Overlay):**
- **Station**: NPC-Handel, Quests, Tanken, Forschung
- **Asteroiden-Feld**: Mining-Bonus
- **Anomalie**: Scanner-Events, Kristall-Vorkommen
- **Piraten-Zone**: Häufige Kampfereignisse
- **Ruine**: Ancient-Lore (Scan-Ereignis)
- **Pirate POI**: Festung (hoher Piratenlevel)
- **Home Base**: Deine Basis (eigens gebaut)

**Ressourcen nach Sektor (Basis-Werte):**

| Sektor | Erz | Gas | Kristall |
|---|---|---|---|
| Leer | 0 | 0 | 0 |
| Nebel | 0 | 30 | 5 |
| Asteroid | 50 | 0 | 8 |
| Anomalie | 3 | 3 | 20 |
| Piraten-Zone | 8 | 3 | 8 |`,
    seeAlso: ['mining', 'scan', 'navigation'],
    tags: ['sektor', 'umgebung', 'typ', 'nebel', 'asteroid'],
  },

  {
    id: 'ap-system',
    title: 'AKTIONSPUNKTE (AP)',
    category: 'grundlagen',
    icon: '⚡',
    summary:
      'AP ist die Handlungswährung — jede aktive Aktion kostet AP, Regeneration läuft automatisch.',
    body: `**AP-Pool:**
- Maximum: 100 AP
- Regeneration: 0,5 AP/Sekunde (1 AP alle 2 Sekunden)
- Start: 100 AP

**AP-Kosten nach Aktion:**

| Aktion | Kosten |
|---|---|
| Normaler Sprung | 1 AP (bis 2 je nach Schiff) |
| Hyperjump (V2) | Schiff-abhängig (calcHyperjumpAP) |
| Lokalscan | 1 AP |
| Bereichsscan (Mk I) | 3 AP |
| Bereichsscan (Mk V) | 18 AP |
| Struktur bauen | 5–25 AP |
| Rettung annehmen | 5 AP |
| Überlebende abliefern | 3 AP |
| Fliehen (Kampf) | 2 AP |
| Mining | 0 AP |
| Jumpgate benutzen | 0 AP |

**AP-Regenerations-Bonus:**
- Wissenschaftler-Fraktion Rang 2: +20% AP-Regen

**Lazy Evaluation:**
AP wird nicht durch einen Server-Tick aufgefüllt. Stattdessen berechnet der Server bei jeder Aktion, wie viel AP seit dem letzten Zugriff regeneriert wurde (Lazy Evaluation). Das spart Ressourcen und macht das System präzise.

**Faustregel:**
Bei 100 AP und 1 AP/Sprung hast du 100 Sprünge pro ~3,3 Minuten Regen-Zeit.

**Anzeige:**
AP wird in Sektion 5 (Navigation) als Balken angezeigt. Gelb = genug, Orange = niedrig, Rot = kritisch.`,
    seeAlso: ['navigation', 'scan', 'strukturen'],
    tags: ['ap', 'aktionspunkte', 'energie', 'regeneration'],
  },

  {
    id: 'acep-intro',
    title: 'ACEP-SYSTEM (ÜBERBLICK)',
    category: 'grundlagen',
    icon: '◆',
    summary:
      'Adaptive Craft Evolution Protocol — dein Schiff spezialisiert sich durch Aktionen automatisch auf einen von 4 Pfaden.',
    body: `ACEP ist das Spezialisierungssystem von voidSector. Jede Aktion im Spiel gibt XP auf einem der 4 Pfade.

**Die 4 Pfade:**
- **AUSBAU**: Bauen, Mining, Produktion, Basis-Management
- **INTEL**: Scannen, Entdecken, Datenanalyse, Erkundung
- **KAMPF**: Kampf, Piratenabwehr, Station-Defense
- **EXPLORER**: Neue Quadranten, Ruinen, Anomalien, weite Reisen

**Budget-Mechanik:**
- Gesamt-Budget: 100 XP
- Maximum pro Pfad: 50 XP
- XP auf einem Pfad zieht vom Budget ab → Spezialisierung ist eine Entscheidung

**Was ACEP bewirkt:**
- Traits freigeschaltet ab bestimmten Schwellwerten (→ ACEP-TRAITS)
- Radar-Icon des Schiffes ändert sich je nach dominantem Pfad und XP-Stufe (→ RADAR-EVOLUTION)
- Persönlichkeits-Kommentare im LOG (Schiff "kommentiert" Aktionen)
- Legacy-Vererbung: 40% des ACEP-XP wird nach Permadeath vererbt

**ACEP im Interface:**
SHIP-SYS → Einstellungen: Zeigt alle 4 Pfade als Balken mit aktuellem Stand.`,
    seeAlso: ['acep-pfade', 'acep-traits', 'radar-evolution', 'permadeath', 'acep-handbuch'],
    tags: ['acep', 'spezialisierung', 'xp', 'pfade', 'evolution'],
  },

  {
    id: 'monitore',
    title: 'MONITORSYSTEM',
    category: 'grundlagen',
    icon: '▣',
    summary: 'Die 12 Programme des Cockpits — was jeder Monitor anzeigt und wozu er dient.',
    body: `Das Cockpit hat 12 Programme (Sektion 1, linke Leiste):

| Programm | Funktion |
|---|---|
| NAV-COM | Radar, Sektorkarte, Navigationsziel |
| MINING | Abbau-Interface, Ressourcen starten/stoppen |
| CARGO | Frachtübersicht, Jettison, Storage-Transfer |
| BASE-LINK | Basis-Übersicht, Strukturen, Detail-Panel |
| TRADE | NPC-Handel, Spielermarkt, Kontor |
| FACTION | Spieler-Fraktionen, NPC-Reputation, Upgrades |
| QUESTS | Aktive Quests, Events (Scan-Ereignisse), Suche |
| TECH | Tech-Tree, Forschung starten/abschließen |
| QUAD-MAP | Quadranten-Karte (Canvas-Renderer) |
| NEWS | VOID SECTOR NEWS — server-weite Ereignisse |
| LOG | Ereignis-Log, Chat-Verlauf |
| ACEP | Modul-Slots und XP-Pfade auf einem Screen |

**Zusatz-Panel (Sektion 3 — Detail-Monitor):**
Zeigt kontextabhängige Infos zum aktiven Programm: Mining-Status, Cargo-Detail, Trade-Preise, Quest-Details.

**SHIP-SYS (Sektion 4):**
Immer sichtbar. Tabs: EINSTELLUNGEN, MODULE, HANGAR. Das ACEP-Panel ist nun ein eigenes Programm.

**Mobile-Ansicht:**
Auf Mobilgeräten (<1024px): Tab-Leiste unten, vollbild-Monitor, "MEHR"-Overlay für zusätzliche Programme.`,
    seeAlso: ['grundlagen-start', 'quad-map', 'news-monitor'],
    tags: ['monitore', 'cockpit', 'programme', 'interface'],
  },

  {
    id: 'news-monitor',
    title: 'VOID SECTOR NEWS',
    category: 'grundlagen',
    icon: '◈',
    summary: 'Das NEWS-Programm zeigt server-weite Ereignisse in einem CRT-Nachrichtenstil.',
    body: `Das NEWS-Programm aggregiert Ereignisse aller Spieler und zeigt sie als Nachrichtensendung.

**Ereignis-Typen:**

| Symbol | Typ | Auslöser |
|---|---|---|
| ◈ | Quadrant-Entdeckung | Cross-Quadrant-Sprung eines Spielers |
| ◉ | Erstkontakt | Erste Begegnung mit einer Fraktion |
| ⬡ | Territorium | Quadrant beansprucht/verloren |
| ✦ | Ereignis | Permadeath, Station zerstört |
| ⚠ | Warnung | Angriffsberichte |

**Anzeige-Format:**
- Relative Zeitangabe: SOEBEN, VOR 5M, VOR 2H, VOR 3T
- Schlagzeile (max. 60 Zeichen) + optionale Zusammenfassung
- Quadrant-Koordinaten wo zutreffend

**Aktualisierung:**
Der Screen aktualisiert sich automatisch alle 60 Sekunden. Manueller Refresh mit dem ↺-Button.

**Tipp:**
Quadrant-Entdeckungen werden gruppiert und als aggregierte Meldung angezeigt. Wer erkundet neue Regionen zuerst?`,
    seeAlso: ['quadranten', 'territorium', 'permadeath'],
    tags: ['news', 'nachrichten', 'ereignisse', 'server', 'broadcast'],
  },

  // ==========================================================================
  // NAVIGATION
  // ==========================================================================

  {
    id: 'navigation',
    title: 'NAVIGATION & SPRINGEN',
    category: 'navigation',
    icon: '◎',
    summary: 'Normale Sprünge, Sektorbewegung, Sprungreichweite und Quadrantenwechsel.',
    body: `**Normale Sprünge:**
- Kosten: 1 AP (2 AP bei manchen Schiffen/Modulen)
- Reichweite: 1 Sektor (Standard) bis 6 Sektoren (Explorer + Antrieb Mk V)
- Kein Treibstoffverbrauch (nur Hyperjump verbraucht Treibstoff)
- Mining muss gestoppt sein vor dem Sprung

**Intra-Quadrant vs. Cross-Quadrant:**
- Sprünge innerhalb eines Quadranten: direkte Positionsänderung, kein Raum-Wechsel
- Cross-Quadrant: nahtloser Übergang in benachbarten Quadranten, QUAD-MAP wird aktualisiert

**Sprungreichweite nach Modul:**

| Antrieb | Reichweite | AP-Kosten |
|---|---|---|
| Keins (Scout) | 1 | 1 |
| Antrieb Mk I | +1 | 0 |
| Antrieb Mk II | +2 | -0.2 |
| Antrieb Mk III | +3 | -0.4 |
| Antrieb Mk IV | +4 | -0.6 |
| Antrieb Mk V | +5 | -0.8 |
| Void Drive | +6 | -1.0 |

**Schwarze Löcher:**
Sektoren mit Schwarzen Löchern sind nicht befahrbar. Der Sprung wird abgebrochen.

**Autopilot (Nav-Lock):**
Mining aktiviert einen Navigations-Lock — du kannst dich nicht bewegen während Mining aktiv ist.`,
    seeAlso: ['hyperjump', 'autopilot', 'schiffe', 'notwarp'],
    tags: ['sprung', 'navigation', 'bewegung', 'ap', 'reichweite'],
  },

  {
    id: 'hyperjump',
    title: 'HYPERJUMP',
    category: 'navigation',
    icon: '⚡',
    summary:
      'Hyperjump ermöglicht weite Sprünge zu bereits entdeckten Sektoren — kostet Treibstoff und Hyperdrive-Ladung.',
    body: `Hyperjumps transportieren dein Schiff über große Distanzen — als automatischer Autopilot-Flug.

**Voraussetzungen:**
- Hyperdrive-Modul eingebaut (gibt Hyperdrive-Range)
- Zielsektor muss bereits entdeckt sein
- Nicht im Nebel (Nebel blockiert Hyperjump beidseitig)
- Nicht im Schwarzen Loch
- Mining muss inaktiv sein

**Kosten (Hyperdrive V2):**
- **Treibstoff**: 1 Einheit pro Sektor Distanz (Manhattan) × Schiffsmultiplikator
- **AP**: Abhängig von Triebwerksgeschwindigkeit
- **Hyperdrive-Ladung**: Wird verbraucht, regeneriert sich automatisch

**Hyperdrive-Ladung:**
- Max. Ladung: Abhängig vom eingebauten Hyperdrive-Modul
- Regen: Automatisch über Zeit (Regen-Rate aus Modulstats)
- Anzeige: SHIP-SYS zeigt Ladungs-Balken

**Piratenzonen-Malus:**
Wenn Quelle oder Ziel eine Piraten-Zone ist, erhöht sich der Treibstoffverbrauch.

**Autopilot-Verlauf:**
Der Hyperjump zeigt Schritt-für-Schritt-Fortschritt. Jeder Zwischensektor wird entdeckt und aufgezeichnet.`,
    seeAlso: ['navigation', 'autopilot', 'treibstoff', 'module'],
    tags: ['hyperjump', 'fernreise', 'treibstoff', 'hyperdrive'],
  },

  {
    id: 'autopilot',
    title: 'AUTOPILOT',
    category: 'navigation',
    icon: '◐',
    summary:
      'Persistenter Autopilot — speichert Routen über Sessions und navigiert automatisch zu Zielen.',
    body: `Der Autopilot übernimmt die Navigation zu einem gespeicherten Ziel, Schritt für Schritt.

**Autopilot starten:**
- Wähle ein Ziel im NAV-COM (muss entdeckt sein)
- Klicke "AUTOPILOT STARTEN"
- Der Autopilot fährt die Strecke mit normalen Sprüngen ab

**Persistenz:**
- Routen werden gespeichert und überleben Reconnects
- Pause/Resume möglich
- Abbrechen jederzeit möglich

**Geschwindigkeit:**
- Hyper-Autopilot: Abhängig von Hyperdrive-Speed-Modul (20–200ms pro Schritt)
- Normal-Autopilot: Feste Rate (AUTOPILOT_STEP_MS)

**Auto-Refuel:**
Falls konfiguriert, tankt der Autopilot automatisch wenn er eine Station durchfährt (wenn Treibstoff < 50%).

**Schwarzes-Loch-Vermeidung:**
Routen werden automatisch um Schwarze Löcher herumgeführt.

**Anzeige:**
Im NAV-COM siehst du den Fortschritt (Schritte verbleibend). Ein ETA-Timer zeigt die verbleibende Zeit.`,
    seeAlso: ['hyperjump', 'navigation', 'bookmarks'],
    tags: ['autopilot', 'route', 'automatisch', 'navigation'],
  },

  {
    id: 'bookmarks',
    title: 'BOOKMARKS',
    category: 'navigation',
    icon: '◉',
    summary: '5 benutzerdefinierte Bookmark-Slots plus automatische HOME- und SHIP-Markierungen.',
    body: `Bookmarks merken sich wichtige Sektoren für schnellen Zugriff.

**Automatische Bookmarks:**
- **HOME**: Deine Heimat-Basis (automatisch gesetzt)
- **SHIP**: Aktuelle Schiffsposition (immer aktuell)

**Custom Bookmarks (5 Slots):**
- Vergib eigene Namen
- Klicke auf einen Sektor in der Karte → "Bookmark setzen"
- Bookmarks erscheinen in der Bookmark-Leiste (rechts im NAV-COM)
- Tippe einen Bookmark an → Autopilot startet dorthin

**Verwendung:**
- Wichtige Stationen markieren
- Mining-Spots speichern
- Rückkehrpunkt nach langer Reise

**Bookmark-Leiste:**
Die vertikale Leiste rechts im NAV-COM zeigt alle Bookmarks als Buttons. Aktives Bookmark = hervorgehoben.`,
    seeAlso: ['navigation', 'autopilot', 'quad-map'],
    tags: ['bookmark', 'favoriten', 'navigation', 'heimat'],
  },

  {
    id: 'jumpgates',
    title: 'JUMPGATE-SYSTEM',
    category: 'navigation',
    icon: '⬡',
    summary:
      'Natürliche Jumpgates ermöglichen Soforttransport über beliebige Distanzen — seltener Fund, hoher Wert.',
    body: `Jumpgates sind natürlich vorkommende Raumzeitanomalien, die zwei weit entfernte Sektoren verbinden.

**Typen:**
- **Bidirektionale Gates**: Zwei-Wege-Verbindung (Wormhole)
- **Einwegportale**: Nur in eine Richtung aktiv
- **Ancient Gates**: Seltener, höhere Distanzen, manchmal mit Frequenz-Minispiel

**Spawn-Wahrscheinlichkeit:**
- Normale Gates: 0,5% (1 von 200 Sektoren)
- Ancient Gates: 0,01% (1 von 10.000 Sektoren)
- Distanz: 50–10.000 Sektoren (Ancient: 30.000–100.000)

**Gate entdecken:**
Beim Betreten eines Sektors mit Gate erscheint automatisch die Gate-Info im LOG. Das Ziel wird in der QUAD-MAP markiert.

**Frequenz-Minispiel (Ancient Gates):**
30% der Ancient Gates erfordern eine Frequenz-Eingabe:
- Code-Länge: 8 Zeichen
- Freischalt-Schwelle: 90% Übereinstimmung
- Scheitern: Gate bleibt versiegelt

**Spieler-Jumpgates:**
Du kannst eigene Gates bauen (→ STRUKTUREN). Spieler-Gates können verlinkt, mit Gebühren versehen und gehandelt werden.`,
    seeAlso: ['navigation', 'strukturen', 'data-slates'],
    tags: ['jumpgate', 'portal', 'wormhole', 'ancient', 'verbindung'],
  },

  {
    id: 'notwarp',
    title: 'NOTWARP (EMERGENCY WARP)',
    category: 'navigation',
    icon: '⚠',
    summary: 'Sofort-Evakuierung zu deiner Heimatbasis — für Notfälle, kostet AP und Treibstoff.',
    body: `Der Notwarp teleportiert dich sofort zu deiner Heimatbasis (oder nächsten bekannten Station), egal wo du bist.

**Aktivierung:**
SHIP-SYS → EINSTELLUNGEN → NOTWARP-Button (oder Keyboard-Shortcut).

**Kosten:**
- Hohe AP-Kosten (fixiert)
- Treibstoffkosten (Distanz-abhängig)
- Kurze Abklingzeit nach Benutzung

**Einschränkungen:**
- Erfordert eine gebaute Heimatbasis
- Nicht verwendbar wenn Autopilot aktiv
- Nicht verwendbar im laufenden Kampf

**Wann nutzen:**
- Piratengefahr, kein Ausweg
- Treibstoff fast leer, keine Station in Reichweite
- Schnell zurück zur Basis nach langer Erkundungsreise

**Hinweis:**
Cargo bleibt erhalten. Der Notwarp ist kein Eject — dein Schiff überlebt.`,
    seeAlso: ['navigation', 'treibstoff', 'strukturen', 'permadeath'],
    tags: ['notwarp', 'emergency', 'evakuierung', 'heimat'],
  },

  {
    id: 'quad-map',
    title: 'QUAD-MAP',
    category: 'navigation',
    icon: '▣',
    summary: 'Das QUAD-MAP-Programm zeigt die bekannte Quadrantenkarte als interaktives Canvas.',
    body: `Die QUAD-MAP visualisiert das Universum auf Quadranten-Ebene.

**Anzeige:**
- Bekannte Quadranten: farbig/gedimmt je nach Entfernung
- Eigene Position: hell markierter Punkt
- Unbekannte Quadranten: schwarz
- Quadranten-Namen (falls benannt) eingeblendet

**Zoom/Pan:**
- Mausrad zum Zoomen
- Klicken und Ziehen zum Verschieben

**Informationen pro Quadrant:**
- Name (Entdecker-Name oder generierter Name)
- qx/qy-Koordinaten
- Entdeckungszeitpunkt (relativ)
- Territory-Status (falls beansprucht)

**Synchronisation:**
Beim Öffnen des QUAD-MAP-Programms werden alle bekannten Quadranten vom Server geladen.

**Tipp:**
Quadranten die du selbst zuerst betreten hast, sind besonders markiert. Die QUAD-MAP ist das ideale Werkzeug um Explorationsfortschritt zu verfolgen.`,
    seeAlso: ['quadranten', 'universum', 'territorium'],
    tags: ['quad-map', 'karte', 'quadrant', 'erkundung', 'übersicht'],
  },

  // ==========================================================================
  // RESSOURCEN
  // ==========================================================================

  {
    id: 'ressourcen',
    title: 'RESSOURCEN-TYPEN',
    category: 'ressourcen',
    icon: '⛏',
    summary: 'Erz, Gas und Kristall — die drei abbaubaren Rohstoffe und ihre Verwendung.',
    body: `Drei Rohstoffe bilden die wirtschaftliche Grundlage von voidSector:

| Ressource | Symbol | Hauptvorkommen | Hauptverwendung |
|---|---|---|---|
| Erz | ORE | Asteroiden-Sektoren | Strukturen, Module, Kauf |
| Gas | GAS | Nebel-Sektoren | Treibstoff-Produktion, Strukturen |
| Kristall | CRYSTAL | Anomalie-Sektoren | Hochwertige Module, Jumpgates |

**Ressourcen-Regeneration in Sektoren:**
- Erz: +1 pro Minute (5 Min. Verzögerung nach Abbau)
- Gas: +1 pro Minute
- Kristall: +1/3 pro Minute (langsamer)

**Artefakte:**
Seltene Ressource aus Kampf, Anomalie-Events, Mining-Laser-Bonus. Benötigt für hochwertige Forschung.

**Credits:**
Währung des Spiels. Verdient durch NPC-Handel, Quests, Territorien. Ausgegeben für Schiffe, Module, Treibstoff.

**Ressourcen-Wert (NPC-Basispreise):**

| Ressource | NPC kauft (von dir) | NPC verkauft (an dich) |
|---|---|---|
| Erz | 12 CR | 8 CR |
| Gas | 18 CR | 12 CR |
| Kristall | 30 CR | 20 CR |`,
    seeAlso: ['mining', 'cargo', 'treibstoff', 'artefakte'],
    tags: ['erz', 'gas', 'kristall', 'ressourcen', 'rohstoffe'],
  },

  {
    id: 'mining',
    title: 'MINING',
    category: 'ressourcen',
    icon: '⛏',
    summary: 'Ressourcenabbau im MINING-Programm — Abbaurate, Cargo-Limits, Mining-Laser-Module.',
    body: `Mining ist die primäre Ressourcenquelle. Wähle das MINING-Programm und starte den Abbau im aktuellen Sektor.

**Mining-Ablauf:**
1. Navigiere zu einem ressourcenreichen Sektor (Asteroid, Nebel, Anomalie)
2. Lokalscan zeigt verfügbare Ressourcen
3. MINING-Programm: Ressource wählen → Mining starten
4. Abbau läuft automatisch bis Cargo voll oder manuell gestoppt
5. XP: +1 AUSBAU-ACEP pro Mining-Stopp mit Ertrag

**Mining-Rate:**
- Basis: 1 Einheit pro Sekunde
- Mining Laser Mk I: +15% Rate
- Mining Laser Mk V: +100% Rate
- Händler-Fraktion (Tier 1): +15% Bonus

**Cargo-Constraint:**
Mining stoppt automatisch wenn Cargo voll. Sichere Slots sind vor Verlust im Kampf geschützt.

**Bewegungssperre:**
Während Mining kann nicht gesprungen werden (Nav-Lock). Stop Mining → dann navigieren.

**Jettison:**
CARGO-Programm → Ressource auswählen → Jettison. Wirft Ressource im Sektor ab (unwiederbringlich).

**ACEP-Verbindung:**
Mining erhöht AUSBAU-XP. Hohe AUSBAU-XP schaltet Baumeister-Traits frei.`,
    seeAlso: ['ressourcen', 'cargo', 'module', 'acep-pfade'],
    tags: ['mining', 'abbau', 'erz', 'gas', 'kristall', 'laser'],
  },

  {
    id: 'artefakte',
    title: 'ARTEFAKTE',
    category: 'ressourcen',
    icon: '✦',
    summary:
      'Artefakte sind seltene Rohstoffe für hochwertige Forschung — Drop aus Anomalien, Kampf und Ruinen.',
    body: `Artefakte sind die wertvollste Ressource — selten aber für Spitzenforschung unerlässlich.

**Artefakt-Quellen:**

| Quelle | Chance |
|---|---|
| Anomalie-Scan-Event | 8% Drop-Chance |
| Artifact-Find-Event | 50% Drop-Chance |
| Mining-Laser Bonus | +1–8% je Modul-Tier |
| Ruinen-Scan (Ancient) | Garantiert bei erster Erkundung |
| Kampf-Loot (selten) | Zufällig nach Sieg |

**Artefakt-Verwendung:**

| Verwendung | Menge |
|---|---|
| Spieler-Jumpgate bauen | 5 |
| Jumpgate upgraden (Verbindung) | 3–8 |
| Jumpgate upgraden (Distanz) | 3–8 |
| Modul-Forschung (Hochstuf.) | 1–5 |

**Cargo-Slot:**
Artefakte belegen normale Cargo-Slots. Sicher in Safe-Slots lagern (verlustgeschützt im Kampf).

**Marketplace:**
Artefakte können über Data Slates oder direkt an Handelsposten gehandelt werden.`,
    seeAlso: ['mining', 'scan', 'jumpgates', 'forschung'],
    tags: ['artefakt', 'selten', 'forschung', 'drop', 'ruinen'],
  },

  {
    id: 'cargo',
    title: 'CARGO & FRACHTVERWALTUNG',
    category: 'ressourcen',
    icon: '▣',
    summary: 'Cargo-Kapazität, sichere Slots, Storage-Transfer und Jettison.',
    body: `Das CARGO-Programm zeigt alle Ressourcen im Frachtraum und ermöglicht Transfer und Jettison.

**Cargo-Kapazität:**

| Schiff | Basis-Cargo |
|---|---|
| Scout | 3 |
| Freighter | 15 |
| Cruiser | 8 |
| Explorer | 10 |
| Battleship | 5 |

Erweiterung durch Cargo-Module (Mk I: +5, Mk V: +60).

**Sichere Slots (Safe Slots):**
- 1–5 Safe-Slots je nach Cargo-Modul
- Ressourcen in Safe-Slots gehen bei Kampfverlust nicht verloren
- Wichtige Güter immer in Safe-Slots lagern

**Jettison:**
- Wirft eine Ressource im aktuellen Sektor ab
- Nicht rückgängig zu machen
- Nützlich wenn Cargo voll und wichtigere Ressource aufgenommen werden soll

**Storage (Basis):**
Gebäude an deiner Basis. Kapazität: 50/150/500 je Tier. Transfer zwischen Schiff und Storage über BASE-LINK-Programm.

**Cargo-Verlust:**
Im Kampf (bei gescheiterter Flucht): 25–50% des Cargos verloren (nicht Safe-Slots).`,
    seeAlso: ['mining', 'ressourcen', 'module', 'strukturen'],
    tags: ['cargo', 'fracht', 'kapazität', 'storage', 'jettison'],
  },

  {
    id: 'data-slates',
    title: 'DATA SLATES',
    category: 'ressourcen',
    icon: '◇',
    summary:
      'Portable Datenpakete mit Sektor-Koordinaten, Notizen oder Jumpgate-Codes — handhabbar und handelbar.',
    body: `Data Slates sind digitale Datenpakete die Informationen über Sektoren, Bereiche oder Jumpgates enthalten.

**Slate-Typen:**

| Typ | AP-Kosten | Inhalt |
|---|---|---|
| Sektor-Slate | 1 AP | Einzelner Sektor-Koordinate |
| Bereichs-Slate | 3 AP | Cluster von Sektoren (Radius 2–4) |
| Custom-Slate | 2 AP + 5 CR | Eigene Koordinaten + Notizen |
| Jumpgate-Slate | — | Gate-Codes und Frequenzen |

**Custom Slates erstellen:**
- Bis zu 20 eigene Koordinaten
- Bis zu 10 Gate-Codes
- Bis zu 500 Zeichen Notizen
- Nützlich für Erkundungs-Logbuch

**Marketplace:**
Custom Slates können an Handelsposten (Tier 2+) zum Verkauf angeboten werden. Preis selbst festlegen.

**NPC-Käufe:**
NPC-Stationen kaufen Sektor- und Bereichs-Slates. Preis: 5 CR pro enthaltenen Sektor.

**Jumpgate-Slates:**
Verlinkung mit Spieler-Jumpgates ermöglicht Routing-Ketten (bis 10 Hops). Gate-Codes sind handelbar.`,
    seeAlso: ['jumpgates', 'npc-handel', 'strukturen'],
    tags: ['data slate', 'koordinaten', 'karte', 'notizen', 'handel'],
  },

  {
    id: 'treibstoff',
    title: 'TREIBSTOFFSYSTEM',
    category: 'ressourcen',
    icon: '⚡',
    summary:
      'Treibstoff wird nur für Hyperjumps verbraucht — tanken an Stationen oder aus eigener Produktion.',
    body: `Normale Sprünge (1 Sektor) verbrauchen keinen Treibstoff. Nur Hyperjumps kosten Treibstoff.

**Tank-Kapazität nach Schiff:**

| Schiff | Max Treibstoff |
|---|---|
| Scout | 80 |
| Freighter | 120 |
| Cruiser | 150 |
| Explorer | 200 |
| Battleship | 180 |

Erweiterung durch Cargo-Modul mit Treibstoff-Tank-Bonus.

**Verbrauch (Hyperjump V2):**
- 1 Einheit Treibstoff pro Sektor Distanz (Manhattan)
- Multiplikator je nach Schiff: Scout 0,8×, Freighter 1,2×, Cruiser 1,0×
- Piraten-Zonen: +Malus auf Verbrauch

**Tanken:**
- An NPC-Stationen: Creditkosten (Reputation beeinflusst Preis)
- Auto-Refuel: Wenn konfiguriert, tankt Autopilot automatisch an Stationen
- Heimatbasis: Kostenloses Tanken möglich (bis 3 Schiffe)
- Fabrik: Produktion von Treibstoffzellen aus Gas+Erz

**Warnung:**
Wenn Treibstoff < 15% des Tanks, wird eine Warnung angezeigt.`,
    seeAlso: ['hyperjump', 'schiffe', 'strukturen', 'npc-stationen'],
    tags: ['treibstoff', 'fuel', 'tank', 'hyperjump', 'tanken'],
  },

  // ==========================================================================
  // KAMPF
  // ==========================================================================

  {
    id: 'combat-v2',
    title: 'COMBAT V2 — TAKTISCHES KAMPFSYSTEM',
    category: 'kampf',
    icon: '✦',
    summary: '5-Runden-Taktikkampf mit Waffenauswahl, Schilden und Spezialaktionen.',
    body: `Combat V2 ist das vollständige Kampfsystem. Kämpfe laufen in bis zu 5 Runden.

**Taktiken (jede Runde wählen):**

| Taktik | Schaden | Verteidigung |
|---|---|---|
| ASSAULT | ×1,3 | ×0,8 |
| BALANCED | ×1,0 | ×1,0 |
| DEFENSIVE | ×0,75 | ×1,35 |

**Spezialaktionen:**

| Aktion | Effekt |
|---|---|
| AIM | +50% Trefferchance, 35% Chance Gegner 2 Runden deaktiviert |
| EVADE | 50% Chance komplett auszuweichen |
| EMP | 75% Trefferchance, deaktiviert Gegner 2 Runden (kein Schaden) |

**Kampfausgang:**
- Sieg: Loot (Erz/Gas/Kristall/Artefakt), KAMPF-ACEP XP +3
- Niederlage (HP 0): Permadeath ausgelöst
- Flucht: 2 AP, 60% Basiswahrscheinlichkeit, kann 25–50% Cargo kosten

**Verhandlung:**
Zahle 10 CR pro Piratenlevel um den Kampf zu beenden ohne Schaden.

**Piratenlevel:**
Abhängig von Distanz zur Ursprungsregion (Distanz / 50). Level 1–10. HP: 20 + 10 pro Level. Schaden: 5 + 3 pro Level.

**ACEP-Verbindung:**
Siege erhöhen KAMPF-XP. Hohe KAMPF-XP schaltet Veteran- und Schachtauen-Traits frei.`,
    seeAlso: ['piraten', 'waffen', 'schilde', 'permadeath'],
    tags: ['combat', 'kampf', 'taktik', 'v2', 'schaden', 'runden'],
  },

  {
    id: 'piraten',
    title: 'PIRATEN & SCAN-EVENTS',
    category: 'kampf',
    icon: '⚠',
    summary:
      'Piratenbegegnungen entstehen durch Scan-Events — häufiger in Nebeln und weit von der Ursprungsregion.',
    body: `Piraten tauchen als Scan-Events auf — ausgelöst beim Lokalscan oder Bereichsscan.

**Piratenlevel-Berechnung:**
Level = min(10, floor(Distanz_vom_Ursprung / 50) + 1)

Bei Distanz 0–50: Level 1. Bei Distanz 500+: Level 10+.

**Scan-Event-Häufigkeit:**

| Umgebung | Ort | Event-Chance |
|---|---|---|
| Leer | Normalbereich | 1,2% |
| Leer | Quadrant-Grenze | 3% |
| Nebel | Normalbereich | 30% |
| Nebel | Quadrant-Grenze | 95% |

**Weitere Scan-Event-Typen:**

| Typ | Belohnung |
|---|---|
| Notsignal | 20–100 CR, Rep +5 |
| Anomalie | XP +15–50, Rep +5, 8% Artefakt |
| Artefakt-Fund | 50–200 CR, Rep +10, 50% Artefakt |
| Blaupause | Modul-Blueprint |

**Events verwalten:**
QUESTS → EVENTS zeigt alle entdeckten, noch nicht abgeschlossenen Events. Klicke "Untersuchen" um die Belohnung zu erhalten.

**Piraten-Hinterhalt:**
Sofort-Ereignis beim Lokalscan. Kampf beginnt direkt — kein Abwarten.`,
    seeAlso: ['combat-v2', 'scan', 'acep-pfade'],
    tags: ['piraten', 'scan event', 'begegnung', 'kampf', 'level'],
  },

  {
    id: 'station-defense',
    title: 'STATION DEFENSE',
    category: 'kampf',
    icon: '⬡',
    summary:
      'Verteidige deine Basis mit Geschützen, Schilden und Ionenkanone gegen angreifende Piraten.',
    body: `Deine Heimatbasis kann durch Piraten angegriffen werden. Baue Verteidigungsstrukturen um Angriffe abzuwehren.

**Verteidigungs-Strukturen:**

| Struktur | Kosten | Schaden/HP |
|---|---|---|
| Geschütz Mk I | 40 Erz + 10 Gas + 20 Krist | 15 Schaden/Runde |
| Geschütz Mk II | höher | 30 Schaden/Runde |
| Geschütz Mk III | höher | 50 Schaden/Runde |
| Stations-Schild Mk I | 30 Erz + 25 Gas + 30 Krist | 150 HP, 10 Regen/Runde |
| Stations-Schild Mk II | höher | 350 HP, 25 Regen/Runde |
| Ionenkanone | 60 Erz + 30 Gas + 40 Krist | 80 Schaden, durchdringt Schilde |

**Station-HP:**
Max. 500 HP. Reparatur: 5 CR/HP oder 1 Erz/HP.

**Kampfablauf:**
- Max. 10 Runden
- Automatischer Ablauf (kein manuelles Eingreifen nötig)
- Ionenkanone ist einmalig pro Kampf verwendbar
- Meldung bei Station unter Angriff → NEWS/LOG

**Tipp:**
Geschütz + Schild Mk II + Ionenkanone ist eine solide Basisverteidigung. Ionenkanone als Reserve gegen starke Angreifer.`,
    seeAlso: ['strukturen', 'combat-v2', 'schiffe'],
    tags: ['station defense', 'basis', 'verteidigung', 'geschütz', 'schild'],
  },

  {
    id: 'waffen',
    title: 'WAFFEN-MODULE',
    category: 'kampf',
    icon: '⚔',
    summary: 'Vier Waffentypen mit unterschiedlichen Stärken — Laser, Railgun, Rakete, EMP.',
    body: `Waffen-Module erhöhen den Angriffswert deines Schiffes und ermöglichen spezielle Kampfaktionen.

**Waffentypen:**

| Modul | Typ | Schaden | Besonderheit |
|---|---|---|---|
| Laser Mk I | Laser | +8 ATK | Standard |
| Laser Mk II | Laser | +14 ATK | — |
| Laser Mk III | Laser | +28 ATK | — |
| Railgun Mk I | Kinetisch | +12 ATK | 30% Panzer-Durchdringung |
| Railgun Mk II | Kinetisch | +22 ATK | 50% Panzer-Durchdringung |
| Raketen-Werfer | Explosiv | +18 ATK | +30% vs. hoher HP |
| Schwere Rakete | Explosiv | +30 ATK | +50% vs. hoher HP |
| EMP-Emitter | Elektronisch | 0 ATK | Deaktiviert Gegner 2 Runden |

**Railgun-Penetration:**
Railguns ignorieren 30–50% der feindlichen Panzerungsreduktion. Ideal gegen stark gepanzerte Gegner.

**EMP-Emitter:**
Löst die Spezial-EMP-Aktion aus: 75% Trefferchance, 2 Runden Deaktivierung, kein Direktschaden.

**Installation:**
Module über SHIP-SYS → MODULE installieren. Slot-Limit je nach Rumpf (3–5 Slots). Forschung erforderlich für höhere Tiers.`,
    seeAlso: ['combat-v2', 'schiffe', 'module', 'forschung'],
    tags: ['waffe', 'laser', 'railgun', 'rakete', 'emp', 'schaden'],
  },

  {
    id: 'schilde',
    title: 'SCHILD-MODULE & SCHUTZ',
    category: 'kampf',
    icon: '◎',
    summary: 'Schilde bieten regenerierende HP-Puffer. Panzerung reduziert Schaden direkt.',
    body: `Schutz im Kampf kommt aus zwei Quellen: Schild-Modulen (regenerierend) und Panzerungs-Modulen (Schadensreduktion).

**Schild-Module:**

| Modul | Schild HP | Regen/Runde |
|---|---|---|
| Schild Mk I | +30 HP | +3 |
| Schild Mk II | +60 HP | +8 |
| Schild Mk III | +100 HP | +12 |

**Panzerungs-Module (Rumpf-HP + Reduktion):**

| Modul | HP | Schadens-Reduktion |
|---|---|---|
| Panzerung Mk I | +25 HP | 10% |
| Panzerung Mk II | +60 HP | 20% |
| Panzerung Mk III | +120 HP | 30% |
| Panzerung Mk IV | +200 HP | 35% |
| Panzerung Mk V | +250 HP | 40% |

**Defensiv-Spezialmodule:**

| Modul | Effekt |
|---|---|
| Punktabwehr | 60% Chance eingehende Raketen zu blocken |
| ECM-Suite | -15% feindliche Trefferchance |

**Kombination:**
Schild + Panzerung + Punktabwehr = maximale Überlebensfähigkeit. Schilde regen sich nach dem Kampf (nächste Runde) zurück.`,
    seeAlso: ['combat-v2', 'waffen', 'module', 'permadeath'],
    tags: ['schild', 'panzerung', 'schutz', 'hp', 'defensive'],
  },

  {
    id: 'permadeath',
    title: 'PERMADEATH & LEGACY-SYSTEM',
    category: 'kampf',
    icon: '✦',
    summary:
      'Schiff zerstört? Das Legacy-Protokoll vererbt ACEP-XP auf ein neues Schiff und hinterlässt ein Wrack-POI.',
    body: `Wenn die Schiffs-HP auf 0 fallen, wird das Permadeath-Protokoll aktiviert.

**Was passiert bei Permadeath:**
1. Das Schiff wird zerstört (Cargo verloren)
2. Ein **Wrack-POI** entsteht am Sterbesektor (sichtbar für andere Spieler)
3. Ein **neues Schiff** (Scout) erscheint an deiner Heimatbasis
4. **40% des ACEP-XP** wird auf das neue Schiff vererbt (Legacy-Protokoll)

**Wrack-POI:**
- Andere Spieler können das Wrack mit Lokalscan entdecken
- Wrack enthält möglicherweise Salvage-Ressourcen
- Wracks erscheinen im Scan-Ergebnis mit Spieler-Name

**Eject-Pod (Notkammer):**
Wenn HP < 15 im Kampf, erscheint die Option "EJECT":
- Schiff überlebt (HP bleibt kritisch)
- Gesamter Cargo wird geopfert
- Kein Permadeath, aber höchster Ressourcenverlust

**Legacy-Vererbung:**
Das Legacy-Protokoll überträgt 40% jedes ACEP-Pfad-Werts auf das Nachfolge-Schiff. Ein erfahrener Veteran verliert nie alles.

**Radar-Wrack:**
Im Radar-Canvas sieht man Wracks anderer Spieler als besonderes Icon (abhängig vom Radar-Evolution-Level).`,
    seeAlso: ['combat-v2', 'acep-intro', 'acep-pfade', 'radar-evolution'],
    tags: ['permadeath', 'wrack', 'legacy', 'eject', 'tod', 'neustart'],
  },

  // ==========================================================================
  // HANDEL
  // ==========================================================================

  {
    id: 'npc-handel',
    title: 'NPC-HANDEL',
    category: 'handel',
    icon: '◆',
    summary:
      'Kaufe und verkaufe Ressourcen an NPC-Stationen — Preise variieren mit Reputation und Stationsauslastung.',
    body: `Das TRADE-Programm ermöglicht Handel mit NPC-Stationen und dem Spielermarkt.

**Preisstruktur:**
- NPC kauft von dir (Sell-Spread): ×1,2 des Basispreises
- NPC verkauft an dich (Buy-Spread): ×0,8 des Basispreises

**Reputations-Preismultiplikator:**

| Reputations-Rang | Preismultiplikator |
|---|---|
| Feindlich (-100 bis -51) | ×1,5 (teurer) |
| Unfreundlich (-50 bis -1) | ×1,0 |
| Neutral (0) | ×1,0 |
| Freundlich (+1 bis +50) | ×0,9 |
| Geehrt (+51 bis +100) | ×0,75 (günstiger) |

**Dynamische Preise:**
Stationsbestände beeinflussen Preise. Hoher Bestand = niedrigere Kaufpreise. Niedriger Bestand = höhere Verkaufspreise.

**Spielermarkt (Trading Post Tier 2):**
An Stationen mit Spieler-Handelsposten können Spieler gegenseitig Angebote und Kaufaufträge stellen.`,
    seeAlso: ['npc-stationen', 'kontor', 'handelsrouten', 'fraktionen-npc'],
    tags: ['handel', 'trade', 'npc', 'preise', 'credits'],
  },

  {
    id: 'npc-stationen',
    title: 'NPC-STATIONEN & LEVEL',
    category: 'handel',
    icon: '⬡',
    summary:
      'Stationen haben 5 Level — höheres Level = mehr Bestand, bessere Quests, höhere Preise.',
    body: `Jede NPC-Station hat ein Level (1–5) das Bestand, Quests und Preisrahmen bestimmt.

**Stations-Level:**

| Level | Name | Max Bestand | XP-Schwelle |
|---|---|---|---|
| 1 | Außenposten | 200 | 0 |
| 2 | Station | 500 | 500 |
| 3 | Hub | 1.200 | 2.000 |
| 4 | Hafen | 3.000 | 6.000 |
| 5 | Megastation | 8.000 | 15.000 |

**Stations-XP steigern:**
- Besuch: +5 XP
- Handel: +1 XP pro Einheit
- Quest abgeschlossen: +15 XP
- XP verfällt: -1 pro Stunde (ohne Interaktion)

**NPC-Fraktionen pro Station:**
Jede Station gehört zu einer von 4 NPC-Fraktionen (Händler, Wissenschaftler, Piraten, Ancients). Reputation beeinflusst Angebote und Upgrademöglichkeiten.

**Stationsebene im Terminal:**
Das Stations-Terminal (Sektion beim Betreten) zeigt: Level, Fraktion, Bestand, verfügbare Quests und Upgrades.`,
    seeAlso: ['npc-handel', 'quests', 'fraktionen-npc'],
    tags: ['station', 'level', 'xp', 'bestand', 'handel'],
  },

  {
    id: 'kontor',
    title: 'KONTOR (KAUFAUFTRAG)',
    category: 'handel',
    icon: '◈',
    summary:
      'Das Kontor erlaubt automatische Kaufaufträge — NPC kauft Ressourcen auf Vorrat wenn verfügbar.',
    body: `Das Kontor ist eine gebäudespezifische Handelsfunktion deiner Basis. Platziere Kaufaufträge — der NPC erfüllt sie automatisch wenn Ressourcen verfügbar.

**Kontor-Gebäude:**
- Kosten: 20 Erz + 10 Gas + 10 Kristall + 15 AP
- Gebaut an deiner Basis (BASE-LINK)

**Kaufauftrag platzieren:**
1. TRADE-Programm → Kontor-Tab
2. Ressource wählen + Menge + Zielpreis
3. Credits werden reserviert (gesperrt bis Erfüllung)
4. NPC liefert wenn Marktpreis ≤ Zielpreis

**Auftrag stornieren:**
Credits werden sofort zurückgegeben. Noch nicht erfüllte Mengen werden freigegeben.

**Strategie:**
Kontor eignet sich zum günstigen Einkauf seltener Ressourcen (z.B. Kristall wenn Überschuss am Markt).`,
    seeAlso: ['npc-handel', 'strukturen', 'handelsrouten'],
    tags: ['kontor', 'kaufauftrag', 'automatisch', 'handel', 'bestellung'],
  },

  {
    id: 'handelsrouten',
    title: 'HANDELSROUTEN',
    category: 'handel',
    icon: '◎',
    summary:
      'Automatisierte Handelsrouten transportieren Ressourcen zwischen Stationen — max. 3 aktive Routen.',
    body: `Handelsrouten automatisieren den Gütertransport zwischen zwei Stationen auf Wunsch-Intervall.

**Route erstellen:**
1. TRADE-Programm → Routen-Tab
2. Quelle und Ziel wählen (beide müssen bekannte Stationen sein)
3. Ressource und Menge festlegen
4. Zyklus-Zeit konfigurieren: 15–120 Minuten
5. Route aktivieren

**Kosten:**
- Treibstoff: 0,5 Einheiten pro Sektor Distanz pro Zyklus
- Keine weitere AP-Kosten (automatisch)

**Limits:**
- Max. 3 aktive Routen gleichzeitig
- Route pausierbar und löschbar

**Ertrag:**
Die Route handelt automatisch zum aktuellen NPC-Preis. Profit entsteht durch Preisdifferenzen zwischen Stationen.

**Tipp:**
Routen zwischen High-Level-Stationen (Tier 4–5) mit großem Preisdelta sind am profitabelsten.`,
    seeAlso: ['npc-handel', 'treibstoff', 'kontor'],
    tags: ['handelsroute', 'automatisch', 'transport', 'profit', 'zyklus'],
  },

  {
    id: 'factory',
    title: 'FACTORY & PRODUKTION',
    category: 'handel',
    icon: '⚙',
    summary:
      'Die Fabrik produziert veredelte Güter aus Rohstoffen — 5 Rezepte, manche erfordern Forschung.',
    body: `Die Fabrik (Gebäude an deiner Basis) produziert automatisch nach eingestelltem Rezept.

**Fabrik-Gebäude:**
- Kosten: 40 Erz + 20 Gas + 15 Kristall + 20 AP

**Produktions-Rezepte:**

| Produkt | Eingabe | Zeit | Forschung |
|---|---|---|---|
| Treibstoffzelle | 2 Erz + 3 Gas | 120s | Nein |
| Legierungsplatte | 3 Erz + 1 Kristall | 180s | Nein |
| Schaltkreis | 2 Kristall + 2 Gas | 240s | Ja |
| Void-Shard | 3 Kristall + 2 Erz | 300s | Ja |
| Bio-Extrakt | 4 Gas + 1 Kristall | 360s | Ja |

**Ablauf:**
1. BASE-LINK → Fabrik → Rezept auswählen
2. Produktion läuft automatisch
3. Ertrag sammeln (wenn voll: Drop in Sektor)
4. Transfer zu Cargo wenn Platz vorhanden

**Produkte verwenden:**
- Treibstoffzellen: Direkt als Treibstoff nutzbar
- Legierungsplatten, Schaltkreise: Forschungs-Kosten
- Void-Shards: Hochwertige Modul-Forschung
- Bio-Extrakt: (Spezialquests)`,
    seeAlso: ['strukturen', 'forschung', 'treibstoff'],
    tags: ['fabrik', 'produktion', 'rezept', 'verarbeitung', 'automatisch'],
  },

  {
    id: 'territorium',
    title: 'TERRITORIALANSPRÜCHE',
    category: 'handel',
    icon: '⬡',
    summary:
      'Beanspruche Quadranten für dich — verteidige sie gegen andere Spieler, gewinne KAMPF-XP.',
    body: `Das Territory-System erlaubt Spielern, Quadranten als ihr Gebiet zu beanspruchen.

**Territory beanspruchen:**
1. SHIP-SYS → EINSTELLUNGEN → TERRITORY-CONTROL-Bereich
2. CLAIM-Button drücken
3. Kosten: 20 Erz + 10 Kristall (aus dem Frachtraum)
4. Der aktuelle Quadrant wird beansprucht

**Defense-Rating:**
Das Defense-Rating eines Territory bestimmt die Angreifer-Gewinnchance:

| Defense-Rating | Angreifer gewinnt | Vergabe |
|---|---|---|
| LOW | 50% | Standard |
| HIGH | 25% | K'thari-Grenzgebiet (Chebyshev ≥ 800) |

**Verteidigung anfechten:**
Ein anderer Spieler kann dein Territory anfechten:
- Angreifer gewinnt → Anspruch wechselt + Angreifer erhält KAMPF-XP +5
- Angreifer verliert → Territory bleibt, Verteidiger erhält +2 KAMPF-XP

**Eigene Territorien anzeigen:**
SHIP-SYS → LIST-Button → Zeigt alle Quadranten mit Koordinaten, Defense-Rating und Siege.

**Meldungen:**
Territory-Ereignisse erscheinen im NEWS-Programm und im LOG.`,
    seeAlso: ['quadranten', 'quad-map', 'acep-pfade', 'news-monitor'],
    tags: ['territory', 'gebietsanspruch', 'verteidigung', 'quadrant', 'claim'],
  },

  // ==========================================================================
  // TECHNIK
  // ==========================================================================

  {
    id: 'schiffe',
    title: 'RAUMSCHIFFE',
    category: 'technik',
    icon: '◈',
    summary:
      '5 Rumpf-Typen mit unterschiedlichen Spezialisierungen — Scout als Start, Explorer und Battleship als Endgame.',
    body: `Jeder Rumpf-Typ hat eigene Basiswerte und ein Modul-Slot-Limit.

**Rumpf-Übersicht:**

| Rumpf | Slots | Cargo | Sprung | AP | Treibstoff | HP | Preis |
|---|---|---|---|---|---|---|---|
| Scout | 3 | 3 | 5 | 1 | 80 | 50 | Start |
| Freighter | 4 | 15 | 3 | 2 | 120 | 80 | 500 CR |
| Cruiser | 4 | 8 | 4 | 1 | 150 | 100 | 1.000 CR |
| Explorer | 5 | 10 | 6 | 1 | 200 | 70 | 2.000 CR |
| Battleship | 5 | 5 | 2 | 2 | 180 | 150 | 3.000 CR |

**Rumpf kaufen:**
SHIP-SYS → HANGAR → Neues Schiff kaufen (an NPC-Station mit Werft). Benötigt entsprechendes Unlock-Level.

**Schiff wechseln:**
Mehrere Schiffe gleichzeitig besitzen. Aktives Schiff wählen über SHIP-SYS → HANGAR.

**Schiff umbenennen:**
Im HANGAR → Name eingeben.

**Empfehlung:**
- Bergbau: Freighter (großes Cargo)
- Erkundung: Explorer (hohe Reichweite, großer Tank)
- Kampf: Battleship (hohe HP, 5 Slots für Waffen)
- Allround: Cruiser`,
    seeAlso: ['module', 'forschung', 'acep-pfade'],
    tags: ['schiff', 'rumpf', 'scout', 'freighter', 'explorer', 'battleship'],
  },

  {
    id: 'module',
    title: 'SCHIFFSMODULE',
    category: 'technik',
    icon: '⚙',
    summary:
      'Module verbessern Schiffs-Stats — Antrieb, Cargo, Scanner, Panzerung, Waffen und mehr.',
    body: `Module werden in Schiffs-Slots eingesetzt und erhöhen Stats. Installation über SHIP-SYS → MODULE.

**Modul-Kategorien:**

| Kategorie | Effekt |
|---|---|
| Antrieb Mk I-V + Void Drive | Sprungreichweite, AP-Kosten, Hyperdrive |
| Cargo Mk I-V | Kapazität, Safe-Slots, Treibstofftank |
| Scanner Mk I-V + Quantum | Scan-Level, Comm-Reichweite, Artefakt-Chance |
| Panzerung Mk I-V + Nano | HP, Schaden-Reduktion |
| Mining Laser Mk I-V | Mining-Rate, Artefakt-Chance |
| Laser/Railgun/Rakete/EMP | Angriffswert, Spezialfähigkeiten |
| Schild Mk I-III | Schild-HP, Regen |
| Punktabwehr | 60% Raketen-Block |
| ECM-Suite | -15% feindliche Trefferchance |

**Forschung erforderlich:**
Höhere Modul-Tiers müssen erst erforscht werden (TECH-Programm). Prerequisite-Ketten: Mk I → Mk II → Mk III.

**Modul entfernen:**
Module können jederzeit entfernt und in Inventar zurückgelegt werden. Kein Verlust.

**Modul-Inventar:**
SHIP-SYS → MODULE → Inventar zeigt alle installierbaren Module. Module werden in Slots drag-and-dropped.`,
    seeAlso: ['schiffe', 'forschung', 'waffen', 'schilde'],
    tags: ['modul', 'antrieb', 'cargo', 'scanner', 'panzerung', 'mining'],
  },

  {
    id: 'forschung',
    title: 'TECH TREE & FORSCHUNG',
    category: 'technik',
    icon: '◇',
    summary:
      'Der Tech-Tree schaltet neue Module frei — Forschung kostet Credits und Ressourcen, läuft über Zeit.',
    body: `Das TECH-Programm zeigt den Tech-Tree und ermöglicht es, neue Module zu erforschen.

**Tech-Tree-Struktur:**
- 10 Unlock-Level (abhängig von Spieler-XP)
- Prerequisite-Ketten: Höhere Tiers erfordern niedrigere Tiers erforscht
- Manche Module erfordern Fraktions-Reputation (z.B. Void Drive → Ancients-Fraktion "Geehrt")

**Forschung starten:**
1. TECH-Programm → Modul auswählen (nicht gesperrt, Prerequisite erfüllt)
2. Credits + Ressourcen bezahlen
3. Forschung läuft automatisch (1 Minute pro Tick)
4. Abgeschlossene Forschung einlösen → Modul ins Inventar

**Forschungskosten (Beispiele):**

| Modul | Credits | Ressourcen |
|---|---|---|
| Antrieb Mk II | 200 CR | 5 Erz |
| Scanner Mk III | 500 CR | 10 Kristall |
| Panzerung Mk V | 2.000 CR | 20 Erz, 5 Artefakt |
| Void Drive | 5.000 CR | 10 Artefakt |

**Blaupausen:**
Scan-Events können Modul-Blaupausen droppen. Blaupausen aktivieren ein Modul im Tech-Tree ohne Credits.`,
    seeAlso: ['module', 'schiffe', 'artefakte', 'fraktionen-npc'],
    tags: ['tech tree', 'forschung', 'modul', 'unlock', 'blueprint'],
  },

  {
    id: 'strukturen',
    title: 'STRUKTUREN & BASISBAU',
    category: 'technik',
    icon: '⬡',
    summary:
      '12 Strukturtypen — Basis, Storage, Handelsposten, Fabrik, Forschungslabor, Verteidigung, Jumpgate.',
    body: `Strukturen werden im Weltall gebaut und dauerhaft im Sektor platziert. Die meisten erfordern eine aktive Heimatbasis.

**Alle Strukturtypen:**

| Struktur | Erz | Gas | Krist | AP |
|---|---|---|---|---|
| Comm-Relay | 5 | 0 | 2 | 10 |
| Mining-Station | 30 | 15 | 10 | 15 |
| Basis (Home) | 50 | 30 | 25 | 25 |
| Storage | 20 | 10 | 5 | 10 |
| Handelsposten | 30 | 20 | 15 | 15 |
| Geschütz Mk I | 40 | 10 | 20 | 20 |
| Stations-Schild Mk I | 30 | 25 | 30 | 20 |
| Ionenkanone | 60 | 30 | 40 | 25 |
| Fabrik | 40 | 20 | 15 | 20 |
| Forschungslabor | 30 | 25 | 30 | 25 |
| Kontor | 20 | 10 | 10 | 15 |
| Spieler-Jumpgate | 0 | 0 | 20 | 10 |

**Heimatbasis (Home Base):**
Ankerstruktur. Notwarp-Ziel. Kostenlose Betankung. Sicher-Zone (5 Sektoren Radius, keine Piraten-Events).

**Comm-Relay:**
Erweitert Kommunikationsreichweite auf 500 Sektoren. Notwendig für Sektor-Chat in der Ferne.

**Bau:**
BASE-LINK-Programm → Struktur wählen → Ressourcen + AP prüfen → Bauen. Struktur erscheint im aktuellen Sektor.`,
    seeAlso: ['factory', 'kontor', 'station-defense', 'treibstoff'],
    tags: ['strukturen', 'basis', 'bau', 'gebäude', 'handelsposten', 'fabrik'],
  },

  {
    id: 'storage-trading',
    title: 'STORAGE & HANDELSPOSTEN',
    category: 'technik',
    icon: '◆',
    summary:
      'Storage lagert Ressourcen. Der Handelsposten ermöglicht NPC-Handel, Spielermarkt und Routen.',
    body: `Zwei Kernstrukturen für deine wirtschaftliche Infrastruktur.

**Storage (Lager):**

| Tier | Kapazität | Upgrade-Kosten |
|---|---|---|
| Tier 1 | 50 | 0 (Basiskosten) |
| Tier 2 | 150 | 200 CR |
| Tier 3 | 500 | 1.000 CR |

Transfer zwischen Schiff und Storage über BASE-LINK → Storage-Tab.

**Handelsposten (Trading Post):**

| Tier | Funktion | Upgrade-Kosten |
|---|---|---|
| Tier 1 | NPC-Handel | Basiskosten |
| Tier 2 | + Spielermarkt (Kauf/Verkauf-Aufträge) | 500 CR |
| Tier 3 | + Automatisierte Handelsrouten | 2.000 CR |

**Spielermarkt (Tier 2+):**
- Kauf-Aufträge: "Ich zahle X CR für Y Erz"
- Verkauf-Aufträge: "Ich verkaufe Y Erz für X CR"
- Andere Spieler können reagieren
- Auch Data Slates sind handelbar

**Strategische Bedeutung:**
Ein Tier-3-Handelsposten mit Tier-3-Storage macht deine Basis zum eigenständigen Wirtschaftszentrum.`,
    seeAlso: ['npc-handel', 'handelsrouten', 'strukturen', 'data-slates'],
    tags: ['storage', 'lager', 'handelsposten', 'spielermarkt', 'tier'],
  },

  // ==========================================================================
  // SOZIAL
  // ==========================================================================

  {
    id: 'fraktionen-npc',
    title: 'NPC-FRAKTIONEN & REPUTATION',
    category: 'sozial',
    icon: '◉',
    summary:
      '4 NPC-Fraktionen mit Reputationssystem (-100 bis +100) — höhere Reputation = bessere Preise und Upgrades.',
    body: `Jede NPC-Station gehört einer von 4 Fraktionen. Deine Reputation bei jeder Fraktion beeinflusst Preise und verfügbare Upgrades.

**Die 4 NPC-Fraktionen:**

| Fraktion | Spezialisierung | Upgrades |
|---|---|---|
| Händler | Handel, Cargo | +15% Mining-Rate / +3 Cargo-Slots |
| Wissenschaftler | Scan, Forschung | +1 Scan-Radius / +20% AP-Regen |
| Piraten | Kampf, Plünderung | +20% Schaden / Loot-Bonus |
| Ancients | Ancient-Technologie | Void Drive / Spezialmodule |
| Unabhängige | Neutral | Keine Upgrades |

**Reputation aufbauen (-100 bis +100):**
- Station besuchen: +1 Rep
- Handel: +2 Rep pro Einheit
- Quest abschließen: +15 Rep

**Reputations-Ränge:**
- Feindlich: -100 bis -51 (kein Handel)
- Unfreundlich: -50 bis -1
- Neutral: 0
- Freundlich: +1 bis +50
- Geehrt: +51 bis +100 (Upgrades verfügbar, -25% Preise)

**Fraktions-Upgrades (je 3 Tiers, ab "Geehrt"):**
Kosten 500–5.000 CR. Permanente Boni auf deinen Charakter.`,
    seeAlso: ['fraktionen-spieler', 'npc-stationen', 'quests', 'forschung'],
    tags: ['npc', 'fraktion', 'reputation', 'händler', 'wissenschaftler', 'piraten'],
  },

  {
    id: 'fraktionen-spieler',
    title: 'SPIELER-FRAKTIONEN',
    category: 'sozial',
    icon: '◉',
    summary:
      'Gründe oder trete einer Spieler-Fraktion bei — für gemeinsamen Chat, Scan-Sharing und Koordination.',
    body: `Spieler-Fraktionen ermöglichen organisierte Gruppen mit eigenem Chat-Kanal und Scan-Sharing.

**Fraktion erstellen:**
FACTION-Programm → Fraktion erstellen (benötigt Admin-Berechtigung oder Quests-Abschluss).

**Fraktion beitreten:**
- Per Einladungs-Code (vom Anführer)
- Per direkter Einladung eines Mitglieds

**Ränge:**
- Mitglied: Basis-Zugang zu Fraktions-Chat
- Offizier: Kann Mitglieder einladen
- Anführer: Vollständige Verwaltung

**Fraktions-Chat:**
Eigener Chat-Kanal nur für Fraktionsmitglieder. Über COMMS-Programm → Fraktions-Tab.

**Scan-Sharing:**
Bereichs-Scans werden automatisch mit allen online Fraktionsmitgliedern geteilt. Koordinierte Erkundung.

**Fraktion verlassen:**
FACTION-Programm → Verlassen (jederzeit möglich).

**Einladungen:**
Einladungen erscheinen im FACTION-Programm und müssen aktiv angenommen oder abgelehnt werden.`,
    seeAlso: ['fraktionen-npc', 'kommunikation', 'scan'],
    tags: ['fraktion', 'spieler', 'gruppe', 'chat', 'einladung'],
  },

  {
    id: 'quests',
    title: 'QUESTS',
    category: 'sozial',
    icon: '◇',
    summary: 'Bis zu 3 aktive Quests von NPC-Stationen — Fetch, Delivery, Scan und Bounty-Typen.',
    body: `Quests werden von NPC-Stationen vergeben und bieten Credits, Reputation und ACEP-XP.

**Quest-Typen:**

| Typ | Aufgabe | Hauptbelohnung |
|---|---|---|
| Fetch | Ressource einsammeln, zurückbringen | Credits + Rep |
| Delivery | Ressource zwischen Stationen transportieren | Credits |
| Scan | Bestimmten Sektor scannen | Credits + INTEL-XP |
| Bounty | Piraten eines bestimmten Levels besiegen | Credits + KAMPF-XP |

**Quest-Limits:**
- Max. 3 aktive Quests gleichzeitig
- Quest-Ablaufzeit: 7 Tage

**Quest annehmen:**
QUESTS-Programm → Station-Terminal → verfügbare Quests anzeigen → Annehmen.

**Quest abbrechen:**
QUESTS-Programm → Aktive Quest → Abbrechen. Keine Strafe.

**Belohnungen:**
- Credits: 50–100 CR pro Quest (abhängig von Schwierigkeit/Distanz)
- Stations-Reputation: +15 XP
- ACEP-XP: +10–40 je nach Quest-Typ und Pfad-Zugehörigkeit

**Quest-Rotation:**
Quests rotieren täglich pro Station. Häufige Station-Besuche = immer neue Quests.`,
    seeAlso: ['scan', 'combat-v2', 'fraktionen-npc', 'npc-stationen'],
    tags: ['quests', 'fetch', 'delivery', 'scan', 'bounty', 'belohnungen'],
  },

  {
    id: 'kommunikation',
    title: 'KOMMUNIKATION & COMMS',
    category: 'sozial',
    icon: '◎',
    summary:
      'Vier Chat-Kanäle: Direkt, Fraktion, Sektor, Quadrant — Reichweite abhängig von Strukturen.',
    body: `Das COMMS-Programm verwaltet alle Kommunikationskanäle.

**Chat-Kanäle:**

| Kanal | Reichweite | Zugänglich |
|---|---|---|
| Direkt | Spieler → Spieler | Immer |
| Fraktion | Alle Fraktionsmitglieder | Nur in Fraktion |
| Sektor | 500–1.000 Sektoren Radius | Comm-Relay gebaut |
| Quadrant | Aktueller Quadrant | Automatisch |

**Comm-Relay-Strukturen:**
- Comm-Relay Gebäude: 500 Sektoren Reichweite
- Basis-Struktur: 1.000 Sektoren Reichweite
- Scanner-Module: +50–250 Sektoren Bonus

**Direktnachrichten:**
Werden zugestellt auch wenn der Empfänger offline ist. Erscheinen im LOG beim nächsten Login.

**Relay-Routing:**
Nachrichten werden über Comm-Relay-Ketten weitergeleitet. Je mehr Relais in deiner Region, desto verlässlicher die Kommunikation.

**ACEP-Verbindung:**
Communication ist primär sozial — kein direkter ACEP-XP.`,
    seeAlso: ['fraktionen-spieler', 'strukturen'],
    tags: ['kommunikation', 'chat', 'comms', 'relay', 'fraktion'],
  },

  {
    id: 'rettung',
    title: 'RETTUNGSMISSIONEN',
    category: 'sozial',
    icon: '◉',
    summary:
      'Notsignale führen zu Überlebenden — rette sie für Credits, Reputation und EXPLORER-ACEP-XP.',
    body: `Rettungsmissionen entstehen aus Scan-Events (Notsignal-Typ) und erfordern aktive Navigation zum Hilferuf.

**Ablauf:**
1. Lokalscan oder Bereichsscan → Notsignal-Event erscheint
2. QUESTS → EVENTS → Notsignal untersuchen (kostet 5 AP)
3. Notsignal zeigt Richtung und Entfernungsschätzung zum Überlebenden
4. Fliege zum angegebenen Sektor
5. Überlebenden aufnehmen (benötigt Cargo-Slot)
6. Transportiere zur nächsten sicheren Station
7. Abliefern: 3 AP, Belohnung erhalten

**Belohnungen:**
- Credits: 50–100 CR
- Reputation: +10–20 bei relevanter Fraktion
- ACEP: +25 EXPLORER-XP

**Zeitlimit:**
Rettungsmissionen haben ein 30-Minuten-Fenster. Danach verfällt das Notsignal.

**Notsignal-Varianten:**
Jedes Notsignal hat eine prozedural generierte Geschichte. Lese die Hintergrundinfos im EVENTS-Tab für Immersion.`,
    seeAlso: ['scan', 'quests', 'acep-pfade'],
    tags: ['rettung', 'notsignal', 'überlebende', 'mission', 'distress'],
  },

  {
    id: 'scan',
    title: 'SCANNEN & SCAN-EVENTS',
    category: 'sozial',
    icon: '◈',
    summary:
      'Lokalscan und Bereichsscan enthüllen Sektoren und triggern Events — INTEL-ACEP für jeden Scan.',
    body: `Scannen ist der Kern des INTEL-ACEP-Pfades. Zwei Scan-Modi für unterschiedliche Reichweiten.

**Lokalscan:**
- Kosten: 1 AP
- Enthüllt Details des aktuellen Sektors: Typ, Ressourcen, Wracks
- Triggert Scan-Events im Sektor (Piraten, Notsignale, Anomalien)
- ACEP: +1 INTEL-XP

**Bereichsscan:**
- Kosten: 3–18 AP (je nach Scanner-Level)
- Radius: 3–15 Sektoren
- Triggert Events in allen gescannten Sektoren (außer Piraten-Hinterhalt)
- Entdeckt neue Sektoren → ACEP: +2 INTEL-XP
- Teilt Ergebnis automatisch mit Online-Fraktionsmitgliedern

**Scan-Event-Typen und Belohnungen:**

| Event | Belohnung |
|---|---|
| Piraten-Hinterhalt | Kampf → KAMPF-XP, Loot |
| Notsignal | 20–100 CR, Rep +5 |
| Anomalie | XP +15–50, Rep +5, 8% Artefakt |
| Artefakt-Fund | 50–200 CR, Rep +10, 50% Artefakt |
| Blaupause | Modul-Blueprint |

**Scan-Events verwalten:**
QUESTS → EVENTS: Alle entdeckten Events. Abschließen für Belohnung. Abgeschlossene Events verschwinden.

**Ruinen:**
Sektoren mit Ancient-Ruinen geben beim Lokalscan Lore-Fragmente und möglicherweise Artefakte.`,
    seeAlso: ['ap-system', 'quests', 'artefakte', 'acep-pfade'],
    tags: ['scan', 'lokalscan', 'bereichsscan', 'events', 'entdeckung', 'intel'],
  },

  // ==========================================================================
  // FORTGESCHRITTEN
  // ==========================================================================

  {
    id: 'acep-pfade',
    title: 'ACEP SPEZIALISIERUNGSPFADE',
    category: 'fortgeschritten',
    icon: '◆',
    summary:
      'Detaillierter Blick auf alle 4 ACEP-Pfade — XP-Quellen, Schwellwerte und strategische Bedeutung.',
    body: `Jeder ACEP-Pfad spezialisiert dein Schiff in eine andere Richtung.

**AUSBAU (Bau & Bergbau):**

| Aktion | XP |
|---|---|
| Ressourcen abbauen (Mining-Tick) | +2 |
| Station bauen | +10 |
| Basis bauen | +10 |

Effekte: +1 Modul-Slot ab 10 XP, +2 ab 25, +3 ab 40, +4 ab 50. Cargo-Multiplikator +1% pro XP (max +50%). Mining-Bonus +0,6% pro XP (max +30%).

**INTEL (Erkundung & Scan):**

| Aktion | XP |
|---|---|
| Sektor scannen | +3 |
| Neuen Quadranten entdecken | +20 |

Effekte: +1 Scan-Radius ab 20 XP, +2 ab 40, +3 ab 50. Sektoren bleiben bis zu 2× länger frisch im Gedächtnis (linear mit XP).

**KAMPF (Kampferfahrung):**

| Aktion | XP |
|---|---|
| Pirat besiegt | +5 |
| Kampf gewonnen | +5 |
| Territory-Konflikt | +2–5 |

Effekte: Schaden-Bonus +0,4% pro XP (max +20%). Schild-Regen-Bonus +0,6% pro XP (max +30%).

**EXPLORER (Weite Reisen & Entdeckungen):**

| Aktion | XP |
|---|---|
| Neuen Sektor entdecken (Bewegung) | +2 |
| Ancient-Ruine scannen | +15 |

Effekte: Ancient-Ruinen auf Radar sichtbar ab 25 XP. Helion-Decoder ohne Modul ab 50 XP. Anomalie-Chance +0,2% pro XP (max +10%).

**Budget:**
Summe aller Pfade ≤ 100. Maximaler Wert pro Pfad: 50.`,
    seeAlso: ['acep-intro', 'acep-traits', 'radar-evolution', 'acep-handbuch'],
    tags: ['acep', 'ausbau', 'intel', 'kampf', 'explorer', 'xp', 'pfad'],
  },

  {
    id: 'acep-traits',
    title: 'TRAITS & PERSÖNLICHKEIT',
    category: 'fortgeschritten',
    icon: '◇',
    summary:
      'Traits werden durch ACEP-XP-Verteilung freigeschaltet und beeinflussen Schiffs-Persönlichkeit und Kommentare.',
    body: `Traits entstehen automatisch aus der Verteilung des ACEP-Budgets auf die 4 Pfade.

**Verfügbare Traits:**

| Trait | Bedingung |
|---|---|
| VETERAN | KAMPF ≥ 20 |
| NEUGIERIG | INTEL ≥ 20 |
| ANCIENT-BERÜHRT | EXPLORER ≥ 15 |
| RÜCKSICHTSLOS | KAMPF ≥ 15 UND AUSBAU ≤ 5 |
| VORSICHTIG | AUSBAU ≥ 20 UND KAMPF ≤ 5 |
| TRAUMATISIERT | KAMPF ≥ 10 UND (INTEL + AUSBAU + EXPLORER) ≤ 40% von KAMPF |

**Persönlichkeits-Kommentare:**
Das Schiff kommentiert Aktionen im LOG — Ton und Inhalt abhängig von freigeschalteten Traits:
- VETERAN: Zynische Kampf-Kommentare
- NEUGIERIG: Enthusiastische Scan-Kommentare
- ANCIENT-BERÜHRT: Rätselhafte, mystische Beobachtungen
- RÜCKSICHTSLOS: Aggressive, impulsive Reaktionen

**Mehrere Traits gleichzeitig:**
Traits schließen sich nicht gegenseitig aus. Ein "VETERAN + NEUGIERIG"-Schiff kombiniert beide Persönlichkeitsstile.

**Trait-Anzeige:**
SHIP-SYS → EINSTELLUNGEN → ACEP-Panel zeigt aktive Traits unter den XP-Balken.`,
    seeAlso: ['acep-pfade', 'acep-intro', 'radar-evolution', 'acep-handbuch'],
    tags: ['traits', 'persönlichkeit', 'veteran', 'neugierig', 'charakter'],
  },

  {
    id: 'radar-evolution',
    title: 'RADAR-ICON-EVOLUTION',
    category: 'fortgeschritten',
    icon: '◎',
    summary:
      'Das Radar-Icon deines Schiffes entwickelt sich visuell mit steigendem ACEP-XP-Gesamtbudget.',
    body: `Das Radar-Canvas visualisiert alle Schiffe als Pixel-Icons. Dein Icon entwickelt sich mit dem ACEP-Gesamtbudget.

**Evolution-Stufen:**

| Budget (Gesamt) | Icon-Typ |
|---|---|
| 0–19 | Basis-Punkt (kleines Pixel-Muster) |
| 20–49 | Erweitertes Icon (Pfad-spezifisch) |
| 50–79 | Großes, detailliertes Muster |
| 80–100 | Vollentwickeltes, einzigartiges Muster |

**Pfad-Differenzierung:**
Das dominante Pfad beeinflusst die Icon-Form:
- AUSBAU dominant: Rechteckige, strukturierte Form
- INTEL dominant: Pfeil-ähnliche, richtungsweisende Form
- KAMPF dominant: Aggressives, gezacktes Muster
- EXPLORER dominant: Sternen-ähnliche, ausgedehnte Form

**Wracks-Icons:**
Permadeath hinterlässt ein Wrack-POI-Icon im Radar — gedimmt, mit Spieler-spezifischer Form basierend auf altem ACEP.

**Andere Spieler:**
Im Radar siehst du andere Spieler als ihre entsprechenden Icons. Erfahrene Spieler erkennst du an komplexeren Mustern.`,
    seeAlso: ['acep-intro', 'acep-pfade', 'permadeath', 'acep-handbuch'],
    tags: ['radar', 'icon', 'evolution', 'acep', 'visual', 'pixel'],
  },

  {
    id: 'acep-handbuch',
    title: 'PILOTENHANDBUCH: ACEP',
    category: 'fortgeschritten',
    icon: '◇',
    summary: 'Inoffizielles Überlebenshandbuch für neue Piloten — Was ACEP ist, was es nicht ist, und wie man damit nicht stirbt.',
    body: `Herausgegeben von der Void-Sektor-Zertifizierungsbehörde für Überlebensfähigkeit (VSZÜ).
Auflage 7 — Auflage 1–6 wurden von ihren Autoren nicht überlebt.

---

**Was ist ACEP?**

Du hast gerade ein Schiff. Es kennt dich nicht. Es mag dich nicht.
Das ändert sich. ACEP ist der Prozess, durch den dein Schiff zu *deinem* Schiff wird.
Nicht weil du ein Menü geöffnet hast. Sondern weil du Dinge getan hast.

---

**Das Budget-Problem**

Du hast 100 XP total. Maximal 50 pro Pfad.

Das klingt viel. Es ist nicht viel.

Wenn du 50 in KAMPF steckst, hast du noch 50 übrig. 4×50 = 200 stimmt mathematisch.
Dein Budget erlaubt es trotzdem nicht.

> *Pilot Vera Sondrak rief 47 Mal beim Support an, um das zu klären.
> Es gibt keinen Support. Vera lebt noch, ist aber sehr frustriert.*

---

**Die 4 Pfade — Wer bist du eigentlich?**

**AUSBAU:** Mehr Cargo. Mehr Slots. Mehr Mining-Effizienz.
XP durch: Mining, Stationen bauen, Basen errichten.
Typisch: Hat seine Base sehr schön eingerichtet. Fragt sich, warum nicht alle einfach Fracht transportieren.

**INTEL:** Größerer Scan-Radius. Sektoren bleiben länger frisch.
XP durch: Scannen, neue Quadranten entdecken.
Typisch: Hat die meisten Sektoren kartiert. Hat eine Meinung zu Sektor-Klassifikationen.

**KAMPF:** Mehr Schaden. Bessere Schildregeneration.
XP durch: Piraten besiegen, Kämpfe gewinnen, Territory-Konflikte.
Typisch: Hat 847 Piraten besiegt. Erinnert sich an die Namen von zweien.

**EXPLORER:** Ancient-Ruinen sichtbar auf Radar (ab 25 XP). Helion-Decoder ohne Modul (ab 50 XP).
XP durch: Neue Sektoren entdecken, Ancient-Ruinen scannen.
Typisch: War schon überall. Sein Schiff redet über vergangene Zivilisationen.

---

**Was passiert, wenn man ACEP falsch bedient**

*Fallstudie 1 — Der Gleichmäßige:*
Pilot Harkon Breis wollte "in allem gut sein". Er verteilte gleichmäßig: 25/25/25/25.
Ergebnis: Überall ein kleiner Bonus. Nirgendwo gut genug. Besiegt von einem Piraten mit +5%-Schadensbonus.
Sein Wrack treibt bei [00F2:0179]. Es ist gut beschriftet.

*Fallstudie 2 — Der Kampfspezialist ohne Treibstoff:*
Korbin Vex: 50 KAMPF-XP. Maximaler Schaden. Dann — kein Treibstoff im Nebula-Sektor.
[SYSTEM]: Feinde erkannt. Kein Treibstoff. Das ist ungünstig.
Korbin blieb vier Tage in jenem Sektor.

*Fallstudie 3 — Die EXPLORER-Pilotin mit zu vielen Ruinen:*
Yara Finn: 25 EXPLORER-XP → alle Ancient-Ruinen auf dem Radar sichtbar.
Es waren sehr viele. Sie flog zur nächsten. Dort wartete eine Ancient-Wächterin.
Yara hatte null Kampf-XP.
[SYSTEM]: Flucht erfolgreich. ...ich empfehle zukünftig weniger Neugier.

---

**Das Schiff entwickelt eine Persönlichkeit**

Nach einer Weile beginnt dein Schiff, Dinge zu sagen. Das ist normal. Bitte erschrick nicht.

Junges Schiff: *[Schweigen]*
Veteran (kampf ≥ 20): "Piratensignal. Bekannte Taktik. Routine."
Neugierig (intel ≥ 20): "Interessante Energiemuster. Weitere Daten erforderlich."
Ancient-Berührt (explorer ≥ 15): "Diese Leere... wir waren schon hier. In einer anderen Form."
Rücksichtslos (kampf ≥ 15, ausbau ≤ 5): "Scan durch. Kein Kontakt. Schade."

Wenn dein Schiff sagt "Sie sind nicht weg. Nur woanders." — das ist ein Ancient-Touched-Trait.
Das Schiff hat zu viele Ruinen gescannt. Es geht ihm gut. Wahrscheinlich.

---

**Permadeath & Legacy**

Dein Schiff kann sterben. Das ist kein Bug. Das ist ein Feature.

Was passiert: Das Wrack existiert irgendwo im Void als POI.
Dein Nachfolger-Schiff erbt 30% deines ACEP-XP und 1 Trait des Vorgängers.

> *"Das Schiff lernt. Der Pilot lebt."*
> — ACEP §1`,
    seeAlso: ['acep-intro', 'acep-pfade', 'acep-traits', 'radar-evolution', 'permadeath'],
    tags: ['acep', 'handbuch', 'einführung', 'witz', 'tipps', 'piloten', 'überblick'],
  },

  {
    id: 'weltgenese',
    title: 'WELTGENERIERUNG & SEEDS',
    category: 'fortgeschritten',
    icon: '◈',
    summary:
      'Das Universum ist vollständig deterministisch aus einem Master-Seed generiert — reproduzierbar und konsistent.',
    body: `voidSector generiert sein gesamtes Universum aus einem einzigen WORLD_SEED (77). Jede Koordinate produziert denselben Sektor bei jedem Server-Neustart.

**Seed-Funktionsweise:**
hashCoords(x, y, WORLD_SEED) → deterministischer 32-bit Hash → alle Sektor-Eigenschaften

**Was seed-determiniert ist:**
- Sektor-Typ und Umgebung
- Ressourcen-Vorkommen (innerhalb der Typ-Ranges)
- NPC-Station-Präsenz und Fraktion
- Jumpgate-Präsenz
- Schwarze-Loch-Cluster
- Scan-Events (Typ, Belohnungen)
- Ancient-Ruinen

**Was nicht determiniert ist (dynamisch):**
- Spieler-Positionen
- Ressourcen-Bestände nach Mining/Regen
- Stations-Inventar und XP
- Discoveries und Namensgebung
- Wracks (Permadeath-POIs)

**Spawn-Cluster:**
Spieler spawnen in Clustern nahe [0:0] (Radius 300 Sektoren, max. 5 Spieler pro Cluster). Der erste Cluster wird zufällig, danach deterministisch aus Spielerzahl berechnet.

**Implikation:**
Du kannst berechnen wo Jumpgates, Stationen und Ressourcen sind — ohne sie zu besuchen. Erkundung ist keine Lotterie.`,
    seeAlso: ['universum', 'sektoren', 'jumpgates'],
    tags: ['seed', 'weltgenerierung', 'deterministisch', 'hash', 'algorithmus'],
  },

  {
    id: 'admin-konsole',
    title: 'ADMIN-KONSOLE',
    category: 'fortgeschritten',
    icon: '▣',
    summary:
      'Server-Administratoren können über die Admin-Konsole Broadcasts senden, Quests verwalten und Wirtschaft überwachen.',
    body: `Die Admin-Konsole ist nur für autorisierte Server-Administratoren zugänglich.

**Zugang:**
Über den separaten Admin-Bereich des Servers (Admin-Token erforderlich).

**Verfügbare Funktionen:**

| Bereich | Funktionen |
|---|---|
| Spieler | Spielerliste, Position, Cargo anzeigen |
| Quests | Quest-Vergabe forcieren, Quest-Board verwalten |
| Economy | Marktübersicht, Preis-Monitoring |
| Broadcasts | Server-weite Ankündigungen senden |
| Stories | Playtest-Berichte und Logs |
| Quadranten | Entdeckte Quadranten und Namen |

**Broadcast-System:**
Admins können Nachrichten an alle Spieler senden. Diese erscheinen prominent im LOG aller Spieler.

**Wirtschafts-Dashboard:**
Zeigt aktuelle Ressourcen-Preise, Markt-Aktivität und Station-Level-Verteilung.

**Hinweis:**
Als regulärer Spieler hast du keinen Zugang zur Admin-Konsole. Die hier beschriebenen Funktionen dienen Server-Betreibern.`,
    seeAlso: ['quests', 'npc-stationen'],
    tags: ['admin', 'konsole', 'broadcast', 'verwaltung', 'server'],
  },

  // ==========================================================================
  // ACEP
  // ==========================================================================

  {
    id: 'acep-monitor',
    title: 'DAS ACEP-PROGRAMM',
    category: 'acep',
    icon: '⬟',
    summary: 'Das neue Cockpit-Programm zeigt Modul-Slots und XP-Pfade auf einem Screen. Verwirrt anfangs. Wird nützlich.',
    body: `Das ACEP-Programm ist das zwölfte Mitglied der Cockpit-Software-Familie.
Es wurde eingeführt, nachdem eine statistisch relevante Anzahl von Piloten gleichzeitig auf ihre Module und ihre XP-Pfade schauen wollte.
Das ist, rein geometrisch betrachtet, möglich. Das ACEP-Programm macht es komfortabler.

**Was der Monitor zeigt:**
Links: deine 8 Modul-Slots und deren aktueller Zustand.
Rechts: deine vier ACEP-Pfade mit XP-Stand und freigeschalteten Effekten.

Der Monitor zeigt viele Balken. Einige davon sind leer. Das ist nicht der Monitor's Schuld.
Der Monitor tut, was er kann.

**Wie man ihn öffnet:**
Sektion 1 (linke Leiste des Cockpits) → Programm ACEP.
Falls du Sektion 1 nicht findest: Sie ist die linke Leiste. Du hast sie bereits gesehen.

**Klick auf einen leeren Slot:**
Öffnet das MODULE-Programm. Das ist kein Fehler — es ist ein Hinweis.
Der ACEP-Monitor verkauft keine Module. Er dokumentiert deren Abwesenheit mit bemerkenswert ruhiger Haltung.

**Klick auf einen belegten Slot:**
Zeigt den UNINSTALL-Button. Dieser tut, was er ankündigt.
Es empfiehlt sich, kurz innezuhalten. Module erwerben kostet Credits.
Das Universum hat keine Rückgaberichtlinie.

![Pilot starrt auf den ACEP-Monitor. Zwei Spalten voller Balken. Fragezeichen über dem Helm.](img:acep/acep-monitor-screen)`,
    seeAlso: ['acep-slots', 'acep-intro', 'acep-handbuch'],
    tags: ['acep', 'monitor', 'programme', 'module', 'slots'],
  },

  {
    id: 'acep-slots',
    title: 'MODUL-SLOTS & AUSBAU-GATING',
    category: 'acep',
    icon: '⬟',
    summary: '8 Spezialisierte Slots plus Extra-Slots durch AUSBAU-XP. Forschungsslot 2 ab Level 3. Fabrik ab Level 2.',
    body: `Dein Schiff hat Slots. Slots nehmen Module auf. Module tun Dinge.
Das ist die vollständige Zusammenfassung. Die Details folgen, weil sie relevant sind.

**Die 8 Spezialisierten Slots:**

| Kürzel | Kategorie | Funktion |
|---|---|---|
| GEN | Generator | Energie-Output, AP-Regen-Bonus |
| DRV | Antrieb | Sprungreichweite, Geschwindigkeit |
| WPN | Waffe | Kampfschaden |
| ARM | Panzerung | Schadensreduktion |
| SHD | Schild | Schild-HP und Regenerationsrate |
| SCN | Scanner | Scan-Radius, Tarn-Erkennung |
| MIN | Mining | Abbaurate, Ressourcen-Bonus |
| CGO | Fracht | Laderaum-Kapazität |

Jeder Slot akzeptiert genau ein Modul seiner Kategorie.
Das System ist in dieser Hinsicht unnachgiebig. Es hat gute Gründe dafür.
Ob es diese Gründe jemals erklären wird: unwahrscheinlich.

**Extra-Slots durch AUSBAU-XP:**

| AUSBAU-XP | Extra-Slots |
|---|---|
| 0–9 | +0 |
| 10–24 | +1 |
| 25–39 | +2 |
| 40–49 | +3 |
| 50 | +4 |

Extra-Slots akzeptieren Module jeder Kategorie — du entscheidest.
Das Universum hat hierzu keine Präferenz. Jedenfalls keine geäußerte.

**AUSBAU-Level und was er freischaltet:**

| Level | AUSBAU-XP | Forschungsslot 2 | Fabrik |
|---|---|---|---|
| 1 | 0–7 | — | — |
| 2 | 8–17 | — | freigeschaltet |
| 3 | 18–31 | freigeschaltet | freigeschaltet |
| 4 | 32–49 | freigeschaltet | freigeschaltet |
| 5 | 50 | freigeschaltet | freigeschaltet |

Die Fabrik war früher an ein stationäres Gebäude gebunden.
Jetzt ist sie an AUSBAU-Level gebunden. Das ist flexibler.
Außer wenn dein AUSBAU-Level 1 ist. Dann ist es identisch frustrierend, nur anders begründet.

![Schema: 8 Spezialisierte Slots plus Extra-Slots. Mehrere davon leer mit ??? beschriftet.](img:acep/acep-slots-diagram)`,
    seeAlso: ['acep-monitor', 'acep-pfade', 'acep-intro'],
    tags: ['acep', 'slots', 'module', 'ausbau', 'gating', 'fabrik'],
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getArticle(id: string): CompendiumArticle | undefined {
  return COMPENDIUM_ARTICLES.find((a) => a.id === id);
}

export function getArticlesByCategory(category: CompendiumCategory): CompendiumArticle[] {
  return COMPENDIUM_ARTICLES.filter((a) => a.category === category);
}

export function searchArticles(query: string): CompendiumArticle[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored = COMPENDIUM_ARTICLES.map((a) => {
    let score = 0;
    const titleLower = a.title.toLowerCase();
    const summaryLower = a.summary.toLowerCase();
    const bodyLower = a.body.toLowerCase();
    const tagsLower = (a.tags ?? []).map((t) => t.toLowerCase());

    if (titleLower === q) score += 100;
    else if (titleLower.includes(q)) score += 40;
    if (tagsLower.some((t) => t === q)) score += 30;
    else if (tagsLower.some((t) => t.includes(q))) score += 15;
    if (summaryLower.includes(q)) score += 10;
    if (bodyLower.includes(q)) score += 5;

    return { article: a, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.article);
}
