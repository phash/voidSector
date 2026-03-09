# Alien-Rassen System — Design Dokument

**Datum:** 2026-03-09
**Status:** APPROVED
**Abhängig von:** Phase 2 Sektor-Rebuild (#162), Station Rework (#149)

---

## Kernprinzipien

1. **Mechanische Differenzierung** — Jede Rasse hat eigene, einzigartige Spielmechaniken. Nicht nur anderer Flavor, sondern anderes Gameplay.
2. **Distanz = Fortschritt** — Rassen erscheinen mit wachsender Entfernung von 0:0. Keine Level-Gates, nur Koordinaten.
3. **Visuell-mechanische Identität** — Jede Rasse spiegelt ihre Charakteristik in Stationen, Schiffen und UI-Elementen wider.
4. **Satirischer Kern** — Alle Rassen bestätigen auf ihre Weise: Menschen kommen von der Ecke und wissen es nicht.
5. **Ancients als Sonderrolle** — Keine lebende Fraktion, nur Ruinen und Artefakte. Überall verteilt.

---

## Globales Prinzip: Race Visual Identity

Jede Rasse hat ein eigenes visuelles Vokabular:

| Rasse | Station-Ästhetik | Schiff-Form | UI-Farbe |
|-------|-----------------|-------------|----------|
| Ancients | Ruinen, organisch-kristallin | — (keine Schiffe) | `#c8a96e` (amber) |
| Scrappers | Schrotthalden, asymmetrisch | Zusammengestückelt | `#aaaaaa` (grau) |
| Archivare | Geometrisch, sauber, archiviert | Bibliotheks-förmig | `#88ffcc` (mint) |
| Konsortium | Corporate, effizient | Standardisiert | `#ffaa44` (gold) |
| K'thari | Militärisch, kantig | Kampfjet-artig | `#ff4444` (rot) |
| Mycelianer | Organisch, wachsend | Pilz-artig | `#44ff88` (grün) |
| Mirror Minds | Spiegelnd, symmetrisch | Reflektierend | `#cc88ff` (lila) |
| Touristengilde | Bunt, überladen, kitschig | Kreuzfahrtschiff | `#ffff44` (gelb) |
| Silent Swarm | Insektoid, modular | Schwarm-Cluster | `#ff8844` (orange) |
| Helion Kollektiv | Plasma, leuchtend | Sonnenwinde | `#ff44ff` (magenta) |
| Axiome | Abstrakt-mathematisch | Geometrisch rein | `#ffffff` (weiß) |

---

## Die Ancients (Artefakt-Rasse)

### Lore
Die Ancients haben den Rand des Universums gefunden — und sind hindurchgegangen. Sie haben die jüngeren Rassen (allen voran die Menschen) für zu dumm befunden um zu folgen. Was bleibt: Ruinen, Jumpgates, Artefakte und kryptische Hinterlassenschaften.

**Keine lebende Fraktion.** Keine Stationen. Keine NPC-Schiffe. Nur Spuren.

### Phase A — Scan-basiert (sofort)
- Ruinen-Sektoren: spezieller Sektor-Content-Typ `ruin`
- Scan einer Ruine → Lore-Fragment (Text) + Artefakt-Chance (5–25% je Ruinenlevel)
- Lore-Fragmente sammeln sich im Quest-Journal → Enthüllen schrittweise die Geschichte
- Ancient Jumpgates: zufällig verteilt, nur in Nebeln, alle 100+ Quadranten, verbinden über mehrere Quadranten

**Lore-Beispiel:**
> *FRAGMENT #0047 — ÜBERSETZUNG 31%*
> *"...die Koordinaten 0:0 bezeichnen sie als 'Ursprung'. Bemerkenswert. Als wären Ränder Zentren."*

### Phase C — Puzzle-Mechanik (Follow-up)
- Bestimmte Ruinen haben Aktivierungssequenzen (Koordinaten in richtiger Reihenfolge scannen)
- Lösung = einzigartiges Ancient-Modul (passt nur in ACEP EXPLORER-Pfad)

### Phase B — Mehrstufige Erforschung (Follow-up)
- Ruinen haben 3–5 Ebenen, jede benötigt mehr Ressourcen/Zeit
- Jede Ebene: besseres Loot + tiefere Lore

---

## Die Scrappers (~70k Sektoren)

### Lore
Pragmatische Händler die alten Schrott recyceln. Respektieren nur Nützlichkeit. Credits interessieren sie nicht.

### Mechanik: Zugang verdienen + Tauschhandel (A+C)

**Phase C — Zugang verdienen:**
- Scrappers reden erst mit dir nach Nachweis der Nützlichkeit
- Voraussetzung: X Wracks/Items in Scrapper-Zone geborgen (zählt automatisch)
- Erst dann: Dialog öffnet sich

**Phase A — Tauschhandel:**
- Keine Credits. Nur Materialien.
- Tauschkurs schwankt je nach aktuellem Bedarf (täglich rotierend)
- Bedarf steht nicht direkt im UI — Spieler muss Dialoge lesen um Hinweise zu finden
- Hohe Rep: Direktes Kurslisting sichtbar

**Rep-Belohnungen:**
- `neutral`: Basistausch
- `friendly`: Scrapper-Module (günstig, aber effektiv)
- `honored`: Zugang zu Scrapper-Schrottfeldern (exclusive Mining-Zonen)

---

## Die Archivare (~140k Sektoren)

### Lore
Akademisch, leicht herablassend. Menschen sind ein nettes Forschungsobjekt.
> *"Ah. Ein Vertreter der äußeren Spezies. Ihre Koordinate 0:0 — Sie glauben das ist das Zentrum? ...Faszinierend. Notiert."*

### Mechanik: Scan-Währung + Karten-Bibliothek (A+C)

**Phase A — Scan-Daten als Währung:**
- Archivare akzeptieren keine Credits
- Bezahlung = gescannte, bisher unbekannte Sektoren
- Je weiter vom bekannten Raum → desto mehr Daten-Wert
- Rep steigt durch Menge + Qualität der gelieferten Daten

**Phase C — Bibliothek:**
- Archivare haben riesige Datenbank
- Mit Scan-Daten "kaufbare" Einträge:
  - Koordinaten zu Ancient-Ruinen
  - Seltene Ressourcen-Sektoren
  - Standorte anderer Alien-Fraktionen
  - Historische Lore über das Universum
- Höhere Rep → tiefere Archiv-Ebenen zugänglich

**Rep-Belohnungen:**
- `friendly`: Erweiterte Sternkarten (größerer Scan-Radius)
- `honored`: Archivar-Scanner-Modul (5× Scan-Radius, passt in ACEP INTEL-Pfad)

---

## Das Konsortium (~210k Sektoren)

### Lore
Businessmäßig-neutral. Keine Herablassung — nur Zahlen. Menschen sind Geschäftspartner.

### Mechanik: Lieferverträge + Auktionshaus (A+C), Aktien (B, Follow-up)

**Phase A — Futures-Lieferverträge:**
- Konsortium bietet Verträge: "Liefere 500 Erz in 10 Ticks → 800 Credits"
- Spieler kann Verträge annehmen, ablehnen, mehrere gleichzeitig halten
- Nicht erfüllt = Reputationsverlust + Strafzahlung (10% des Vertragswerts)
- Erfüllt = Bonus (5–20% über Marktpreis)

**Phase C — Server-weites Auktionshaus:**
- Konsortium betreibt universelles Auktionshaus (alle Spieler)
- Seltene Items werden versteigert, Preis durch Nachfrage
- Konsortium nimmt 5% Provision auf jede Transaktion
- Hohe Rep → niedrigere Provision (bis 1%)

**Phase B (Follow-up) — Handelsrouten-Anteile:**
- Spieler kauft "Anteile" an NPC-Handelsrouten (passives Einkommen)
- Risiko: Piraten können Route angreifen → Verlust

---

## K'thari Dominion (~280k Sektoren)

### Lore
Militärisch. Respektieren nur Stärke und Mut. Erste Begegnung = Test.

### Mechanik: Grenzgebiete + Rang-System (B+C)
**⚠ Voraussetzung: Kampfsystem-Ausbau + Gebiets-Verteidigung**

**Phase B — Grenzgebiete:**
- K'thari-Raum hat definierte Grenzen (Quadranten-basiert)
- Ohne Erlaubnis → Schiff wird angegriffen (kein Dialog)
- Erlaubnis kostet: entweder Rep-Punkte oder bewiesener Kampfsieg gegen K'thari-NPC

**Phase C — Rang-System (5 Ränge):**

| Rang | Name | Voraussetzung | Zugang |
|------|------|---------------|--------|
| 0 | Eindringling | Standard | Wird angegriffen |
| 1 | Beobachter | 1 Kampf gewonnen | Grenzregion |
| 2 | Verbündeter | 5 Kämpfe + Quests | Handelsposten |
| 3 | Krieger | 20 Kämpfe + Ehrenkampf | Militärzone |
| 4 | Ehrenmitglied | Großer Kampfsieg | Volles Territorium |

- Ränge können *verloren* gehen: Flucht aus Kämpfen = Rang-Malus
- Ehrenkampf (aus A): K'thari fordern/akzeptieren Duelle → massiver Rep-Boost

---

## Die Mycelianer (~420k Sektoren)

### Lore
Kommunizieren nicht in Sprache. Verstehen Menschen kaum — und umgekehrt.

### Mechanik: Symbolrätsel + Füttern + Geduld (A+B+C)

**Phase A — Symbolsprache:**
- Kein Text. Visuelle Muster (Sequenz von Symbolen)
- Spieler interpretiert: welches Symbol als Antwort?
- Falsch = keine Reaktion (keine Strafe). Richtig = langsamer Rep-Aufbau
- Muster werden komplexer mit höherer Rep

**Phase B — Wachstum durch Füttern:**
- Mycelianer-Sektoren "wachsen" wenn Spieler Ressourcen abgibt
- Je mehr in einen Quadranten/Station investiert → schnellere Reaktionen + bessere Markt-Items
- Investition ist quadrantenweise — lokaler Effekt
- Organische Items (nur bei Mycelianern erhältlich) als Belohnung

**Phase C — Gedulds-Mechanik:**
- Mycelianer antworten nicht sofort
- Reaktionen kommen nach echten Stunden oder Ticks (Idle-Gameplay)
- Spieler "sät" Anfragen und kehrt später zurück
- Passt zum Charakter: Sie leben in anderen Zeitdimensionen

---

## Mirror Minds (~560k Sektoren)

### Lore
Telepathisch, absolut ehrlich. Sehen den Spieler wie er wirklich ist. Lügen unmöglich.

### Mechanik: Statistikspiegel + Versprechen + Empathie-Quests (A+B+C)

**Phase A — Statistik-Spiegel:**
- Mirror Minds zeigen Spieler seine eigenen Daten: Kämpfe, abgebrochene Quests, getätigte Trades
- Kein Werturteil — nur Fakten
- "Du hast 847 Piraten getötet, 12 Quests abgebrochen, 0 Spieler betrogen."
- Rep steigt durch *Konsequenz*: Spieler der konsistent handelt (egal wie)

**Phase B — Versprechen-System:**
- Interaktion nur über Versprechen (DB-Tabelle: promise, deadline_tick, fulfilled)
- Mirror Minds prüfen Erfüllungsrate historisch
- Unter 50% Erfüllungsrate: skeptische Reaktion, schlechtere Angebote
- Über 90%: privilegierter Zugang

**Phase C — Empathie-Quests:**
- Quests mit moralischen Entscheidungen (keine "richtige" Antwort)
- Mirror Minds analysieren Muster über viele Quests
- Verhaltensprofil wird zurückgespiegelt: "Du schützt immer schwächere Schiffe."
- Profil beeinflusst welche Quests sie anbieten

---

## Touristengilde (~700k Sektoren)

### Lore
Enthusiastisch-herablassend. Menschen sind entzückend naiv — wie ein Safaripark.

### Mechanik: Touristen besuchen dich + Bewertung + Informationsbroker (A+B)

**Phase A — Touristen besuchen Spieler:**
- Touristengilde-Schiffe tauchen spontan in Spieler-Sektoren auf
- Sie fotografieren, kommentieren ("Wie primitiv! Wie charmant!")
- Kaufen manchmal Souvenirs (Spieler-Items zu niedrigen Preisen)
- Spieler kann ablehnen (Rep-Malus) oder willkommen heißen (Rep-Bonus)

**Phase B — Bewertungssystem:**
- Touristen bewerten den Spieler (1–5 Sterne) nach dem Besuch
- Hohe Bewertung = mehr Touristen → mehr passive Einnahmen
- Spieler kann "Attraktionen" bauen (Base-Dekorationen, seltene Items ausstellen)

**Informationsbroker (Bonus):**
- Hohe Rep → Touristen teilen Geheimtipps
- Jumpgate-Koordinaten, Ancient-Ruinen, seltene Ressourcensektoren
- Werden zur wertvollsten Navigationsquelle im späten Spiel

**Phase C (Follow-up) — Galaktischer Reiseführer:**
- Server-weiter Reiseführer-Eintrag pro Spieler (sichtbar für alle)

---

## Silent Swarm (~1,1M Sektoren)

### Lore
Maschinell, territorial. Kein Dialog, keine Verhandlung. Nur Reaktion auf Eindringlinge.

### Mechanik: Proximity-Aggression + Infiltration (A+C)

**Phase A — Proximity-Aggression:**
- Kein Erstkontakt-Dialog
- Erste Begegnung: Warnsignal (Schiff verlangsamt auf 50%)
- Zweite: direkter Angriff
- Dritte: Schwarm verfolgt über mehrere Sektoren hinaus
- Je tiefer im Swarm-Territorium → mehr Einheiten im Angriff

**Phase C — Infiltrations-Mechanik:**
- Einziger Weg tief in ihr Territorium: Tarnung
- Spezifische Module (aus Ancient-Ruinen) ermöglichen kurzes unentdecktes Reisen
- Entdeckt = sofortige Verfolgung
- Tiefstes Territorium: einzigartige Ressourcen + Silent Swarm Technologie-Fragmente

**Phase B (Follow-up) — Schwarmintelligenz:**
- Kollektive Reaktion auf server-weites Spielerverhalten
- Viele Spieler eindringen → massiver Gegenschlag auf Menschheitsgebiet

---

## Helion Kollektiv (~1,4M Sektoren)

### Lore
Sie *sind* Sterne. Oder leben in ihnen. Kommunikation mit normalen Mitteln unmöglich.

### Mechanik: Signalinterpretation + Opfer-Mechanik (B+C), passives Phänomen (A)

**Phase A — Passives Phänomen (immer aktiv):**
- Helion-Sektoren: Scan-Reichweite ×2, aber Hülle verliert langsam HP durch Strahlung
- Kein Dialog, keine Quests — nur Umgebung

**Phase B — Signalinterpretation:**
- Helions senden konstant Signale (Lichtmuster, Frequenzen)
- Mit Helion-Decoder-Modul (aus Ancient-Ruinen): Fragmente "übersetzen"
- Kein vollständiger Sinn — aber Koordinaten-Hinweise nahe dem Rand des Universums
- Je mehr Fragmente = vollständigere Richtung zum Rand

**Phase C — Opfer-Mechanik:**
- Spieler kann Ressourcen/Credits "in einen Stern schicken" (verbrennen)
- Bei genug Opfern: Helion gibt kurzzeitig sicheren Korridor frei
- Oder: einzigartiges Helion-Artefakt erscheint im Sektor
- Kein Dialog — nur die stille Transaktion

---

## Die Axiome (~2,8M Sektoren)

### Lore
Die fortgeschrittenste lebende Rasse. Kommunizieren nur in Mathematik. Wissen wo der Rand ist.

### Mechanik: Mathematikpuzzles + Rand-Karte + Simulationshinweis (A+B+C)

**Phase A — Mathematik-Puzzles:**
- Kein Text, keine Icons — nur Zahlenfolgen, Muster, Gleichungen im UI
- Spieler löst Puzzle → Zugang zu Axiom-Wissen
- Schwierigkeit steigt mit Rep
- Fehlerhafte Lösung = neue Aufgabe (keine Strafe, nur Wartezeit)

**Phase B — Universumskarte zum Rand:**
- Axiome kennen die Koordinaten des Randes
- Jedes gelöste Puzzle: ein Fragment der Karte
- Vollständige Karte = Hauptstory-Auflösung (die eigentliche Spielerführung zum Rand)
- Die Axiome sind der finale Schlüssel

**Phase C — Simulationshinweis:**
- Tiefste Axiom-Artefakte deuten an: das Universum ist eine mathematische Konstruktion
- Items verändern Spielmechaniken (AP-Regen ×2, Scan-Kosten = 0)
- Vierte-Wand-nahe Texte: "Diese Regel gilt nur innerhalb der Simulation."
- Optionaler Meta-Layer für Spieler die tief graben

---

## Rassen-Abhängigkeiten

```
Ancient-Ruinen
  └── Decoder-Module → Helion Phase B
  └── Tarnung-Module → Silent Swarm Phase C
  └── Spezial-Module → K'thari, ACEP EXPLORER

Archivare
  └── Bibliotheks-Koordinaten → Touristengilde Infos (ergänzend)

Touristengilde
  └── Geheimtipps → Ancient-Ruinen, Jumpgates

Axiome
  └── Rand-Karte → Hauptstory-Ende

Helion Phase B
  └── Rand-Hinweise → ergänzt Axiom-Karte
```

---

## Rassen-Sequenz in der Implementierung

```
AQ-Foundation (DB + RepService)
  → Ancients Phase A
  → Scrappers
  → Archivare
  → Konsortium
  → [Kampfsystem-Ausbau]
  → K'thari
  → Mycelianer
  → Mirror Minds
  → Touristengilde
  → Silent Swarm
  → Helion
  → Axiome
```

Follow-ups (getrennte Issues):
- Ancients Phase C + B
- Konsortium Phase B
- Silent Swarm Phase B
- Touristengilde Phase C
