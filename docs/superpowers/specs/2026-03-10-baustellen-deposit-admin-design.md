# Design: Baustellen Deposit-UI & Admin-Abschluss

**Issues:** #236 (Deposit-UI wie Handel), #231 (Admin Baustelle vollenden)
**Datum:** 2026-03-10

---

## Überblick

Zwei unabhängige Verbesserungen am bestehenden Baustellen-System:

1. **#236** — Statt eines "alles auf einmal"-Buttons bekommt die `ConstructionSitePanel`-Komponente pro Ressource eine Zeile mit Slider + Zahl-Input + MAX-Button.
2. **#231** — Der Admin kann eine Baustelle sofort vollenden: neuer REST-Endpoint + Abschnitt in der Admin-Console.

---

## #236 — Deposit-UI mit Slider

### Komponente: `ConstructionSitePanel` in `DetailPanel.tsx`

**State:**
```ts
const [amounts, setAmounts] = useState({ ore: 0, gas: 0, crystal: 0 });
```

**Pro benötigter Ressource eine Zeile** (nur wenn `needed > 0`):
```
ORE   [========●====]  [ 5 ]  [MAX]
       slider 0…max    input   setzt auf max
```
- `max = Math.min(cargo[res], remaining[res])`
- Slider und Zahl-Input sind bidirektional synchronisiert (beide `onChange` setzen `amounts`)
- Ressourcen ohne Bedarf (needed = 0) werden nicht angezeigt

**[LIEFERN]-Button:**
- Aktiviert wenn `amounts.ore + amounts.gas + amounts.crystal > 0`
- Ruft `network.sendDepositConstruction(site.id, amounts.ore, amounts.gas, amounts.crystal)` auf
- Setzt `amounts` danach zurück auf `{ ore: 0, gas: 0, crystal: 0 }` (optimistic reset)

**Kein Protokoll-Änderung** — `sendDepositConstruction` und `handleDepositConstruction` auf dem Server existieren bereits und sind korrekt implementiert.

---

## #231 — Admin: Baustelle vollenden

### Server: Neue Admin-Route

**GET `/admin/construction-sites`**
- Ruft `getAllConstructionSites()` aus `constructionQueries.ts` auf (bereits vorhanden)
- Gibt Array von `ConstructionSite` zurück

**POST `/admin/construction-sites/:id/complete`**
- Lädt Baustelle per `getConstructionSiteById(id)`
- 404 wenn nicht gefunden
- Führt Abschluss aus:
  1. `createStructure(site.owner_id, site.type, site.sector_x, site.sector_y)`
  2. `deleteConstructionSiteById(site.id)`
  3. `constructionBus.emit('completed', { siteId, sectorX, sectorY })`
- 200 `{ success: true }` bei Erfolg
- Fehler-Handling: Duplikat-Struktur (23505) → trotzdem löschen + 200

Beide Endpoints werden in `adminRoutes.ts` hinzugefügt, hinter `adminAuth`-Middleware.

### Admin-Console: Neuer Abschnitt "BAUSTELLEN"

Neuer Tab/Abschnitt in `console.html`:
- Tabelle: Typ | Sektor (x,y) | Fortschritt | Besitzer-ID | `[VOLLENDEN]`-Button
- Lädt beim Öffnen/Refresh via `GET /admin/construction-sites`
- `[VOLLENDEN]` ruft `POST /admin/construction-sites/:id/complete` auf, refresht danach die Liste
- Leere-State-Meldung wenn keine Baustellen aktiv

---

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `packages/client/src/components/DetailPanel.tsx` | `ConstructionSitePanel`: Slider-UI statt Einzel-Button |
| `packages/server/src/adminRoutes.ts` | GET + POST für construction-sites |
| `packages/server/src/admin/console.html` | Neuer BAUSTELLEN-Abschnitt |

Keine DB-Migrations, keine Shared-Package-Änderungen nötig.

---

## Tests

- Bestehende `constructionTick.test.ts` bleiben unverändert
- Kein neuer Client-Test nötig (UI-Änderung, existierende Netzwerk-Methode)
- Kein neuer Server-Test nötig (Admin-Route nutzt nur bereits getestete DB-Funktionen)
