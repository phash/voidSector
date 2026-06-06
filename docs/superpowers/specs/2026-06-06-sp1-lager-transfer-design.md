# SP1 — Cargo↔Lager-Transfer + Install-from-Cargo-Feedback

**Datum:** 2026-06-06 · **Branch:** `feat/sp0-cleanup` (Audit-Fix-Programm) · Teil B des Programms.

## Kontext / Befund
- Die **Lager-Bank** (`storage_inventory`) wird serverseitig von **Handelsrouten** genutzt
  (`WorldService` ~1974–1995), aber Spieler konnten sie nie sehen oder manuell befüllen: der
  `transfer`-Pfad (`client.sendTransfer` → kein Server-Handler) und die Lager-Anzeige existierten
  nur in totem `{false && …}`-Code in `TradeScreen`.
- Issue **#521** ("Aus Cargo installieren") ist **fehletikettiert** — es geht um
  Modul-Install-Feedback, nicht um Transfer. Wird hier mit erledigt (User-Entscheidung).

## Teil A — Cargo↔Lager-Transfer (end-to-end)
**Server (erledigt):**
- `rooms/services/transferDecision.ts` — pure `resolveTransfer(direction, resource, amount,
  shipAmount, storageAmount, shipHasSpaceForAmount)` → `{ok}` | `{ok:false, code, message}`.
  - `toStorage`: Schiff muss `amount` der Ressource halten (Lager ungecappt).
  - `fromStorage`: Lager muss `amount` halten UND Schiff Frachtraum frei haben.
- `WorldService.handleTransfer` — wendet die Entscheidung an (erst entnehmen, dann gutschreiben),
  sendet `transferResult` + `storageUpdate` + `cargoUpdate`. Registriert in `SectorRoom` als
  `transfer`-Message.
- Ressourcen: `ore, gas, crystal, artefact`. Kein Stations-Gate (Lager ist persönliche Bank).

**Client:**
- `transferResult`-Handler: bei Erfolg `showSuccessToast`, bei Fehler `setActionError` (+ Log).
- Neue `LagerPanel.tsx`: pro Ressource Schiff-Menge + Lager-Menge, Mengen-Input,
  `[→ Lager]` (toStorage) / `[→ Schiff]` (fromStorage) Buttons → `network.sendTransfer`.
  Beim Mounten `network.requestStorage()` zum Aktualisieren.
- `TradeScreen`: neuer Tab-Wert `'lager'`, LAGER-Tab-Button nur am Heimat-Stützpunkt (`!isStation`),
  rendert `<LagerPanel/>`. `[?]`-Button + HelpSlice `first_lager` (Pflicht pro neuem Tab).

## Teil B — #521 Install-from-Cargo-Feedback
- **Liste aktualisieren:** `moduleInstalled`-Handler (`client.ts`) ruft zusätzlich
  `getInventory` auf (nicht nur `getModuleInventory`), damit das installierte Modul aus der
  `CargoScreen`-Modulliste (`inventory.filter(itemType==='module')`) verschwindet.
- **Erfolgs-Feedback:** `moduleInstalled`-Handler → `showSuccessToast('Modul installiert')`.
- **Kein-Slot-Feedback:** in `CargoScreen` bei `targetSlot < 0` (bisher stiller No-Op) →
  `setActionError({code:'NO_SLOT', message:'Kein passender Slot frei'})`.

## Tests
- `transferDecision.test.ts` — happy paths + INVALID/INSUFFICIENT/CARGO_FULL.
- Server-Suite + Client-Suite grün (Client via vitest, nicht tsc).

## Verifikation
Heimat-Stützpunkt → TRADE → LAGER: Erz einlagern/entnehmen, Toast + Werte aktualisieren.
CARGO → MODULE → Install: Modul verschwindet, Toast; ohne freien Slot Hinweis.
