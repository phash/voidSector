# UI Bug Sprint — Design Doc
**Datum:** 2026-03-03
**Branch:** fix/ui-bug-sprint
**Issues:** #41, #42, #44, #45 + globale Schriftvergrößerung

---

## Überblick

5 zusammenhängende UI-Fixes + Verbesserungen in einem Branch:
1. UI wächst beim Bewegen (#41)
2. Klappbare Sidebars, 30% breiter, CRT-Effekt (#42)
3. Grid-Labels außerhalb des Grids (#44)
4. Zoom bis 3×3 mit Detailansicht (#45)
5. Globale Schriftvergrößerung

---

## 1. #41 — UI wächst beim Bewegen

**Ursache:** Flex-Container in `StatusBar` und `SectorInfo` (HUD.tsx) haben kein `min-width: 0`. Bei längeren Koordinaten (z.B. `(-100, 200)`) drückt der Text die Flex-Eltern auseinander.

**Fix:**
- `min-width: 0` auf alle Flex-Children in StatusBar und SectorInfo
- `white-space: nowrap` auf Koordinaten-Spans
- Keine strukturelle Änderung nötig

**Dateien:** `packages/client/src/components/HUD.tsx`

---

## 2. #42 — Klappbare Sidebars (unabhängig, 30% breiter, CRT-Effekt)

**Breite:** 320px → 416px

**Kollaps-Mechanik:**
- `leftCollapsed: boolean` + `rightCollapsed: boolean` im UISlice
- Kollabiert auf 32px (schmaler Streifen mit Toggle-Button)
- Toggle-Button: `◀`/`▶` links, `▶`/`◀` rechts, oben an der Sidebar
- CSS-Grid: `grid-template-columns` wechselt dynamisch (`416px` vs. `32px`)

**CRT-Effekt (auf Sidebar-Inhalt):**
```css
@keyframes crt-collapse {
  0%   { transform: scaleX(1);    filter: brightness(1); opacity: 1; }
  60%  { transform: scaleX(0.05); filter: brightness(2); opacity: 1; }
  100% { transform: scaleX(0);    filter: brightness(0); opacity: 0; }
}
@keyframes crt-expand {
  0%   { transform: scaleX(0);    filter: brightness(2); opacity: 0; }
  40%  { transform: scaleX(0.05); filter: brightness(2); opacity: 1; }
  100% { transform: scaleX(1);    filter: brightness(1); opacity: 1; }
}
```
- Animationsdauer: ~250ms
- Layout-Breite transitioniert separat (200ms ease) ohne Glitches

**Dateien:** `packages/client/src/state/uiSlice.ts`, `packages/client/src/components/DesktopLayout.tsx`, `packages/client/src/styles/crt.css`

---

## 3. #44 — Grid-Labels außerhalb des Grids

**Ursache:** `FRAME_LEFT = 32`, Labels bei `x = FRAME_LEFT - 4 = 28` — innerhalb des Grids.

**Fix:**
- `FRAME_LEFT`: 32 → 40px
- `FRAME_BOTTOM`: 20 → 24px
- Labels Y-Achse: gezeichnet bei `x = 20` (zentriert im linken Rand)
- Labels X-Achse: gezeichnet bei `y = h - 6` (unterhalb Grid)
- `calculateVisibleRadius` und Click-Offset-Berechnung entsprechend angepasst

**Dateien:** `packages/client/src/canvas/RadarRenderer.ts`, `packages/client/src/components/RadarCanvas.tsx`

---

## 4. #45 — Zoom bis 3×3 mit Detailansicht

**Neuer Zoom-Level 4:**
- Zellgröße dynamisch: `Math.floor(canvasW / 3)` × `Math.floor(canvasH / 3)`
- Pan bei Zoom 4 deaktiviert (Schiff immer mittig)
- Wheel-Handler: `Math.min(3, ...)` → `Math.min(4, ...)`

**Detailinhalt pro Zelle bei Zoom 4:**
```
[STATION]       ← Sektor-Typ (groß, oben)
Ore:  45        ← Ressourcen (aus discoveries)
Gas:  12
Cry:   3
~14d ago        ← Entdeckungsalter (aus discoveryTimestamps)
```
- Ressourcen nur anzeigen wenn vorhanden (> 0)
- Alter: `< 1h`, `Xh`, `Xd`, kein Eintrag = unbekannt

**Dateien:** `packages/client/src/canvas/RadarRenderer.ts`, `packages/client/src/components/RadarCanvas.tsx`

---

## 5. Globale Schriftvergrößerung

**Änderung:** `font-size: 18px` auf `:root` (Browser-Default 16px)

**Effekt:**
- Alle `rem`-Werte skalieren automatisch (+12.5%)
- Canvas-Fonts (`CELL_SIZES.fontSize` in px) bleiben unverändert
- Sidebars gleichzeitig breiter → kein Overflow

**Dateien:** `packages/client/src/styles/global.css`

---

## Nicht im Scope

- Banner/Icons (#30) — separater Issue
- Qualität/Tests (#46, #47) — nächster Sprint
- Features (#43, #48) — übernächster Sprint

---

## Teststrategie

- Alle bestehenden 286 Tests müssen weiter grünen
- Manuelle Checks:
  - [ ] Layout bei (-999, 999) bleibt stabil
  - [ ] Sidebar links/rechts unabhängig klappbar, CRT-Effekt sichtbar
  - [ ] Grid-Labels links/unten außerhalb der Zellen
  - [ ] Zoom Stufe 4 zeigt 3×3 mit Ressourcen-Details
  - [ ] Schrift überall größer, kein Overflow
