# UX-Audit — Phase 3-N (FACTION + SHIP-SYS Detail Panels)

*2026-03-11 · Post-Merge-Audit nach PR #253*

---

## 🔴 Bugs (falsch oder broken)

### 1. ManagementTab: Recruiting-State wird nicht initialisiert

`ManagementTab` nutzt `useState(false)` und `useState('')` — die tatsächlichen Werte aus dem Server (`faction.is_recruiting`, `faction.slogan`) werden nie gelesen, weil `is_recruiting` nicht mal in `ClientFactionData` existiert. Ein Fraktions-Leader sieht die Checkbox immer als "deaktiviert", auch wenn die Fraktion bereits aktiv rekrutiert. Der Slogan ist immer leer. **Speichern überschreibt den echten Zustand mit Falschwerten.**

**Fix:** `is_recruiting` + `slogan` zu `ClientFactionData` hinzufügen, Server schickt sie im `factionData`-Handler. `useState` mit echten Werten initialisieren.

### 2. FactionRecruitPanel: `[FRAKTIONSNAME →]` Button führt ins Nirgendwo

Der Button navigiert zu `setMonitorMode(MONITORS.FACTION, 'info')`. Das öffnet den INFO-Tab in FactionScreen, der nichts über die gewählte Fraktion zeigt — er zeigt schlicht keine Fraktion (weil der User keine hat). Das ist komplett kaputt. Die Spec verlangte `selectedFactionId` setzen + zu einer Fraktions-Infopage navigieren. Beides fehlt.

**Fix:** Entweder (a) `selectedFactionId` in FactionScreen-State einführen und gezielt die gewählte Fraktion anzeigen, oder (b) Button-Aktion auf etwas Sinnvolles umlenken (z.B. Fraktion im Fullscreen anzeigen).

### 3. ShipDetailPanel: Slot-Berechnung frei erfunden

`Math.max(installedModules.length + 2, 3)` ist keine Businesslogik, das ist Raten. `ClientShipData` hat kein `maxSlots`-Feld. `acepEffects.extraModuleSlots` ist vorhanden aber wird nicht genutzt. Tatsächliche Slot-Kapazität ist dem Client unbekannt.

**Fix:** Server schickt `maxSlots` im `shipList`-Handler (aus `ShipHullDef` berechnet + ACEP-Bonus). Client zeigt dann korrekte Kapazität.

---

## 🟠 UX-Schwächen (funktioniert, aber schlecht)

### 4. InfoTab ist quasi leer

```
Modus: INVITE | 3 Mitglieder
```

Das ist der gesamte Inhalt des `[INFO]`-Tabs. Kein Gründungsdatum, keine Fraktionsbeschreibung, kein Join-Code-Hinweis, kein "was kann die Fraktion bereits?". Dieser Tab wird als Default gezeigt wenn man FACTION öffnet — das erste was ein Mitglied sieht, ist fast nichts.

### 5. "NÄCHSTER UPGRADE" zeigt keine Upgrade-Optionen

`→ TIER 2 — 5000 CR` sagt dem Spieler nichts. Er weiß nicht, zwischen welchen zwei Optionen er (als Leader) wählen müsste. Minimal wäre: `→ TIER 2: Cargo +20% vs. Scan +2`.

**Fix:** `nextTierDef.optionA.effect` + `nextTierDef.optionB.effect` in der Anzeige nutzen.

### 6. Generationsanzeige fehlt im ShipDetailPanel

Die Spec zeigt `⬡ NIGHTFALL · GEN 2`. `acepGeneration` ist in `ClientShipData` vorhanden, wird aber nicht angezeigt. Generation ist das einzige persistente ACEP-Legacymerkmal nach Permadeath — besonders bedeutsam.

**Fix:** Trivial — `{ship.acepGeneration && ship.acepGeneration > 1 ? ` · GEN ${ship.acepGeneration}` : ''}` im Header.

### 7. Module-Namen als rohe IDs

`mining_laser` → `"mining laser"` (lowercase, kein Display-Name). Das sieht unfertig aus.

**Fix:** `moduleId.replace(/_/g, ' ')` durch Title-Case ersetzen, oder eine Display-Name-Map aus shared nutzen.

### 8. Alle Traits haben dieselbe rote Farbe

`⬡ VETERAN · ⬡ RECKLESS · ⬡ CAUTIOUS` — alle rot. Veteran ist positiv, Reckless ist riskant, Cautious ist defensiv. Keine visuelle Differenzierung.

**Fix:** Trait-Farbmap aus `traitCalculator.ts` ableiten (positiv = grün/cyan, riskant = orange, neutral = grau).

### 9. `[MGMT]`-Tab für Nicht-Leader irreführend

Nicht-Leader sehen den Tab `[MGMT]` und klicken ihn an — drinnen ist nur `[VERLASSEN]`. Misleading Tab-Label für eine Verlassen-Aktion.

**Fix:** `[MGMT]`-Tab nur für `isLeader || isOfficer` anzeigen. `[VERLASSEN]`-Button direkt im `[INFO]`- oder `[MEMBERS]`-Tab zugänglich machen.

### 10. Upgrade-Namen ohne Effekte in FactionMemberPanel

`✓ Warehouse Expansion  ✓ Enhanced Scanners` ohne Effektbeschreibung ist nutzlos.

**Fix:** `FACTION_UPGRADE_TIERS[u.tier][u.choice === 'A' ? 'optionA' : 'optionB'].effect` nutzen — zeige `✓ Cargo +20%  ✓ Scan +2`.

---

## 🟡 Design-Issues (ästhetisch oder inkonsistent)

### 11. Sprach-Chaos in FactionScreen

| Wo | Sprache |
|----|---------|
| Tab-Labels | Englisch (`[INFO]`, `[MEMBERS]`, `[UPGRADES]`, `[MGMT]`) |
| Tab-Inhalte | Deutsch (`Modus:`, `Mitglieder`, `Einladungen`) |
| NoFactionView Headline | Englisch (`NOT IN A FACTION`, `Open QUESTS`) |
| NoFactionView Buttons | Deutsch (`[GRÜNDEN]`, `[BEITRETEN]`) |
| Recruiting-Section | Deutsch (`AKTIV REKRUTIEREN`, `Slogan`) |

Muss in eine Sprache vereinheitlicht werden (Empfehlung: Englisch, da das Cockpit-Thema Space-Terminal ist).

### 12. "NO CONNECTION TO NETWORK..." ist eine Lüge

Wenn keine Fraktionen rekrutieren, zeigt `FactionRecruitPanel` `NO CONNECTION TO NETWORK...` — aber die Verbindung steht. Besserer Text: `NO OPEN RECRUITMENT`.

---

## Prioritätsliste

| # | Problem | Datei | Aufwand | Impact |
|---|---------|-------|---------|--------|
| 1 | Recruiting-State nicht initialisiert | `FactionScreen.tsx`, `gameSlice.ts`, Server | Mittel | 🔴 Hoch — Datenverlust |
| 2 | `[→]`-Button kaputt in RecruitPanel | `FactionDetailPanel.tsx` | Mittel | 🔴 Hoch — Feature broken |
| 3 | Slot-Berechnung falsch | `ShipDetailPanel.tsx`, Server | Mittel | 🟠 Mittel |
| 4 | InfoTab leer | `FactionScreen.tsx` | Klein | 🟠 Mittel |
| 5 | Nächster Upgrade ohne Optionsinfo | `FactionDetailPanel.tsx` | Trivial | 🟠 Mittel |
| 9 | MGMT-Tab für Nicht-Leader | `FactionScreen.tsx` | Klein | 🟠 Mittel |
| 11 | Sprach-Chaos | `FactionScreen.tsx` | Mittel | 🟠 Mittel |
| 6 | Generation fehlt im Ship-Header | `ShipDetailPanel.tsx` | Trivial | 🟡 Niedrig |
| 7 | Module rohe IDs | `ShipDetailPanel.tsx` | Klein | 🟡 Niedrig |
| 8 | Alle Traits gleiche Farbe | `ShipDetailPanel.tsx` | Klein | 🟡 Niedrig |
| 10 | Upgrade-Effekte fehlen im Member-Panel | `FactionDetailPanel.tsx` | Trivial | 🟡 Niedrig |
| 12 | Falsche "NO CONNECTION" Meldung | `FactionDetailPanel.tsx` | Trivial | 🟡 Niedrig |
