# Kompendium ACEP-Erweiterung (#235) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an ACEP category with 2 new articles, update 4 existing articles, expand the pilot handbook with images + 2 new case studies, and add `img:` image embedding to the compendium renderer.

**Architecture:** All data changes are in `packages/client/src/data/compendium.ts`. The renderer change is in `packages/client/src/components/CompendiumOverlay.tsx` — a new paragraph-level early-exit branch in `renderBody`, analogous to the existing table branch. Images are served statically from `packages/client/public/compendium/acep/`. No server changes.

**Tech Stack:** TypeScript, React, Vitest, @testing-library/react

---

## Chunk 1: img: Parser

### Task 1: Add img: block to renderBody in CompendiumOverlay.tsx

**Files:**
- Modify: `packages/client/src/components/CompendiumOverlay.tsx` (renderBody, lines 17–160)
- Test: `packages/client/src/__tests__/CompendiumOverlay.test.tsx`

**Background:** `renderBody(body, onNavigate)` splits body on `\n\n`, loops over paragraphs. Line 28 checks if the whole paragraph is a markdown table → early `continue`. We add a similar check right after line 27 (after `const isTable = ...`):

```typescript
// paragraph-level image block: ![caption](img:path)
const imgMatch = paragraph.trim().match(/^!\[([^\]]*)\]\(img:([^)]+)\)$/);
if (imgMatch) {
  const [, caption, path] = imgMatch;
  elements.push(
    <div key={`img-${pi}`} className="compendium-img-block" style={{ margin: '16px 0', textAlign: 'center' }}>
      <img
        src={`/compendium/${path}.png`}
        alt={caption}
        loading="lazy"
        style={{ maxWidth: '100%', imageRendering: 'pixelated', border: '1px solid rgba(255,176,0,0.3)' }}
      />
      <div className="compendium-img-caption" style={{ fontSize: '0.65rem', color: 'var(--color-dim)', marginTop: '4px', letterSpacing: '0.1em' }}>
        [ {caption} ]
      </div>
    </div>,
  );
  continue;
}
```

This goes BEFORE the `if (isTable)` check.

- [ ] **Step 1: Write the failing test**

Add to `packages/client/src/__tests__/CompendiumOverlay.test.tsx` — at the top add `import * as compendiumData from '../data/compendium';`, then add this describe block inside the outer `describe('CompendiumOverlay', ...)`:

```typescript
describe('img: block rendering', () => {
  it('renders compendium-img-block with img and caption from img: marker', () => {
    const spy = vi.spyOn(compendiumData, 'getArticle').mockReturnValue({
      id: 'grundlagen-start',
      title: 'TEST',
      category: 'grundlagen',
      icon: '◈',
      summary: 'Test summary of at least twenty characters.',
      body: 'Vortext.\n\n![Test Bild](img:acep/test)\n\nNachtext.',
    });

    setupStore({ compendiumOpen: true, compendiumArticleId: 'grundlagen-start' });
    const { container } = render(<CompendiumOverlay />);

    const imgBlock = container.querySelector('.compendium-img-block');
    expect(imgBlock).not.toBeNull();

    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('/compendium/acep/test.png');

    const caption = container.querySelector('.compendium-img-caption');
    expect(caption?.textContent).toContain('Test Bild');

    spy.mockRestore();
  });

  it('does not render compendium-img-block for non-img paragraphs', () => {
    const spy = vi.spyOn(compendiumData, 'getArticle').mockReturnValue({
      id: 'grundlagen-start',
      title: 'TEST',
      category: 'grundlagen',
      icon: '◈',
      summary: 'Test summary of at least twenty characters.',
      body: 'Normaler Text ohne Bild.',
    });

    setupStore({ compendiumOpen: true, compendiumArticleId: 'grundlagen-start' });
    const { container } = render(<CompendiumOverlay />);

    expect(container.querySelector('.compendium-img-block')).toBeNull();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/CompendiumOverlay.test.tsx
```

Expected: FAIL — `compendium-img-block` not found

- [ ] **Step 3: Implement the img: parser**

In `packages/client/src/components/CompendiumOverlay.tsx`, find the block starting at line ~24:
```typescript
    // Check if this paragraph is a table (all non-empty lines start with |)
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    const isTable = nonEmpty.length > 0 && nonEmpty.every((l) => l.trim().startsWith('|'));
```

Insert BEFORE `if (isTable) {`:

```typescript
    // Check if this paragraph is an image block: ![caption](img:path)
    const imgMatch = paragraph.trim().match(/^!\[([^\]]*)\]\(img:([^)]+)\)$/);
    if (imgMatch) {
      const [, caption, path] = imgMatch;
      elements.push(
        <div key={`img-${pi}`} className="compendium-img-block" style={{ margin: '16px 0', textAlign: 'center' }}>
          <img
            src={`/compendium/${path}.png`}
            alt={caption}
            loading="lazy"
            style={{ maxWidth: '100%', imageRendering: 'pixelated', border: '1px solid rgba(255,176,0,0.3)' }}
          />
          <div
            className="compendium-img-caption"
            style={{ fontSize: '0.65rem', color: 'var(--color-dim)', marginTop: '4px', letterSpacing: '0.1em' }}
          >
            [ {caption} ]
          </div>
        </div>,
      );
      continue;
    }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/client && npx vitest run src/__tests__/CompendiumOverlay.test.tsx
```

Expected: all PASS including the 2 new img: tests

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/components/CompendiumOverlay.tsx \
        packages/client/src/__tests__/CompendiumOverlay.test.tsx
git commit -m "feat: add img: block rendering to compendium renderBody"
```

---

## Chunk 2: ACEP Category + New Articles

### Task 2: CompendiumCategory type + COMPENDIUM_CATEGORIES entry + tests

**Files:**
- Modify: `packages/client/src/data/compendium.ts` (lines 5–39)
- Test: `packages/client/src/__tests__/compendium-data.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside `describe('categories', ...)` in `packages/client/src/__tests__/compendium-data.test.ts`:

```typescript
it("has an 'acep' category in COMPENDIUM_CATEGORIES", () => {
  expect(COMPENDIUM_CATEGORIES.some((c) => c.id === 'acep')).toBe(true);
});

it("'acep' category has icon ⬟ and label ACEP", () => {
  const cat = COMPENDIUM_CATEGORIES.find((c) => c.id === 'acep');
  expect(cat?.icon).toBe('⬟');
  expect(cat?.label).toBe('ACEP');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: FAIL — `COMPENDIUM_CATEGORIES.some(c => c.id === 'acep')` is false

- [ ] **Step 3: Add 'acep' to CompendiumCategory type**

In `packages/client/src/data/compendium.ts`, change:

```typescript
export type CompendiumCategory =
  | 'grundlagen'
  | 'navigation'
  | 'ressourcen'
  | 'kampf'
  | 'handel'
  | 'technik'
  | 'sozial'
  | 'fortgeschritten';
```

to:

```typescript
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
```

- [ ] **Step 4: Add 'acep' to COMPENDIUM_CATEGORIES**

In `packages/client/src/data/compendium.ts`, change the `COMPENDIUM_CATEGORIES` array (add after `fortgeschritten`):

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: PASS (but note: "every category has at least one article" will now FAIL until acep articles are added in Task 3 and 4)

Note: the test `every category has at least one article` will fail. That's expected — it will pass after Task 3 adds the first acep article.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/data/compendium.ts \
        packages/client/src/__tests__/compendium-data.test.ts
git commit -m "feat(compendium): add 'acep' category type and COMPENDIUM_CATEGORIES entry"
```

---

### Task 3: Add acep-monitor article

**Files:**
- Modify: `packages/client/src/data/compendium.ts` (append to COMPENDIUM_ARTICLES)
- Test: `packages/client/src/__tests__/compendium-data.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside `describe('required article IDs', ...)` in `compendium-data.test.ts` (extend `requiredIds` or add a new describe block):

```typescript
describe('ACEP articles', () => {
  it("has article 'acep-monitor'", () => {
    const a = getArticle('acep-monitor');
    expect(a).toBeDefined();
    expect(a?.category).toBe('acep');
    expect(a?.body.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: FAIL — `getArticle('acep-monitor')` returns undefined

- [ ] **Step 3: Add acep-monitor article to COMPENDIUM_ARTICLES**

Append to `COMPENDIUM_ARTICLES` in `packages/client/src/data/compendium.ts` (before the closing `];`):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: PASS including the "every category has at least one article" test (which now has an acep article)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/data/compendium.ts \
        packages/client/src/__tests__/compendium-data.test.ts
git commit -m "feat(compendium): add acep-monitor article"
```

---

### Task 4: Add acep-slots article

**Files:**
- Modify: `packages/client/src/data/compendium.ts`
- Test: `packages/client/src/__tests__/compendium-data.test.ts`

- [ ] **Step 1: Write the failing test**

Add inside the `describe('ACEP articles', ...)` block from Task 3:

```typescript
it("has article 'acep-slots'", () => {
  const a = getArticle('acep-slots');
  expect(a).toBeDefined();
  expect(a?.category).toBe('acep');
  expect(a?.body).toContain('AUSBAU-Level');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: FAIL — `getArticle('acep-slots')` undefined

- [ ] **Step 3: Add acep-slots article to COMPENDIUM_ARTICLES**

Append directly after `acep-monitor` in `packages/client/src/data/compendium.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/data/compendium.ts \
        packages/client/src/__tests__/compendium-data.test.ts
git commit -m "feat(compendium): add acep-slots article"
```

---

## Chunk 3: Update Existing Articles

### Task 5: Update monitore + grundlagen-start

**Files:**
- Modify: `packages/client/src/data/compendium.ts` (monitore article ~line 263, grundlagen-start ~line 51)
- Test: `packages/client/src/__tests__/compendium-data.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `compendium-data.test.ts` in a new describe block:

```typescript
describe('article content updates', () => {
  it("monitore summary mentions 12 Programme", () => {
    const a = getArticle('monitore');
    expect(a?.summary).toContain('12 Programme');
  });

  it("monitore body mentions 12 Programme", () => {
    const a = getArticle('monitore');
    expect(a?.body).toContain('12 Programme');
  });

  it("monitore body has ACEP row", () => {
    const a = getArticle('monitore');
    expect(a?.body).toContain('ACEP');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: FAIL — monitore has "11 Programme"

- [ ] **Step 3: Update monitore article**

In `packages/client/src/data/compendium.ts`, find the `monitore` article (id: 'monitore', ~line 263). Make these changes:

**summary** (line ~267): change
```typescript
    summary: 'Die 11 Programme des Cockpits — was jeder Monitor anzeigt und wozu er dient.',
```
to:
```typescript
    summary: 'Die 12 Programme des Cockpits — was jeder Monitor anzeigt und wozu er dient.',
```

**body** — change the opening line and table:
```typescript
    body: `Das Cockpit hat 12 wählbare Programme (Sektion 1, linke Leiste):

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
```

- [ ] **Step 4: Update grundlagen-start article**

In `packages/client/src/data/compendium.ts`, find `grundlagen-start` (~line 51). Change:

```typescript
- **Sektion 1** (links): Programm-Selektor — 11 Buttons für alle Hauptprogramme
```
to:
```typescript
- **Sektion 1** (links): Programm-Selektor — 12 Buttons für alle Hauptprogramme
```

Change:
```typescript
- **Sektion 4** (rechts oben): SHIP-SYS — Status, Module, Hangar, ACEP
```
to:
```typescript
- **Sektion 4** (rechts oben): SHIP-SYS — Status, Module, Hangar (ACEP ist eigenes Programm in Sektion 1)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/data/compendium.ts \
        packages/client/src/__tests__/compendium-data.test.ts
git commit -m "fix(compendium): update monitore (11→12 Programme, ACEP row) and grundlagen-start"
```

---

### Task 6: Update acep-intro + acep-pfade

**Files:**
- Modify: `packages/client/src/data/compendium.ts` (acep-intro ~line 231, acep-pfade ~line 1642)

Note: No new failing tests needed here — the seeAlso integrity test (already in the test file) will catch any broken references after we add 'acep-monitor' and 'acep-slots' to seeAlso. The test `all seeAlso IDs point to existing articles` will pass once Tasks 3 and 4 added those articles.

- [ ] **Step 1: Update acep-intro body**

Find the `acep-intro` article (~line 231). The last section currently reads:

```typescript
**ACEP im Interface:**
SHIP-SYS → Einstellungen: Zeigt alle 4 Pfade als Balken mit aktuellem Stand.
```

Replace it with:

```typescript
**ACEP im Interface:**
Das ACEP-Programm (Sektion 1 → ACEP) zeigt alle Modul-Slots und XP-Pfade auf einem Screen.
SHIP-SYS (Sektion 4) → EINSTELLUNGEN zeigt die ACEP-Balken weiterhin zusätzlich.

**AUSBAU-Level und Gating:**
- Fabrik: erfordert AUSBAU Level 2 (ab 8 AUSBAU-XP)
- Forschungsslot 2: erfordert AUSBAU Level 3 (ab 18 AUSBAU-XP)
```

- [ ] **Step 2: Update acep-intro seeAlso**

Current:
```typescript
    seeAlso: ['acep-pfade', 'acep-traits', 'radar-evolution', 'permadeath', 'acep-handbuch'],
```

Change to:
```typescript
    seeAlso: ['acep-pfade', 'acep-traits', 'radar-evolution', 'permadeath', 'acep-handbuch', 'acep-monitor', 'acep-slots'],
```

- [ ] **Step 3: Update acep-pfade body (AUSBAU section)**

Find the `acep-pfade` article (~line 1642). After the AUSBAU Effekte line:

```typescript
Effekte: +1 Modul-Slot ab 10 XP, +2 ab 25, +3 ab 40, +4 ab 50. Cargo-Multiplikator +1% pro XP (max +50%). Mining-Bonus +0,6% pro XP (max +30%).
```

Add a new line immediately after:

```typescript
Effekte: +1 Modul-Slot ab 10 XP, +2 ab 25, +3 ab 40, +4 ab 50. Cargo-Multiplikator +1% pro XP (max +50%). Mining-Bonus +0,6% pro XP (max +30%).
AUSBAU-Level schaltet außerdem frei: Fabrik ab Level 2 (8 XP), zweiter Forschungsslot ab Level 3 (18 XP).
```

- [ ] **Step 4: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: all PASS (including seeAlso integrity — acep-monitor and acep-slots exist from Tasks 3+4)

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/data/compendium.ts
git commit -m "fix(compendium): update acep-intro and acep-pfade for AUSBAU gating and new ACEP program"
```

---

## Chunk 4: Expand acep-handbuch + Images + Final Tests

### Task 7: Expand acep-handbuch (images + new section + Fallstudien 4+5)

**Files:**
- Modify: `packages/client/src/data/compendium.ts` (acep-handbuch ~line 1765)

The acep-handbuch body currently ends with:
```
> *"Das Schiff lernt. Der Pilot lebt."*
> — ACEP §1`
```

Structure of the article body:
1. Intro + "Was ist ACEP?"
2. "Das Budget-Problem" + Fallstudie Vera Sondrak
3. "Die 4 Pfade"
4. "Was passiert, wenn man ACEP falsch bedient" + Fallstudien 1–3
5. "Das Schiff entwickelt eine Persönlichkeit"
6. "Permadeath & Legacy"

We need to:
A. Add `![caption](img:path)` paragraphs after each of the 3 existing Fallstudien
B. Add a new section after Fallstudie 3 (and before "Das Schiff entwickelt...") with the new ACEP-Programm section and Fallstudien 4+5

- [ ] **Step 1: Locate and modify acep-handbuch body**

Find `id: 'acep-handbuch'` (~line 1765) in `compendium.ts`.

**A. Add image after Fallstudie 1 (Harkon Breis):**

Find (in the body):
```
Sein Wrack treibt bei [00F2:0179]. Es ist gut beschriftet.
```

The paragraph ends there. After that paragraph add a new `\n\n` block:
```
![Harkon Breis winkt aus seinem beschrifteten Wrack. Schild: "GLEICHMÄSSIG VERTEILT".](img:acep/pilot-harkon)
```

This means in the template literal, after `Es ist gut beschriftet.` add:
```
\n\n![Harkon Breis winkt aus seinem beschrifteten Wrack. Schild: "GLEICHMÄSSIG VERTEILT".](img:acep/pilot-harkon)
```

**B. Add image after Fallstudie 2 (Korbin Vex):**

Find:
```
Korbin blieb vier Tage in jenem Sektor.
```

After that paragraph add:
```
\n\n![Korbin Vex treibt im Nebula. Treibstoffanzeige rot. Piraten im Hintergrund stehen gelangweilt.](img:acep/pilot-korbin)
```

**C. Add image after Fallstudie 3 (Yara Finn):**

Find:
```
[SYSTEM]: Flucht erfolgreich. ...ich empfehle zukünftig weniger Neugier.
```

After that paragraph add:
```
\n\n![Yara Finn flieht. 5 Tempel-Icons auf Mini-Radar. Ancient-Wächterin dahinter.](img:acep/pilot-yara)
```

**D. Add new section after Fallstudie 3's image and before "Das Schiff entwickelt...":**

After the `pilot-yara` image paragraph, add these new paragraphs (before `---\n\n**Das Schiff entwickelt eine Persönlichkeit**`):

```
---

**Das neue ACEP-Programm**

Nach mehreren Eingaben bei der Zuständigen Behörde (Abteilung: Unklare Beschwerden) mit dem Betreff
"Wo sind meine Balken?" wurde ACEP ein eigenes Cockpit-Programm.

Links: deine Module. Rechts: deine XP-Pfade.
Du kannst jetzt beides gleichzeitig ignorieren statt nacheinander. Das nennt sich Fortschritt.

*Fallstudie 4 — Der Monitor-Erkunder:*
Pilot Ren Dalvik öffnete den neuen ACEP-Monitor und klickte auf alle leeren Slots.
Jeder Klick öffnete das MODULE-Programm. Das war beabsichtigt.
Ren klickte 47 Mal. Es blieben 47 leere Slots.
[SYSTEM]: Module werden im MODULE-Programm erworben, nicht durch wiederholtes Klicken auf ihre Abwesenheit.
Ren lebt noch. Er hat jetzt 0 Module und ein tiefes, praxisnahes Verständnis der Benutzeroberfläche.

*Fallstudie 5 — Die Fabrik-Ungeduld:*
Pilotin Sera Voss entschied, sofort eine Fabrik auf ihrer Basis zu errichten.
AUSBAU Level 1. Fabrik gesperrt.
Sie baute Mining-Module. AUSBAU Level 1. Fabrik gesperrt.
Sie engagierte sich im Kampf. AUSBAU Level 1. Fabrik gesperrt.
Während dieser Zeit: 7 AUSBAU-XP. Beständig.
[SYSTEM]: Fabrik erfordert AUSBAU Level 2. Das entspricht 8 XP. Du hast 7.
Das Universum ist präzise.
Sera hat seitdem eine sehr gepflegte Basis mit einer unbenutzten Fabrik, die sie täglich besucht.
```

- [ ] **Step 2: Run tests**

```bash
cd packages/client && npx vitest run src/__tests__/compendium-data.test.ts
```

Expected: all PASS. Body length check (≥100 chars) should still pass since we're adding, not removing.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/data/compendium.ts
git commit -m "feat(compendium): expand acep-handbuch — pilot images, new ACEP-Programm section, Fallstudien 4+5"
```

---

### Task 8: Placeholder images + full test run

**Files:**
- Create: `packages/client/public/compendium/acep/` directory + 5 placeholder PNG files

The images are designed to be generated by Gemini Imagen with retro pixel art prompts (see spec). Until that generation happens, placeholder PNGs are needed so the `<img>` tags don't break the layout.

- [ ] **Step 1: Create directory and placeholder images**

A minimal 1×1 transparent PNG (base64):
`iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=`

Run this to create all 5 placeholders:

```bash
mkdir -p packages/client/public/compendium/acep

python3 -c "
import base64, os
data = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=')
files = ['pilot-harkon', 'pilot-korbin', 'pilot-yara', 'acep-monitor-screen', 'acep-slots-diagram']
for f in files:
    path = f'packages/client/public/compendium/acep/{f}.png'
    with open(path, 'wb') as fh:
        fh.write(data)
    print(f'Created {path}')
"
```

- [ ] **Step 2: Run full client test suite**

```bash
cd packages/client && npx vitest run
```

Expected: all tests PASS (currently ~386+, now a few more from new tests)

- [ ] **Step 3: Commit**

```bash
git add packages/client/public/compendium/acep/ \
        packages/client/src/__tests__/compendium-data.test.ts \
        packages/client/src/__tests__/CompendiumOverlay.test.tsx
git commit -m "chore(compendium): add placeholder images for acep pixel art (to be replaced by Gemini Imagen)"
```

---

## Post-Implementation Notes

### Pixel Art Image Generation

The 5 placeholder images in `packages/client/public/compendium/acep/` need to be replaced with actual Gemini Imagen output. Use this prompt template (retro 8-bit arcade style, dark bg, amber/green palette, chunky pixels, expressive face):

| File | Prompt Scene |
|---|---|
| `pilot-harkon.png` | Harkon Breis winkt aus seinem beschrifteten Wrack. Schild: "GLEICHMÄSSIG VERTEILT". |
| `pilot-korbin.png` | Korbin Vex treibt im Nebula, Treibstoffanzeige rot, Piraten gelangweilt im Hintergrund. |
| `pilot-yara.png` | Yara Finn flieht, 5 Tempel-Icons auf Mini-Radar, Ancient-Wächterin dahinter. |
| `acep-monitor-screen.png` | Pilot starrt auf ACEP-Monitor. Zwei Spalten Balken. Fragezeichen über dem Helm. |
| `acep-slots-diagram.png` | Schema 8 Slots + 2 Extra-Slots. 5 davon leer mit "???" beschriftet. |

Run interactive Gemini session: `gemini -y` with the prompt template from the spec.
