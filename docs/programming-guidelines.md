# Programmierrichtlinien — voidSector

Diese Richtlinien gelten verbindlich für alle Implementierungen in diesem Projekt.

---

## 1. Spec-Driven Development

**Keine Implementierung ohne Spec.** Vor jeder neuen Funktion oder jedem User Story muss eine Spec existieren:

1. Spec liegt in `docs/superpowers/specs/YYYY-MM-DD-<thema>-design.md`
2. Spec ist approved (von User oder Reviewer bestätigt)
3. Implementierung folgt der Spec — Abweichungen werden zuerst in der Spec geändert, dann im Code

Wenn eine Implementierung zeigt, dass die Spec unvollständig ist: **stoppen, Spec aktualisieren, dann weiterarbeiten.**

---

## 2. Test-Driven Development (TDD)

**Reihenfolge ist nicht verhandelbar:** Test → Implementierung → Refactor

### Einheitstests (Vitest)

```
1. Test schreiben (schlägt fehl — RED)
2. Minimale Implementierung (wird grün — GREEN)
3. Refactoring ohne neue Funktionalität (REFACTOR)
```

- Berechnungslogik (Engines, Services, shared utilities) hat Unit-Test-Abdeckung
- Tests liegen im `__tests__/`-Ordner des jeweiligen Packages
- Server: `packages/server/src/__tests__/`
- Client: `packages/client/src/__tests__/`
- Shared: `packages/shared/src/__tests__/`

### E2E-Tests (Playwright)

Jeder User-Workflow wird als Playwright-Test abgebildet, **bevor** der Workflow implementiert wird:

```typescript
// Erst der Test:
test('Spieler kann Modul in kompatiblen Slot installieren', async ({ page }) => {
  // ... State injizieren ...
  await page.getByText('AUSWÄHLEN').click();
  await page.getByText('[+]').click();
  await expect(page.getByText(/kompatibel/)).not.toBeVisible();
});

// Dann die Implementierung.
```

Playwright-Tests liegen in `e2e/`. Jeder Screen hat eine eigene Testdatei.

### Playwright-Testbarkeit als Design-Requirement

Jedes interaktive Element bekommt ein `data-testid`-Attribut:

```html
<!-- Pflicht für alle klickbaren Elemente, Eingabefelder, Ergebniswerte -->
<button data-testid="sell-all-ore">ALL (10)</button>
<span data-testid="ship-hp">100</span>
```

Naming-Konvention für `data-testid`:
- Aktionen: `<ressource>-<aktion>` → `sell-all-ore`, `install-module-btn`
- Anzeige: `<ressource>-<wert>` → `ship-hp`, `cargo-ore`
- Listen-Items: `<ressource>-item-<id>` oder `<ressource>-list`

---

## 3. Clean Code

### Allgemein

- **Eine Verantwortung pro Datei:** Component, Service, Engine oder Utility — nie gemischt
- **Keine Magic Numbers:** Alle Konstanten in `packages/shared/src/constants.ts` auslagern
- **Funktionsnamen beschreiben die Absicht:** `calculateCurrentStock()` nicht `calc()`
- **Keine Kommentare für offensichtliches:** Kommentare erklären das *Warum*, nicht das *Was*
- **Maximale Funktionslänge:** ~30 Zeilen. Länger → aufteilen.
- **Maximale Dateilänge:** ~200 Zeilen. Länger → aufteilen.

### Projektstruktur

```
packages/
  server/src/
    rooms/            # Colyseus SectorRoom + ServiceContext
    rooms/services/   # 10 Domain Services (Economy, Combat, Ship, ...)
    engine/           # Reine Berechnungslogik (npcStationEngine, combatEngine, ...)
    db/               # queries.ts (alle DB-Aufrufe), migrations/
  client/src/
    components/       # React-Komponenten (PascalCase)
    state/            # Zustand Store (gameSlice, uiSlice, helpSlice)
    network/          # GameNetwork Singleton (client.ts)
  shared/src/
    types.ts          # Shared TypeScript-Typen
    constants.ts      # Shared Konstanten
    shipCalculator.ts # Shared Berechnungslogik
```

- **Engines** kapseln reine Berechnungslogik — kein DB-Zugriff, kein State
- **Services** orchestrieren Engines + DB-Queries + Client-Kommunikation
- **Keine direkten DB-Aufrufe in Rooms** — immer über Services + queries.ts
- **TypeScript überall** — kein `any`, keine impliziten Typen

---

## 4. UX-Konsistenz (CRT Terminal Aesthetik)

### Gleichartige Workflows

Jeder interaktive Workflow im Cockpit folgt demselben Muster:

```
1. Anzeige in Sec 2 (Main Monitor) oder Sec 3 (Detail Monitor)
2. Interaktion über klare Buttons im Terminal-Stil: [AKTION]
3. Feedback über InlineError oder Statusänderung im selben Panel
4. Keine Seiten-Navigation — Programm-Wechsel über Sec 1
```

### Gleichartige Datendarstellung

| Datentyp | Format | Beispiel |
|---|---|---|
| Koordinaten | `(X, Y)` | `(42, 17)` |
| Ressourcen | `XXX <typ>` | `150 Erz` |
| AP/Fuel | `XX/XX` | `45/100` |
| Credits | `X.XXX CR` | `2.500 CR` |
| HP | `█░░` Balken | `████░░ 4/6` |

### Navigation

- Programm-Selector in Sec 1 (12 Programme)
- Kontextabhängige Detail-Panels in Sec 3
- Keine Modals — alles inline im Cockpit-Grid

---

## 5. Fehlerbehandlung

- Server sendet `{ code, message }` → Client zeigt über `actionError` / `InlineError`
- Validierungsfehler: inline am Element anzeigen (nicht als Toast)
- Netzwerkfehler: Client zeigt Verbindungsstatus, kein Error-Dialog
- Unerwartete Fehler: kurzer InlineError, Details in Browser-Konsole + pino Server-Log

---

## 6. Entwicklungs-Workflow

### Vor jeder neuen Funktion

```
1. Spec prüfen — existiert und ist approved?
2. Playwright-Test schreiben (schlägt fehl)
3. Unit-Tests schreiben (schlagen fehl)
4. Implementieren
5. Tests grün
6. data-testid auf allen neuen interaktiven Elementen
7. Commit mit konventionellem Prefix
```

### Commit-Konvention

```
feat: MODULE tab — select-then-install UX
fix: station stock drift causing sell-all to leave 1 unit (#237)
test: E2E-Tests Trade sell-all
docs: ARC42 Bausteinsicht aktualisiert
chore: Abhängigkeiten aktualisiert
```

Jeder Commit endet mit:
```
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

---

## 7. Technische Vorgaben

### Datenzugriff

- Alle PostgreSQL-Aufrufe laufen über `packages/server/src/db/queries.ts`
- Redis für flüchtige States (AP, Fuel, Mining, Position)
- Keine direkten SQL-Aufrufe in Services — immer über queries.ts-Funktionen
- Alle Queries nutzen parametrisierte Statements (SQL-Injection-Schutz)

### Migrations

- Dateien in `packages/server/src/db/migrations/NNN_name.sql`
- Alle idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
- Nächste Migration: siehe CLAUDE.md für aktuelle Nummer

### Shared Package

- Nach jeder Änderung in `packages/shared/src/`: `cd packages/shared && npm run build`
- Types und Constants werden aus `index.ts` re-exportiert
- Client und Server importieren über `@void-sector/shared`
