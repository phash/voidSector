# Programmable Ship — Design Spec

**Datum:** 2026-06-15 · **Branch:** `feat/programmable-ship` · **Status:** Design (zur Review)

## Ziel

Spieler schreiben kleine Skripte, die ihr Schiff autonom ausführt — sequenziell und mit
Kontrollfluss. Online (Browser offen) läuft das Skript live; ab Schiffscomputer **MK.IV** auch
**offline**, sodass das Schiff handelt, während der Spieler weg ist. Die Komplexität der erlaubten
Skripte steigt mit dem Computer-Level.

**MVP-Loop:** `fly → scan → mine → sell`. Perspektivisch werden alle Schiffsfunktionen
skriptbar; die DSL ist dafür erweiterbar angelegt.

## Kern-Entscheidungen (vom Nutzer bestätigt)

| Thema | Entscheidung |
|---|---|
| **Sprache** | Eigene Mini-DSL, **englische** Keywords, Einrückungs-basierte Blöcke. Kein Ausführen von echtem Code — Quelltext wird zu einer flachen Instruktionsliste kompiliert (sicher, deterministisch, serialisierbar). |
| **Computer-Level** | Neue Modulkategorie `computer`, Tiers **MK.I–MK.V**. Wie andere Module per Blueprint/Fabrik baubar, belegt einen Slot. Tier = Level = Komplexitätslimit. |
| **Offline-Modell** | **Dauerhafter Hintergrund-Scheduler** (ein globaler Timer) mit harten Deckeln. Schiff schreibt seinen Zustand in Echtzeit fort. Sichtbarkeit für andere Spieler = Phase 2. |
| **Risiko offline** | **Realistisch mit Schutznetz**: Schaden möglich, aber Automatik verursacht **nie Permadeath**. HP→0 ⇒ „Notabschaltung & Drift". |
| **UI-Sprache** | DSL-Keywords Englisch; UI-Labels & HelpSlice-Texte **Deutsch** (Projekt-Standard). |

## Phasing

- **Phase 1 (MVP, dieser Plan):** DSL-Parser/Compiler · `computer`-Modul + Gating · Live-Executor
  (online) · Offline-Scheduler (schreibt Position/Cargo/Credits in Echtzeit fort) · Schutznetz ·
  Client-Tab `AUTOMAT` · Onboarding/Hilfe. Befehle: `fly`, `scan`, `mine`, `sell` + `if`/`else` +
  `repeat`.
- **Phase 2 (Folge-PR):** Offline-Schiffe als **Welt-Entität** rendern (analog NPC-Ships über
  `civShipBus`), damit andere sie live fahren sehen.
- **Später:** weitere Befehle (Kampf-Reaktionen, Fabrik, Repair, Bookmarks als Ziele, Variablen).

> **Verwandte Vorarbeit:** `docs/superpowers/specs/2026-06-07-bb1-background-tick-design.md`
> (BB1 Background-Tick) — der Offline-Scheduler orientiert sich an dessen Deckel-/Budget-Prinzipien.

---

## 1. Die DSL

Line-basiert, englische Keywords, Einrückung definiert Blöcke (Python-artig). Kommentare mit `#`.

### Befehle (MVP)
| Befehl | Wirkung |
|---|---|
| `fly X:Y` | Fliegt zum Sektor (nutzt bestehende Autopilot-Pfadlogik; kostet AP/Treibstoff; läuft über mehrere Ticks). |
| `scan` | Area-Scan am aktuellen Ort. |
| `mine` / `mine until full` / `mine <n>` | Baut ab bis Cargo voll bzw. Sektor leer; `<n>` = feste Menge. |
| `sell all` / `sell <resource>` | Verkauft an Station/Origin am aktuellen Ort (`<resource>` ∈ ore/gas/crystal/…). |

### Kontrollfluss
- `if <condition>:` … optional `else:` … (Block per Einrückung)
- `repeat:` (umschließt Block, läuft endlos bis Stop) bzw. `repeat N times:`

### Bedingungen (MVP)
`resources` (Sektor hat abbaubare Rohstoffe) · `full` · `empty` · `fuel < N` · `at X:Y` ·
`station` (verkaufbar hier). Negation: `not <condition>`.

### Beispiel
```
repeat:
  fly 3:5
  scan
  if resources:
    mine until full
  else:
    fly 7:9
    scan
    mine until full
  if full:
    fly 0:0
    sell all
```

### Compile-Verhalten
Quelltext → Tokenizer → Parser → **flache Instruktionsliste** (VM-Ops mit Sprungzielen für
`if`/`else`/`repeat`). Validierung beim Speichern:
- Syntaxfehler, unbekannte Befehle/Bedingungen → Ablehnung mit **Zeilennummer**.
- Feature über Computer-Level → Ablehnung mit Hinweis („Zeile 4: `mine until full` braucht MK.III").
- Programmlänge über MK-Limit → Ablehnung.

Es läuft nie ein ungültiges/halbkompiliertes Programm.

---

## 2. `computer`-Modul & Gating

Neue Modulkategorie `computer` (Ergänzung in `packages/shared/src/moduleDefinitions.ts`), fünf
Tiers. Gating wird **beim Kompilieren** geprüft. Alle Limits im bestehenden `game_config`-System
(live-tunebar).

| Tier | Level | Schaltet frei | Prog.-Länge | Offline |
|---|---|---|---|---|
| MK.I | 1 | reine Sequenz (`fly`/`scan`/`mine`/`sell`) | 10 | – |
| MK.II | 2 | + `if`/`else`, `repeat` (ganzes Skript) | 25 | – |
| MK.III | 3 | + `repeat N times`, verschachtelte Bedingungen, alle Conditions | 50 | – |
| MK.IV | 4 | **Offline-Ausführung** (Fenster ≤ 4h) | 75 | ✓ |
| MK.V | 5 | volles Feature-Set, längstes Offline-Fenster (≤ 12h), Scheduler-Priorität | 120 | ✓ |

Genaue Zahlen sind Default-Werte und liegen als `game_config`-Keys vor
(`AUTOMATION_MAXLEN_MK1…5`, `AUTOMATION_OFFLINE_WINDOW_MK4/5`, …).

---

## 3. Ausführungs-Engine

### 3.1 VM
- **Compile** → Instruktionsliste mit Sprungzielen.
- **VM-State** = `programCounter` + Loop-Zähler-Stack + „laufende Aktion" (z.B. aktive Flugroute /
  Mining-Status) + `status` + `paused_reason`. Klein & serialisierbar → Resume nach
  Reconnect/Offline.
- Eine Instruktion kann **viele Ticks** dauern (`fly` über mehrere Sektoren, `mine until full`).
  Sie „yieldet" über Ticks, bis fertig → dann rückt der `programCounter` vor.

### 3.2 Headless Action-Cores (wichtigster Umbau)
Der Kern von **Move/Jump, Area-Scan, Mine, Sell** wird in `playerId`-basierte Funktionen
extrahiert, die direkt auf Redis+Postgres arbeiten — **ohne** Colyseus-`client`. Die heutigen
Room-Handler in `SectorRoom`/Services werden dünne Wrapper: *validieren → Core → an Client
broadcasten*. Der Executor ruft **dieselben Cores** → eine einzige Wahrheit für „was tut Mining",
online wie offline. Umbau bleibt auf die 4 MVP-Aktionen begrenzt.

### 3.3 Online-Treiber
Pro verbundenem Spieler ein `setInterval` (analog heutigem Autopilot-Timer in
`NavigationService.startAutopilotTimer`). Tick-Takt = Aktions-Takt. Stoppt bei Disconnect; State
wird persistiert.

### 3.4 Offline-Treiber (Hintergrund-Scheduler)
**EIN** globaler Scheduler-Timer (kein Per-Player-Timer). Pro Tick:
1. Begrenzte Menge aktiver Offline-Programme holen (Spieler **nicht** in Redis-`online_players`),
   **Round-Robin** für Fairness.
2. Jedes Programm um die seit `last_tick` fälligen Schritte vorrücken (Echtzeit-Takt).
3. Harte Deckel gegen OOM:
   - `AUTOMATION_MAX_CONCURRENT_OFFLINE` (Concurrency-Cap)
   - **Arbeitsbudget pro Tick** (max. Instruktions-Schritte gesamt)
   - VM-State winzig; **keine** Rooms für Offline-Spieler im Speicher
   - **Offline-Fenster-Cap** je MK (MK.IV ≤ 4h, MK.V ≤ 12h) → danach Auto-Pause
     („Reichweite erreicht")
4. State periodisch + bei Pause/Stop nach Postgres persistieren.

Beim Reconnect: laufendes Programm nahtlos auf den Online-Treiber übernehmen.

### 3.5 Schutznetz
- Automatisierte Schiffe können **Schaden nehmen**, aber Automatik verursacht **nie Permadeath**
  (online wie offline).
- HP→0 unter Automatik = **Notabschaltung & Drift**: Programm `status='drift'`, Schiff deaktiviert
  am Ort, geloggt → beim Login reparieren/auftanken, dann fortsetzbar. Kein Kapitänsverlust durch
  den Bot.
- **MVP-Default:** bei Angriff versucht das Schiff automatisch auszuweichen/zu fliehen (skriptbare
  Kampf-Reaktionen kommen „später"). So ist der MVP auch bei Routen durch Piratenzonen nicht
  frustrierend.

### 3.6 Unterbrechungs-/Fehlerregeln
- Kein Treibstoff / Sektor leer / Ziel blockiert → **Pause** mit `paused_reason`, Log-Eintrag,
  Hinweis beim Login.
- Manuelle Aktion des Spielers während Online-Automatik → Programm pausiert (Spieler übernimmt).

---

## 4. Datenmodell (Migration 099)

`packages/server/src/db/migrations/099_ship_programs.sql` — alle `CREATE TABLE/INDEX IF NOT EXISTS`.

```sql
CREATE TABLE IF NOT EXISTS ship_programs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   VARCHAR(255) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  source      TEXT NOT NULL,
  mode        VARCHAR(8) NOT NULL DEFAULT 'loop',   -- 'once' | 'loop'
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, name)
);

CREATE TABLE IF NOT EXISTS ship_program_state (
  player_id     VARCHAR(255) PRIMARY KEY,
  program_id    UUID NOT NULL,
  pc            INT NOT NULL DEFAULT 0,
  vm_state      JSONB NOT NULL DEFAULT '{}',
  status        VARCHAR(12) NOT NULL DEFAULT 'idle', -- idle|running|paused|drift|error
  paused_reason TEXT,
  last_tick     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ship_program_logs (
  id         BIGSERIAL PRIMARY KEY,
  player_id  VARCHAR(255) NOT NULL,
  program_id UUID,
  ts         TIMESTAMP NOT NULL DEFAULT NOW(),
  level      VARCHAR(8) NOT NULL DEFAULT 'info',     -- info|warn|error
  message    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ship_program_logs_player ON ship_program_logs(player_id, ts DESC);
```

- **Redis** `ship:prog:{playerId}` — Live-VM-State für schnellen Offline-Tick; nach PG persistiert
  bei Stop/Pause + periodisch. Logs werden gekappt (Ringpuffer, alte Einträge prunen).
- **`queries.ts`**: `saveProgram`, `listPrograms`, `getProgram`, `deleteProgram`,
  `setActiveProgram`, `saveProgramState`, `getProgramState`, `appendProgramLog`, `getProgramLogs`,
  `getOfflineActivePrograms`.
- **`shared`**: Instruktions-/Bedingungs-Typen, `computer_mk1…5` ModuleDefs, Config-Keys,
  `COCKPIT_PROGRAMS += 'AUTOMAT'` + Label.

---

## 5. Client-UI — neues Programm `AUTOMAT` (17.)

- **Registrierung:** `COCKPIT_PROGRAMS` + `COCKPIT_PROGRAM_LABELS` (shared), Render-Switch in
  `GameScreen.tsx`, `uiSlice.setActiveProgram`.
- **Sec 2 (Hauptmonitor):** Editor (Monospace, Zeilennummern, leichte Keyword-Hervorhebung),
  Skript-Liste (Neu/Laden/Speichern/Löschen), **Template-Picker**, **level-abhängige
  Befehls-Palette** (freigeschaltete Befehle klickbar einfügbar, gesperrte ausgegraut „ab MK.x").
- **Sec 3 (Detail):** Status (läuft/pausiert/drift/idle), aktuelle Instruktion hervorgehoben,
  **Live-Log**, `[START]/[STOP]/[PAUSE]`, **Computer-MK-Badge** mit freigeschalteten Features,
  Offline-Schalter (ab MK.IV).
- **Netzwerk-Messages:** `saveProgram`, `deleteProgram`, `setActiveProgram`, `startProgram{mode}`,
  `stopProgram`, `pauseProgram` ↔ Server-Pushes `programState`, `programLog`, `programError`.
- **Store:** Programm-Slice (Skripte, aktives Skript, Exec-Status, Log) in `gameSlice` o. eigener
  Slice; Fehler über bestehendes `actionError`/`InlineError`-Pattern (string **und**
  `{code,message}` behandeln).

---

## 6. Onboarding & Hilfe

1. **HelpSlice `first_automat`** beim ersten Öffnen + `[?]`-Button neben dem Titel (Pflicht-Pattern,
   `docs/onboardingInstructions.md`). Deutsch, ≤6 Zeilen, konkrete →Schritte.
2. **Empty-State** ohne `computer`-Modul: erklärt, dass **MK.I** (früher, günstiger Blueprint) per
   **Fabrik** gebaut/eingebaut wird → ein Klick führt hin.
3. **Template-Programme** statt leerem Blatt: vorgefertigte, kommentierte Skripte
   („Mine→Verkaufen-Loop", „Erkunden & Scannen") per Klick ladbar.
4. **Level-bewusste Befehls-Palette** als lebende Doku.
5. **Klare Compile-Fehler** mit Zeile.
6. **Tutorial-Ketten-Schritt** „AUTOMATISIEREN" (an BEWEGEN→SCANNEN→MINEN→LIEFERN angehängt):
   führt durch das erste 3-Zeilen-Skript + Start; erscheint, sobald ein Computer verbaut ist.
7. **Kompendium-Artikel** (via `articleId` der HelpSlice): vollständige DSL-Referenz — Befehle,
   Bedingungen, Beispiele, Gating-Tabelle, Offline-Regeln.

---

## 7. Tests (TDD, pro `docs/programming-guidelines.md`)

- **shared:** Parser/Compiler — Grammatik, alle Befehle/Bedingungen, Einrückungs-Blöcke,
  `if`/`else`/`repeat`-Sprungziele, Gating pro Level, Fehlermeldungen (Zeilennummern), Längen-Limit.
- **server:** VM-Schrittausführung (deterministisch), Headless-Cores (move/scan/mine/sell),
  Scheduler-Deckel/Round-Robin/Arbeitsbudget, Schutznetz-Drift, Offline-Fenster-Cap,
  Persistenz/Resume nach Reconnect.
- **client:** Editor, Template-Laden, level-bewusste Palette, Store-Slice, `first_automat`-Tip.
  Verifikation via **vitest/Vite**, nicht `tsc` (Client hat ~111 Vorbestandsfehler).

---

## Offene Punkte / Annahmen

- **MK.I-Verfügbarkeit:** MVP nimmt an, dass MK.I ein früh erreichbarer, günstiger Blueprint ist,
  damit Neulinge die Automation testen können (Balance final beim Implementieren).
- **Ein aktives Programm pro Spieler** im MVP (mehrere gespeicherte, eines aktiv). Mehrere parallele
  Programme: später.
- **Sichtbarkeit für andere Spieler** offline = Phase 2 (NPC-Ship-Entität).
- Genaue `game_config`-Defaultwerte (Längen, Offline-Fenster, Scheduler-Deckel) werden beim
  Implementieren festgelegt und sind live-tunebar.
