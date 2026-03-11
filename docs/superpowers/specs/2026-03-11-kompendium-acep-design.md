# Design: Kompendium ACEP-Erweiterung

**Datum:** 2026-03-11
**Issue:** #235
**Status:** Approved

---

## Ton & Stil

Die Texte im Pilotenhandbuch und in den neuen ACEP-Artikeln folgen einem Mix aus **Terry Pratchett** und **Douglas Adams**:

- **Trockener Witz**: Das Universum ist gleichgültig, aber höflich interessiert an deinem Scheitern. Systemmeldungen klingen bürokratisch und leicht apologetisch.
- **Fußnoten-Energie**: Informationen werden beiläufig geliefert, als wären sie schon immer bekannt gewesen — und als würde die Dokumentation leicht überrascht sein, dass du das noch nicht wusstest.
- **Kosmische Gleichgültigkeit**: Das Spiel urteilt nicht. Es dokumentiert nur. Mit einer gewissen Wärme für wiederholte Fehler.
- **Bürokratische Absurdität**: Systeme wurden aus guten Gründen so gebaut. Die Gründe sind nur nicht mehr ganz klar.
- **Selbstironie, nicht Sarkasmus**: Die Piloten sind keine Idioten — sie haben nur Entscheidungen getroffen, die im Nachhinein interessant wirken.

Beispiel-Ton:
> *Der Monitor zeigt viele Balken. Einige davon sind leer. Das ist nicht der Monitor's Schuld. Der Monitor tut, was er kann.*
> *[SYSTEM]: AUSBAU Level 2 erfordert 8 XP. Du hast 7. Das Universum ist fair.*

---

## Scope

Drei Änderungen am bestehenden Kompendium-System:

1. **Neue ACEP-Kategorie** — eigener Tab `⬟ ACEP` mit 6 Artikeln
2. **Bestehende Artikel aktualisieren** — acep-intro, acep-pfade, monitore auf aktuelle Implementierung bringen
3. **Pilotenhandbuch ausbauen** — Fallstudien + neue Sektionen + Pixel-Art-Bilder

---

## Teil 1: Neue ACEP-Kategorie

### Kategorie-Eintrag

In `COMPENDIUM_CATEGORIES` in `packages/client/src/data/compendium.ts` hinzufügen:

```typescript
{ id: 'acep', label: 'ACEP', icon: '⬟' },
```

Als neunten Eintrag (nach `fortgeschritten`).

`CompendiumCategory` Union-Type um `'acep'` erweitern.

### Neue Artikel

**acep-monitor** — Das ACEP-Programm

```
id: 'acep-monitor'
title: 'DAS ACEP-PROGRAMM'
category: 'acep'
icon: '⬟'
summary: 'Das neue Cockpit-Programm ACEP zeigt Modul-Slots und XP-Pfade auf einem Screen. Verwirrt anfangs. Wird nützlich.'
```

Inhalt:
- Was der Monitor zeigt (zwei Spalten: Modul-Slots links, XP-Pfade rechts)
- Wie man ihn öffnet (Programm-Selektor Sektion 1)
- Was Klick auf leeren Slot tut (öffnet MODULE-Programm)
- Was Klick auf belegten Slot tut (zeigt UNINSTALL-Button)
- Selbstironische Note: "Der Monitor zeigt viele Balken. Einige davon sind leer. Das ist nicht der Monitor's Schuld."
- Pixel-Art-Bild: `acep/acep-monitor-screen.png`

**acep-slots** — Modul-Slots & AUSBAU-Gating

```
id: 'acep-slots'
title: 'MODUL-SLOTS & AUSBAU-GATING'
category: 'acep'
icon: '⬟'
summary: '8 Spezialisierte Slots plus Extra-Slots durch AUSBAU-XP. Forschungsslot 2 ab Level 3. Fabrik ab Level 2.'
```

Inhalt:
- 8 Spezialisierte Slots: GEN / DRV / WPN / ARM / SHD / SCN / MIN / CGO
- Extra-Slots freigeschaltet durch AUSBAU-XP (Schwellwerte: 10 / 25 / 40 / 50 XP)
- AUSBAU-Level-Tabelle:

| Level | XP | Forschungsslots | Fabrik |
|---|---|---|---|
| 1 | 0–7 | 1 | — |
| 2 | 8–17 | 1 | ✅ |
| 3 | 18–31 | 2 | ✅ |
| 4 | 32–49 | 2 | ✅ |
| 5 | 50 | 2 | ✅ |

- Selbstironische Note zur Fabrik: "Die Fabrik war früher an ein Gebäude gebunden. Jetzt ist sie an dein AUSBAU-Level gebunden. Das ist effizienter. Außer wenn dein AUSBAU-Level 1 ist."
- Pixel-Art-Bild: `acep/acep-slots-diagram.png`

---

## Teil 2: Bestehende Artikel aktualisieren

### acep-intro

Ergänzen:
- ACEP-Monitor als neues Interface erwähnen (war bisher nur SHIP-SYS)
- AUSBAU-Level-Gating für Forschungsslot 2 und Fabrik
- `seeAlso` um `'acep-monitor'` und `'acep-slots'` erweitern

### acep-pfade

Ergänzen unter AUSBAU:
- "AUSBAU-Level bestimmt Forschungsslots und Fabrik-Zugang"
- Korrekte Level-Schwellwerte (0/8/18/32/50 XP)
- Extra-Slot-Schwellwerte (10/25/40/50 XP)

### monitore

- Programm-Tabelle: 11 → 12 Programme (ACEP hinzufügen)
- SHIP-SYS Beschreibung: "ACEP-Tab entfernt (eigenes Programm)" → "Tabs: EINSTELLUNGEN, MODULE, HANGAR"
- `summary` string: "Die 11 Programme" → "Die 12 Programme"

### grundlagen-start

- "11 Buttons" → "12 Buttons" im Sektion-1-Beschreibungstext
- ACEP-Erwähnung: Von "ACEP-Tab in SHIP-SYS" → "eigenes ACEP-Programm"

---

## Teil 3: Pilotenhandbuch ausbauen (acep-handbuch)

### Neue Sektionen im bestehenden Artikel

**Sektion: "Das neue ACEP-Programm (Update)"**

```
Nach mehreren Beschwerden ("Wo sind meine Balken?") wurde ACEP ein eigenes Cockpit-Programm.
Links: deine Module. Rechts: deine XP-Pfade.
Du kannst jetzt beides gleichzeitig ignorieren statt nacheinander.
```

**Neue Fallstudie 4 — Der Monitor-Erkunder:**

```
Pilot Ren Dalvik öffnete den neuen ACEP-Monitor und klickte auf alle leeren Slots.
Jeder Klick öffnete das MODULE-Programm.
Ren klickte 47 Mal. Es blieben 47 leere Slots.
[SYSTEM]: Die Module kauft man woanders.
Ren lebt noch. Er hat jetzt 0 Module und sehr viel Erfahrung mit dem MODULE-Programm.
```

**Neue Fallstudie 5 — Die Fabrik-Ungeduld:**

```
Pilotin Sera Voss baute sofort eine Fabrik auf ihrer Basis.
Level 1. Fabrik gesperrt.
Sie baute Mining-Module. Level 1. Fabrik gesperrt.
Sie trainierte Kampf. Level 1. Fabrik gesperrt.
AUSBAU war die ganze Zeit auf 7 XP.
[SYSTEM]: AUSBAU Level 2 erfordert 8 XP. Du hast 7.
Sera hat seitdem eine sehr gepflegte Basis mit einer unbenutzten Fabrik.
```

### Pixel-Art-Bilder

Alle 5 Bilder werden per Gemini Imagen generiert, **retro 8-bit pixel art style**, und als statische Assets gespeichert. Die Figuren haben übertrieben ausdrucksstarke Gesichter im Pixel-Art-Stil — selbstironisch, nicht dramatisch.

| Datei | Motiv |
|---|---|
| `acep/pilot-harkon.png` | Harkon Breis winkt aus seinem beschrifteten Wrack. Schild: "GLEICHMÄSSIG VERTEILT". |
| `acep/pilot-korbin.png` | Korbin Vex treibt im Nebula, Treibstoffanzeige rot, Piraten im Hintergrund stehen gelangweilt. |
| `acep/pilot-yara.png` | Yara Finn flieht, 5 Tempel-Icons auf Mini-Radar sichtbar, Ancient-Wächterin dahinter. |
| `acep/acep-monitor-screen.png` | Pilot starrt auf den ACEP-Monitor. Zwei Spalten voller Balken. Fragezeichen über dem Helm. |
| `acep/acep-slots-diagram.png` | Schema 8 Slots + 2 Extra-Slots. 5 davon leer mit "???" beschriftet. |

### Bild-Einbettung in Artikel-Body

Neuer Marker in `renderBody`:

```
![Bildbeschriftung](img:acep/pilot-harkon)
```

**Parser-Logik** (paragraph-level, wie Tables):
- Der bestehende `renderBody`-Parser iteriert über Paragraphen (durch `\n\n` getrennt).
- Ein Paragraph, der mit `![` beginnt und dem Muster `![caption](img:path)` entspricht, wird als Image-Block erkannt.
- `hasBlockContent` wird um den Typ `'image'` erweitert, damit gemischte Paragraphen korrekt klassifiziert werden.
- Render-Ausgabe für einen Image-Block:

```tsx
<div className="compendium-img-block">
  <img src={`/compendium/${path}.png`} alt={caption} loading="lazy" />
  <div className="compendium-img-caption">[ {caption} ]</div>
</div>
```

Bilder liegen in `packages/client/public/compendium/acep/`.

---

## Dateien

### Neu erstellen
- `packages/client/public/compendium/acep/pilot-harkon.png` (Gemini Imagen)
- `packages/client/public/compendium/acep/pilot-korbin.png` (Gemini Imagen)
- `packages/client/public/compendium/acep/pilot-yara.png` (Gemini Imagen)
- `packages/client/public/compendium/acep/acep-monitor-screen.png` (Gemini Imagen)
- `packages/client/public/compendium/acep/acep-slots-diagram.png` (Gemini Imagen)

### Modifizieren
- `packages/client/src/data/compendium.ts` — neue Kategorie, 2 neue Artikel, 4 Updates (acep-intro, acep-pfade, monitore, grundlagen-start), 2 neue Fallstudien
- `packages/client/src/components/CompendiumOverlay.tsx` — `img:`-Marker in `renderBody` unterstützen
- `packages/client/src/data/compendium.ts` (grundlagen-start) — 11 → 12 Buttons, ACEP-Programm-Beschreibung

---

## Bildgenerierung

Die 5 Bilder werden interaktiv generiert (Gemini-Session mit `-y` Flag) mit diesem Prompt-Template:

```
Retro 8-bit pixel art, 1980s arcade style, dark background, limited color palette
(black/amber/green/dark-teal), chunky pixels, expressive face.
Scene: [MOTIVBESCHREIBUNG]
```

Generierung läuft vor der Implementierung, Bilder werden in `public/compendium/acep/` committed.

---

## Testplan

| Feature | Test |
|---|---|
| `'acep'` in `COMPENDIUM_CATEGORIES` | `compendium-data.test.ts`: `COMPENDIUM_CATEGORIES.some(c => c.id === 'acep')` muss `true` sein |
| `'acep'` in `CompendiumCategory` Type | `compendium-data.test.ts`: Artikel mit `category: 'acep'` schlägt TypeScript-Check nicht fehl |
| Neue Artikel vorhanden | `compendium-data.test.ts`: `COMPENDIUM_ARTICLES.find(a => a.id === 'acep-monitor')` und `'acep-slots'` truthy |
| `img:`-Marker rendert `<img>` | `CompendiumOverlay.test.tsx`: Mock-Artikel mit `body: '![Test Bild](img:acep/test)'` durch `<CompendiumOverlay>` rendern → `<img>` mit `src="/compendium/acep/test.png"` und `<div className="compendium-img-block">` im DOM |
| `img:` caption | Gleicher Test: `<div className="compendium-img-caption">[ Test Bild ]</div>` im DOM |
| Keine broken seeAlso-Links | `compendium-data.test.ts`: alle seeAlso-IDs in `COMPENDIUM_ARTICLES.map(a => a.id)` vorhanden |
| monitore hat 12 Programme | `compendium-data.test.ts`: Artikel `'monitore'` body enthält "12 Programme" |

---

## Nicht im Scope

- Neue Kompendium-Kategorien außer ACEP
- Kompendium-Suche verbessern
- Animierte Pixel-Art
- Mehr als 5 Bilder
