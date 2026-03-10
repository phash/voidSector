# Baustellen Deposit-UI & Admin-Abschluss — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-Ressource Slider-UI zum Rohstoffe liefern (#236) + Admin-Endpoint zum sofortigen Vollenden einer Baustelle (#231).

**Architecture:** Zwei unabhängige Änderungen: (1) Client-only UI-Refactor in `ConstructionSitePanel`, (2) zwei neue Admin-Routes in `adminRoutes.ts` + neuer Tab in `console.html`. Kein Protokoll-Änderung, keine DB-Migration.

**Tech Stack:** React + useState (Client), Express Router (Server), Vanilla JS + DOM API (Admin-Console)

**Spec:** `docs/superpowers/specs/2026-03-10-baustellen-deposit-admin-design.md`

---

## Chunk 1: Client — Deposit-UI mit Slider (#236)

**Files:**
- Modify: `packages/client/src/components/DetailPanel.tsx:124-187`

### Task 1: ConstructionSitePanel auf Slider-UI umbauen

Die bestehende `ConstructionSitePanel`-Komponente (Zeilen 124–187) bekommt `useState` für Mengen und pro Ressource eine Zeile mit Slider + Zahl-Input + MAX-Button statt des Einzel-Buttons.

- [ ] **Schritt 1: Aktuellen Code lesen**

  Lese `packages/client/src/components/DetailPanel.tsx` Zeilen 124–187 zur Orientierung.

- [ ] **Schritt 2: `ConstructionSitePanel` ersetzen**

  Ersetze die gesamte Funktion `ConstructionSitePanel` (Zeilen 124–187) mit folgendem Code:

  ```tsx
  function ConstructionSitePanel({ site }: { site: ConstructionSiteState }) {
    const cargo = useStore((s) => s.cargo);
    const [amounts, setAmounts] = useState({ ore: 0, gas: 0, crystal: 0 });

    const remainOre     = Math.max(0, site.neededOre     - site.depositedOre);
    const remainGas     = Math.max(0, site.neededGas     - site.depositedGas);
    const remainCrystal = Math.max(0, site.neededCrystal - site.depositedCrystal);

    const maxOre     = Math.min(cargo.ore,     remainOre);
    const maxGas     = Math.min(cargo.gas,     remainGas);
    const maxCrystal = Math.min(cargo.crystal, remainCrystal);

    const pct = site.progress;
    const canDeliver = amounts.ore + amounts.gas + amounts.crystal > 0;

    type ResKey = 'ore' | 'gas' | 'crystal';
    const rows: [string, ResKey, number][] = [
      ['ORE',     'ore',     maxOre],
      ['GAS',     'gas',     maxGas],
      ['CRYSTAL', 'crystal', maxCrystal],
    ];

    function setAmt(key: ResKey, raw: number, max: number) {
      const v = Math.max(0, Math.min(max, isNaN(raw) ? 0 : raw));
      setAmounts((prev) => ({ ...prev, [key]: v }));
    }

    function deliver() {
      network.sendDepositConstruction(site.id, amounts.ore, amounts.gas, amounts.crystal);
      setAmounts({ ore: 0, gas: 0, crystal: 0 });
    }

    return (
      <div style={{ marginTop: 8 }}>
        {/* Header */}
        <div style={{ fontSize: '0.65rem', color: 'var(--color-dim)', letterSpacing: '0.15em', marginBottom: 4 }}>
          {site.type === 'mining_station' ? 'STATION' : 'JUMPGATE'} — IN BAU
          {site.paused && (
            <span style={{ color: '#ff4444', marginLeft: 8 }}>⏸ PAUSIERT</span>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', marginBottom: 2 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', transition: 'width 0.5s' }} />
        </div>
        <div style={{ fontSize: '0.6rem', color: 'var(--color-dim)', marginBottom: 6 }}>
          {pct}/100 Ticks
        </div>

        {/* Resource status */}
        {([
          ['ORE',     site.depositedOre,     site.neededOre],
          ['GAS',     site.depositedGas,     site.neededGas],
          ['CRYSTAL', site.depositedCrystal, site.neededCrystal],
        ] as [string, number, number][]).filter(([, , needed]) => needed > 0).map(([label, deposited, needed]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
            <span style={{ color: 'var(--color-dim)' }}>{label}</span>
            <span style={{ color: deposited >= needed ? 'var(--color-primary)' : '#ffaa00' }}>
              {deposited}/{needed}
            </span>
          </div>
        ))}

        {/* Deposit sliders */}
        {rows.filter(([, , max]) => max > 0).length > 0 && (
          <div style={{ marginTop: 8 }}>
            {rows.filter(([, , max]) => max > 0).map(([label, key, max]) => (
              <div key={key} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.6rem' }}>
                  <span style={{ color: 'var(--color-dim)', width: 44 }}>{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={max}
                    value={amounts[key]}
                    onChange={(e) => setAmt(key, parseInt(e.target.value), max)}
                    style={{ flex: 1, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={max}
                    value={amounts[key]}
                    onChange={(e) => setAmt(key, parseInt(e.target.value), max)}
                    style={{ width: 36, background: 'transparent', border: '1px solid var(--color-dim)', color: 'var(--color-primary)', fontSize: '0.6rem', textAlign: 'center', padding: '1px 2px' }}
                  />
                  <button
                    className="vs-btn"
                    style={{ fontSize: '0.55rem', padding: '1px 4px' }}
                    onClick={() => setAmt(key, max, max)}
                  >
                    MAX
                  </button>
                </div>
              </div>
            ))}
            <button
              className="vs-btn"
              style={{ fontSize: '0.7rem', marginTop: 4, width: '100%' }}
              disabled={!canDeliver}
              onClick={deliver}
            >
              [LIEFERN]
            </button>
          </div>
        )}
      </div>
    );
  }
  ```

  Stelle sicher dass `useState` bereits importiert ist (es ist bereits in `DetailPanel.tsx` durch `import { useState, useEffect } from 'react'` vorhanden).

- [ ] **Schritt 3: Manuell testen**

  Starte den Dev-Client (`npm run dev:client` vom Root) und navigiere zu einem Sektor mit einer aktiven Baustelle. Prüfe:
  - Slider und Zahl-Input sind synchronisiert
  - MAX-Button füllt den Wert auf das Maximum
  - [LIEFERN] nur aktiv wenn mindestens ein Wert > 0
  - Nach dem Klick werden alle Werte zurückgesetzt

- [ ] **Schritt 4: Client-Tests laufen lassen**

  ```bash
  cd packages/client && npx vitest run
  ```
  Erwartet: alle Tests grün (keine neuen Tests nötig — UI-Änderung ohne neue Logik).

- [ ] **Schritt 5: Committen**

  ```bash
  git add packages/client/src/components/DetailPanel.tsx
  git commit -m "feat(#236): Deposit-UI mit Slider pro Ressource statt Einzel-Button"
  ```

---

## Chunk 2: Server — Admin-Routes (#231)

**Files:**
- Modify: `packages/server/src/adminRoutes.ts` (neue Endpoints am Ende, vor den Helpers)

### Task 2: GET + POST `/admin/construction-sites`

- [ ] **Schritt 1: Imports hinzufügen**

  Füge am Anfang von `adminRoutes.ts` nach dem letzten `import`-Block folgende Zeilen ein:

  ```ts
  import {
    getAllConstructionSites,
    getConstructionSiteById,
    deleteConstructionSiteById,
  } from './db/constructionQueries.js';
  import { createStructure } from './db/queries.js';
  import { constructionBus } from './constructionBus.js';
  ```

  **Achtung:** `createStructure` und `constructionBus` könnten schon importiert sein — prüfe, ob diese Namen in den bestehenden Imports vorkommen, und füge nur die fehlenden hinzu.

- [ ] **Schritt 2: GET-Endpoint hinzufügen**

  Füge vor dem `// ── Helpers ─────` Kommentar in `adminRoutes.ts` ein:

  ```ts
  // ── Construction Sites ──────────────────────────────────────────────

  adminRouter.get('/construction-sites', async (_req: Request, res: Response) => {
    try {
      const sites = await getAllConstructionSites();
      res.json({ sites });
    } catch (err) {
      logger.error({ err }, 'Admin construction-sites GET error');
      res.status(500).json({ error: 'Internal error' });
    }
  });
  ```

- [ ] **Schritt 3: POST-Endpoint hinzufügen**

  Direkt nach dem GET-Endpoint einfügen:

  ```ts
  adminRouter.post('/construction-sites/:id/complete', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
      const site = await getConstructionSiteById(id);
      if (!site) {
        res.status(404).json({ error: 'Construction site not found' });
        return;
      }
      try {
        await createStructure(site.owner_id, site.type, site.sector_x, site.sector_y);
      } catch (err: any) {
        if (err.code !== '23505') throw err;
        // Duplicate structure — delete site anyway and treat as success
      }
      await deleteConstructionSiteById(site.id);
      constructionBus.emit('completed', {
        siteId: site.id,
        sectorX: site.sector_x,
        sectorY: site.sector_y,
      });
      await logAdminEvent('complete_construction', { siteId: site.id, type: site.type, sectorX: site.sector_x, sectorY: site.sector_y });
      logger.info({ id, type: site.type }, 'Admin completed construction site');
      res.json({ success: true });
    } catch (err) {
      logger.error({ err, id }, 'Admin construction-sites POST complete error');
      res.status(500).json({ error: 'Internal error' });
    }
  });
  ```

- [ ] **Schritt 4: Server-Tests laufen lassen**

  ```bash
  cd packages/server && npx vitest run
  ```
  Erwartet: alle Tests grün.

- [ ] **Schritt 5: Committen**

  ```bash
  git add packages/server/src/adminRoutes.ts
  git commit -m "feat(#231): Admin-Routes GET/POST /admin/construction-sites"
  ```

---

## Chunk 3: Admin-Console — BAUSTELLEN-Tab (#231)

**Files:**
- Modify: `packages/server/src/admin/console.html`

Die console.html ist eine einzelne HTML-Datei mit Vanilla JS. Alle Änderungen müssen dem bestehenden Muster (`el()`, `api()`, `toast()`, `esc()`) folgen.

### Task 3: Neuen Tab in Admin-Console einbauen

- [ ] **Schritt 1: Tab-Button einfügen**

  In `console.html` nach der Zeile:
  ```html
  <div class="tab" data-tab="quadmap">QUAD-MAP</div>
  ```
  Folgendes einfügen:
  ```html
  <div class="tab" data-tab="construction">BAUSTELLEN</div>
  ```

- [ ] **Schritt 2: Tab-Panel einfügen**

  Nach dem schließenden `</div>` von `id="panel-quadmap"` (suche nach `<div class="tab-panel" id="panel-quadmap">` und geh bis zum nächsten Tab-Level-`</div>`) folgendes einfügen:

  ```html
  <div class="tab-panel" id="panel-construction">
    <div class="section-title">Aktive Baustellen</div>
    <div id="construction-empty" class="empty-state" style="display:none">Keine aktiven Baustellen.</div>
    <table class="data-table" id="construction-table">
      <thead>
        <tr>
          <th>Typ</th>
          <th>Sektor</th>
          <th>Fortschritt</th>
          <th>Besitzer-ID</th>
          <th>Aktion</th>
        </tr>
      </thead>
      <tbody id="construction-list"></tbody>
    </table>
  </div>
  ```

- [ ] **Schritt 3: `loadConstructionSites`-Funktion hinzufügen**

  Im Script-Block, nach der `loadStories`-Funktion (suche `function loadStories()`), folgendes einfügen:

  ```js
  function loadConstructionSites() {
    api('GET', '/construction-sites').then(function(data) {
      renderConstructionSites(data.sites || []);
    }).catch(function(err) {
      if (err.message !== 'Unauthorized') toast('Fehler beim Laden der Baustellen: ' + err.message, 'error');
    });
  }

  function renderConstructionSites(sites) {
    var tbody = document.getElementById('construction-list');
    var empty = document.getElementById('construction-empty');
    clearChildren(tbody);

    if (sites.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    sites.forEach(function(site) {
      var tr = el('tr');
      tr.appendChild(el('td', null, esc(site.type)));
      tr.appendChild(el('td', null, esc(site.sector_x) + ', ' + esc(site.sector_y)));
      tr.appendChild(el('td', null, esc(site.progress) + '/100'));
      tr.appendChild(el('td', null, esc(site.owner_id)));

      var actionsTd = el('td');
      var btn = el('button', { className: 'success', style: { fontSize: '10px', padding: '2px 6px' } }, 'Vollenden');
      btn.addEventListener('click', function() {
        if (!confirm('Baustelle ' + site.type + ' bei (' + site.sector_x + ', ' + site.sector_y + ') sofort vollenden?')) return;
        api('POST', '/construction-sites/' + encodeURIComponent(site.id) + '/complete').then(function() {
          toast('Baustelle vollständig!', 'success');
          loadConstructionSites();
        }).catch(function(err) {
          toast('Fehler: ' + err.message, 'error');
        });
      });
      actionsTd.appendChild(btn);
      tr.appendChild(actionsTd);

      tbody.appendChild(tr);
    });
  }
  ```

- [ ] **Schritt 4: `switchTab` und `startRefresh`-Loop erweitern**

  **a) In der `switchTab`-Funktion**, nach der Zeile:
  ```js
  else if (name === 'stories') loadStories();
  ```
  Folgendes einfügen:
  ```js
  else if (name === 'construction') loadConstructionSites();
  ```

  **b) In der `startRefresh`-Funktion** (der `setInterval`-Block der alle 30 s den aktiven Tab refresht), nach der Zeile:
  ```js
  else if (name === 'stories') loadStories();
  ```
  Folgendes einfügen:
  ```js
  else if (name === 'construction') loadConstructionSites();
  ```
  Damit wird die Baulisten-Tabelle auch beim Auto-Refresh aktualisiert.

- [ ] **Schritt 5: Datei speichern und manuell testen**

  Öffne die Admin-Console im Browser. Prüfe:
  - Tab "BAUSTELLEN" erscheint in der Tab-Leiste
  - Klick auf den Tab lädt die Liste (oder zeigt "Keine aktiven Baustellen.")
  - [Vollenden]-Button öffnet `confirm()`, ruft dann POST auf und refresht

- [ ] **Schritt 6: Committen**

  ```bash
  git add packages/server/src/admin/console.html
  git commit -m "feat(#231): Admin-Console BAUSTELLEN-Tab mit Vollenden-Button"
  ```

---

## Abschluss

- [ ] **Finaler Test aller Pakete**

  ```bash
  cd packages/client && npx vitest run
  cd packages/server && npx vitest run
  ```
  Alle Tests grün.

- [ ] **Issues schliessen**

  ```bash
  gh issue close 236 --repo phash/voidSector --comment "Deposit-UI: pro Ressource Slider + Zahl-Input + MAX-Button, implementiert in DetailPanel.tsx"
  gh issue close 231 --repo phash/voidSector --comment "Admin-Route GET/POST /admin/construction-sites + BAUSTELLEN-Tab in Admin-Console"
  ```
